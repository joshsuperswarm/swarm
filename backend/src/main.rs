use axum::{
    extract::State,
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
mod models;
mod sandbox;

use auth::{clerk_middleware, CurrentUser, GitHubTokenBody, AnthropicApiKeyBody};
use config::Config;
use database::Database;
use error::{AppError, AppResult};
use github::GitHubClient;
use models::{CreateGitHubToken, CreateRepository, CreateTask, CreateUser};
use sandbox::{daytona::DaytonaProvider, DynSandbox, WorkspaceStatus};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

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
            access_token: body.access_token,
            token_type: "bearer".into(),
            scope: Some("repo".into()),
        })
        .await
    {
        Ok(_) => {
            tracing::info!("Successfully stored GitHub token for user {}", db_user.id);
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
            tracing::info!("Successfully stored Anthropic API key for user {}", db_user.id);
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
            "SELECT id, daytona_workspace_id, status FROM tasks 
             WHERE daytona_workspace_id IS NOT NULL 
             AND status IN ('spinning', 'running')"
        );
        
        let active_tasks = match active_tasks_query.fetch_all(&app_state.database.pool).await {
            Ok(tasks) => tasks,
            Err(e) => {
                tracing::error!("Error fetching active tasks: {}", e);
                continue;
            }
        };
        
        for task in active_tasks {
            let sandbox_id = match &task.daytona_workspace_id {
                Some(id) => id,
                None => continue,
            };
            
            // Check sandbox status
            match app_state.sandbox.get_sandbox_status(&sandbox_id).await {
                Ok(WorkspaceStatus::Stopped) => {
                    tracing::info!("Sandbox {} completed for task {}", sandbox_id, task.id);
                    // Mark task as completed
                    if let Err(e) = app_state.database.update_task_status(
                        task.id,
                        "pr_opened",
                        None, // PR URL will be extracted from logs in a real implementation
                    ).await {
                        tracing::error!("Error updating task {} status: {}", task.id, e);
                    }
                },
                Ok(WorkspaceStatus::Failed) => {
                    tracing::warn!("Sandbox {} failed for task {}", sandbox_id, task.id);
                    // Mark task as failed
                    if let Err(e) = app_state.database.update_task_status(
                        task.id,
                        "failed",
                        None,
                    ).await {
                        tracing::error!("Error updating task {} status: {}", task.id, e);
                    }
                },
                Ok(WorkspaceStatus::Running) => {
                    // Update status to running if it was spinning
                    if task.status.as_deref() == Some("spinning") {
                        if let Err(e) = app_state.database.update_task_status(
                            task.id,
                            "running",
                            None,
                        ).await {
                            tracing::error!("Error updating task {} status: {}", task.id, e);
                        }
                    }
                },
                Ok(WorkspaceStatus::Starting) => {
                    // Keep polling
                },
                Err(e) => {
                    tracing::error!("Error checking sandbox {} status: {}", sandbox_id, e);
                    // Don't mark as failed immediately, keep trying
                }
            }
        }
    }
}

