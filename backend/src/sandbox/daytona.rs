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
    organization_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DaytonaSandbox {
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
    pub fn new(base_url: String, api_key: String, organization_id: Option<String>) -> Self {
        Self {
            client: Client::new(),
            base_url,
            api_key,
            organization_id,
        }
    }

    fn add_auth_headers(&self, request_builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        let mut builder = request_builder.bearer_auth(&self.api_key);
        
        if let Some(ref org_id) = self.organization_id {
            builder = builder.header("X-Daytona-Organization-ID", org_id);
        }
        
        builder
    }

    async fn create_sandbox(&self, request: CreateSandboxRequest) -> SandboxResult<DaytonaSandbox> {
        let url = format!("{}/sandbox", self.base_url);
        
        let response = self
            .add_auth_headers(self.client.post(&url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to create sandbox: {} - {}",
                status,
                error_text
            )));
        }

        let sandbox: DaytonaSandbox = response.json().await?;
        Ok(sandbox)
    }

    async fn get_sandbox(&self, sandbox_id: &str) -> SandboxResult<DaytonaSandbox> {
        let url = format!("{}/sandbox/{}", self.base_url, sandbox_id);
        
        let response = self
            .add_auth_headers(self.client.get(&url))
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to get sandbox: {} - {}",
                status,
                error_text
            )));
        }

        let sandbox: DaytonaSandbox = response.json().await?;
        Ok(sandbox)
    }

    async fn start_sandbox_command(&self, sandbox_id: &str) -> SandboxResult<()> {
        let url = format!("{}/sandbox/{}/command", self.base_url, sandbox_id);
        
        let command_request = CommandRequest {
            command: "/runner/entrypoint.sh".to_string(),
        };

        let response = self
            .add_auth_headers(self.client.post(&url))
            .json(&command_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to start sandbox command: {} - {}",
                status,
                error_text
            )));
        }

        Ok(())
    }

    async fn delete_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        let url = format!("{}/sandbox/{}", self.base_url, sandbox_id);
        
        let response = self
            .add_auth_headers(self.client.delete(&url))
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(SandboxError::WorkspaceError(format!(
                "Failed to delete sandbox: {} - {}",
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
    async fn start_sandbox(
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

        let sandbox = self.create_sandbox(create_request).await?;
        
        // Wait for sandbox to be ready with retry logic
        let retry_strategy = ExponentialBackoff::from_millis(1000).max_delay(Duration::from_secs(10));
        let sandbox_id = sandbox.id.clone();
        
        let ready_sandbox = Retry::spawn(retry_strategy, || async {
            let sb = self.get_sandbox(&sandbox_id).await?;
            if sb.host_name.is_some() {
                Ok(sb)
            } else {
                Err(SandboxError::WorkspaceError("Sandbox hostname not ready".to_string()))
            }
        })
        .await?;

        // Start the bootstrap command
        self.start_sandbox_command(&sandbox_id).await?;

        let hostname = ready_sandbox.host_name.unwrap_or_else(|| {
            ready_sandbox.public_ipv4.unwrap_or_else(|| sandbox_id.clone())
        });

        let status = ready_sandbox
            .status
            .as_ref()
            .map(|s| Self::map_daytona_status(&s.phase))
            .unwrap_or(WorkspaceStatus::Starting);

        Ok(WorkspaceInfo {
            id: sandbox_id,
            hostname,
            status,
        })
    }

    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus> {
        let sandbox = self.get_sandbox(sandbox_id).await?;
        
        let status = sandbox
            .status
            .as_ref()
            .map(|s| Self::map_daytona_status(&s.phase))
            .unwrap_or(WorkspaceStatus::Starting);

        Ok(status)
    }

    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus> {
        let timeout_duration = Duration::from_secs(30 * 60); // 30 minutes
        let poll_interval = Duration::from_secs(30);

        let result = timeout(timeout_duration, async {
            loop {
                let status = self.get_sandbox_status(sandbox_id).await?;
                
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
                // Timeout occurred, try to stop the sandbox
                let _ = self.stop_sandbox(sandbox_id).await;
                Err(SandboxError::TimeoutError)
            }
        }
    }

    async fn stop_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        self.delete_sandbox(sandbox_id).await
    }
}