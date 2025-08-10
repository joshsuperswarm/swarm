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
    let mut cycle_count = 0;

    loop {
        let cycle_start = Instant::now();
        cycle_count += 1;

        if let Err(e) = poll_once(&app_state).await {
            error!("poller cycle error: {e}");
        }

        let elapsed = cycle_start.elapsed();
        if elapsed.as_millis() > 100 {
            warn!(
                "poller cycle {} took {} ms (target <100 ms)",
                cycle_count,
                elapsed.as_millis()
            );
        } else {
            debug!(
                "poller cycle {} completed in {} ms",
                cycle_count,
                elapsed.as_millis()
            );
        }

        // Heartbeat every 60 seconds (6 cycles)
        if cycle_count % 6 == 0 {
            info!("poller heartbeat: {} cycles completed", cycle_count);
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

    // 2. fetch candidate runs (spinning or running)
    let rows = sqlx::query!(
        r#"SELECT id,
                  task_id,
                  sandbox_id,
                  session_id,
                  command_id,
                  status
           FROM   runs
           WHERE  sandbox_id IS NOT NULL
           AND    status IN ('spinning','running')"#
    )
    .fetch_all(&app_state.database.pool)
    .await?;

    if rows.is_empty() {
        info!("no active runs to poll");
        return Ok(());
    }

    info!("polling {} active runs concurrently", rows.len());

    // 3. process each run concurrently – **no DB writes on critical path**
    let mut handles = Vec::new();
    for row in rows {
        let run_id = row.id;
        let task_id = row.task_id;
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
                run_id,
                task_id,
                sandbox_id,
                session_id,
                command_id,
                status,
            )
            .await
            {
                warn!("run {} / task {} poll error: {e}", run_id, task_id);
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
//  Per‑run processing – distilled from the legacy poller
// ——————————————————————————————————————————————————————————————
#[allow(clippy::too_many_lines)]
async fn handle_task(
    app_state: &AppState,
    provider: &dyn SandboxProvider,
    run_id: i32,
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
            // Task completed successfully, now process final message for PR synthesis
            wait_for_final_message(
                app_state,
                provider,
                run_id,
                task_id,
                &sandbox_id,
                &command_id,
            )
            .await?;
        } else {
            mark_failed(app_state, provider, run_id, task_id, &sandbox_id).await?;
        }
        return Ok(());
    }

    // 2. otherwise check sandbox status
    match provider.get_sandbox_status(&sandbox_id).await? {
        SandboxStatus::Running => {
            if current_status == "spinning" {
                app_state
                    .database
                    .update_run_status(run_id, "running")
                    .await?;
                info!("run {} / task {} → running", run_id, task_id);
            }
            // lightweight log pulse (non‑blocking) - use provider-specific log collection
            if let Some(modal_url) = &app_state.config.modal_url {
                let modal = sandbox::modal::ModalProvider::new(
                    modal_url.clone(),
                    app_state.config.modal_region.clone(),
                );
                let _ = modal
                    .pull_logs_once(
                        &app_state.database,
                        task_id,
                        run_id,
                        &sandbox_id,
                        &command_id,
                    )
                    .await;
            }
        }
        SandboxStatus::Stopped => {
            mark_failed(app_state, provider, run_id, task_id, &sandbox_id).await?
        }
        SandboxStatus::Failed => {
            mark_failed(app_state, provider, run_id, task_id, &sandbox_id).await?
        }
        SandboxStatus::Starting => {
            debug!("task {task_id} sandbox still starting");
        }
    }

    Ok(())
}

// ——————————————————————————————————————————————————————————————
//  Helpers
// ——————————————————————————————————————————————————————————————
async fn wait_for_final_message(
    app_state: &AppState,
    provider: &dyn SandboxProvider,
    run_id: i32,
    task_id: i32,
    sandbox_id: &str,
    command_id: &str,
) -> anyhow::Result<()> {
    info!("task {task_id} finished with exit‑code 0 – waiting for final message");

    // Ensure last logs pulled after exit to capture the final message
    if let Some(modal_url) = &app_state.config.modal_url {
        let modal = sandbox::modal::ModalProvider::new(
            modal_url.clone(),
            app_state.config.modal_region.clone(),
        );
        let _ = modal
            .pull_logs_once(&app_state.database, task_id, run_id, sandbox_id, command_id)
            .await;
    }

    let run = app_state.database.get_run_by_id(run_id).await?
        .ok_or_else(|| anyhow::anyhow!("Run {} not found", run_id))?;

    let final_md = run.final_message_md.clone().unwrap_or_default();

    if final_md.trim().is_empty() {
        tracing::error!("Run {} has no final message; cannot synthesize PR", run_id);
        app_state.database.update_run_status(run_id, "failed").await?;
        return Err(anyhow::anyhow!("No final message to synthesize PR from"));
    }

    // Synthesize PR from the final message
    let api_key = app_state.config.anthropic_api_key.clone()
        .ok_or_else(|| anyhow::anyhow!("No Anthropic API key configured"))?;
    
    match crate::claude::synthesize_pr_from_agent_output(&final_md, &api_key).await {
        Ok((pr_title, pr_body)) => {
            // Save PR artifacts to task
            app_state.database
                .set_task_pr_artifacts(task_id, Some(pr_title.clone()), Some(pr_body.clone()))
                .await?;

            // Also set a commit title/body (short form)
            let commit_title = pr_title.chars().take(72).collect::<String>();
            app_state.database
                .set_run_artifacts(run_id, Some(commit_title), None)
                .await?;

            info!("Successfully synthesized PR for task {} from final message", task_id);

            return finalize_success(
                app_state, provider, run_id, task_id, sandbox_id, command_id, &run.mode,
            )
            .await;
        }
        Err(e) => {
            tracing::error!("PR synthesis failed for task {}: {}", task_id, e);
            app_state.database.update_run_status(run_id, "failed").await?;
            return Err(anyhow::anyhow!("PR synthesis failed: {}", e));
        }
    }
}

async fn finalize_success(
    app_state: &AppState,
    provider: &dyn SandboxProvider,
    run_id: i32,
    task_id: i32,
    sandbox_id: &str,
    _command_id: &str,
    run_mode: &str,
) -> anyhow::Result<()> {
    info!("task {task_id} finalizing success");

    // Fetch comment artifacts after successful completion for plan and review modes
    // Only fetch artifacts for plan and review modes - execute mode doesn't generate artifacts
    if run_mode == "plan" || run_mode == "review" {
        match provider.fetch_artifact(sandbox_id, task_id, run_mode).await {
            Ok((body_md, sha)) => {
                if let Err(e) = app_state
                    .database
                    .upsert_message(task_id, run_id, run_mode, &body_md, &sha, "assistant")
                    .await
                {
                    warn!(
                        "Failed to store {} artifact for task {}: {}",
                        run_mode, task_id, e
                    );
                } else {
                    info!(
                        "Successfully stored {} artifact for task {}",
                        run_mode, task_id
                    );
                }
            }
            Err(e) => {
                // Log but don't fail the task - artifacts are optional
                info!(
                    "No {} artifact found for task {} or fetch failed: {}",
                    run_mode, task_id, e
                );
            }
        }
    } else {
        info!(
            "Skipping artifact fetch for {} mode - no artifacts expected",
            run_mode
        );
    }

    app_state.database.update_run_status(run_id, "done").await?;

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
    run_id: i32,
    task_id: i32,
    sandbox_id: &str,
) -> anyhow::Result<()> {
    warn!(
        "run {} / task {} marked failed – cleaning up",
        run_id, task_id
    );
    app_state
        .database
        .update_run_status(run_id, "failed")
        .await?;
    provider.delete_sandbox(sandbox_id).await.ok();
    Ok(())
}
