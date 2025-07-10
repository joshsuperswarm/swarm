use crate::models::Task;
use crate::AppState;
use anyhow::Result;
use chrono::Utc;
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
pub async fn run_full_task_pipeline(app_state: AppState, task: Task) -> Result<()> {
    tracing::info!("Starting task pipeline for task {}", task.id);

    // Get the user from the task
    let user = match app_state.database.get_user_by_id(task.user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            tracing::error!("User {} not found for task {}", task.user_id, task.id);
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("User not found"));
        }
        Err(e) => {
            tracing::error!("Database error getting user {}: {}", task.user_id, e);
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
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
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("Repository not found"));
        }
        Err(e) => {
            tracing::error!(
                "Database error getting repository {}: {}",
                task.repository_id,
                e
            );
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
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
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("No GitHub token available"));
        }
        Err(e) => {
            tracing::error!("Error fetching GitHub token for user {}: {}", user.id, e);
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("Error fetching GitHub token: {}", e));
        }
    };

    // Get user's Anthropic API key
    let anthropic_api_key = match user.anthropic_api_key {
        Some(key) => key,
        None => {
            tracing::error!(
                "No Anthropic API key available for user {} in task {}",
                user.id,
                task.id
            );
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("No Anthropic API key available"));
        }
    };

    // Generate branch name and author info - fail if GitHub username or email not available
    let branch = format!("swarm/task-{}-{}", task.id, Utc::now().format("%Y%m%d%H%M"));
    let author_name = match user.github_username.clone() {
        Some(username) => username,
        None => {
            tracing::error!(
                "No GitHub username available for user {} in task {}",
                user.id,
                task.id
            );
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("No GitHub username available"));
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
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("No email available"));
        }
    };

    // Update task with branch name
    match app_state
        .database
        .update_task_branch(task.id, &branch)
        .await
    {
        Ok(_) => {
            tracing::info!("Updated task {} with branch {}", task.id, branch);
        }
        Err(e) => {
            tracing::error!(
                "Error updating task {} with branch {}: {}",
                task.id,
                branch,
                e
            );
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("Error updating task branch: {}", e));
        }
    }

    // Start sandbox
    let repo_url = format!("https://github.com/{}", repository.full_name);
    let prompt = task.description.as_ref()
        .filter(|s| !s.is_empty())
        .unwrap_or(&task.title)
        .to_string();

    let sandbox_info = match app_state
        .sandbox
        .start_sandbox(
            task.id,
            &repo_url,
            &github_token,
            &prompt,
            &anthropic_api_key,
            app_state.config.openai_api_key.as_deref(),
            &branch,
            &author_name,
            &author_email,
        )
        .await
    {
        Ok(info) => {
            tracing::info!("Started sandbox {} for task {}", info.id, task.id);
            info
        }
        Err(e) => {
            tracing::error!("Failed to start sandbox for task {}: {}", task.id, e);
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("Failed to start sandbox: {}", e));
        }
    };

    // Update task with sandbox information
    match app_state
        .database
        .update_task_sandbox(
            task.id,
            &sandbox_info.id,
            &sandbox_info.hostname,
            "spinning",
        )
        .await
    {
        Ok(_) => {
            tracing::info!(
                "Updated task {} with sandbox {} info",
                task.id,
                sandbox_info.id
            );
        }
        Err(e) => {
            tracing::error!("Error updating task {} with sandbox info: {}", task.id, e);
            let _ = app_state
                .database
                .update_task_status(task.id, "failed", None)
                .await;
            return Err(anyhow::anyhow!("Error updating task sandbox: {}", e));
        }
    }

    // Store command IDs for log streaming
    if let Err(e) = app_state
        .database
        .update_task_command_ids(task.id, &sandbox_info.session_id, &sandbox_info.command_id)
        .await
    {
        tracing::error!("Error storing command IDs for task {}: {}", task.id, e);
        let _ = app_state
            .database
            .update_task_status(task.id, "failed", None)
            .await;
        return Err(anyhow::anyhow!("Error storing command IDs: {}", e));
    }

    tracing::info!(
        "Task {} pipeline completed successfully - sandbox {} ready for execution",
        task.id,
        sandbox_info.id
    );

    Ok(())
}
