use async_trait::async_trait;
use std::sync::Arc;
use thiserror::Error;

pub mod modal;
pub mod status_poller;

#[derive(Debug, Error)]
#[allow(clippy::enum_variant_names)]
pub enum SandboxError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    #[error("JSON parsing failed: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("Sandbox operation failed: {0}")]
    SandboxOperationError(String),
    #[error("Timeout waiting for sandbox")]
    TimeoutError,
}

pub type SandboxResult<T> = Result<T, SandboxError>;

#[derive(Debug, Clone)]
pub struct SandboxInfo {
    pub id: String,
    pub hostname: String,
    pub status: SandboxStatus,
    pub session_id: String,
    pub command_id: String,
    pub branch: String,
}

#[derive(Debug, Clone)]
pub enum SandboxStatus {
    Starting,
    Running,
    Stopped,
    Failed,
}

#[async_trait]
pub trait SandboxProvider: Send + Sync {
    /// Start a new sandbox with the given configuration
    #[allow(clippy::too_many_arguments)]
    async fn start_sandbox(
        &self,
        task_id: i32,
        repo_url: &str,
        github_token: &str,
        prompt: &str,
        anthropic_api_key: &str,
        openai_api_key: Option<&str>,
        branch: &str,
        author_name: &str,
        author_email: &str,
    ) -> SandboxResult<SandboxInfo>;

    /// Get the current status of a sandbox
    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus>;

    /// Wait for a sandbox to complete (return when status is Stopped or Failed)
    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus>;

    /// Stop a sandbox
    async fn stop_sandbox(&self, sandbox_id: &str) -> SandboxResult<()>;

    /// Get the exit code of a command if available
    async fn get_command_exit_code(
        &self,
        sandbox_id: &str,
        session_id: &str,
        command_id: &str,
    ) -> SandboxResult<Option<i32>>;

    /// Push changes to GitHub branch after task completion  
    async fn push_changes(
        &self,
        sandbox_id: &str,
        repo_path: &str,
        branch: &str,
        task_id: i32,
        author_name: &str,
        author_email: &str,
        commit_title: &str,
        commit_body: &str,
    ) -> SandboxResult<()>;

    /// Delete a sandbox
    async fn delete_sandbox(&self, sandbox_id: &str) -> SandboxResult<()>;
}

pub type DynSandbox = Arc<dyn SandboxProvider + Send + Sync>;
