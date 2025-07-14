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
    sandbox::{self, DynSandbox, SandboxProvider, SandboxStatus},
    AppState,
};
use std::{sync::Arc, time::Duration};
use tokio::time::{sleep, Instant};
use tracing::{debug, error, info, warn};

// ——————————————————————————————————————————————————————————————
//  Helper functions
// ——————————————————————————————————————————————————————————————
fn has_required_artifacts(task: &crate::models::Task) -> bool {
    task.commit_title.is_some() && task.pr_title.is_some() && task.pr_body.is_some()
}

// ——————————————————————————————————————————————————————————————
//  Provider factory (Modal only)
// ——————————————————————————————————————————————————————————————
fn provider_from_config(config: &Config) -> Option<DynSandbox> {
    if let Some(url) = &config.modal_url {
        Some(Arc::new(sandbox::modal::ModalProvider::new(
            url.clone(),
            config.modal_region.clone(),
        )))
    } else {
        None
    }
}

// ——————————————————————————————————————————————————————————————
//  Public entry‑point – spawn this once at boot
// ——————————————————————————————————————————————————————————————
pub async fn run(app_state: AppState) {
    info!("→ unified status poller online");

    loop {
        let cycle_start = Instant::now();
        if let Err(e) = poll_once(&app_state).await {
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
async fn poll_once(app_state: &AppState) -> anyhow::Result<()> {
    // 1. resolve provider – if none configured just bail early (don't spam DB).
    let provider = match provider_from_config(&app_state.config) {
        Some(p) => p,
        None => {
            debug!("no sandbox provider configured – skipping poll");
            return Ok(());
        }
    };

    // 2. fetch candidate tasks (spinning or running)
    let rows = sqlx::query!(
        r#"SELECT id,
                  sandbox_id,
                  session_id,
                  command_id,
                  status
           FROM   tasks
           WHERE  sandbox_id IS NOT NULL
           AND    status IN ('spinning','running')"#
    )
    .fetch_all(&app_state.database.pool)
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
        let app_state_clone = app_state.clone();
        let p = provider.clone();
        let handle = tokio::spawn(async move {
            if let Err(e) = handle_task(
                &app_state_clone,
                p.as_ref(),
                task_id,
                sandbox_id,
                session_id,
                command_id,
                status,
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
    app_state: &AppState,
    provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: Option<String>,
    session_id: Option<String>,
    command_id: Option<String>,
    status: Option<String>,
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
            // Task completed successfully, now poll for artifacts
            wait_for_artifacts(app_state, provider, task_id, &sandbox_id, &command_id).await?;
        } else {
            mark_failed(app_state, provider, task_id, &sandbox_id).await?;
        }
        return Ok(());
    }

    // 2. otherwise check sandbox status
    match provider.get_sandbox_status(&sandbox_id).await? {
        SandboxStatus::Running => {
            if current_status == "spinning" {
                app_state
                    .database
                    .update_task_status(task_id, "running", None)
                    .await?;
                info!("task {task_id} → running");
            }
            // lightweight log pulse (non‑blocking) - use provider-specific log collection
            if let Some(modal_url) = &app_state.config.modal_url {
                let modal = sandbox::modal::ModalProvider::new(
                    modal_url.clone(),
                    app_state.config.modal_region.clone(),
                );
                let _ = modal
                    .pull_logs_once(&app_state.database, task_id, &sandbox_id, &command_id)
                    .await;
            }
        }
        SandboxStatus::Stopped => mark_failed(app_state, provider, task_id, &sandbox_id).await?,
        SandboxStatus::Failed => mark_failed(app_state, provider, task_id, &sandbox_id).await?,
        SandboxStatus::Starting => {
            debug!("task {task_id} sandbox still starting");
        }
    }

    Ok(())
}

// ——————————————————————————————————————————————————————————————
//  Helpers
// ——————————————————————————————————————————————————————————————
async fn wait_for_artifacts(
    app_state: &AppState,
    provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: &str,
    command_id: &str,
) -> anyhow::Result<()> {
    info!("task {task_id} finished with exit‑code 0 – waiting for artifacts");

    // Poll for artifacts with timeout
    let timeout_duration = Duration::from_secs(30); // 30 seconds
    let poll_interval = Duration::from_secs(2);
    let start_time = Instant::now();

    loop {
        // Pull logs to collect any new artifacts
        if let Some(modal_url) = &app_state.config.modal_url {
            let modal = sandbox::modal::ModalProvider::new(
                modal_url.clone(),
                app_state.config.modal_region.clone(),
            );
            let _ = modal
                .pull_logs_once(&app_state.database, task_id, sandbox_id, command_id)
                .await;
        }

        // Check if we have all required artifacts
        if let Ok(Some(task)) = app_state.database.get_task_by_id(task_id).await {
            if has_required_artifacts(&task) {
                info!("task {task_id} has all required artifacts – proceeding to finalize");
                return finalize_success(app_state, provider, task_id, sandbox_id, command_id)
                    .await;
            }
        }

        // Check timeout
        if start_time.elapsed() > timeout_duration {
            warn!("task {task_id} timed out waiting for artifacts after 30 seconds");
            return finalize_success(app_state, provider, task_id, sandbox_id, command_id).await;
        }

        // Wait before next poll
        sleep(poll_interval).await;
    }
}

async fn finalize_success(
    app_state: &AppState,
    _provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: &str,
    command_id: &str,
) -> anyhow::Result<()> {
    info!("task {task_id} finished with exit‑code 0 – collecting logs & pushing");

    // Use provider-specific log collection on success
    if let Some(modal_url) = &app_state.config.modal_url {
        let modal = sandbox::modal::ModalProvider::new(
            modal_url.clone(),
            app_state.config.modal_region.clone(),
        );
        modal
            .pull_logs_once(&app_state.database, task_id, sandbox_id, command_id)
            .await
            .ok();
    }
    app_state
        .database
        .update_task_status(task_id, "done", None)
        .await?;

    // Spawn handle_task_success for PR creation
    info!("task {task_id} → done, spawning PR creation");
    let app_state_clone = app_state.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::handle_task_success(app_state_clone, task_id).await {
            error!("Error handling task {} success: {}", task_id, e);
        }
    });

    Ok(())
}

async fn mark_failed(
    app_state: &AppState,
    provider: &dyn SandboxProvider,
    task_id: i32,
    sandbox_id: &str,
) -> anyhow::Result<()> {
    warn!("task {task_id} marked failed – cleaning up");
    app_state
        .database
        .update_task_status(task_id, "failed", None)
        .await?;
    provider.delete_sandbox(sandbox_id).await.ok();
    Ok(())
}
