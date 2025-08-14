use crate::claude;
use crate::models::Task;
use crate::sandbox::{SandboxInfo, SandboxProvider};
use crate::AppState;
use anyhow::Result;
use tracing::instrument;

/// Runs the full task pipeline in a detached tokio task
///
/// This function extracts all heavy operations from the HTTP handler:
/// - GitHub token retrieval/validation
/// - Anthropic API key validation
/// - Sandbox creation
/// - Task workspace updates
/// - Command ID storage
///
/// On any error, marks the task as "failed" in the database.
#[instrument(skip_all, fields(task_id = task.id))]
pub async fn run_full_task_pipeline(
    app_state: AppState,
    task: Task,
    mode: &str,
    model: &str,
    description: &str,
) -> Result<()> {
    tracing::info!("Starting task pipeline for task {}", task.id);

    // Create a new run for this task
    let run = match app_state.database.create_run(task.id, mode, model).await {
        Ok(run) => run,
        Err(e) => {
            tracing::error!("Failed to create run for task {}: {}", task.id, e);
            // Note: This failure happens before run creation, so no run to update status on
            return Err(anyhow::anyhow!("Failed to create run: {}", e));
        }
    };
    tracing::info!("Using run {} for task {}", run.id, task.id);


    // Get the user from the task
    let user = match app_state.database.get_user_by_id(task.user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            tracing::error!("User {} not found for task {}", task.user_id, task.id);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("User not found"));
        }
        Err(e) => {
            tracing::error!("Database error getting user {}: {}", task.user_id, e);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Database error: {}", e));
        }
    };

    // Get the repository from the task
    let repository = match app_state
        .database
        .get_repository_by_id(task.repository_id, task.user_id)
        .await
    {
        Ok(Some(repo)) => repo,
        Ok(None) => {
            tracing::error!(
                "Repository {} not found for task {}",
                task.repository_id,
                task.id
            );
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Repository not found"));
        }
        Err(e) => {
            tracing::error!(
                "Database error getting repository {}: {}",
                task.repository_id,
                e
            );
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Database error: {}", e));
        }
    };

    // Get GitHub token for the user
    let github_token = match app_state.database.get_github_token(user.id).await {
        Ok(Some(token)) => token.access_token,
        Ok(None) => {
            tracing::error!(
                "No GitHub token available for user {} in task {}",
                user.id,
                task.id
            );
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("No GitHub token available"));
        }
        Err(e) => {
            tracing::error!("Error fetching GitHub token for user {}: {}", user.id, e);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Error fetching GitHub token: {}", e));
        }
    };

    // Get user's stored API keys
    let (anthropic_api_key_opt, openai_api_key_opt) =
        crate::onboarding::get_decrypted_api_keys_for_user(
            &app_state.database,
            &app_state.config,
            user.id,
        )
        .await?;

    let anthropic_api_key = match anthropic_api_key_opt {
        Some(k) => k,
        None => {
            tracing::error!("No Anthropic API key stored for user {}", user.id);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("No Anthropic API key for user"));
        }
    };

    // Only generate title if task doesn't have one (first run)
    let title = if task.title.trim().is_empty() {
        let generated_title = claude::generate_title(description, &anthropic_api_key)
            .await
            .unwrap_or_else(|_| "Untitled task".into());

        app_state
            .database
            .update_task_title(task.id, &generated_title)
            .await?;

        tracing::info!("Generated title for task {}: {}", task.id, generated_title);
        generated_title
    } else {
        tracing::info!("Task {} already has title: {}", task.id, task.title);
        task.title.clone()
    };

    // Determine branch name with reuse logic
    let branch = determine_branch_for_task(&app_state, task.id, mode).await?;
    let author_name = match user.github_username.clone() {
        Some(username) => username,
        None => {
            if mode == "chat" {
                // Chat mode doesn't need GitHub username, use placeholder
                tracing::info!(
                    "No GitHub username available for user {} in chat task {}, using placeholder",
                    user.id,
                    task.id
                );
                "chat-user".to_string()
            } else {
                tracing::error!(
                    "No GitHub username available for user {} in task {}",
                    user.id,
                    task.id
                );
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Err(anyhow::anyhow!("No GitHub username available"));
            }
        }
    };
    let author_email = match user.email.clone() {
        Some(email) => email,
        None => {
            tracing::error!(
                "No email available for user {} in task {}",
                user.id,
                task.id
            );
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("No email available"));
        }
    };

    // Update run with branch name
    match app_state.database.update_run_branch(run.id, &branch).await {
        Ok(_) => {
            tracing::info!("Updated run {} with branch {}", run.id, branch);
        }
        Err(e) => {
            tracing::error!(
                "Error updating run {} with branch {}: {}",
                run.id,
                branch,
                e
            );
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Error updating run branch: {}", e));
        }
    }

    // Start sandbox
    let repo_url = format!("https://github.com/{}", repository.full_name);
    let prompt = if description.is_empty() {
        title.clone()
    } else {
        description.to_string()
    };

    // Update run status to spinning immediately before sending request to modal
    if let Err(e) = app_state
        .database
        .update_run_status(run.id, "spinning")
        .await
    {
        tracing::error!("Failed to update run {} status to spinning: {}", run.id, e);
    } else {
        tracing::info!("task {} / run {} → spinning", task.id, run.id);
    }

    // Check for existing active sandbox for this task
    let (sandbox_info, is_reused) = if let Some((existing_sandbox, old_run_id)) =
        find_reusable_session(&app_state, task.id, &branch).await?
    {
        tracing::info!(
            "Reusing existing sandbox {} from run {} for task {}",
            existing_sandbox.id,
            old_run_id,
            task.id
        );
        // Clear idle timeout on the OLD run to prevent it from cleaning up the sandbox
        if let Err(e) = app_state.database.clear_run_idle_timeout(old_run_id).await {
            tracing::warn!(
                "Failed to clear idle timeout on old run {}: {}",
                old_run_id,
                e
            );
        }
        // Set idle timeout for NEW run (extend by 15 minutes)
        if let Err(e) = app_state.database.update_run_idle_timeout(run.id, 15).await {
            tracing::warn!("Failed to set idle timeout for new run: {}", e);
        }
        (existing_sandbox, true)
    } else {
        // Create new sandbox as current logic
        match app_state
            .sandbox
            .start_sandbox(
                task.id,
                &repo_url,
                &github_token,
                &prompt,
                &anthropic_api_key,
                openai_api_key_opt.as_deref(),
                &branch,
                &author_name,
                &author_email,
                mode,
                model,
            )
            .await
        {
            Ok(info) => {
                tracing::info!("Started new sandbox {} for task {}", info.id, task.id);
                // Set initial idle timeout for new session (15 minutes)
                if let Err(e) = app_state.database.update_run_idle_timeout(run.id, 15).await {
                    tracing::warn!("Failed to set idle timeout for new session: {}", e);
                }
                (info, false)
            }
            Err(e) => {
                tracing::error!("Failed to start sandbox for task {}: {}", task.id, e);
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Err(anyhow::anyhow!("Failed to start sandbox: {}", e));
            }
        }
    };

    // If we're reusing a sandbox, we need to launch Claude Code with the new task
    let final_sandbox_info = if is_reused {
        // Launch Claude Code on the existing sandbox
        match app_state
            .sandbox
            .exec_claude_code_on_sandbox(
                &sandbox_info.id,
                &repo_url,
                &prompt,
                task.id,
                &github_token,
                &anthropic_api_key,
                openai_api_key_opt.as_deref(),
                &branch,
                &author_name,
                &author_email,
                mode,
                model,
                true, // reuse_session = true for reused sandboxes
            )
            .await
        {
            Ok(proc_id) => {
                tracing::info!(
                    "Launched Claude Code on reused sandbox {} with proc_id {}",
                    sandbox_info.id,
                    proc_id
                );
                SandboxInfo {
                    id: sandbox_info.id,
                    hostname: sandbox_info.hostname,
                    status: sandbox_info.status,
                    session_id: "modal".to_string(), // Modal doesn't use sessions, use placeholder
                    command_id: proc_id,             // Use proc_id as command_id
                    branch: branch.to_string(),
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to launch Claude Code on reused sandbox {}: {}",
                    sandbox_info.id,
                    e
                );
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Err(anyhow::anyhow!(
                    "Failed to launch Claude Code on reused sandbox: {}",
                    e
                ));
            }
        }
    } else {
        sandbox_info
    };

    // Update run with sandbox information (keeping status as spinning)
    match app_state
        .database
        .update_run_sandbox(run.id, &final_sandbox_info.id, &final_sandbox_info.hostname)
        .await
    {
        Ok(_) => {
            tracing::info!(
                "Updated run {} with sandbox {} info",
                run.id,
                final_sandbox_info.id
            );
        }
        Err(e) => {
            tracing::error!("Error updating run {} with sandbox info: {}", run.id, e);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Error updating run sandbox: {}", e));
        }
    }

    // Store command IDs for log streaming
    if let Err(e) = app_state
        .database
        .update_run_command_ids(
            run.id,
            &final_sandbox_info.session_id,
            &final_sandbox_info.command_id,
        )
        .await
    {
        tracing::error!("Error storing command IDs for run {}: {}", run.id, e);
        let _ = app_state.database.update_run_status(run.id, "failed").await;
        return Err(anyhow::anyhow!("Error storing command IDs: {}", e));
    }

    tracing::info!(
        "Task {} pipeline completed successfully - sandbox {} ready for execution",
        task.id,
        final_sandbox_info.id
    );

    Ok(())
}

