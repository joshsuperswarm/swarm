use crate::claude;
use crate::models::Task;
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

    // Generate branch name and author info - fail if GitHub username or email not available
    let branch = format!("swarm/task-{}", task.id);
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

    let sandbox_info = match app_state
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
            tracing::info!("Started sandbox {} for task {}", info.id, task.id);
            info
        }
        Err(e) => {
            tracing::error!("Failed to start sandbox for task {}: {}", task.id, e);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Err(anyhow::anyhow!("Failed to start sandbox: {}", e));
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
