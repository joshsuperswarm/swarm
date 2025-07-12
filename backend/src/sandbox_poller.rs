//! Unified, non‑blocking sandbox status poller
//!
//! This replaces both `sandbox::status_poller::poll_running_sandboxes` (log‑only)
//! **and** the legacy `sandbox_poller` that lived in `main.rs` (full state
//! machine).  It keeps the fast, concurrent, <100 ms sweep goal while also
//! performing status transitions – so tasks can finally march from
//! **spinning → running → done / failed**.
//!
//! ### Usage
//! ```rust
//! // main.rs – start the poller once at boot
//! tokio::spawn(sandbox_poller::run(database.clone(), config.clone()));
//! ```
//! Delete the old spawn for `run_sandbox_status_poller`.
//!
//! ---

use crate::{
    config::Config,
    database::Database,
    sandbox::{self, DynSandbox, SandboxProvider, SandboxStatus},
};
use std::{sync::Arc, time::Duration};
use tokio::time::{sleep, Instant};
use tracing::{debug, error, info, warn};

// ——————————————————————————————————————————————————————————————
//  Provider factory (Modal first, Daytona fallback)
// ——————————————————————————————————————————————————————————————
fn provider_from_config(config: &Config) -> Option<DynSandbox> {
    if let Some(url) = &config.modal_url {
        Some(Arc::new(sandbox::modal::ModalProvider::new(
            url.clone(),
            config.modal_region.clone(),
        )))
    } else if let (Some(url), Some(key)) = (&config.daytona_url, &config.daytona_api_key) {
        Some(Arc::new(sandbox::daytona::DaytonaProvider::new(
            url.clone(),
            key.clone(),
            config.daytona_organization_id.clone(),
            config.daytona_region.clone(),
        )))
    } else {
        None
    }
}

// ——————————————————————————————————————————————————————————————
//  Public entry‑point – spawn this once at boot
// ——————————————————————————————————————————————————————————————
pub async fn run(database: Database, config: Config) {
    info!("→ unified status poller online");

    loop {
        let cycle_start = Instant::now();
        if let Err(e) = poll_once(&database, &config).await {
            error!("poller cycle error: {e}");
        }
        let elapsed = cycle_start.elapsed();
        if elapsed.as_millis() > 100 {
            warn!(
                "poller cycle took {} ms (target <100 ms)",
                elapsed.as_millis()
            );
        } else {
            debug!("poller cycle {} ms", elapsed.as_millis());
        }
        sleep(Duration::from_secs(10)).await; // configurable
    }
}

// ——————————————————————————————————————————————————————————————
//  One polling cycle
// ——————————————————————————————————————————————————————————————
async fn poll_once(database: &Database, config: &Config) -> anyhow::Result<()> {
    // 1. resolve provider – if none configured just bail early (don't spam DB).
    let provider = match provider_from_config(config) {
        Some(p) => p,
        None => {
            debug!("no sandbox provider configured – skipping poll");
            return Ok(());
        }
    };

    // 2. fetch candidate tasks (spinning or running)
    let rows = sqlx::query!(
        r#"SELECT id,
                  daytona_sandbox_id  AS sandbox_id,
                  daytona_session_id AS session_id,
                  daytona_command_id AS command_id,
                  status
           FROM   tasks
           WHERE  daytona_sandbox_id IS NOT NULL
           AND    status IN ('spinning','running')"#
    )
    .fetch_all(&database.pool)
    .await?;

    if rows.is_empty() {
        debug!("no active tasks");
        return Ok(());
    }

    info!("polling {} active tasks concurrently", rows.len());

    // 3. process each task concurrently – **no DB writes on critical path**
    let mut handles = Vec::new();
    for row in rows {
        let task_id = row.id;
        let sandbox_id = row.sandbox_id.clone();
        let session_id = row.session_id.clone();
        let command_id = row.command_id.clone();
        let status = row.status.clone();
        let db = database.clone();
        let p = provider.clone();
        let config_clone = config.clone();
        let handle = tokio::spawn(async move {
            if let Err(e) = handle_task(
                &db,
                p.as_ref(),
                task_id,
                sandbox_id,
                session_id,
                command_id,
                status,
                &config_clone,
            )
            .await
            {
                warn!("task {} poll error: {e}", task_id);
            }
        });
        handles.push(handle);
    }

    // Wait for all handles to complete
    for handle in handles {
        let _ = handle.await;
    }
    Ok(())
}

// ——————————————————————————————————————————————————————————————
//  Per‑task processing – distilled from the legacy poller
// ——————————————————————————————————————————————————————————————
#[allow(clippy::too_many_lines)]
async fn handle_task(
    db: &Database,
    provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: Option<String>,
    session_id: Option<String>,
    command_id: Option<String>,
    status: Option<String>,
    config: &Config,
) -> anyhow::Result<()> {
    let sandbox_id = sandbox_id.ok_or_else(|| anyhow::anyhow!("missing sandbox_id"))?;
    let session_id = session_id.unwrap_or_default();
    let command_id = command_id.unwrap_or_default();
    let current_status = status.unwrap_or_else(|| "spinning".to_string());

    // 1. try exit‑code first – fast path
    if let Ok(Some(code)) = provider
        .get_command_exit_code(&sandbox_id, &session_id, &command_id)
        .await
    {
        if code == 0 {
            finalize_success(db, provider, task_id, &sandbox_id, &command_id, config).await?;
        } else {
            mark_failed(db, provider, task_id, &sandbox_id).await?;
        }
        return Ok(());
    }

    // 2. otherwise check sandbox status
    match provider.get_sandbox_status(&sandbox_id).await? {
        SandboxStatus::Running => {
            if current_status == "spinning" {
                db.update_task_status(task_id, "running", None).await?;
                info!("task {task_id} → running");
            }
            // lightweight log pulse (non‑blocking) - use provider-specific log collection
            if let Some(modal_url) = &config.modal_url {
                let modal = sandbox::modal::ModalProvider::new(
                    modal_url.clone(),
                    config.modal_region.clone(),
                );
                let _ = modal
                    .pull_logs_once(db, task_id, &sandbox_id, &command_id)
                    .await;
            }
        }
        SandboxStatus::Stopped => mark_failed(db, provider, task_id, &sandbox_id).await?,
        SandboxStatus::Failed => mark_failed(db, provider, task_id, &sandbox_id).await?,
        SandboxStatus::Starting => {
            debug!("task {task_id} sandbox still starting");
        }
    }

    Ok(())
}

// ——————————————————————————————————————————————————————————————
//  Helpers
// ——————————————————————————————————————————————————————————————
async fn finalize_success(
    db: &Database,
    _provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: &str,
    command_id: &str,
    config: &Config,
) -> anyhow::Result<()> {
    info!("task {task_id} finished with exit‑code 0 – collecting logs & pushing");

    // Use provider-specific log collection on success
    if let Some(modal_url) = &config.modal_url {
        let modal =
            sandbox::modal::ModalProvider::new(modal_url.clone(), config.modal_region.clone());
        modal
            .pull_logs_once(db, task_id, sandbox_id, command_id)
            .await
            .ok();
    }
    db.update_task_status(task_id, "done", None).await?;

    // Let old `handle_task_success` (in main.rs) deal with PR creation – it
    // already runs atomically when status flips to `done`.
    Ok(())
}

async fn mark_failed(
    db: &Database,
    provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: &str,
) -> anyhow::Result<()> {
    warn!("task {task_id} marked failed – cleaning up");
    db.update_task_status(task_id, "failed", None).await?;
    provider.delete_sandbox(sandbox_id).await.ok();
    Ok(())
}
