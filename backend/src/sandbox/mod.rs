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
    #[error("Workspace operation failed: {0}")]
    WorkspaceError(String),
    #[error("Timeout waiting for workspace")]
    TimeoutError,
}

pub type SandboxResult<T> = Result<T, SandboxError>;

#[derive(Debug, Clone)]
pub struct WorkspaceInfo {
    pub id: String,
    pub hostname: String,
    pub status: WorkspaceStatus,
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
    /// Start a new workspace with the given configuration
    async fn start_workspace(
        &self,
        task_id: i32,
        repo_url: &str,
        github_token: &str,
        prompt: &str,
    ) -> SandboxResult<WorkspaceInfo>;

    /// Get the current status of a workspace
    async fn get_workspace_status(&self, workspace_id: &str) -> SandboxResult<WorkspaceStatus>;

    /// Wait for a workspace to complete (return when status is Stopped or Failed)
    async fn wait_for_completion(&self, workspace_id: &str) -> SandboxResult<WorkspaceStatus>;

    /// Stop a workspace
    async fn stop_workspace(&self, workspace_id: &str) -> SandboxResult<()>;
}

pub type DynSandbox = Arc<dyn SandboxProvider + Send + Sync>;