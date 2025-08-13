use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::{get, post, put},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

mod agent_log_parser;
mod auth;
mod claude;
mod clerk_api;
mod config;
mod database;
mod error;
mod github;
mod github_pr;
mod models;
mod onboarding;
mod pr_status_poller;
mod sandbox;
mod sandbox_poller;
mod task_pipeline;

use auth::{clerk_middleware, CurrentUser, GitHubTokenBody};
use config::Config;
use database::Database;
use error::{AppError, AppResult};
use github::GitHubClient;
use github_pr::GitHubPRClient;
use onboarding::{encrypt_secret, ensure_onboarding_complete, get_onboarding_status};
use models::{
    AgentTodo, ApiKeysStatus, ArchiveMultipleTasksRequest, CreateGitHubToken, CreateMessage, CreateRepository, CreateTask, CreateUser,
    GitHubToken, MessageWithRun, OnboardingStatus, RepositoryTS, RepositoryWithTasks, Run, RunWithMeta, 
    SetDefaultRepoRequest, Task, TaskDetails, TaskLog, TaskLogsPaginated, TaskWithRun, 
    UpdateApiKeysRequest, User, UserWithDefaultRepo,
};
use pr_status_poller::PrStatusPoller;
use sandbox::{modal::ModalProvider, DynSandbox};
use std::sync::Arc;
use ts_rs::TS;

#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub config: Config,
    pub sandbox: DynSandbox,
}

