use super::{SandboxError, SandboxProvider, SandboxResult, WorkspaceInfo, WorkspaceStatus};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tokio::time::{sleep, timeout};
use tokio_retry::strategy::ExponentialBackoff;
use tokio_retry::Retry;
use tracing::{debug, error, info, warn};

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
        
        info!("Creating Daytona sandbox for repository: {}", request.repository_url);
        debug!("Creating sandbox with request: {:?}", request);

        let response = self
            .add_auth_headers(self.client.post(&url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Failed to create sandbox: {} - {}", status, error_text);
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to create sandbox: {} - {}",
                status,
                error_text
            )));
        }

        let sandbox: DaytonaSandbox = response.json().await?;
        info!("Successfully created sandbox with ID: {}", sandbox.id);
        Ok(sandbox)
    }

    async fn get_sandbox(&self, sandbox_id: &str) -> SandboxResult<DaytonaSandbox> {
        let url = format!("{}/sandbox/{}", self.base_url, sandbox_id);
        
        debug!("Getting sandbox status for ID: {}", sandbox_id);

        let response = self
            .add_auth_headers(self.client.get(&url))
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Failed to get sandbox {}: {} - {}", sandbox_id, status, error_text);
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to get sandbox: {} - {}",
                status,
                error_text
            )));
        }

        let sandbox: DaytonaSandbox = response.json().await?;
        debug!("Retrieved sandbox {}: status={:?}, hostname={:?}", 
               sandbox.id, 
               sandbox.status.as_ref().map(|s| &s.phase), 
               sandbox.host_name);
        Ok(sandbox)
    }

    async fn start_sandbox_command(&self, sandbox_id: &str) -> SandboxResult<()> {
        let url = format!("{}/sandbox/{}/command", self.base_url, sandbox_id);
        
        let command_request = CommandRequest {
            command: "/runner/entrypoint.sh".to_string(),
        };

        info!("Starting bootstrap command for sandbox {}", sandbox_id);
        debug!("Executing command: {}", command_request.command);

        let response = self
            .add_auth_headers(self.client.post(&url))
            .json(&command_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Failed to start sandbox command for {}: {} - {}", sandbox_id, status, error_text);
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to start sandbox command: {} - {}",
                status,
                error_text
            )));
        }

        info!("Successfully started bootstrap command for sandbox {}", sandbox_id);
        Ok(())
    }

    async fn delete_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        let url = format!("{}/sandbox/{}", self.base_url, sandbox_id);
        
        info!("Deleting sandbox {}", sandbox_id);

        let response = self
            .add_auth_headers(self.client.delete(&url))
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Failed to delete sandbox {}: {} - {}", sandbox_id, status, error_text);
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to delete sandbox: {} - {}",
                status,
                error_text
            )));
        }

        info!("Successfully deleted sandbox {}", sandbox_id);
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
        info!("Starting sandbox for task {}, repository: {}", task_id, repo_url);
        
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
        info!("Waiting for sandbox {} to be ready", sandbox.id);
        let retry_strategy = ExponentialBackoff::from_millis(1000)
            .max_delay(Duration::from_secs(10))
            .take(30); // Limit to 30 retries (about 5 minutes total)
        let sandbox_id = sandbox.id.clone();
        
        let ready_sandbox = timeout(Duration::from_secs(10 * 60), Retry::spawn(retry_strategy, || async {
            let sb = self.get_sandbox(&sandbox_id).await?;
            
            // Check if sandbox is in a running state (rather than waiting for hostname)
            if let Some(ref status) = sb.status {
                let sandbox_status = Self::map_daytona_status(&status.phase);
                match sandbox_status {
                    WorkspaceStatus::Running => {
                        info!("Sandbox {} is running (hostname: {:?}, ip: {:?})", 
                              sandbox_id, sb.host_name, sb.public_ipv4);
                        Ok(sb)
                    }
                    WorkspaceStatus::Failed => {
                        error!("Sandbox {} failed to start", sandbox_id);
                        Err(SandboxError::SandboxOperationError("Sandbox failed to start".to_string()))
                    }
                    WorkspaceStatus::Starting => {
                        debug!("Sandbox {} still starting (status: {}), retrying...", sandbox_id, status.phase);
                        Err(SandboxError::SandboxOperationError("Sandbox still starting".to_string()))
                    }
                    WorkspaceStatus::Stopped => {
                        error!("Sandbox {} stopped unexpectedly", sandbox_id);
                        Err(SandboxError::SandboxOperationError("Sandbox stopped unexpectedly".to_string()))
                    }
                }
            } else {
                debug!("Sandbox {} has no status yet, retrying...", sandbox_id);
                Err(SandboxError::SandboxOperationError("Sandbox status not available".to_string()))
            }
        }))
        .await
        .map_err(|_| {
            error!("Timeout waiting for sandbox {} to be ready", sandbox_id);
            SandboxError::TimeoutError
        })??;

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

        info!("Sandbox {} started successfully with hostname: {}", sandbox_id, hostname);
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

        debug!("Sandbox {} status: {:?}", sandbox_id, status);
        Ok(status)
    }

    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus> {
        let timeout_duration = Duration::from_secs(30 * 60); // 30 minutes
        let poll_interval = Duration::from_secs(30);

        info!("Waiting for sandbox {} completion (timeout: 30 minutes)", sandbox_id);
        let result = timeout(timeout_duration, async {
            loop {
                let status = self.get_sandbox_status(sandbox_id).await?;
                
                match status {
                    WorkspaceStatus::Stopped | WorkspaceStatus::Failed => {
                        info!("Sandbox {} completed with status: {:?}", sandbox_id, status);
                        return Ok(status);
                    }
                    WorkspaceStatus::Starting | WorkspaceStatus::Running => {
                        debug!("Sandbox {} still running, checking again in {} seconds", sandbox_id, poll_interval.as_secs());
                        sleep(poll_interval).await;
                    }
                }
            }
        }).await;

        match result {
            Ok(status) => status,
            Err(_) => {
                warn!("Sandbox {} timed out after 30 minutes, attempting to stop", sandbox_id);
                // Timeout occurred, try to stop the sandbox
                let _ = self.stop_sandbox(sandbox_id).await;
                Err(SandboxError::TimeoutError)
            }
        }
    }

    async fn stop_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        info!("Stopping sandbox {}", sandbox_id);
        self.delete_sandbox(sandbox_id).await
    }
}