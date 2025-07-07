use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct User {
    pub id: i32,
    pub clerk_user_id: String,
    pub github_username: Option<String>,
    pub github_user_id: Option<i32>,
    pub email: Option<String>,
    pub default_repo_id: Option<i32>,
    pub anthropic_api_key: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUser {
    pub clerk_user_id: String,
    pub github_username: Option<String>,
    pub github_user_id: Option<i32>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Repository {
    pub id: i32,
    pub github_repo_id: i64,
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub user_id: i32,
    pub is_private: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRepository {
    pub github_repo_id: i64,
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub user_id: i32,
    pub is_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct GitHubToken {
    pub id: i32,
    pub user_id: i32,
    pub access_token: String,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGitHubToken {
    pub user_id: i32,
    pub access_token: String,
    pub token_type: String,
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Task {
    pub id: i32,
    pub user_id: i32,
    pub repository_id: i32,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub github_pr_url: Option<String>,
    pub daytona_workspace_id: Option<String>,
    pub workspace_hostname: Option<String>,
    pub daytona_session_id: Option<String>,
    pub daytona_command_id: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTask {
    pub user_id: i32,
    pub repository_id: i32,
    pub title: String,
    pub description: Option<String>,
}

// Response models for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithDefaultRepo {
    pub id: i32,
    pub clerk_user_id: String,
    pub github_username: Option<String>,
    pub email: Option<String>,
    pub default_repo: Option<Repository>,
    pub anthropic_api_key: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RepositoryWithTasks {
    pub id: i32,
    pub github_repo_id: i64,
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub is_private: Option<bool>,
    pub task_count: i64,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskLog {
    pub id: i64,
    pub task_id: i32,
    pub log_line: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskLog {
    pub task_id: i32,
    pub log_line: serde_json::Value,
}