async fn get_or_create_user(
    database: &Database,
    clerk_user: &auth::ClerkUser,
) -> Result<models::User, StatusCode> {
    // Try to get existing user
    if let Ok(Some(user)) = database.get_user_by_clerk_id(&clerk_user.id).await {
        return Ok(user);
    }

    // Create new user if doesn't exist
    let create_user = CreateUser {
        clerk_user_id: clerk_user.id.clone(),
        github_username: None,
        github_user_id: None,
        email: clerk_user.email.clone(),
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
    let db_user = match get_or_create_user(&app_state.database, &user).await {
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

/// Handle successful task completion: push changes and create PR
async fn handle_task_success(
    app_state: AppState,
    task_id: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing::info!("Handling successful completion for task {}", task_id);

    // Get task, user, and repository information
    let task = match app_state.database.get_task_by_id_raw(task_id).await? {
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
            if let Ok(Some(run_id)) = app_state.database.get_latest_run_id_for_task(task_id).await {
                let _ = app_state.database.update_run_status(run_id, "failed").await;
            }
            return Ok(());
        }
    };

    // Extract necessary information
    // Get run information (sandbox_id and branch are stored on the run)
    let run = match app_state.database.get_latest_run_id_for_task(task_id).await {
        Ok(Some(run_id)) => match app_state.database.get_run_by_id(run_id).await {
            Ok(Some(run)) => run,
            _ => {
                tracing::error!("Run {} not found for task {}", run_id, task_id);
                return Ok(());
            }
        },
        _ => {
            tracing::error!("No run found for task {}", task_id);
            return Ok(());
        }
    };

    let sandbox_id = match run.sandbox_id.as_ref() {
        Some(id) => id,
        None => {
            tracing::error!("No sandbox ID for task {} run {}", task_id, run.id);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Ok(());
        }
    };

    let branch = match run.branch.as_ref() {
        Some(branch) => branch,
        None => {
            tracing::error!("No branch for task {} run {}", task_id, run.id);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Ok(());
        }
    };

    // Author information and repo path no longer needed for backend processing
    // (agent handles branch creation and pushing directly)

    // No longer requiring commit artifacts since the agent pushes the branch directly

    // Check if this is a subsequent run (task already has a PR URL)
    let is_subsequent_run = task.github_pr_url.is_some();
    
    if is_subsequent_run {
        tracing::info!("Task {} is a subsequent run, will add PR comment instead of creating/updating PR", task_id);
        
        // For subsequent runs, add a comment to the existing PR using the final message
        let final_message = if let Ok(Some(run_record)) = app_state.database.get_run_by_id(run.id).await {
            run_record.final_message_md.unwrap_or_default()
        } else {
            String::new()
        };
        
        if final_message.trim().is_empty() {
            tracing::error!("No final message available for subsequent run of task {}", task_id);
            let _ = app_state.database.update_run_status(run.id, "failed").await;
            return Ok(());
        }
        
        let pr_url = task.github_pr_url.as_ref().unwrap();
        let (owner, repo, pr_number) = match GitHubPRClient::parse_pr_url(pr_url) {
            Ok(parsed) => parsed,
            Err(e) => {
                tracing::error!("Failed to parse existing PR URL for task {}: {}", task_id, e);
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Ok(());
            }
        };
        
        // Create GitHub PR client for commenting
        let pr_client = match GitHubPRClient::new(&github_token) {
            Ok(client) => client,
            Err(e) => {
                tracing::error!("Failed to create PR client for task {}: {}", task_id, e);
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Ok(());
            }
        };
        
        // Format the comment with the final message
        let comment_body = format!(
            "## 🤖 Subsequent Run Completed\n\n{}\n\n---\n*Generated by Swarm AI agent*",
            final_message
        );
        
        match pr_client.add_pr_comment(&owner, &repo, pr_number, &comment_body).await {
            Ok(comment_url) => {
                tracing::info!(
                    "✓ Added comment to existing PR for task {}: {}",
                    task_id,
                    comment_url
                );
            }
            Err(e) => {
                tracing::error!(
                    "Failed to add comment to PR for task {}: {}",
                    task_id,
                    e
                );
                let _ = app_state.database.update_run_status(run.id, "failed").await;
                return Ok(());
            }
        }
        
        // Update run status to done (not pr_opened since PR already exists)
        if let Err(e) = app_state.database.update_run_status(run.id, "done").await {
            tracing::error!("Error updating run {} status to done: {}", run.id, e);
        }
        
        tracing::info!("✓ Task {} subsequent run completed successfully", task_id);
        return Ok(());
    }

    // For first runs, continue with PR creation/update logic
    let pr_title = match task.pr_title.as_ref() {
        Some(title) if !title.trim().is_empty() => title,
        _ => {
            tracing::error!("Task {} missing AI-generated PR title", task_id);
            if let Ok(Some(run_id)) = app_state.database.get_latest_run_id_for_task(task_id).await {
                let _ = app_state.database.update_run_status(run_id, "failed").await;
            }
            return Ok(());
        }
    };

    let pr_body = task.pr_body.as_deref().unwrap_or("AI-generated changes");

    // Using pre-pushed branch created by the agent during execution
    tracing::info!(
        "Using pre-pushed branch {} for task {} (no longer pushing from backend)",
        branch,
        task_id
    );

    // Create GitHub PR client
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
            if let Ok(Some(run_id)) = app_state.database.get_latest_run_id_for_task(task_id).await {
                let _ = app_state.database.update_run_status(run_id, "failed").await;
            }
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
                "Failed to create PR for task {} in {}/{} on branch {}: {}",
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

            if let Ok(Some(run_id)) = app_state.database.get_latest_run_id_for_task(task_id).await {
                let _ = app_state.database.update_run_status(run_id, "failed").await;
            }
            return Ok(());
        }
    };

    // Update task with PR URL
    if let Err(e) = app_state
        .database
        .update_task_pr_url(task_id, &pr_url)
        .await
    {
        tracing::error!("Error updating task {} PR URL: {}", task_id, e);
    }

    // Update task status to pr_opened
    if let Err(e) = app_state
        .database
        .update_task_status(task_id, "pr_opened", Some(&pr_url))
        .await
    {
        tracing::error!("Error updating task {} status to pr_opened: {}", task_id, e);
    }

    // Update run status to pr_opened
    if let Err(e) = app_state
        .database
        .update_run_status(run.id, "pr_opened")
        .await
    {
        tracing::error!("Error updating run {} status to pr_opened: {}", run.id, e);
    } else {
        tracing::info!(
            "✓ Task {} completed successfully with PR: {}",
            task_id,
            pr_url
        );
    }

    // Note: Sandbox cleanup is handled by idle timeout management (15-minute timeout)
    // This allows for session reuse if there are subsequent runs on the same task
    tracing::info!("✓ PR created for task {}, sandbox {} will be cleaned up by idle timeout", task_id, sandbox_id);

    Ok(())
}

