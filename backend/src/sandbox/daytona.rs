use super::{SandboxError, SandboxProvider, SandboxResult, WorkspaceInfo, WorkspaceStatus};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tokio::time::{sleep, timeout};
use tokio_retry::strategy::ExponentialBackoff;
use tokio_retry::Retry;

#[derive(Debug, Clone)]
pub struct DaytonaProvider {
    client: Client,
    base_url: String,
    api_key: String,
}

#[derive(Debug, Deserialize)]
struct DaytonaWorkspace {
    id: String,
    #[serde(rename = "publicIpv4")]
    public_ipv4: Option<String>,
    #[serde(rename = "hostName")]
    host_name: Option<String>,
    status: Option<DaytonaStatus>,
}

#[derive(Debug, Deserialize)]
struct DaytonaStatus {
    phase: String,
}

#[derive(Debug, Serialize)]
struct CreateSandboxRequest {
    #[serde(rename = "repositoryUrl")]
    repository_url: String,
    args: serde_json::Value,
    secrets: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct CommandRequest {
    command: String,
}

impl DaytonaProvider {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            api_key,
        }
    }

    async fn create_workspace(&self, request: CreateSandboxRequest) -> SandboxResult<DaytonaWorkspace> {
        let url = format!("{}/sandbox", self.base_url);
        
        let response = self
            .client
            .post(&url)
            .header("X-Daytona-Api-Key", &self.api_key)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to create workspace: {} - {}",
                status,
                error_text
            )));
        }

        let workspace: DaytonaWorkspace = response.json().await?;
        Ok(workspace)
    }

    async fn get_workspace(&self, workspace_id: &str) -> SandboxResult<DaytonaWorkspace> {
        let url = format!("{}/sandbox/{}", self.base_url, workspace_id);
        
        let response = self
            .client
            .get(&url)
            .header("X-Daytona-Api-Key", &self.api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to get workspace: {} - {}",
                status,
                error_text
            )));
        }

        let workspace: DaytonaWorkspace = response.json().await?;
        Ok(workspace)
    }

    async fn start_workspace_command(&self, workspace_id: &str) -> SandboxResult<()> {
        let url = format!("{}/sandbox/{}/command", self.base_url, workspace_id);
        
        let command_request = CommandRequest {
            command: "/runner/entrypoint.sh".to_string(),
        };

        let response = self
            .client
            .post(&url)
            .header("X-Daytona-Api-Key", &self.api_key)
            .json(&command_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to start workspace command: {} - {}",
                status,
                error_text
            )));
        }

        Ok(())
    }

    async fn delete_workspace(&self, workspace_id: &str) -> SandboxResult<()> {
        let url = format!("{}/sandbox/{}", self.base_url, workspace_id);
        
        let response = self
            .client
            .delete(&url)
            .header("X-Daytona-Api-Key", &self.api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to delete workspace: {} - {}",
                status,
                error_text
            )));
        }

        Ok(())
    }

    fn map_daytona_status(phase: &str) -> WorkspaceStatus {
        match phase.to_lowercase().as_str() {
            "starting" | "pending" => WorkspaceStatus::Starting,
            "running" => WorkspaceStatus::Running,
            "stopped" | "succeeded" => WorkspaceStatus::Stopped,
            "failed" | "error" => WorkspaceStatus::Failed,
            _ => WorkspaceStatus::Starting,
        }
    }
}

#[async_trait]
impl SandboxProvider for DaytonaProvider {
    async fn start_workspace(
        &self,
        task_id: i32,
        repo_url: &str,
        github_token: &str,
        prompt: &str,
    ) -> SandboxResult<WorkspaceInfo> {
        let create_request = CreateSandboxRequest {
            repository_url: repo_url.to_string(),
            args: json!({
                "TASK_ID": task_id.to_string(),
                "PROMPT": prompt
            }),
            secrets: json!({
                "GITHUB_TOKEN": github_token
            }),
        };

        let workspace = self.create_workspace(create_request).await?;
        
        // Wait for workspace to be ready with retry logic
        let retry_strategy = ExponentialBackoff::from_millis(1000).max_delay(Duration::from_secs(10));
        let workspace_id = workspace.id.clone();
        
        let ready_workspace = Retry::spawn(retry_strategy, || async {
            let ws = self.get_workspace(&workspace_id).await?;
            if ws.host_name.is_some() {
                Ok(ws)
            } else {
                Err(SandboxError::WorkspaceError("Workspace hostname not ready".to_string()))
            }
        })
        .await?;

        // Start the bootstrap command
        self.start_workspace_command(&workspace_id).await?;

        let hostname = ready_workspace.host_name.unwrap_or_else(|| {
            ready_workspace.public_ipv4.unwrap_or_else(|| workspace_id.clone())
        });

        let status = ready_workspace
            .status
            .as_ref()
            .map(|s| Self::map_daytona_status(&s.phase))
            .unwrap_or(WorkspaceStatus::Starting);

        Ok(WorkspaceInfo {
            id: workspace_id,
            hostname,
            status,
        })
    }

    async fn get_workspace_status(&self, workspace_id: &str) -> SandboxResult<WorkspaceStatus> {
        let workspace = self.get_workspace(workspace_id).await?;
        
        let status = workspace
            .status
            .as_ref()
            .map(|s| Self::map_daytona_status(&s.phase))
            .unwrap_or(WorkspaceStatus::Starting);

        Ok(status)
    }

    async fn wait_for_completion(&self, workspace_id: &str) -> SandboxResult<WorkspaceStatus> {
        let timeout_duration = Duration::from_secs(30 * 60); // 30 minutes
        let poll_interval = Duration::from_secs(30);

        let result = timeout(timeout_duration, async {
            loop {
                let status = self.get_workspace_status(workspace_id).await?;
                
                match status {
                    WorkspaceStatus::Stopped | WorkspaceStatus::Failed => {
                        return Ok(status);
                    }
                    WorkspaceStatus::Starting | WorkspaceStatus::Running => {
                        sleep(poll_interval).await;
                    }
                }
            }
        }).await;

        match result {
            Ok(status) => status,
            Err(_) => {
                // Timeout occurred, try to stop the workspace
                let _ = self.stop_workspace(workspace_id).await;
                Err(SandboxError::TimeoutError)
            }
        }
    }

    async fn stop_workspace(&self, workspace_id: &str) -> SandboxResult<()> {
        self.delete_workspace(workspace_id).await
    }
}