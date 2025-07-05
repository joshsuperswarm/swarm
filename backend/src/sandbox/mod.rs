use async_trait::async_trait;
use std::sync::Arc;
use thiserror::Error;

pub mod daytona;

#[derive(Debug, Error)]
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
pub struct WorkspaceInfo {
    pub id: String,
    pub hostname: String,
    pub status: WorkspaceStatus,
    pub session_id: String,
    pub command_id: String,
}

#[derive(Debug, Clone)]
pub enum WorkspaceStatus {
    Starting,
    Running,
    Stopped,
    Failed,
}

#[async_trait]
pub trait SandboxProvider: Send + Sync {
    /// Start a new sandbox with the given configuration
    async fn start_sandbox(
        &self,
        task_id: i32,
        repo_url: &str,
        github_token: &str,
        prompt: &str,
        anthropic_api_key: &str,
        openai_api_key: Option<&str>,
    ) -> SandboxResult<WorkspaceInfo>;

    /// Get the current status of a sandbox
    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus>;

    /// Wait for a sandbox to complete (return when status is Stopped or Failed)
    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus>;

    /// Stop a sandbox
    async fn stop_sandbox(&self, sandbox_id: &str) -> SandboxResult<()>;
}

pub type DynSandbox = Arc<dyn SandboxProvider + Send + Sync>;