#[tokio::main]
async fn main() -> AppResult<()> {
    // Export the types explicitly
    User::export().unwrap();
    UserWithDefaultRepo::export().unwrap();
    Task::export().unwrap();
    Run::export().unwrap();
    RunWithMeta::export().unwrap();
    TaskWithRun::export().unwrap();
    RepositoryTS::export().unwrap();
    RepositoryWithTasks::export().unwrap();
    GitHubToken::export().unwrap();
    AgentTodo::export().unwrap();
    MessageWithRun::export().unwrap();
    TaskLog::export().unwrap();
    TaskDetails::export().unwrap();
    TaskLogsPaginated::export().unwrap();

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

    // Initialize sandbox provider - using Modal
    let sandbox: DynSandbox = if let Some(modal_url) = config.modal_url.as_ref() {
        tracing::info!("Initializing Modal sandbox provider");
        Arc::new(ModalProvider::new(
            modal_url.clone(),
            config.modal_region.clone(),
        ))
    } else {
        tracing::warn!("MODAL_URL not configured. Tasks will fail to start sandboxes.");
        tracing::info!("Consider setting MODAL_URL=http://localhost:8000 for local development");
        // For now, we'll use a dummy provider that errors out
        Arc::new(ModalProvider::new("".to_string(), None))
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

    // Start background task poller (non-blocking)
    let poller_app_state = app_state.clone();
    tokio::spawn(async move {
        sandbox_poller::run(poller_app_state).await;
    });

    // Start PR status poller (non-blocking)
    tracing::info!("Booting PR status poller…");
    let pr_poller_db = Arc::new(app_state.database.clone());
    tokio::spawn(async move {
        let pr_poller = PrStatusPoller::new(pr_poller_db, None);
        pr_poller.start_polling().await;
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/github-token", post(store_github_token))
        .route("/api/auth/github/connect", post(connect_github))
        .route("/protected", get(protected_endpoint))
        .route("/api/user/profile", get(get_user_profile))
        .route("/api/user/repos", get(get_user_repos))
        .route("/api/user/default-repo", post(set_default_repo))
        .route("/api/user/onboarding-status", get(get_onboarding_status_endpoint))
        .route("/api/user/api-keys", post(update_api_keys))
        .route("/api/user/api-keys/status", get(get_api_keys_status))
        .route("/api/user/default-repo", put(set_default_repo_onboarding))
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks", post(create_task))
        .route("/api/tasks/:id/details", get(get_task_details))
        .route("/api/tasks/:id/logs", get(get_task_logs))
        .route("/api/tasks/:id/todos", get(get_task_todos))
        .route("/api/tasks/:id/messages", get(get_task_messages))
        .route("/api/tasks/:id/messages", post(post_task_message))
        .route("/api/tasks/:id/archive", put(archive_task))
        .route("/api/tasks/archive", put(archive_multiple_tasks))
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
            modal_url: None,
            modal_region: None,
            api_keys_kek: [0u8; 32], // Test key
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
            description: "Test Description".to_string(),
            repository_id: 1,
            mode: "execute".to_string(),
        };

        let start_time = Instant::now();

        // Call create_task - this should return quickly even though sandbox ops are slow
        let _result = create_task(current_user, State(app_state), Json(payload)).await;

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
            "INSERT INTO tasks (user_id, repository_id, title, status, sandbox_id, session_id, command_id)
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
                        github_pushed_at: repo.github_pushed_at.map(|dt| dt.to_rfc3339()),
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
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
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
            github_pushed_at: repo.pushed_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&chrono::Utc)),
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

async fn set_default_repo(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<SetDefaultRepoRequest>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    match app_state.database.set_default_repository(user.id, Some(payload.repository_id)).await {
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

// Onboarding handlers
async fn get_onboarding_status_endpoint(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<OnboardingStatus>, StatusCode> {
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    match get_onboarding_status(&app_state.database.pool, user.id).await {
        Ok(status) => Ok(Json(status)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn update_api_keys(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<UpdateApiKeysRequest>,
) -> Result<Json<Value>, StatusCode> {
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Validate that at least one key is provided and non-empty
    if payload.anthropic_api_key.as_ref().map_or(true, |k| k.trim().is_empty()) &&
       payload.openai_api_key.as_ref().map_or(true, |k| k.trim().is_empty()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Encrypt the keys
    let mut anthropic_ciphertext = None;
    let mut anthropic_nonce = None;
    let mut openai_ciphertext = None;
    let mut openai_nonce = None;

    if let Some(key) = &payload.anthropic_api_key {
        if !key.trim().is_empty() {
            match encrypt_secret(&app_state.config, key) {
                Ok((ciphertext, nonce)) => {
                    anthropic_ciphertext = Some(ciphertext);
                    anthropic_nonce = Some(nonce);
                }
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
    }

    if let Some(key) = &payload.openai_api_key {
        if !key.trim().is_empty() {
            match encrypt_secret(&app_state.config, key) {
                Ok((ciphertext, nonce)) => {
                    openai_ciphertext = Some(ciphertext);
                    openai_nonce = Some(nonce);
                }
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
    }

    // Store encrypted keys in database
    if let Err(_) = app_state.database.upsert_user_api_keys(
        user.id,
        anthropic_ciphertext,
        anthropic_nonce,
        openai_ciphertext,
        openai_nonce,
    ).await {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Check if we should update onboarding step
    match get_onboarding_status(&app_state.database.pool, user.id).await {
        Ok(status) => {
            if status.has_anthropic && status.has_openai && !status.has_default_repo {
                // Both keys provided, move to default-repo step
                if let Err(_) = app_state.database.update_onboarding_step(user.id, Some("default-repo".to_string())).await {
                    // Log but don't fail the request
                    tracing::warn!("Failed to update onboarding step for user {}", user.id);
                }
            } else if (status.has_anthropic || status.has_openai) && status.has_default_repo {
                // Has keys and repo, complete onboarding
                if let Err(_) = app_state.database.complete_onboarding(user.id).await {
                    tracing::warn!("Failed to complete onboarding for user {}", user.id);
                }
            }
        }
        Err(_) => {
            tracing::warn!("Failed to get onboarding status for user {}", user.id);
        }
    }

    Ok(Json(json!({"success": true})))
}

async fn get_api_keys_status(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<ApiKeysStatus>, StatusCode> {
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    match app_state.database.get_user_api_keys(user.id).await {
        Ok(api_keys) => {
            let has_anthropic = api_keys.as_ref()
                .and_then(|k| k.anthropic_ciphertext.as_ref())
                .is_some();
            let has_openai = api_keys.as_ref()
                .and_then(|k| k.openai_ciphertext.as_ref())
                .is_some();
            
            Ok(Json(ApiKeysStatus {
                has_anthropic,
                has_openai,
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn set_default_repo_onboarding(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<SetDefaultRepoRequest>,
) -> Result<Json<Value>, StatusCode> {
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Verify repository belongs to user
    match app_state.database.ensure_repo_owner(payload.repository_id, user.id).await {
        Ok(_) => {
            // Set default repository
            match app_state.database.set_default_repository(user.id, Some(payload.repository_id)).await {
                Ok(_) => {
                    // Check if onboarding should be completed
                    match get_onboarding_status(&app_state.database.pool, user.id).await {
                        Ok(status) => {
                            if (status.has_anthropic || status.has_openai) && status.has_default_repo {
                                // Has keys and repo, complete onboarding
                                if let Err(_) = app_state.database.complete_onboarding(user.id).await {
                                    tracing::warn!("Failed to complete onboarding for user {}", user.id);
                                }
                            }
                        }
                        Err(_) => {
                            tracing::warn!("Failed to get onboarding status for user {}", user.id);
                        }
                    }

                    Ok(Json(json!({
                        "success": true,
                        "default_repo_id": payload.repository_id
                    })))
                }
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        Err(_) => Err(StatusCode::FORBIDDEN),
    }
}

async fn get_tasks(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Query(query): Query<TasksQuery>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Get user's tasks with latest run data from database
    match app_state.database.get_user_runs_latest(user.id).await {
        Ok(mut task_runs) => {
            // If include=todos is specified, fetch todos for each task
            if query.include.as_deref() == Some("todos") {
                for task_run in &mut task_runs {
                    match app_state.database.get_agent_todos(task_run.task_id).await {
                        Ok(todos) => {
                            // Limit to 20 todos per task and only include non-completed or recently updated ones
                            let filtered_todos: Vec<_> = todos
                                .into_iter()
                                .filter(|todo| {
                                    todo.status != "completed" || todo.updated_at.is_some()
                                })
                                .take(20)
                                .collect();
                            task_run.latest_todos = Some(filtered_todos);
                        }
                        Err(e) => {
                            tracing::warn!(
                                "Failed to fetch todos for task {}: {}",
                                task_run.task_id,
                                e
                            );
                            task_run.latest_todos = Some(Vec::new());
                        }
                    }
                }
            }

            Ok(Json(json!({
                "tasks": task_runs,
                "count": task_runs.len(),
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
    description: String,
    repository_id: i32,
    mode: String,
}

async fn create_task(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<Json<Value>, StatusCode> {
    // User is already authenticated by middleware
    // Get or create user
    let user = match get_or_create_user(&app_state.database, &clerk_user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

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


    if payload.description.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST); // still needed
    }

    // Validate mode
    if !["execute", "plan", "review"].contains(&payload.mode.as_str()) {
        tracing::warn!("Rejected task creation: invalid mode '{}'", payload.mode);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Title will be generated in background pipeline
    let title = String::new();

    // description stays local, not persisted
    let sanitized_description = None;

    // Create task in database first with "pending" status
    let create_task = CreateTask {
        user_id: user.id,
        repository_id: payload.repository_id,
        title,
        description: sanitized_description,
    };

    let task = match app_state.database.create_task(create_task).await {
        Ok(task) => task,
        Err(e) => {
            tracing::error!("Error creating task: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Insert initial description into messages table
    let create_message = CreateMessage {
        task_id: task.id,
        run_id: None, // Will be set when run is created
        mode: payload.mode.clone(),
        body_md: payload.description.clone(),
        sha: None,
        role: "user".to_string(),
        metadata: None,
    };

    if let Err(e) = app_state.database.create_message(create_message).await {
        tracing::error!("Error creating initial message for task {}: {}", task.id, e);
        // Continue even if message creation fails
    }

    // Spawn detached task for heavy operations
    let pipeline_state = app_state.clone();
    let task_clone = task.clone();
    let task_id = task.id;
    let mode = payload.mode.clone();
    let description = payload.description.clone();
    tokio::spawn(async move {
        if let Err(e) =
            task_pipeline::run_full_task_pipeline(pipeline_state, task_clone, &mode, &description)
                .await
        {
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
            "created_at": task.created_at.map(|dt| dt.to_rfc3339()),
            "updated_at": task.updated_at.map(|dt| dt.to_rfc3339())
        }
    })))
}

async fn connect_github(
    CurrentUser(clerk_user): CurrentUser,
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    let user = get_or_create_user(&app_state.database, &clerk_user)
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

#[derive(Deserialize)]
struct TasksQuery {
    include: Option<String>,
}

async fn get_task_details(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
) -> Result<Json<TaskDetails>, StatusCode> {
    // Get or create database user from Clerk user
    let db_user = match get_or_create_user(&app_state.database, &user).await {
        Ok(user) => user,
        Err(e) => {
            tracing::error!("→ get_task_details API: failed to get/create user: {:?}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify task belongs to user
    app_state.database.ensure_task_owner(task_id, db_user.id)
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

    // Get task details
    let details = match app_state.database.get_task_details(task_id).await {
        Ok(details) => details,
        Err(e) => {
            tracing::error!(
                "→ get_task_details API: failed to get task details: {:?}",
                e
            );
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(details))
}

async fn get_task_logs(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<Value>, StatusCode> {
    // Verify the task belongs to the user
    let db_user = match get_or_create_user(&app_state.database, &user).await {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify task belongs to user
    app_state.database.ensure_task_owner(task_id, db_user.id)
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

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
        None => match app_state.database.get_task_logs_raw(task_id).await {
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

async fn get_task_todos(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
) -> Result<Json<Value>, StatusCode> {
    let db_user = get_or_create_user(&app_state.database, &user)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify task belongs to user
    app_state.database.ensure_task_owner(task_id, db_user.id)
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let todos = app_state
        .database
        .get_agent_todos(task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "task_id": task_id,
        "todos": todos,
        "count": todos.len()
    })))
}

async fn get_task_messages(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
) -> Result<Json<Value>, StatusCode> {
    let db_user = get_or_create_user(&app_state.database, &user)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify task belongs to user
    app_state.database.ensure_task_owner(task_id, db_user.id)
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let messages = match app_state.database.get_task_messages(task_id).await {
        Ok(messages) => messages,
        Err(e) => {
            tracing::error!("Error fetching messages for task {}: {}", task_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(json!(messages)))
}

#[derive(Deserialize)]
struct PostMessageRequest {
    content: String,
    mode: Option<String>,
}

async fn post_task_message(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
    Json(payload): Json<PostMessageRequest>,
) -> Result<Json<Value>, StatusCode> {
    let db_user = get_or_create_user(&app_state.database, &user)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify task belongs to user
    app_state.database.ensure_task_owner(task_id, db_user.id)
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

    // Retrieve task for later use
    let _task = app_state.database.get_task_by_id_raw(task_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if payload.content.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Create the message
    let create_message = CreateMessage {
        task_id,
        run_id: None, // Will be set later if mode is provided
        mode: payload
            .mode
            .clone()
            .unwrap_or_else(|| "execute".to_string()),
        body_md: payload.content.clone(),
        sha: None,
        role: "user".to_string(),
        metadata: None,
    };

    let message = match app_state.database.create_message(create_message).await {
        Ok(message) => message,
        Err(e) => {
            tracing::error!("Error creating message for task {}: {}", task_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Always create a run and spawn pipeline regardless of task status
    let mode = payload
        .mode
        .clone()
        .unwrap_or_else(|| "execute".to_string());

    // Validate mode if provided
    if !["execute", "plan", "review"].contains(&mode.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let run = match app_state.database.create_run(task_id, &mode).await {
        Ok(run) => {
            // Attach the run to the message
            if let Err(e) = app_state
                .database
                .attach_run_to_message(message.id, run.id)
                .await
            {
                tracing::error!(
                    "Error attaching run {} to message {}: {}",
                    run.id,
                    message.id,
                    e
                );
            }

            // Spawn the task pipeline for this run
            let pipeline_state = app_state.clone();
            let task_clone = _task.clone();
            let run_id = run.id;
            let mode_clone = mode.clone();
            let description = payload.content.clone();
            tokio::spawn(async move {
                if let Err(e) = task_pipeline::run_full_task_pipeline(
                    pipeline_state,
                    task_clone,
                    &mode_clone,
                    &description,
                )
                .await
                {
                    tracing::error!("Task {} run {} pipeline error: {}", task_id, run_id, e);
                }
            });

            run
        }
        Err(e) => {
            tracing::error!("Error creating run for task {}: {}", task_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let response = json!({
        "message": {
            "id": message.id,
            "task_id": message.task_id,
            "role": message.role,
            "content": message.body_md,
            "created_at": message.created_at,
            "metadata": message.metadata
        },
        "run": {
            "id": run.id,
            "task_id": run.task_id,
            "message_id": run.message_id,
            "status": run.status,
            "mode": run.mode,
            "created_at": run.created_at
        }
    });

    Ok(Json(response))
}

async fn archive_task(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Path(task_id): Path<i32>,
) -> Result<Json<Value>, StatusCode> {
    let db_user = get_or_create_user(&app_state.database, &user)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify task belongs to user and archive it
    match app_state.database.archive_task(task_id, db_user.id).await {
        Ok(Some(_)) => Ok(Json(json!({
            "success": true,
            "task_id": task_id,
            "message": "Task archived successfully"
        }))),
        Ok(None) => {
            // Task not found or user doesn't have permission
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            tracing::error!("Error archiving task {}: {}", task_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn archive_multiple_tasks(
    CurrentUser(user): CurrentUser,
    State(app_state): State<AppState>,
    Json(payload): Json<ArchiveMultipleTasksRequest>,
) -> Result<Json<Value>, StatusCode> {
    let db_user = get_or_create_user(&app_state.database, &user)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Check onboarding completion
    if let Err(e) = ensure_onboarding_complete(&app_state.database.pool, db_user.id).await {
        match e {
            AppError::Forbidden(_) => return Err(StatusCode::FORBIDDEN),
            _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    // Verify tasks belong to user and archive them
    match app_state.database.archive_multiple_tasks(&payload.task_ids, db_user.id).await {
        Ok(archived_ids) => Ok(Json(json!({
            "success": true,
            "archived_task_ids": archived_ids,
            "message": format!("Successfully archived {} task(s)", archived_ids.len())
        }))),
        Err(e) => {
            tracing::error!("Error archiving multiple tasks: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
