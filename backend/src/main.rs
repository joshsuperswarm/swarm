use axum::{
    extract::{Extension, State},
    http::StatusCode,
    middleware,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
use std::env;
use sqlx::PgPool;
use serde::Deserialize;

mod clerk_middleware;
mod models;
mod database_working;
mod github;

use clerk_middleware::{clerk_auth_middleware, fetch_clerk_jwks, AuthenticatedUser};
use database_working::Database;
use github::GitHubClient;
use models::{CreateRepository};

#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub clerk_keys: clerk_middleware::ClerkKeys,
}

#[tokio::main]
async fn main() {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();
    
    // Initialize logging
    env_logger::init();
    
    // Get port from environment or default to 3001
    let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    
    // Get database URL from environment
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());
    
    // Connect to database
    let pool = match PgPool::connect(&database_url).await {
        Ok(pool) => {
            println!("✓ Connected to database");
            pool
        }
        Err(e) => {
            println!("✗ Failed to connect to database: {}", e);
            println!("Make sure PostgreSQL is running and DATABASE_URL is correct");
            std::process::exit(1);
        }
    };
    
    // Run database migrations (skip if already exist)
    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => println!("✓ Database migrations completed"),
        Err(e) => {
            println!("⚠ Migration warning (likely tables already exist): {}", e);
            println!("✓ Continuing with existing database schema");
        }
    }
    
    let database = Database::new(pool);
    
    // Fetch Clerk JWKS (in production, you'd cache this and refresh periodically)
    let clerk_keys = fetch_clerk_jwks().await.unwrap_or_else(|_| {
        println!("Warning: Could not fetch Clerk JWKS, using development mode");
        clerk_middleware::ClerkKeys { keys: vec![] }
    });
    
    let app_state = AppState {
        database,
        clerk_keys,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let protected_routes = Router::new()
        .route("/protected", get(protected_endpoint))
        .route("/api/user/profile", get(get_user_profile))
        .route("/api/user/repos", get(get_user_repos))
        .route("/api/user/default-repo", post(set_default_repo))
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks", post(create_task))
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            clerk_auth_middleware,
        ));

    let app = Router::new()
        .route("/health", get(health_check))
        .merge(protected_routes)
        .layer(cors)
        .with_state(app_state);

    let bind_address = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&bind_address).await.unwrap();
    println!("Server running on {}", bind_address);
    
    axum::serve(listener, app).await.unwrap();
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
    Extension(user): Extension<AuthenticatedUser>,
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    match app_state.database.get_user_by_clerk_id(&user.clerk_user_id).await {
        Ok(Some(db_user)) => {
            Ok(Json(json!({
                "id": db_user.id,
                "clerk_user_id": db_user.clerk_user_id,
                "github_username": db_user.github_username,
                "email": db_user.email,
                "default_repo_id": db_user.default_repo_id,
                "created_at": db_user.created_at
            })))
        },
        Ok(None) => {
            Err(StatusCode::NOT_FOUND)
        },
        Err(_) => {
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_user_repos(
    Extension(user): Extension<AuthenticatedUser>,
    State(app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    // Step 1: Get user's GitHub token from database
    let github_token = match app_state.database.get_github_token(user.user_id).await {
        Ok(Some(token)) => token.access_token,
        Ok(None) => {
            return Ok(Json(json!({
                "repositories": [],
                "count": 0,
                "message": "No GitHub token found. Please reconnect your GitHub account."
            })));
        }
        Err(e) => {
            eprintln!("Database error getting GitHub token: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Step 2: Use GitHub API to fetch repositories
    let github_client = match GitHubClient::new(&github_token) {
        Ok(client) => client,
        Err(e) => {
            eprintln!("Error creating GitHub client: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let github_repos = match github_client.get_user_repositories(50).await {
        Ok(repos) => repos,
        Err(e) => {
            eprintln!("Error fetching repositories from GitHub: {}", e);
            // Fallback to cached repositories
            return match app_state.database.get_user_repositories(user.user_id).await {
                Ok(cached_repos) => {
                    Ok(Json(json!({
                        "repositories": cached_repos,
                        "count": cached_repos.len(),
                        "message": "GitHub API error - showing cached repositories"
                    })))
                }
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
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
            user_id: user.user_id,
            is_private: repo.private,
        })
        .collect();

    match app_state.database.sync_repositories(user.user_id, create_repos).await {
        Ok(_) => {
            // Return fresh data from database after sync
            match app_state.database.get_user_repositories(user.user_id).await {
                Ok(synced_repos) => {
                    Ok(Json(json!({
                        "repositories": synced_repos,
                        "count": synced_repos.len(),
                        "message": format!("Successfully synced {} repositories from GitHub", github_repos.len())
                    })))
                }
                Err(e) => {
                    eprintln!("Database error after sync: {}", e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        Err(e) => {
            eprintln!("Error syncing repositories to database: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
struct SetDefaultRepoRequest {
    repository_id: Option<i32>,
}

async fn set_default_repo(
    Extension(user): Extension<AuthenticatedUser>,
    State(app_state): State<AppState>,
    Json(payload): Json<SetDefaultRepoRequest>,
) -> Result<Json<Value>, StatusCode> {
    match app_state.database.update_user_github_info(
        user.user_id,
        user.username.clone(),
        None
    ).await {
        Ok(updated_user) => {
            Ok(Json(json!({
                "success": true,
                "default_repo_id": payload.repository_id,
                "user": {
                    "id": updated_user.id,
                    "github_username": updated_user.github_username
                }
            })))
        },
        Err(_) => {
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_tasks(
    Extension(user): Extension<AuthenticatedUser>,
    State(_app_state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    // Return mock tasks for now
    // In the full implementation, this would query the database for user's tasks
    Ok(Json(json!({
        "tasks": [],
        "count": 0,
        "user_id": user.user_id
    })))
}

#[derive(Deserialize)]
struct CreateTaskRequest {
    title: String,
    description: Option<String>,
    repository_id: i32,
}

async fn create_task(
    Extension(user): Extension<AuthenticatedUser>,
    State(_app_state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<Json<Value>, StatusCode> {
    // Create mock task for now
    // In the full implementation, this would:
    // 1. Validate repository access
    // 2. Create task in database
    // 3. Trigger sandbox creation and Claude Code execution
    
    Ok(Json(json!({
        "success": true,
        "task": {
            "id": 1,
            "title": payload.title,
            "description": payload.description,
            "repository_id": payload.repository_id,
            "user_id": user.user_id,
            "status": "pending",
            "created_at": chrono::Utc::now().to_rfc3339()
        }
    })))
}