/// Determine branch name for task with reuse logic
/// All modes (execute, plan, review): Reuse existing branch if available and PR not merged
/// Fallback: Generate new branch if none exists
async fn determine_branch_for_task(
    app_state: &AppState,
    task_id: i32,
    mode: &str,
) -> Result<String> {
    // Try to reuse existing branch for all modes
    if let Ok(Some(existing_branch)) = app_state
        .database
        .get_existing_branch_for_task(task_id, mode)
        .await
    {
        tracing::info!(
            "Reusing existing branch '{}' for task {}",
            existing_branch,
            task_id
        );
        return Ok(existing_branch);
    }

    // Fallback: generate new branch
    let new_branch = format!("swarm/task-{}", task_id);
    tracing::info!("Creating new branch '{}' for task {}", new_branch, task_id);
    Ok(new_branch)
}

/// Check for existing active sandbox for this task and branch
/// Returns (SandboxInfo, run_id) if a reusable session is found
async fn find_reusable_session(
    app_state: &AppState,
    task_id: i32,
    branch: &str,
) -> Result<Option<(crate::sandbox::SandboxInfo, i32)>> {
    tracing::info!(
        "Searching for reusable session for task {} on branch '{}'",
        task_id,
        branch
    );

    if let Some(existing_run) = app_state
        .database
        .find_active_session_for_task(task_id, branch)
        .await?
    {
        tracing::info!(
            "Found existing run {} for task {} with status '{}' and sandbox_id: {:?}",
            existing_run.id,
            task_id,
            existing_run.status.as_deref().unwrap_or("None"),
            existing_run.sandbox_id
        );

        // Verify the session is still valid
        if let (Some(sandbox_id), Some(hostname)) =
            (&existing_run.sandbox_id, &existing_run.sandbox_hostname)
        {
            tracing::info!(
                "Run {} has valid sandbox_id '{}' and hostname '{}'",
                existing_run.id,
                sandbox_id,
                hostname
            );

            // Check if sandbox is still alive via provider
            if let Some(modal_url) = &app_state.config.modal_url {
                tracing::info!("Checking sandbox {} status via Modal provider", sandbox_id);
                let modal = crate::sandbox::modal::ModalProvider::new(
                    modal_url.clone(),
                    app_state.config.modal_region.clone(),
                );

                match modal.get_sandbox_status(sandbox_id).await {
                    Ok(status) => {
                        tracing::info!(
                            "Sandbox {} status check returned: {:?}",
                            sandbox_id,
                            status
                        );
                        match status {
                            crate::sandbox::SandboxStatus::Running => {
                                tracing::info!(
                                    "✓ Found reusable session for task {}: sandbox {} is running",
                                    task_id,
                                    sandbox_id
                                );
                                return Ok(Some((
                                    crate::sandbox::SandboxInfo {
                                        id: sandbox_id.clone(),
                                        hostname: hostname.clone(),
                                        status,
                                        session_id: existing_run
                                            .session_id
                                            .clone()
                                            .unwrap_or_default(),
                                        command_id: existing_run
                                            .command_id
                                            .clone()
                                            .unwrap_or_default(),
                                        branch: branch.to_string(),
                                    },
                                    existing_run.id,
                                )));
                            }
                            _ => {
                                tracing::warn!("✗ Existing sandbox {} is not running (status: {:?}), cannot reuse", sandbox_id, status);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            "✗ Failed to check sandbox {} status: {}, cannot reuse",
                            sandbox_id,
                            e
                        );
                    }
                }
            } else {
                tracing::warn!("✗ No Modal URL configured, cannot check sandbox status for reuse");
            }
        } else {
            tracing::warn!("✗ Run {} missing sandbox_id or hostname (sandbox_id: {:?}, hostname: {:?}), cannot reuse", 
                existing_run.id, existing_run.sandbox_id, existing_run.sandbox_hostname);
        }
    } else {
        tracing::info!(
            "✗ No existing active session found for task {} on branch '{}'",
            task_id,
            branch
        );
    }

    tracing::info!(
        "No reusable session available for task {} on branch '{}', will create new sandbox",
        task_id,
        branch
    );
    Ok(None)
}
