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
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct UserWithDefaultRepo {
    pub id: i32,
    pub clerk_user_id: String,
    pub github_username: Option<String>,
    pub github_user_id: Option<i32>,
    pub email: Option<String>,
    pub default_repo_id: Option<i32>,
    pub default_repo: Option<RepositoryTS>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

// Force ts-rs to generate types by ensuring they're used
#[allow(dead_code)]
pub fn _force_ts_generation() {
    let _: UserWithDefaultRepo = UserWithDefaultRepo {
        id: 0,
        clerk_user_id: String::new(),
        github_username: None,
        github_user_id: None,
        email: None,
        default_repo_id: None,
        default_repo: None,
        created_at: None,
        updated_at: None,
    };
    let _: RepositoryTS = RepositoryTS {
        id: 0,
        github_repo_id: 0,
        owner: String::new(),
        name: String::new(),
        full_name: String::new(),
        user_id: 0,
        is_private: None,
        created_at: None,
        last_fetched_at: None,
    };
    let _: Run = Run {
        id: 0,
        task_id: 0,
        sandbox_id: None,
        sandbox_hostname: None,
        session_id: None,
        command_id: None,
        branch: None,
        status: None,
        commit_title: None,
        commit_body: None,
        pr_title: None,
        pr_body: None,
        created_at: None,
        updated_at: None,
    };
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
    pub last_fetched_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RepositoryTS {
    pub id: i32,
    pub github_repo_id: i64,
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub user_id: i32,
    pub is_private: Option<bool>,
    pub created_at: Option<String>,
    pub last_fetched_at: Option<String>,
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
    pub github_branch: Option<String>,
    pub sandbox_id: Option<String>,
    pub sandbox_hostname: Option<String>,
    pub session_id: Option<String>,
    pub command_id: Option<String>,
    pub commit_title: Option<String>,
    pub commit_body: Option<String>,
    pub pr_title: Option<String>,
    pub pr_body: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Run {
    pub id: i32,
    pub task_id: i32,
    pub sandbox_id: Option<String>,
    pub sandbox_hostname: Option<String>,
    pub session_id: Option<String>,
    pub command_id: Option<String>,
    pub branch: Option<String>,
    pub status: Option<String>,
    pub commit_title: Option<String>,
    pub commit_body: Option<String>,
    pub pr_title: Option<String>,
    pub pr_body: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRun {
    pub task_id: i32,
    pub sandbox_id: Option<String>,
    pub sandbox_hostname: Option<String>,
    pub session_id: Option<String>,
    pub command_id: Option<String>,
    pub branch: Option<String>,
    pub status: Option<String>,
    pub commit_title: Option<String>,
    pub commit_body: Option<String>,
    pub pr_title: Option<String>,
    pub pr_body: Option<String>,
}

// Response models for API

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
    pub last_fetched_at: Option<DateTime<Utc>>,
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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct AgentTodo {
    pub todo_id: String,
    pub content: String,
    pub priority: String,
    pub status: String,
    pub updated_at: Option<DateTime<Utc>>,
}
