use crate::claude;
use crate::models::Task;
use crate::sandbox::SandboxProvider;
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
    description: &str,
) -> Result<()> {
    tracing::info!("Starting task pipeline for task {}", task.id);

    // Create a new run for this task
    let run = match app_state.database.create_run(task.id, mode).await {
        Ok(run) => run,
        Err(e) => {
            tracing::error!("Failed to create run for task {}: {}", task.id, e);
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("Failed to create run: {}", e));
        }
    };
    tracing::info!("Using run {} for task {}", run.id, task.id);

    // Create placeholder assistant message for this run
    if let Err(e) = app_state
        .database
        .upsert_message(task.id, run.id, mode, "", "", "assistant")
        .await
    {
        tracing::error!(
            "Failed to create placeholder assistant message for task {}: {}",
            task.id,
            e
        );
        let _ = app_state.database.update_run_status(run.id, "failed").await;
        return Err(anyhow::anyhow!(
            "Failed to create placeholder assistant message: {}",
            e
        ));
    }

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

    // Generate concise title
    let title = claude::generate_title(description, &anthropic_api_key)
        .await
        .unwrap_or_else(|_| "Untitled task".into());

    app_state
        .database
        .update_task_title(task.id, &title)
        .await?;

    // Determine branch name with reuse logic
    let branch = determine_branch_for_task(&app_state, task.id, mode).await?;
    let author_name = match user.github_username.clone() {
        Some(username) => username,
        None => {
            if mode == "plan" {
                // Plan mode doesn't need GitHub username, use placeholder
                tracing::info!(
                    "No GitHub username available for user {} in plan task {}, using placeholder",
                    user.id,
                    task.id
                );
                "plan-user".to_string()
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
    let sandbox_info = if let Some(existing) = find_reusable_session(&app_state, task.id, &branch).await? {
        tracing::info!("Reusing existing sandbox {} for task {}", existing.id, task.id);
        // Set idle timeout for reused session (extend by 15 minutes)
        if let Err(e) = app_state.database.update_run_idle_timeout(run.id, 15).await {
            tracing::warn!("Failed to set idle timeout for reused session: {}", e);
        }
        existing
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
            )
            .await
        {
            Ok(info) => {
                tracing::info!("Started new sandbox {} for task {}", info.id, task.id);
                // Set initial idle timeout for new session (15 minutes)
                if let Err(e) = app_state.database.update_run_idle_timeout(run.id, 15).await {
                    tracing::warn!("Failed to set idle timeout for new session: {}", e);
                }
                info
            }
            Err(e) => {
                tracing::error!("Failed to start sandbox for task {}: {}", task.id, e);
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Err(anyhow::anyhow!("Failed to start sandbox: {}", e));
            }
        }
    };

    // Update run with sandbox information (keeping status as spinning)
    match app_state
        .database
        .update_run_sandbox(run.id, &sandbox_info.id, &sandbox_info.hostname)
        .await
    {
        Ok(_) => {
            tracing::info!(
                "Updated run {} with sandbox {} info",
                run.id,
                sandbox_info.id
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
        .update_run_command_ids(run.id, &sandbox_info.session_id, &sandbox_info.command_id)
        .await
    {
        tracing::error!("Error storing command IDs for run {}: {}", run.id, e);
        let _ = app_state.database.update_run_status(run.id, "failed").await;
        return Err(anyhow::anyhow!("Error storing command IDs: {}", e));
    }

    tracing::info!(
        "Task {} pipeline completed successfully - sandbox {} ready for execution",
        task.id,
        sandbox_info.id
    );

    Ok(())
}

/// Determine branch name for task with reuse logic
/// For "execute" mode: Reuse existing branch if available and PR not merged
/// For "plan" mode: Always create new branch (separate planning workflow)  
/// Fallback: Generate new branch if none exists
async fn determine_branch_for_task(
    app_state: &AppState,
    task_id: i32,
    mode: &str,
) -> Result<String> {
    if mode == "plan" {
        // Plan mode always gets new branch
        return Ok(format!("swarm/task-{}", task_id));
    }
    
    // For execute mode, try to reuse existing branch
    if let Ok(Some(existing_branch)) = app_state
        .database
        .get_existing_branch_for_task(task_id, mode)
        .await
    {
        tracing::info!("Reusing existing branch '{}' for task {}", existing_branch, task_id);
        return Ok(existing_branch);
    }

    // Fallback: generate new branch
    let new_branch = format!("swarm/task-{}", task_id);
    tracing::info!("Creating new branch '{}' for task {}", new_branch, task_id);
    Ok(new_branch)
}

/// Check for existing active sandbox for this task and branch
async fn find_reusable_session(
    app_state: &AppState, 
    task_id: i32, 
    branch: &str,
) -> Result<Option<crate::sandbox::SandboxInfo>> {
    if let Some(existing_run) = app_state
        .database
        .find_active_session_for_task(task_id, branch)
        .await?
    {
        // Verify the session is still valid
        if let (Some(sandbox_id), Some(hostname)) = (&existing_run.sandbox_id, &existing_run.sandbox_hostname) {
            // Check if sandbox is still alive via provider
            if let Some(modal_url) = &app_state.config.modal_url {
                let modal = crate::sandbox::modal::ModalProvider::new(
                    modal_url.clone(),
                    app_state.config.modal_region.clone(),
                );
                
                if let Ok(status) = modal.get_sandbox_status(sandbox_id).await {
                    match status {
                        crate::sandbox::SandboxStatus::Running => {
                            tracing::info!("Found reusable session for task {}: sandbox {}", task_id, sandbox_id);
                            return Ok(Some(crate::sandbox::SandboxInfo {
                                id: sandbox_id.clone(),
                                hostname: hostname.clone(),
                                status,
                                session_id: existing_run.session_id.clone().unwrap_or_default(),
                                command_id: existing_run.command_id.clone().unwrap_or_default(),
                                branch: branch.to_string(),
                            }));
                        }
                        _ => {
                            tracing::warn!("Existing sandbox {} is not running (status: {:?}), creating new session", sandbox_id, status);
                        }
                    }
                }
            }
        }
    }
    
    Ok(None)
}