#[tokio::main]
async fn main() -> AppResult<()> {
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
    
    // Initialize sandbox provider
    let sandbox: DynSandbox = if let (Some(url), Some(api_key)) = 
        (config.daytona_url.as_ref(), config.daytona_api_key.as_ref()) {
        tracing::info!("Initializing Daytona sandbox provider");
        Arc::new(DaytonaProvider::new(
            url.clone(), 
            api_key.clone(),
            config.daytona_organization_id.clone(),
            config.daytona_region.clone()
        ))
    } else {
        tracing::warn!("DAYTONA_URL or DAYTONA_API_KEY not configured. Tasks will fail to start sandboxes.");
        // For now, we'll use a dummy provider that errors out
        Arc::new(DaytonaProvider::new("".to_string(), "".to_string(), None, "us".to_string()))
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
) -> Result<Json<Value>, StatusCode> {
    // Get full user data from database
    match app_state.database.get_user_by_clerk_id(&user.id).await {
        Ok(Some(db_user)) => Ok(Json(json!({
            "id": db_user.id,
            "clerk_user_id": db_user.clerk_user_id,
            "github_username": db_user.github_username,
            "email": db_user.email,
            "default_repo_id": db_user.default_repo_id,
            "created_at": db_user.created_at
        }))),
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

    // Step 1: look in DB, else ask Clerk, else fall back
    let github_token = if let Ok(Some(t)) = app_state.database.get_github_token(user.id).await {
        t.access_token
    } else {
        match clerk_api::fetch_github_token(&clerk_user.id, &app_state.config.clerk_secret_key).await {
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

    // Step 2: Use GitHub API to fetch repositories
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

    // Step 3: Store/sync repositories in database
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
                Ok(synced_repos) => Ok(Json(json!({
                    "repositories": synced_repos,
                    "count": synced_repos.len(),
                    "message": format!("Successfully synced {} repositories from GitHub", github_repos.len())
                }))),
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
            let task_responses: Vec<_> = tasks.into_iter().map(|task| {
                json!({
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "repository_id": task.repository_id,
                    "user_id": task.user_id,
                    "status": task.status.unwrap_or_else(|| "pending".to_string()),
                    "github_pr_url": task.github_pr_url,
                    "daytona_workspace_id": task.daytona_workspace_id,
                    "workspace_hostname": task.workspace_hostname,
                    "ssh_hostname": task.workspace_hostname,
                    "created_at": task.created_at.map(|dt| dt.to_rfc3339()),
                    "updated_at": task.updated_at.map(|dt| dt.to_rfc3339())
                })
            }).collect();

            Ok(Json(json!({
                "tasks": task_responses,
                "count": task_responses.len(),
                "user_id": user.id
            })))
        },
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
    let repository = match app_state.database.get_repository_by_id(payload.repository_id, user.id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => {
            tracing::warn!("User {} attempted to create task for repository {} they don't have access to", user.id, payload.repository_id);
            return Err(StatusCode::FORBIDDEN);
        },
        Err(e) => {
            tracing::error!("Database error checking repository access: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Create task in database first with "spinning" status
    let create_task = CreateTask {
        user_id: user.id,
        repository_id: payload.repository_id,
        title: payload.title,
        description: payload.description,
    };

    let mut task = match app_state.database.create_task(create_task).await {
        Ok(task) => task,
        Err(e) => {
            tracing::error!("Error creating task: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Get GitHub token for the user
    let github_token = match app_state.database.get_github_token(user.id).await {
        Ok(Some(token)) => token.access_token,
        Ok(None) => {
            // Try to get from Clerk
            match clerk_api::fetch_github_token(&clerk_user.id, &app_state.config.clerk_secret_key).await {
                Ok(token) => token,
                Err(_) => {
                    tracing::error!("No GitHub token available for user {}", user.id);
                    return Err(StatusCode::BAD_REQUEST);
                }
            }
        },
        Err(e) => {
            tracing::error!("Error fetching GitHub token: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Get user's Anthropic API key
    let anthropic_api_key = match user.anthropic_api_key {
        Some(key) => key,
        None => {
            tracing::error!("No Anthropic API key available for user {}", user.id);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // Start sandbox
    let repo_url = format!("https://github.com/{}", repository.full_name);
    let prompt = task.description.as_deref().unwrap_or(&task.title);
    
    match app_state.sandbox.start_sandbox(task.id, &repo_url, &github_token, prompt, &anthropic_api_key, app_state.config.openai_api_key.as_deref()).await {
        Ok(sandbox_info) => {
            // Update task with sandbox information
            match app_state.database.update_task_workspace(
                task.id,
                &sandbox_info.id,
                &sandbox_info.hostname,
                "spinning",
            ).await {
                Ok(updated_task) => {
                    task = updated_task;
                    tracing::info!("Started sandbox {} for task {}", sandbox_info.id, task.id);
                },
                Err(e) => {
                    tracing::error!("Error updating task with sandbox info: {}", e);
                    // Still return success since sandbox was created
                }
            }

            // Store command IDs for log streaming
            if let Err(e) = app_state.database.update_task_command_ids(
                task.id,
                &sandbox_info.session_id,
                &sandbox_info.command_id,
            ).await {
                tracing::error!("Error storing command IDs: {}", e);
            }
        },
        Err(e) => {
            tracing::error!("Failed to start sandbox for task {}: {}", task.id, e);
            // Update task status to failed
            let _ = app_state.database.update_task_status(task.id, "failed", None).await;
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    Ok(Json(json!({
        "success": true,
        "task": {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "repository_id": task.repository_id,
            "user_id": task.user_id,
            "status": task.status.unwrap_or_else(|| "spinning".to_string()),
            "github_pr_url": task.github_pr_url,
            "daytona_workspace_id": task.daytona_workspace_id,
            "workspace_hostname": task.workspace_hostname,
            "ssh_hostname": task.workspace_hostname,
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
