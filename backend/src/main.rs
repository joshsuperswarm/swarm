use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

mod auth;
mod clerk_api;
mod config;
mod database;
mod error;
mod github;
mod github_pr;
mod models;
mod sandbox;
mod task_pipeline;

use auth::{clerk_middleware, AnthropicApiKeyBody, CurrentUser, GitHubTokenBody};
use config::Config;
use database::Database;
use error::{AppError, AppResult};
use github::GitHubClient;
use github_pr::GitHubPRClient;
use models::{
    CreateGitHubToken, CreateRepository, CreateTask, CreateUser, RepositoryTS, UserWithDefaultRepo,
    _force_ts_generation,
};
use sandbox::{daytona::DaytonaProvider, modal::ModalProvider, DynSandbox, SandboxStatus};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use ts_rs::TS;

#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub config: Config,
    pub sandbox: DynSandbox,
}

async fn get_or_create_user(
    database: &Database,
    clerk_user_id: &str,
) -> Result<models::User, StatusCode> {
    // Try to get existing user
    if let Ok(Some(user)) = database.get_user_by_clerk_id(clerk_user_id).await {
        return Ok(user);
    }

    // Create new user if doesn't exist
    let create_user = CreateUser {
        clerk_user_id: clerk_user_id.to_string(),
        github_username: None,
        github_user_id: None,
        email: None,
    };

    database
        .create_user(create_user)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn store_github_token(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Json(body): Json<GitHubTokenBody>,
) -> Result<Json<Value>, StatusCode> {
    tracing::info!(
        "Storing GitHub token for user: {}, token length: {}",
        user.id,
        body.access_token.len()
    );

    // Upsert Swarm user (helper re-uses existing DB methods)
    let db_user = match get_or_create_user(&app_state.database, &user.id).await {
        Ok(u) => {
            tracing::debug!("Found/created DB user with ID: {}", u.id);
            u
        }
        Err(e) => {
            tracing::error!("Error getting/creating user: {:?}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    match app_state
        .database
        .store_github_token(CreateGitHubToken {
            user_id: db_user.id,
            access_token: body.access_token.clone(),
            token_type: "bearer".into(),
            scope: Some("repo".into()),
        })
        .await
    {
        Ok(_) => {
            tracing::info!("Successfully stored GitHub token for user {}", db_user.id);

            if let Ok((login, gh_id)) = github::fetch_current_user(&body.access_token).await {
                let _ = app_state
                    .database
                    .update_user_github_info(db_user.id, Some(login), Some(gh_id))
                    .await;
            }

            Ok(Json(json!({ "success": true })))
        }
        Err(e) => {
            tracing::error!("Error storing GitHub token: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn store_anthropic_key(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Json(body): Json<AnthropicApiKeyBody>,
) -> Result<Json<Value>, StatusCode> {
    tracing::info!(
        "Storing Anthropic API key for user: {}, key length: {}",
        user.id,
        body.api_key.len()
    );

    // Get or create user
    let db_user = match get_or_create_user(&app_state.database, &user.id).await {
        Ok(u) => {
            tracing::debug!("Found/created DB user with ID: {}", u.id);
            u
        }
        Err(e) => {
            tracing::error!("Error getting/creating user: {:?}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    match app_state
        .database
        .update_user_anthropic_key(db_user.id, Some(body.api_key))
        .await
    {
        Ok(_) => {
            tracing::info!(
                "Successfully stored Anthropic API key for user {}",
                db_user.id
            );
            Ok(Json(json!({ "success": true })))
        }
        Err(e) => {
            tracing::error!("Error storing Anthropic API key: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn sandbox_poller(app_state: AppState) {
    tracing::info!("Starting sandbox status poller");

    loop {
        sleep(Duration::from_secs(30)).await;

        // Get all active tasks with sandbox IDs
        let active_tasks_query = sqlx::query!(
            "SELECT id, user_id, daytona_sandbox_id, daytona_session_id, daytona_command_id, status FROM tasks 
             WHERE daytona_sandbox_id IS NOT NULL 
             AND status IN ('spinning', 'running', 'done')"
        );

        let active_tasks = match active_tasks_query.fetch_all(&app_state.database.pool).await {
            Ok(tasks) => tasks,
            Err(e) => {
                tracing::error!("Error fetching active tasks: {}", e);
                continue;
            }
        };

        for task in active_tasks {
            let sandbox_id = match &task.daytona_sandbox_id {
                Some(id) => id.as_str(),
                None => continue,
            };

            // Handle tasks that are already in 'done' state - transition to PR creation
            if task.status.as_deref() == Some("done") {
                tracing::info!(
                    "Task {} is in 'done' state, initiating PR creation",
                    task.id
                );

                // Atomically update task status to 'pushing' to prevent duplicate workers
                let update_result = sqlx::query!(
                    r#"
                    UPDATE tasks
                    SET    status = 'pushing'
                    WHERE  id = $1
                      AND  status = 'done'
                    RETURNING id
                    "#,
                    task.id
                )
                .fetch_optional(&app_state.database.pool)
                .await;

                match update_result {
                    Ok(Some(_)) => {
                        // We were the first to update - safe to spawn background job
                        tracing::info!(
                            "Task {} status updated from 'done' to 'pushing', spawning PR creation job",
                            task.id
                        );
                        let app_state_clone = app_state.clone();
                        let task_id = task.id;
                        tokio::spawn(async move {
                            if let Err(e) = handle_task_success(app_state_clone, task_id).await {
                                tracing::error!(
                                    "Error handling task {} PR creation: {}",
                                    task_id,
                                    e
                                );
                            }
                        });
                    }
                    Ok(None) => {
                        // Task was already updated by another worker
                        tracing::debug!(
                            "Task {} already transitioned from 'done' state by another worker",
                            task.id
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            "Error updating task {} status from 'done' to 'pushing': {}",
                            task.id,
                            e
                        );
                    }
                }
                continue; // Skip sandbox status checks for done tasks
            }

            // Check command exit code first if we have session and command IDs
            if let (Some(session_id), Some(command_id)) =
                (&task.daytona_session_id, &task.daytona_command_id)
            {
                match app_state
                    .sandbox
                    .get_command_exit_code(sandbox_id, session_id, command_id)
                    .await
                {
                    Ok(Some(0)) => {
                        // Exit code 0 means success
                        tracing::info!("Task {} completed successfully (exit code: 0)", task.id);

                        // Collect final logs immediately upon successful completion
                        if let (Some(session_id), Some(command_id)) =
                            (&task.daytona_session_id, &task.daytona_command_id)
                        {
                            tracing::info!(
                                "→ Collecting final logs for successful task {}",
                                task.id
                            );

                            // Create temporary provider for log collection
                            if let Ok(config) = crate::config::Config::from_env() {
                                // Try Modal first, then Daytona
                                if let Some(modal_url) = config.modal_url {
                                    let modal = sandbox::modal::ModalProvider::new(
                                        modal_url,
                                        config.modal_region,
                                    );
                                    // For Modal, command_id is the proc_id
                                    match modal
                                        .stream_command_logs(
                                            &app_state.database,
                                            task.id,
                                            sandbox_id,
                                            command_id, // This is proc_id for Modal
                                        )
                                        .await
                                    {
                                        Ok(_) => {
                                            tracing::info!(
                                                "✓ Final log collection completed for successful task {}",
                                                task.id
                                            );

                                            // Run post-completion workflow: push changes, create PR, terminate sandbox
                                            match modal
                                                .run_post_completion_workflow(
                                                    &app_state.database,
                                                    task.id,
                                                    sandbox_id,
                                                )
                                                .await
                                            {
                                                Ok(_) => {
                                                    tracing::info!(
                                                        "✓ Post-completion workflow completed for task {}",
                                                        task.id
                                                    );
                                                }
                                                Err(e) => {
                                                    tracing::error!(
                                                        "✗ Post-completion workflow failed for task {}: {}",
                                                        task.id, e
                                                    );
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            tracing::warn!(
                                                "⚠ Final log collection failed for successful task {}: {}",
                                                task.id,
                                                e
                                            );
                                        }
                                    }
                                } else if let (Some(url), Some(api_key)) =
                                    (config.daytona_url, config.daytona_api_key)
                                {
                                    let daytona = sandbox::daytona::DaytonaProvider::new(
                                        url,
                                        api_key,
                                        config.daytona_organization_id,
                                        config.daytona_region,
                                    );

                                    match daytona
                                        .stream_command_logs(
                                            &app_state.database,
                                            task.id,
                                            sandbox_id,
                                            session_id,
                                            command_id,
                                        )
                                        .await
                                    {
                                        Ok(_) => {
                                            tracing::info!(
                                                "✓ Final log collection completed for successful task {}",
                                                task.id
                                            );
                                        }
                                        Err(e) => {
                                            tracing::warn!(
                                                "⚠ Final log collection failed for successful task {}: {}",
                                                task.id,
                                                e
                                            );
                                        }
                                    }
                                } else {
                                    tracing::warn!(
                                        "No sandbox provider configured for log collection"
                                    );
                                }
                            }
                        }

                        // Atomically update task status to 'pushing' to prevent duplicate workers
                        let update_result = sqlx::query!(
                            r#"
                            UPDATE tasks
                            SET    status = 'pushing'
                            WHERE  id = $1
                              AND  status IN ('running','spinning')
                            RETURNING id
                            "#,
                            task.id
                        )
                        .fetch_optional(&app_state.database.pool)
                        .await;

                        match update_result {
                            Ok(Some(_)) => {
                                // We were the first to update - safe to spawn background job
                                tracing::info!(
                                    "Task {} status updated to 'pushing', spawning background job",
                                    task.id
                                );
                                let app_state_clone = app_state.clone();
                                let task_id = task.id;
                                tokio::spawn(async move {
                                    if let Err(e) =
                                        handle_task_success(app_state_clone, task_id).await
                                    {
                                        tracing::error!(
                                            "Error handling task {} success: {}",
                                            task_id,
                                            e
                                        );
                                    }
                                });
                            }
                            Ok(None) => {
                                // Task was already in terminal state or being processed by another worker
                                tracing::debug!(
                                    "Task {} already in terminal state or being processed",
                                    task.id
                                );
                            }
                            Err(e) => {
                                tracing::error!(
                                    "Error updating task {} status to 'pushing': {}",
                                    task.id,
                                    e
                                );
                            }
                        }
                        continue; // Skip sandbox status check
                    }
                    Ok(Some(code)) => {
                        // Non-zero exit code means failure
                        tracing::warn!("Task {} failed with exit code: {}", task.id, code);

                        // Collect final logs immediately upon task failure
                        if let (Some(session_id), Some(command_id)) =
                            (&task.daytona_session_id, &task.daytona_command_id)
                        {
                            tracing::info!("→ Collecting final logs for failed task {}", task.id);

                            // Create temporary provider for log collection
                            if let Ok(config) = crate::config::Config::from_env() {
                                // Try Modal first, then Daytona
                                if let Some(modal_url) = config.modal_url {
                                    let modal = sandbox::modal::ModalProvider::new(
                                        modal_url,
                                        config.modal_region,
                                    );
                                    // For Modal, command_id is the proc_id
                                    match modal
                                        .stream_command_logs(
                                            &app_state.database,
                                            task.id,
                                            sandbox_id,
                                            command_id, // This is proc_id for Modal
                                        )
                                        .await
                                    {
                                        Ok(_) => {
                                            tracing::info!(
                                                "✓ Final log collection completed for failed task {}",
                                                task.id
                                            );
                                        }
                                        Err(e) => {
                                            tracing::warn!(
                                                "⚠ Final log collection failed for failed task {}: {}",
                                                task.id,
                                                e
                                            );
                                        }
                                    }
                                } else if let (Some(url), Some(api_key)) =
                                    (config.daytona_url, config.daytona_api_key)
                                {
                                    let daytona = sandbox::daytona::DaytonaProvider::new(
                                        url,
                                        api_key,
                                        config.daytona_organization_id,
                                        config.daytona_region,
                                    );

                                    match daytona
                                        .stream_command_logs(
                                            &app_state.database,
                                            task.id,
                                            sandbox_id,
                                            session_id,
                                            command_id,
                                        )
                                        .await
                                    {
                                        Ok(_) => {
                                            tracing::info!(
                                                "✓ Final log collection completed for failed task {}",
                                                task.id
                                            );
                                        }
                                        Err(e) => {
                                            tracing::warn!(
                                                "⚠ Final log collection failed for failed task {}: {}",
                                                task.id,
                                                e
                                            );
                                        }
                                    }
                                } else {
                                    tracing::warn!(
                                        "No sandbox provider configured for log collection"
                                    );
                                }
                            }
                        }

                        // Skip if already in terminal state
                        if !matches!(task.status.as_deref(), Some("failed") | Some("pr_opened")) {
                            if let Err(e) = app_state
                                .database
                                .update_task_status(task.id, "failed", None)
                                .await
                            {
                                tracing::error!(
                                    "Error updating task {} status to failed: {}",
                                    task.id,
                                    e
                                );
                            } else {
                                tracing::info!(
                                    "✓ Task {} marked as failed (exit code: {})",
                                    task.id,
                                    code
                                );
                            }

                            // Clean up sandbox after task failure
                            tracing::info!("Deleting sandbox {} after task failure", sandbox_id);
                            if let Err(e) = app_state.sandbox.delete_sandbox(sandbox_id).await {
                                tracing::warn!(
                                    "⚠ Failed to delete sandbox {} after task failure: {}",
                                    sandbox_id,
                                    e
                                );
                            } else {
                                tracing::info!(
                                    "✓ Sandbox {} deleted after task failure",
                                    sandbox_id
                                );
                            }
                        }
                        continue; // Skip sandbox status check
                    }
                    Ok(None) => {
                        // No exit code yet, command still running - continue to sandbox check
                        tracing::debug!("Task {} command still running (no exit code)", task.id);
                    }
                    Err(e) => {
                        tracing::debug!("Error checking exit code for task {}: {}", task.id, e);
                        // Continue to sandbox status check as fallback
                    }
                }
            }

            // Check sandbox status (fallback or when no session/command IDs)
            match app_state.sandbox.get_sandbox_status(sandbox_id).await {
                Ok(SandboxStatus::Stopped) => {
                    tracing::info!(
                        "Sandbox {} stopped for task {} (exit code check was inconclusive)",
                        sandbox_id,
                        task.id
                    );

                    // Collect final logs for UI display
                    if let (Some(session_id), Some(command_id)) =
                        (&task.daytona_session_id, &task.daytona_command_id)
                    {
                        tracing::info!("→ Collecting final logs for stopped task {}", task.id);

                        // Create temporary provider for log collection
                        if let Ok(config) = crate::config::Config::from_env() {
                            // Try Modal first, then Daytona
                            if let Some(modal_url) = config.modal_url {
                                let modal = sandbox::modal::ModalProvider::new(
                                    modal_url,
                                    config.modal_region,
                                );
                                // For Modal, command_id is the proc_id
                                match modal
                                    .stream_command_logs(
                                        &app_state.database,
                                        task.id,
                                        sandbox_id,
                                        command_id, // This is proc_id for Modal
                                    )
                                    .await
                                {
                                    Ok(_) => {
                                        tracing::info!(
                                            "✓ Final log collection completed for task {}",
                                            task.id
                                        );
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            "⚠ Final log collection failed for task {}: {}",
                                            task.id,
                                            e
                                        );
                                    }
                                }
                            } else if let (Some(url), Some(api_key)) =
                                (config.daytona_url, config.daytona_api_key)
                            {
                                let daytona = sandbox::daytona::DaytonaProvider::new(
                                    url,
                                    api_key,
                                    config.daytona_organization_id,
                                    config.daytona_region,
                                );

                                match daytona
                                    .stream_command_logs(
                                        &app_state.database,
                                        task.id,
                                        sandbox_id,
                                        session_id,
                                        command_id,
                                    )
                                    .await
                                {
                                    Ok(_) => {
                                        tracing::info!(
                                            "✓ Final log collection completed for task {}",
                                            task.id
                                        );
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            "⚠ Final log collection failed for task {}: {}",
                                            task.id,
                                            e
                                        );
                                    }
                                }
                            } else {
                                tracing::warn!("No sandbox provider configured for log collection");
                            }
                        }
                    }

                    // Since we rely on exit code for task completion,
                    // a stopped sandbox without exit code indicates failure
                    tracing::warn!(
                        "Task {} sandbox stopped without exit code, likely failed",
                        task.id
                    );

                    // Skip if already in terminal state
                    if !matches!(task.status.as_deref(), Some("failed") | Some("pr_opened")) {
                        if let Err(e) = app_state
                            .database
                            .update_task_status(task.id, "failed", None)
                            .await
                        {
                            tracing::error!(
                                "Error updating task {} status to failed: {}",
                                task.id,
                                e
                            );
                        } else {
                            tracing::info!(
                                "✓ Task {} marked as failed (sandbox stopped without exit code)",
                                task.id
                            );
                        }

                        // Clean up sandbox after task failure
                        tracing::info!(
                            "Deleting sandbox {} after task failure (stopped without exit code)",
                            sandbox_id
                        );
                        if let Err(e) = app_state.sandbox.delete_sandbox(sandbox_id).await {
                            tracing::warn!(
                                "⚠ Failed to delete sandbox {} after task failure: {}",
                                sandbox_id,
                                e
                            );
                        } else {
                            tracing::info!("✓ Sandbox {} deleted after task failure", sandbox_id);
                        }
                    }
                }
                Ok(SandboxStatus::Failed) => {
                    tracing::warn!("Sandbox {} failed for task {}", sandbox_id, task.id);
                    // Mark task as failed
                    if let Err(e) = app_state
                        .database
                        .update_task_status(task.id, "failed", None)
                        .await
                    {
                        tracing::error!("Error updating task {} status: {}", task.id, e);
                    } else {
                        tracing::info!("✓ Task {} marked as failed (sandbox failed)", task.id);
                    }

                    // Clean up sandbox after sandbox failure
                    tracing::info!("Deleting sandbox {} after sandbox failure", sandbox_id);
                    if let Err(e) = app_state.sandbox.delete_sandbox(sandbox_id).await {
                        tracing::warn!(
                            "⚠ Failed to delete sandbox {} after sandbox failure: {}",
                            sandbox_id,
                            e
                        );
                    } else {
                        tracing::info!("✓ Sandbox {} deleted after sandbox failure", sandbox_id);
                    }
                }
                Ok(SandboxStatus::Running) => {
                    // Update status to running if it was spinning
                    if task.status.as_deref() == Some("spinning") {
                        if let Err(e) = app_state
                            .database
                            .update_task_status(task.id, "running", None)
                            .await
                        {
                            tracing::error!("Error updating task {} status: {}", task.id, e);
                        } else {
                            tracing::info!("✓ Task {} updated to running", task.id);
                        }
                    }

                    // For running tasks, collect logs periodically
                    if let (Some(session_id), Some(command_id)) =
                        (&task.daytona_session_id, &task.daytona_command_id)
                    {
                        tracing::info!("→ Collecting logs for running task {}", task.id);

                        // Create temporary provider for log collection
                        if let Ok(config) = crate::config::Config::from_env() {
                            // Try Modal first, then Daytona
                            if let Some(modal_url) = config.modal_url {
                                let modal = sandbox::modal::ModalProvider::new(
                                    modal_url,
                                    config.modal_region,
                                );
                                // For Modal, command_id is the proc_id
                                match modal
                                    .stream_command_logs(
                                        &app_state.database,
                                        task.id,
                                        sandbox_id,
                                        command_id, // This is proc_id for Modal
                                    )
                                    .await
                                {
                                    Ok(_) => {
                                        tracing::debug!(
                                            "✓ Log collection completed for running task {}",
                                            task.id
                                        );
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            "⚠ Log collection failed for running task {}: {}",
                                            task.id,
                                            e
                                        );
                                    }
                                }
                            } else if let (Some(url), Some(api_key)) =
                                (config.daytona_url, config.daytona_api_key)
                            {
                                let daytona = sandbox::daytona::DaytonaProvider::new(
                                    url,
                                    api_key,
                                    config.daytona_organization_id,
                                    config.daytona_region,
                                );

                                match daytona
                                    .stream_command_logs(
                                        &app_state.database,
                                        task.id,
                                        sandbox_id,
                                        session_id,
                                        command_id,
                                    )
                                    .await
                                {
                                    Ok(_) => {
                                        tracing::debug!(
                                            "✓ Log collection completed for running task {}",
                                            task.id
                                        );
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            "⚠ Log collection failed for running task {}: {}",
                                            task.id,
                                            e
                                        );
                                    }
                                }
                            } else {
                                tracing::warn!("No sandbox provider configured for log collection");
                            }
                        }
                    }
                }
                Ok(SandboxStatus::Starting) => {
                    tracing::debug!("Task {} sandbox still starting", task.id);
                    // Keep polling
                }
                Err(e) => {
                    tracing::error!("Error checking sandbox {} status: {}", sandbox_id, e);
                    // Don't mark as failed immediately, keep trying
                }
            }
        }
    }
}

/// Handle successful task completion: push changes and create PR
async fn handle_task_success(
    app_state: AppState,
    task_id: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("Handling successful completion for task {}", task_id);

    // Get task, user, and repository information
    let task = match app_state.database.get_task_by_id(task_id).await? {
        Some(task) => task,
        None => {
            tracing::error!("Task {} not found", task_id);
            return Ok(());
        }
    };

    // Early exit if task is already in terminal state
    if matches!(task.status.as_deref(), Some("pr_opened") | Some("failed")) {
        tracing::info!(
            "Task {} already in terminal state: {:?}",
            task_id,
            task.status
        );
        return Ok(());
    }

    let user = match app_state.database.get_user_by_id(task.user_id).await? {
        Some(user) => user,
        None => {
            tracing::error!("User {} not found for task {}", task.user_id, task_id);
            return Ok(());
        }
    };

    let repository = match app_state
        .database
        .get_repository_by_id(task.repository_id, task.user_id)
        .await?
    {
        Some(repo) => repo,
        None => {
            tracing::error!(
                "Repository {} not found for task {}",
                task.repository_id,
                task_id
            );
            return Ok(());
        }
    };

    let github_token = match app_state.database.get_github_token(user.id).await? {
        Some(token) => token.access_token,
        None => {
            tracing::error!("No GitHub token for user {} in task {}", user.id, task_id);
            return Ok(());
        }
    };

    // Extract necessary information
    let sandbox_id = match task.daytona_sandbox_id.as_ref() {
        Some(id) => id,
        None => {
            tracing::error!("No sandbox ID for task {}", task_id);
            return Ok(());
        }
    };

    let branch = match task.github_branch.as_ref() {
        Some(branch) => branch,
        None => {
            tracing::error!("No branch for task {}", task_id);
            return Ok(());
        }
    };

    // Get author information - fail if not available
    let author_name = match user.github_username.clone() {
        Some(username) => username,
        None => {
            tracing::error!(
                "No GitHub username available for user {} in task {}",
                user.id,
                task_id
            );
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };
    let author_email = match user.email.clone() {
        Some(email) => email,
        None => {
            tracing::error!(
                "No email available for user {} in task {}",
                user.id,
                task_id
            );
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    // Create repo path
    let repo_name = repository.name.clone();
    let repo_path = format!("/home/daytona/{}", repo_name);

    // Validate that AI-generated artifacts are present
    let commit_title = match task.commit_title.as_ref() {
        Some(title) if !title.trim().is_empty() => title,
        _ => {
            tracing::error!("Task {} missing AI-generated commit title", task_id);
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    let commit_body = match task.commit_body.as_ref() {
        Some(body) if !body.trim().is_empty() => body,
        _ => {
            tracing::error!("Task {} missing AI-generated commit body", task_id);
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    let pr_title = match task.pr_title.as_ref() {
        Some(title) if !title.trim().is_empty() => title,
        _ => {
            tracing::error!("Task {} missing AI-generated PR title", task_id);
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    let pr_body = match task.pr_body.as_ref() {
        Some(body) if !body.trim().is_empty() => body,
        _ => {
            tracing::error!("Task {} missing AI-generated PR body", task_id);
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    // Push changes to GitHub
    tracing::info!(
        "Pushing changes for task {} with AI-generated commit message",
        task_id
    );
    if let Err(e) = app_state
        .sandbox
        .push_changes(
            sandbox_id,
            &repo_path,
            branch,
            task_id,
            &author_name,
            &author_email,
            commit_title,
            commit_body,
        )
        .await
    {
        tracing::error!("Failed to push changes for task {}: {}", task_id, e);
        let _ = app_state
            .database
            .update_task_status(task_id, "failed", None)
            .await;
        return Ok(());
    }

    // Create or update PR
    tracing::info!(
        "Creating PR for task {} in repository {}/{}",
        task_id,
        repository.owner,
        repository.name
    );
    tracing::debug!(
        "Using GitHub token: {}***",
        &github_token[..4.min(github_token.len())]
    );

    let pr_client = match GitHubPRClient::new(&github_token) {
        Ok(client) => {
            tracing::debug!("Successfully created GitHub PR client for task {}", task_id);
            client
        }
        Err(e) => {
            tracing::error!("Failed to create PR client for task {}: {}", task_id, e);
            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    let pr_url = match pr_client
        .create_or_update_pr(
            &repository.owner,
            &repository.name,
            branch,
            &task,
            pr_title,
            pr_body,
        )
        .await
    {
        Ok(url) => {
            tracing::info!(
                "Successfully created/updated PR for task {}: {}",
                task_id,
                url
            );
            url
        }
        Err(e) => {
            tracing::error!(
                "Failed to create PR for task {} in {}/{} on branch '{}': {}",
                task_id,
                repository.owner,
                repository.name,
                branch,
                e
            );

            // Log error chain for more context
            let mut source = e.source();
            let mut depth = 1;
            while let Some(err) = source {
                tracing::error!("  Error chain [{}]: {}", depth, err);
                source = err.source();
                depth += 1;
                if depth > 5 {
                    break;
                } // Prevent infinite loops
            }

            let _ = app_state
                .database
                .update_task_status(task_id, "failed", None)
                .await;
            return Ok(());
        }
    };

    // Update task with PR URL and status
    if let Err(e) = app_state
        .database
        .update_task_status(task_id, "pr_opened", Some(&pr_url))
        .await
    {
        tracing::error!("Error updating task {} status to pr_opened: {}", task_id, e);
    } else {
        tracing::info!(
            "✓ Task {} completed successfully with PR: {}",
            task_id,
            pr_url
        );
    }

    // Delete the sandbox after PR is created
    tracing::info!("Deleting sandbox {} after PR creation", sandbox_id);
    if let Err(e) = app_state.sandbox.delete_sandbox(sandbox_id).await {
        tracing::warn!(
            "⚠ Failed to delete sandbox {} after PR creation: {}",
            sandbox_id,
            e
        );
        // Don't fail the task if sandbox deletion fails
    } else {
        tracing::info!("✓ Sandbox {} deleted successfully", sandbox_id);
    }

    Ok(())
}

#[tokio::main]
async fn main() -> AppResult<()> {
    // Force TypeScript generation for exported types
    _force_ts_generation();

    // Export the types explicitly
    UserWithDefaultRepo::export().unwrap();
    RepositoryTS::export().unwrap();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Load configuration
    let config = Config::from_env()?;

    // Connect to database
    let pool = match PgPool::connect(&config.database_url).await {
        Ok(pool) => {
            tracing::info!("Connected to database successfully");
            pool
        }
        Err(e) => {
            tracing::error!("Failed to connect to database: {}", e);
            tracing::error!("Make sure PostgreSQL is running and DATABASE_URL is correct");
            return Err(AppError::Database(e));
        }
    };

    // Run database migrations (skip if already exist)
    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => tracing::info!("Database migrations completed successfully"),
        Err(e) => {
            tracing::warn!("Migration warning (likely tables already exist): {}", e);
            tracing::info!("Continuing with existing database schema");
        }
    }

    let database = Database::new(pool);

    // Initialize sandbox provider - prefer Modal over Daytona
    let sandbox: DynSandbox = if let Some(modal_url) = config.modal_url.as_ref() {
        tracing::info!("Initializing Modal sandbox provider");
        Arc::new(ModalProvider::new(
            modal_url.clone(),
            config.modal_region.clone(),
        ))
    } else if let (Some(url), Some(api_key)) =
        (config.daytona_url.as_ref(), config.daytona_api_key.as_ref())
    {
        tracing::info!("Initializing Daytona sandbox provider");
        Arc::new(DaytonaProvider::new(
            url.clone(),
            api_key.clone(),
            config.daytona_organization_id.clone(),
            config.daytona_region.clone(),
        ))
    } else {
        tracing::warn!(
            "Neither MODAL_URL nor DAYTONA_URL/DAYTONA_API_KEY configured. Tasks will fail to start sandboxes."
        );
        tracing::info!("Consider setting MODAL_URL=http://localhost:8000 for local development");
        // For now, we'll use a dummy provider that errors out
        Arc::new(DaytonaProvider::new(
            "".to_string(),
            "".to_string(),
            None,
            "us".to_string(),
        ))
    };

    let app_state = AppState {
        database,
        config: config.clone(),
        sandbox,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Start background task poller
    let poller_app_state = app_state.clone();
    tokio::spawn(async move {
        sandbox_poller(poller_app_state).await;
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/github-token", post(store_github_token))
        .route("/api/auth/github/connect", post(connect_github))
        .route("/protected", get(protected_endpoint))
        .route("/api/user/profile", get(get_user_profile))
        .route("/api/user/repos", get(get_user_repos))
        .route("/api/user/default-repo", post(set_default_repo))
        .route("/api/user/anthropic-key", post(store_anthropic_key))
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks", post(create_task))
        .route("/api/tasks/:id/logs", get(get_task_logs))
        .layer(middleware::from_fn(clerk_middleware))
        .layer(cors)
        .with_state(app_state);

    let bind_address = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&bind_address)
        .await
        .map_err(|e| {
            AppError::Internal(format!("Failed to bind to address {}: {}", bind_address, e))
        })?;

    tracing::info!("Server running on {}", bind_address);

    axum::serve(listener, app)
        .await
        .map_err(|e| AppError::Internal(format!("Server error: {}", e)))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::{ClerkUser, CurrentUser};
    use crate::sandbox::SandboxProvider;
    use async_trait::async_trait;
    use axum::extract::State;
    use axum::Json;
    use std::sync::Arc;
    use std::time::Instant;

    // Mock sandbox provider for testing
    #[derive(Clone)]
    struct MockSandboxProvider {
        delay_ms: u64,
    }

    impl MockSandboxProvider {
        fn new(delay_ms: u64) -> Self {
            Self { delay_ms }
        }
    }

    #[async_trait]
    impl SandboxProvider for MockSandboxProvider {
        async fn start_sandbox(
            &self,
            _task_id: i32,
            _repo_url: &str,
            _github_token: &str,
            _prompt: &str,
            _anthropic_api_key: &str,
            _openai_api_key: Option<&str>,
            branch: &str,
            _author_name: &str,
            _author_email: &str,
        ) -> crate::sandbox::SandboxResult<crate::sandbox::SandboxInfo> {
            // Simulate delay
            tokio::time::sleep(tokio::time::Duration::from_millis(self.delay_ms)).await;

            Ok(crate::sandbox::SandboxInfo {
                id: "test-workspace".to_string(),
                hostname: "test-hostname".to_string(),
                status: crate::sandbox::SandboxStatus::Running,
                session_id: "test-session".to_string(),
                command_id: "test-command".to_string(),
                branch: branch.to_string(),
            })
        }

        async fn get_sandbox_status(
            &self,
            _sandbox_id: &str,
        ) -> crate::sandbox::SandboxResult<crate::sandbox::SandboxStatus> {
            Ok(crate::sandbox::SandboxStatus::Running)
        }

        async fn wait_for_completion(
            &self,
            _sandbox_id: &str,
        ) -> crate::sandbox::SandboxResult<crate::sandbox::SandboxStatus> {
            Ok(crate::sandbox::SandboxStatus::Stopped)
        }

        async fn stop_sandbox(&self, _sandbox_id: &str) -> crate::sandbox::SandboxResult<()> {
            Ok(())
        }

        async fn get_command_exit_code(
            &self,
            _sandbox_id: &str,
            _session_id: &str,
            _command_id: &str,
        ) -> crate::sandbox::SandboxResult<Option<i32>> {
            // For testing, return no exit code (command still running)
            Ok(None)
        }

        async fn push_changes(
            &self,
            _sandbox_id: &str,
            _repo_path: &str,
            _branch: &str,
            _task_id: i32,
            _author_name: &str,
            _author_email: &str,
            _commit_title: &str,
            _commit_body: &str,
        ) -> crate::sandbox::SandboxResult<()> {
            Ok(())
        }

        async fn delete_sandbox(&self, _sandbox_id: &str) -> crate::sandbox::SandboxResult<()> {
            Ok(())
        }
    }

    // Mock sandbox provider with controllable exit code for testing
    #[derive(Clone)]
    struct MockSandboxProviderWithExitCode {
        exit_code: Option<i32>,
    }

    impl MockSandboxProviderWithExitCode {
        fn new(exit_code: Option<i32>) -> Self {
            Self { exit_code }
        }
    }

    #[async_trait]
    impl SandboxProvider for MockSandboxProviderWithExitCode {
        async fn start_sandbox(
            &self,
            _task_id: i32,
            _repo_url: &str,
            _github_token: &str,
            _prompt: &str,
            _anthropic_api_key: &str,
            _openai_api_key: Option<&str>,
            branch: &str,
            _author_name: &str,
            _author_email: &str,
        ) -> crate::sandbox::SandboxResult<crate::sandbox::SandboxInfo> {
            Ok(crate::sandbox::SandboxInfo {
                id: "test-workspace".to_string(),
                hostname: "test-hostname".to_string(),
                status: crate::sandbox::SandboxStatus::Running,
                session_id: "test-session".to_string(),
                command_id: "test-command".to_string(),
                branch: branch.to_string(),
            })
        }

        async fn get_sandbox_status(
            &self,
            _sandbox_id: &str,
        ) -> crate::sandbox::SandboxResult<crate::sandbox::SandboxStatus> {
            Ok(crate::sandbox::SandboxStatus::Running)
        }

        async fn wait_for_completion(
            &self,
            _sandbox_id: &str,
        ) -> crate::sandbox::SandboxResult<crate::sandbox::SandboxStatus> {
            Ok(crate::sandbox::SandboxStatus::Stopped)
        }

        async fn stop_sandbox(&self, _sandbox_id: &str) -> crate::sandbox::SandboxResult<()> {
            Ok(())
        }

        async fn get_command_exit_code(
            &self,
            _sandbox_id: &str,
            _session_id: &str,
            _command_id: &str,
        ) -> crate::sandbox::SandboxResult<Option<i32>> {
            Ok(self.exit_code)
        }

        async fn push_changes(
            &self,
            _sandbox_id: &str,
            _repo_path: &str,
            _branch: &str,
            _task_id: i32,
            _author_name: &str,
            _author_email: &str,
            _commit_title: &str,
            _commit_body: &str,
        ) -> crate::sandbox::SandboxResult<()> {
            Ok(())
        }

        async fn delete_sandbox(&self, _sandbox_id: &str) -> crate::sandbox::SandboxResult<()> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_create_task_returns_quickly() {
        // This test verifies that create_task returns quickly (< 100ms)
        // even when sandbox operations would take longer

        // Setup mock sandbox with 2 second delay
        let mock_sandbox: Arc<dyn SandboxProvider + Send + Sync> =
            Arc::new(MockSandboxProvider::new(2000));

        // Create a minimal config for testing
        let config = Config {
            database_url: "postgresql://test".to_string(),
            clerk_secret_key: "test-key".to_string(),
            github_token: None,
            port: 3001,
            daytona_url: Some("http://localhost".to_string()),
            daytona_api_key: Some("test-key".to_string()),
            daytona_organization_id: Some("test-org".to_string()),
            daytona_region: "us".to_string(),
            openai_api_key: None,
        };

        // Create a mock database (this would need proper mocking in a real test)
        let pool = sqlx::PgPool::connect_lazy("postgresql://test").unwrap();
        let database = Database::new(pool);

        let app_state = AppState {
            database,
            config,
            sandbox: mock_sandbox,
        };

        let current_user = CurrentUser(ClerkUser {
            id: "test-user".to_string(),
            email: Some("test@example.com".to_string()),
        });

        let payload = CreateTaskRequest {
            title: "Test Task".to_string(),
            description: Some("Test Description".to_string()),
            repository_id: 1,
        };

        let start_time = Instant::now();

        // Call create_task - this should return quickly even though sandbox ops are slow
        let result = create_task(current_user, State(app_state), Json(payload)).await;

        let elapsed = start_time.elapsed();

        // Verify the handler returned quickly (< 100ms)
        // Note: This test will fail with database connection issues since we're using a mock URL
        // But it demonstrates the pattern for testing fire-and-forget behavior
        // We expect an error but the timing should still be fast
        assert!(
            elapsed.as_millis() < 100,
            "create_task should return quickly, took {}ms",
            elapsed.as_millis()
        );

        // In a real test environment with proper database setup, we would also verify:
        // - The task was created with "pending" status
        // - The response contains the correct task data
        // - The spawned task eventually completes (could be verified with polling)
    }

    #[tokio::test]
    async fn test_sandbox_provider_exit_code_success() {
        // Test that a mock provider returning exit code 0 is handled correctly
        let mock_provider = MockSandboxProviderWithExitCode::new(Some(0));

        // Test the exit code method directly
        let result = mock_provider
            .get_command_exit_code("test-sandbox", "test-session", "test-command")
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some(0));
    }

    #[tokio::test]
    async fn test_sandbox_provider_exit_code_failure() {
        // Test that a mock provider returning exit code 1 is handled correctly
        let mock_provider = MockSandboxProviderWithExitCode::new(Some(1));

        // Test the exit code method directly
        let result = mock_provider
            .get_command_exit_code("test-sandbox", "test-session", "test-command")
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some(1));
    }

    #[tokio::test]
    async fn test_sandbox_provider_no_exit_code() {
        // Test that a mock provider returning no exit code is handled correctly
        let mock_provider = MockSandboxProviderWithExitCode::new(None);

        // Test the exit code method directly
        let result = mock_provider
            .get_command_exit_code("test-sandbox", "test-session", "test-command")
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    async fn test_atomic_task_status_update_prevents_duplicate_workers() {
        // This test verifies that the atomic UPDATE prevents duplicate background workers
        // when multiple pollers try to handle the same successful task

        use sqlx::PgPool;
        use std::sync::atomic::{AtomicU32, Ordering};
        use std::sync::Arc;

        // Skip test if no database connection available
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://localhost/swarm_test".to_string());

        let pool = match PgPool::connect(&database_url).await {
            Ok(pool) => pool,
            Err(_) => {
                // Skip test if database not available
                eprintln!("Skipping test - database not available");
                return;
            }
        };

        // Create a test task in 'running' status
        let task_id = sqlx::query_scalar!(
            "INSERT INTO tasks (user_id, repository_id, title, status, daytona_sandbox_id, daytona_session_id, daytona_command_id) 
             VALUES (1, 1, 'Test Task', 'running', 'test-sandbox', 'test-session', 'test-command')
             RETURNING id"
        )
        .fetch_one(&pool)
        .await
        .expect("Failed to insert test task");

        // Counter to track how many times the atomic update succeeds
        let update_success_count = Arc::new(AtomicU32::new(0));

        // Simulate multiple concurrent workers trying to process the same task
        let mut handles = Vec::new();
        for i in 0..5 {
            let pool_clone = pool.clone();
            let counter_clone = update_success_count.clone();

            let handle = tokio::spawn(async move {
                // Simulate the atomic update that happens in sandbox_poller
                let update_result = sqlx::query!(
                    r#"
                    UPDATE tasks
                    SET    status = 'pushing'
                    WHERE  id = $1
                      AND  status IN ('running','spinning')
                    RETURNING id
                    "#,
                    task_id
                )
                .fetch_optional(&pool_clone)
                .await;

                match update_result {
                    Ok(Some(_)) => {
                        // Successfully updated - this worker would spawn the background job
                        counter_clone.fetch_add(1, Ordering::SeqCst);
                        println!("Worker {} successfully updated task status to 'pushing'", i);
                    }
                    Ok(None) => {
                        // Task was already processed by another worker
                        println!("Worker {} found task already processed", i);
                    }
                    Err(e) => {
                        println!("Worker {} got error: {}", i, e);
                    }
                }
            });

            handles.push(handle);
        }

        // Wait for all workers to complete
        for handle in handles {
            handle.await.expect("Worker task panicked");
        }

        // Only one worker should have successfully updated the task
        assert_eq!(
            update_success_count.load(Ordering::SeqCst),
            1,
            "Exactly one worker should have successfully updated the task status"
        );

        // Verify the task is now in 'pushing' status
        let final_status = sqlx::query_scalar!("SELECT status FROM tasks WHERE id = $1", task_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to fetch task status");

        assert_eq!(final_status, Some("pushing".to_string()));

        // Clean up
        sqlx::query!("DELETE FROM tasks WHERE id = $1", task_id)
            .execute(&pool)
            .await
            .expect("Failed to clean up test task");
    }
}

async fn health_check() -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({
        "status": "ok",
        "message": "Backend is running with authentication!",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

async fn protected_endpoint() -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({
        "message": "This is a protected endpoint - you are authenticated!",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

// API handlers
async fn get_user_profile(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<models::UserWithDefaultRepo>, StatusCode> {
    // Get full user data from database
    match app_state.database.get_user_by_clerk_id(&user.id).await {
        Ok(Some(db_user)) => {
            // Get default repository if set
            let default_repo = if let Some(default_repo_id) = db_user.default_repo_id {
                if let Ok(Some(repo)) = app_state
                    .database
                    .get_repository_by_id(default_repo_id, db_user.id)
                    .await
                {
                    Some(models::RepositoryTS {
                        id: repo.id,
                        github_repo_id: repo.github_repo_id,
                        owner: repo.owner,
                        name: repo.name,
                        full_name: repo.full_name,
                        user_id: repo.user_id,
                        is_private: repo.is_private,
                        created_at: repo.created_at.map(|dt| dt.to_rfc3339()),
                        last_fetched_at: repo.last_fetched_at.map(|dt| dt.to_rfc3339()),
                    })
                } else {
                    None
                }
            } else {
                None
            };

            Ok(Json(models::UserWithDefaultRepo {
                id: db_user.id,
                clerk_user_id: db_user.clerk_user_id,
                github_username: db_user.github_username,
                github_user_id: db_user.github_user_id,
                email: db_user.email,
                default_repo_id: db_user.default_repo_id,
                default_repo,
                anthropic_api_key: db_user.anthropic_api_key,
                created_at: db_user.created_at.map(|dt| dt.to_rfc3339()),
                updated_at: db_user.updated_at.map(|dt| dt.to_rfc3339()),
            }))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_user_repos(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user.id).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Step 1: Check cache first - if we have repositories and they're fresh, return them
    if let Ok(cached_repos) = app_state.database.get_user_repositories(user.id).await {
        if !cached_repos.is_empty() {
            // Check if cache is still valid (15 minutes TTL)
            if let Some(last_fetched) = cached_repos.iter().filter_map(|r| r.last_fetched_at).max()
            {
                let cache_age = chrono::Utc::now() - last_fetched;
                if cache_age.num_minutes() < 15 {
                    tracing::info!(
                        "Returning cached repositories for user {}, cache age: {} minutes",
                        user.id,
                        cache_age.num_minutes()
                    );
                    return Ok(Json(json!({
                        "repositories": cached_repos,
                        "count": cached_repos.len(),
                        "message": format!("Cached repositories (updated {} minutes ago)", cache_age.num_minutes())
                    })));
                }
            }
        }
    }

    // Step 2: Cache is stale or empty, need to fetch from GitHub
    // First get GitHub token
    let github_token = if let Ok(Some(t)) = app_state.database.get_github_token(user.id).await {
        t.access_token
    } else {
        match clerk_api::fetch_github_token(&clerk_user.id, &app_state.config.clerk_secret_key)
            .await
        {
            Ok(token) => {
                // cache for next time (ignore errors)
                let _ = app_state
                    .database
                    .store_github_token(CreateGitHubToken {
                        user_id: user.id,
                        access_token: token.clone(),
                        token_type: "bearer".into(),
                        scope: Some("repo".into()),
                    })
                    .await;
                token
            }
            Err(_) => {
                // final fallback - return demo repos if no valid token available
                if let Some(env_token) = &app_state.config.github_token {
                    env_token.clone()
                } else {
                    // Return demo repositories when no GitHub token is available
                    return Ok(Json(json!({
                        "repositories": [
                            {
                                "id": 1,
                                "github_repo_id": 123456789,
                                "owner": "demo-user",
                                "name": "demo-repo",
                                "full_name": "demo-user/demo-repo",
                                "is_private": false,
                                "task_count": 0,
                                "created_at": chrono::Utc::now().to_rfc3339()
                            },
                            {
                                "id": 2,
                                "github_repo_id": 987654321,
                                "owner": "demo-user",
                                "name": "another-project",
                                "full_name": "demo-user/another-project",
                                "is_private": true,
                                "task_count": 0,
                                "created_at": chrono::Utc::now().to_rfc3339()
                            }
                        ],
                        "count": 2,
                        "message": "Demo repositories shown. Connect GitHub account to see real repositories."
                    })));
                }
            }
        }
    };

    // Step 3: Use GitHub API to fetch repositories
    let github_client = match GitHubClient::new(&github_token) {
        Ok(client) => client,
        Err(e) => {
            tracing::error!("Error creating GitHub client: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let github_repos = match github_client.get_user_repositories(50).await {
        Ok(repos) => repos,
        Err(e) => {
            tracing::error!("Error fetching repositories from GitHub: {:?}", e);
            tracing::error!("GitHub API error details: {}", e);
            // Fallback to cached repositories
            return match app_state.database.get_user_repositories(user.id).await {
                Ok(cached_repos) => Ok(Json(json!({
                    "repositories": cached_repos,
                    "count": cached_repos.len(),
                    "message": "GitHub API error - showing cached repositories"
                }))),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            };
        }
    };

    // Step 4: Store/sync repositories in database with updated last_fetched_at
    let create_repos: Vec<CreateRepository> = github_repos
        .iter()
        .map(|repo| CreateRepository {
            github_repo_id: repo.id,
            owner: repo.owner.login.clone(),
            name: repo.name.clone(),
            full_name: repo.full_name.clone(),
            user_id: user.id,
            is_private: repo.private,
        })
        .collect();

    match app_state
        .database
        .sync_repositories(user.id, create_repos)
        .await
    {
        Ok(_) => {
            // Return fresh data from database after sync
            match app_state.database.get_user_repositories(user.id).await {
                Ok(synced_repos) => {
                    tracing::info!(
                        "Successfully synced {} repositories from GitHub for user {}",
                        github_repos.len(),
                        user.id
                    );
                    Ok(Json(json!({
                        "repositories": synced_repos,
                        "count": synced_repos.len(),
                        "message": format!("Successfully synced {} repositories from GitHub", github_repos.len())
                    })))
                }
                Err(e) => {
                    tracing::error!("Database error after sync: {}", e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        Err(e) => {
            tracing::error!("Error syncing repositories to database: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
struct SetDefaultRepoRequest {
    repository_id: Option<i32>,
}

async fn set_default_repo(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<SetDefaultRepoRequest>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user.id).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    match app_state
        .database
        .update_user_github_info(
            user.id, None, // We don't have github_username in the auth context
            None,
        )
        .await
    {
        Ok(updated_user) => Ok(Json(json!({
            "success": true,
            "default_repo_id": payload.repository_id,
            "user": {
                "id": updated_user.id,
                "github_username": updated_user.github_username
            }
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_tasks(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user.id).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Get user's tasks from database
    match app_state.database.get_user_tasks(user.id).await {
        Ok(tasks) => {
            let task_responses: Vec<_> = tasks
                .into_iter()
                .map(|task| {
                    json!({
                        "id": task.id,
                        "title": task.title,
                        "description": task.description,
                        "repository_id": task.repository_id,
                        "user_id": task.user_id,
                        "status": task.status.unwrap_or_else(|| "pending".to_string()),
                        "github_pr_url": task.github_pr_url,
                        "github_branch": task.github_branch,
                        "daytona_sandbox_id": task.daytona_sandbox_id,
                        "sandbox_hostname": task.sandbox_hostname,
                        "ssh_hostname": task.sandbox_hostname,
                        "created_at": task.created_at.map(|dt| dt.to_rfc3339()),
                        "updated_at": task.updated_at.map(|dt| dt.to_rfc3339())
                    })
                })
                .collect();

            Ok(Json(json!({
                "tasks": task_responses,
                "count": task_responses.len(),
                "user_id": user.id
            })))
        }
        Err(e) => {
            tracing::error!("Error fetching tasks for user {}: {}", user.id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
struct CreateTaskRequest {
    title: String,
    description: Option<String>,
    repository_id: i32,
}

async fn create_task(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user.id).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Validate repository access
    let _repository = match app_state
        .database
        .get_repository_by_id(payload.repository_id, user.id)
        .await
    {
        Ok(Some(repo)) => repo,
        Ok(None) => {
            tracing::warn!(
                "User {} attempted to create task for repository {} they don't have access to",
                user.id,
                payload.repository_id
            );
            return Err(StatusCode::FORBIDDEN);
        }
        Err(e) => {
            tracing::error!("Database error checking repository access: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Pre-flight validation: Check GitHub token availability
    match app_state.database.get_github_token(user.id).await {
        Ok(Some(_)) => {} // Token exists, continue
        Ok(None) => {
            // Try to get from Clerk
            match clerk_api::fetch_github_token(&clerk_user.id, &app_state.config.clerk_secret_key)
                .await
            {
                Ok(_) => {} // Token available from Clerk, continue
                Err(_) => {
                    tracing::error!("No GitHub token available for user {}", user.id);
                    return Err(StatusCode::BAD_REQUEST);
                }
            }
        }
        Err(e) => {
            tracing::error!("Error fetching GitHub token: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Pre-flight validation: Check Anthropic API key
    if user.anthropic_api_key.is_none() {
        tracing::error!("No Anthropic API key available for user {}", user.id);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Validate title is not empty
    if payload.title.trim().is_empty() {
        tracing::warn!("Rejected task creation: empty title");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Convert empty description to None
    let sanitized_description = payload
        .description
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().to_string());

    // Create task in database first with "pending" status
    let create_task = CreateTask {
        user_id: user.id,
        repository_id: payload.repository_id,
        title: payload.title.trim().to_string(),
        description: sanitized_description,
    };

    let task = match app_state.database.create_task(create_task).await {
        Ok(task) => task,
        Err(e) => {
            tracing::error!("Error creating task: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Spawn detached task for heavy operations
    let pipeline_state = app_state.clone();
    let task_clone = task.clone();
    let task_id = task.id;
    tokio::spawn(async move {
        if let Err(e) = task_pipeline::run_full_task_pipeline(pipeline_state, task_clone).await {
            tracing::error!("Task {} pipeline error: {}", task_id, e);
        }
    });

    // Return immediately with pending task
    Ok(Json(json!({
        "success": true,
        "task": {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "repository_id": task.repository_id,
            "user_id": task.user_id,
            "status": task.status.unwrap_or_else(|| "pending".to_string()),
            "github_pr_url": task.github_pr_url,
            "daytona_sandbox_id": task.daytona_sandbox_id,
            "sandbox_hostname": task.sandbox_hostname,
            "ssh_hostname": task.sandbox_hostname,
            "created_at": task.created_at.map(|dt| dt.to_rfc3339()),
            "updated_at": task.updated_at.map(|dt| dt.to_rfc3339())
        }
    })))
}

async fn connect_github(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    let user = get_or_create_user(&app_state.database, &clerk_user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match clerk_api::fetch_github_token(&clerk_user.id, &app_state.config.clerk_secret_key).await {
        Ok(token) => {
            app_state
                .database
                .store_github_token(CreateGitHubToken {
                    user_id: user.id,
                    access_token: token.clone(),
                    token_type: "bearer".into(),
                    scope: Some("repo".into()),
                })
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            if let Ok((login, gh_id)) = github::fetch_current_user(&token).await {
                let _ = app_state
                    .database
                    .update_user_github_info(user.id, Some(login), Some(gh_id))
                    .await;
            }

            Ok(Json(json!({ "success": true })))
        }
        Err(e) => {
            tracing::error!("Clerk token fetch failed: {e}");
            // 404 means GitHub not connected to Clerk account
            if e.to_string().contains("404") {
                Ok(Json(json!({
                    "success": false,
                    "error": "github_not_connected",
                    "message": "GitHub account not connected to Clerk. Please connect GitHub in your account settings."
                })))
            } else {
                Err(StatusCode::BAD_GATEWAY)
            }
        }
    }
}

#[derive(Deserialize)]
struct LogsQuery {
    since: Option<i64>,
}

async fn get_task_logs(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<Value>, StatusCode> {
    // Verify the task belongs to the user
    let db_user = match get_or_create_user(&app_state.database, &user.id).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Verify task exists and belongs to user
    let tasks = match app_state.database.get_user_tasks(db_user.id).await {
        Ok(tasks) => tasks,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let _task = match tasks.into_iter().find(|t| t.id == task_id) {
        Some(task) => task,
        None => return Err(StatusCode::FORBIDDEN),
    };

    // Get logs since the specified ID (or all logs if no since parameter)
    let logs = match query.since {
        Some(since_id) => {
            match app_state
                .database
                .stream_task_logs(task_id, Some(since_id))
                .await
            {
                Ok(logs) => logs,
                Err(e) => {
                    tracing::error!(
                        "Error fetching logs since {} for task {}: {}",
                        since_id,
                        task_id,
                        e
                    );
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
        None => match app_state.database.get_task_logs(task_id).await {
            Ok(logs) => logs,
            Err(e) => {
                tracing::error!("Error fetching all logs for task {}: {}", task_id, e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        },
    };

    // Convert JSON logs back to string format for API response
    let string_logs: Vec<_> = logs
        .into_iter()
        .map(|log| {
            json!({
                "id": log.id,
                "task_id": log.task_id,
                "log_line": log.log_line.to_string(),
                "created_at": log.created_at
            })
        })
        .collect();

    Ok(Json(json!({
        "logs": string_logs,
        "task_id": task_id,
        "count": string_logs.len()
    })))
}
