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
    pub onboarding_completed: Option<bool>,
    pub onboarding_completed_at: Option<DateTime<Utc>>,
    pub onboarding_step: Option<String>,
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
    pub github_pushed_at: Option<DateTime<Utc>>,
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
    #[ts(optional)]
    pub github_pushed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRepository {
    pub github_repo_id: i64,
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub user_id: i32,
    pub is_private: bool,
    pub github_pushed_at: Option<DateTime<Utc>>,
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
    /// Deprecated – will be removed after 2025-Q3
    pub description: Option<String>,
    pub status: Option<String>,
    pub github_pr_url: Option<String>,
    pub pr_title: Option<String>,
    pub pr_body: Option<String>,
    pub is_archived: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTask {
    pub user_id: i32,
    pub repository_id: i32,
    pub title: String,
    /// Deprecated – will be removed after 2025-Q3
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Run {
    pub id: i32,
    pub task_id: i32,
    pub message_id: Option<i64>,
    pub sandbox_id: Option<String>,
    pub sandbox_hostname: Option<String>,
    pub session_id: Option<String>,
    pub command_id: Option<String>,
    pub branch: Option<String>,
    pub status: Option<String>,
    pub commit_title: Option<String>,
    pub commit_body: Option<String>,
    pub final_message_md: Option<String>,
    pub mode: String,
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
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct TaskWithRunDB {
    pub run_id: i32,
    pub task_id: i32,
    pub title: String,
    /// Deprecated – will be removed after 2025-Q3
    pub description: Option<String>,
    pub repository_id: i32,
    pub user_id: i32,
    pub status: Option<String>,
    pub github_branch: Option<String>,
    pub sandbox_id: Option<String>,
    pub sandbox_hostname: Option<String>,
    pub session_id: Option<String>,
    pub command_id: Option<String>,
    pub commit_title: Option<String>,
    pub commit_body: Option<String>,
    pub mode: Option<String>,
    pub pr_title: Option<String>,
    pub pr_body: Option<String>,
    pub is_archived: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub github_pr_url: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TaskWithRun {
    pub run_id: i32,
    pub task_id: i32,
    pub title: String,
    /// Deprecated – will be removed after 2025-Q3
    pub description: Option<String>,
    pub repository_id: i32,
    pub user_id: i32,
    pub status: Option<String>,
    pub github_branch: Option<String>,
    pub sandbox_id: Option<String>,
    pub sandbox_hostname: Option<String>,
    pub session_id: Option<String>,
    pub command_id: Option<String>,
    pub commit_title: Option<String>,
    pub commit_body: Option<String>,
    pub mode: Option<String>,
    pub pr_title: Option<String>,
    pub pr_body: Option<String>,
    pub is_archived: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub github_pr_url: Option<String>,
    pub latest_todos: Option<Vec<AgentTodo>>,
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
    #[ts(optional)]
    pub github_pushed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct TaskLog {
    pub id: i32,
    pub task_id: i32,
    pub run_id: Option<i32>,
    #[ts(type = "Record<string, any>")]
    pub log_line: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskLog {
    pub task_id: i32,
    pub run_id: i32,
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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Comment {
    pub id: i64,
    pub task_id: i32,
    pub run_id: i32,
    pub mode: String, // "plan" | "review"
    pub body_md: String,
    pub sha: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: i64,
    pub task_id: i32,
    pub run_id: Option<i32>,
    pub mode: String,
    pub body_md: String,
    pub sha: Option<String>,
    pub role: String, // 'user' | 'assistant' | 'system'
    pub metadata: serde_json::Value,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMessage {
    pub task_id: i32,
    pub run_id: Option<i32>,
    pub mode: String,
    pub body_md: String,
    pub sha: Option<String>,
    pub role: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RunWithMeta {
    pub run: Run,
    pub todos: Vec<AgentTodo>,
    pub logs: TaskLogsPaginated,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MessageWithRun {
    pub id: i64,
    pub task_id: i32,
    pub role: String,
    pub content: String, // from body_md
    pub created_at: Option<DateTime<Utc>>,
    #[ts(type = "Record<string, any> | null")]
    pub metadata: Option<serde_json::Value>,
    pub run: Option<RunWithMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TaskLogsPaginated {
    pub entries: Vec<TaskLog>,
    pub total_count: i32,
    pub has_more: bool,
    pub cursor: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TaskDetails {
    pub task: Task,
    pub messages: Vec<MessageWithRun>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserApiKeys {
    pub id: i32,
    pub user_id: i32,
    pub anthropic_ciphertext: Option<String>,
    pub anthropic_nonce: Option<String>,
    pub openai_ciphertext: Option<String>,
    pub openai_nonce: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OnboardingStatus {
    pub onboarding_completed: bool,
    pub step: Option<String>, // 'api-keys' | 'default-repo' | null
    pub has_anthropic: bool,
    pub has_openai: bool,
    pub has_default_repo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ApiKeysStatus {
    pub has_anthropic: bool,
    pub has_openai: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApiKeysRequest {
    pub anthropic_api_key: Option<String>,
    pub openai_api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetDefaultRepoRequest {
    pub repository_id: i32,
}
