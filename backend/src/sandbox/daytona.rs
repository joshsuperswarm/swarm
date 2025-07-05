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
use url::Url;
use uuid::Uuid;

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
    #[serde(rename = "runnerDomain")]
    runner_domain: Option<String>,
    state: String,
}

#[derive(Debug, Serialize)]
struct CreateSandboxRequest {
    #[serde(rename = "repositoryUrl")]
    repository_url: String,
    /// Environment variables that get injected inside the container
    env: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct GitCloneRequest {
    url: String,
    path: String,
    username: String,
    password: String,
    branch: String,
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

    fn add_auth_headers(
        &self,
        request_builder: reqwest::RequestBuilder,
    ) -> reqwest::RequestBuilder {
        let mut builder = request_builder.bearer_auth(&self.api_key);

        if let Some(ref org_id) = self.organization_id {
            builder = builder.header("X-Daytona-Organization-ID", org_id);
        }

        builder
    }

    async fn create_sandbox(&self, request: CreateSandboxRequest) -> SandboxResult<DaytonaSandbox> {
        let url = format!("{}/sandbox", self.base_url);

        info!(
            "Creating Daytona sandbox for repository: {}",
            request.repository_url
        );
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
                status, error_text
            )));
        }

        let sandbox: DaytonaSandbox = response.json().await?;
        info!("Successfully created sandbox with ID: {}", sandbox.id);
        Ok(sandbox)
    }

    async fn get_sandbox(&self, sandbox_id: &str) -> SandboxResult<DaytonaSandbox> {
        let url = format!("{}/sandbox/{}", self.base_url, sandbox_id);

        debug!("Getting sandbox status for ID: {}", sandbox_id);

        let response = self.add_auth_headers(self.client.get(&url)).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "Failed to get sandbox {}: {} - {}",
                sandbox_id, status, error_text
            );
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to get sandbox: {} - {}",
                status, error_text
            )));
        }

        // Get the raw response text for logging
        let response_text = response.text().await?;
        debug!(
            "Daytona API response for sandbox {}: {}",
            sandbox_id, response_text
        );

        // Parse the JSON
        let sandbox: DaytonaSandbox = serde_json::from_str(&response_text)?;
        debug!(
            "Retrieved sandbox {}: state={}, hostname={:?}, runner_domain={:?}",
            sandbox.id, sandbox.state, sandbox.host_name, sandbox.runner_domain
        );
        Ok(sandbox)
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
            error!(
                "Failed to delete sandbox {}: {} - {}",
                sandbox_id, status, error_text
            );
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to delete sandbox: {} - {}",
                status, error_text
            )));
        }

        info!("Successfully deleted sandbox {}", sandbox_id);
        Ok(())
    }

    pub async fn clone_repository(
        &self,
        sandbox_id: &str,
        repo_url: &str,
        github_token: &str,
        branch: Option<&str>,
    ) -> SandboxResult<()> {
        let url = format!("{}/toolbox/{}/toolbox/git/clone", self.base_url, sandbox_id);

        // Extract repository name from URL
        let repo_name = Self::extract_repo_name(repo_url)?;
        let workspace_path = format!("/home/daytona/{}", repo_name);

        let clone_request = GitCloneRequest {
            url: repo_url.to_string(),
            path: workspace_path,
            username: "git".to_string(),
            password: github_token.to_string(),
            branch: branch.unwrap_or("main").to_string(),
        };

        let masked_token = format!("{}***", &github_token[..4.min(github_token.len())]);
        info!(
            "Cloning repository {} to sandbox {} (token: {})",
            repo_url, sandbox_id, masked_token
        );
        debug!(
            "Clone request: url={}, path={}, branch={}",
            clone_request.url, clone_request.path, clone_request.branch
        );

        let response = self
            .add_auth_headers(self.client.post(&url))
            .json(&clone_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "Failed to clone repository in sandbox {}: {} - {}",
                sandbox_id, status, error_text
            );
            return Err(SandboxError::SandboxOperationError(format!(
                "clone failed: {} – {}",
                status, error_text
            )));
        }

        info!(
            "Successfully cloned repository {} in sandbox {}",
            repo_url, sandbox_id
        );
        Ok(())
    }

    fn extract_repo_name(repo_url: &str) -> SandboxResult<String> {
        let parsed_url = Url::parse(repo_url).map_err(|e| {
            SandboxError::SandboxOperationError(format!("Invalid repository URL: {}", e))
        })?;

        let path = parsed_url.path();
        let repo_name = path
            .split('/')
            .last()
            .ok_or_else(|| {
                SandboxError::SandboxOperationError(
                    "Cannot extract repository name from URL".to_string(),
                )
            })?
            .strip_suffix(".git")
            .unwrap_or(path.split('/').last().unwrap())
            .to_string();

        if repo_name.is_empty() {
            return Err(SandboxError::SandboxOperationError(
                "Repository name is empty".to_string(),
            ));
        }

        Ok(repo_name)
    }

    fn map_daytona_status(state: &str) -> WorkspaceStatus {
        match state.to_lowercase().as_str() {
            "starting" | "pending" => WorkspaceStatus::Starting,
            "started" | "running" => WorkspaceStatus::Running,
            "stopped" | "succeeded" => WorkspaceStatus::Stopped,
            "failed" | "error" | "destroyed" => WorkspaceStatus::Failed,
            _ => WorkspaceStatus::Starting,
        }
    }

    /// Install Node.js and Claude Code in the sandbox
    async fn install_claude_code(&self, sandbox_id: &str) -> SandboxResult<()> {
        #[derive(Serialize)]
        struct ExecBody {
            command: String,
            cwd: String,
            #[serde(rename = "runAsync")]
            run_async: bool,
        }

        // 1. Create process session
        let session_id = Uuid::new_v4().to_string();
        let response = self
            .add_auth_headers(self.client.post(format!(
                "{}/toolbox/{}/toolbox/process/session",
                self.base_url, sandbox_id
            )))
            .json(&serde_json::json!({
                "SessionId": session_id
            }))
            .send()
            .await?;

        let response_text = response.text().await?;
        debug!("Process session response for install: {}", response_text);

        // If response is empty, use the session ID we generated
        let returned_session_id = if response_text.is_empty() {
            session_id.clone()
        } else {
            let sess: serde_json::Value = serde_json::from_str(&response_text)?;
            sess["id"]
                .as_str()
                .or_else(|| sess["SessionId"].as_str())
                .or_else(|| sess["sessionId"].as_str())
                .unwrap_or(&session_id)
                .to_owned()
        };

        // 2. Install Node.js 18+ and Claude Code
        let install_cmd = "bash -lc 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs && npm install -g @anthropic-ai/claude-code'";

        info!("Installing Claude Code in sandbox {}", sandbox_id);

        self.add_auth_headers(self.client.post(format!(
            "{}/toolbox/{}/toolbox/process/session/{}/exec",
            self.base_url, sandbox_id, returned_session_id
        )))
        .json(&ExecBody {
            command: install_cmd.to_string(),
            cwd: "/home/daytona".to_string(),
            run_async: false, // Wait for installation to complete
        })
        .send()
        .await?
        .error_for_status()?;

        info!(
            "Successfully installed Claude Code in sandbox {}",
            sandbox_id
        );
        Ok(())
    }

    /// Execute Claude Code with the given task prompt
    pub async fn exec_claude_code(
        &self,
        sandbox_id: &str,
        repo_path: &str,
        prompt: &str,
        task_id: i32,
    ) -> SandboxResult<(String, String)> {
        #[derive(Serialize)]
        struct ExecBody {
            command: String,
            cwd: String,
            #[serde(rename = "runAsync")]
            run_async: bool,
        }

        // 1. Create process session
        let session_id = Uuid::new_v4().to_string();
        let response = self
            .add_auth_headers(self.client.post(format!(
                "{}/toolbox/{}/toolbox/process/session",
                self.base_url, sandbox_id
            )))
            .json(&serde_json::json!({
                "SessionId": session_id.clone()
            }))
            .send()
            .await?;

        let response_text = response.text().await?;

        // If response is empty, use the session ID we generated
        let returned_session_id = if response_text.is_empty() {
            session_id
        } else {
            let sess: serde_json::Value = serde_json::from_str(&response_text)?;
            sess["id"]
                .as_str()
                .or_else(|| sess["SessionId"].as_str())
                .or_else(|| sess["sessionId"].as_str())
                .unwrap_or(&session_id)
                .to_owned()
        };

        // 2. Execute Claude Code with the task prompt
        let claude_prompt = format!(
            "Please work on task ID {}: {}. Analyze the codebase and suggest improvements.",
            task_id,
            prompt.replace('\"', "\\\"")
        );

        let cmd = format!(
            "claude -p {} --output-format stream-json --max-turns 10 --dangerously-skip-permissions",
            claude_prompt
        );

        info!(
            "Executing Claude Code in sandbox {} for task {}",
            sandbox_id, task_id
        );

        let exec_response = self
            .add_auth_headers(self.client.post(format!(
                "{}/toolbox/{}/toolbox/process/session/{}/exec",
                self.base_url, sandbox_id, returned_session_id
            )))
            .json(&ExecBody {
                command: cmd,
                cwd: repo_path.to_string(),
                run_async: true,
            })
            .send()
            .await?;

        let status = exec_response.status();
        let exec_text = exec_response.text().await?;
        debug!("Exec response status: {}, body: {}", status, exec_text);

        // Handle async execution - expect 202 (Accepted) response
        if status != 202 {
            error!(
                "Expected 202 (Accepted) response for async execution, got: {}",
                status
            );
            return Err(SandboxError::SandboxOperationError(format!(
                "Async execution failed: {} - {}",
                status, exec_text
            )));
        }

        // Extract command ID from response
        let exec_json: serde_json::Value =
            serde_json::from_str(&exec_text).unwrap_or_else(|_| json!({"cmdId": "unknown"}));
        let command_id = exec_json["cmdId"]
            .as_str()
            .or_else(|| exec_json["commandId"].as_str())
            .or_else(|| exec_json["id"].as_str())
            .unwrap_or("unknown");

        info!(
            "Successfully launched Claude Code asynchronously in sandbox {} with command ID {}",
            sandbox_id, command_id
        );

        // Return session and command IDs for polling
        Ok((returned_session_id, command_id.to_string()))
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
        anthropic_api_key: &str,
    ) -> SandboxResult<WorkspaceInfo> {
        info!(
            "Starting sandbox for task {}, repository: {}",
            task_id, repo_url
        );

        let create_request = CreateSandboxRequest {
            repository_url: repo_url.to_string(),
            env: json!({
                "TASK_ID": task_id.to_string(),
                "PROMPT": prompt,
                "GITHUB_TOKEN": github_token,
                "ANTHROPIC_API_KEY": anthropic_api_key
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

            // Check if sandbox is in a running state
            let sandbox_status = Self::map_daytona_status(&sb.state);
            match sandbox_status {
                WorkspaceStatus::Running => {
                    info!("Sandbox {} is running (state: {}, hostname: {:?}, runner_domain: {:?}, ip: {:?})",
                          sandbox_id, sb.state, sb.host_name, sb.runner_domain, sb.public_ipv4);
                    Ok(sb)
                }
                WorkspaceStatus::Failed => {
                    error!("Sandbox {} failed to start (state: {})", sandbox_id, sb.state);
                    Err(SandboxError::SandboxOperationError("Sandbox failed to start".to_string()))
                }
                WorkspaceStatus::Starting => {
                    debug!("Sandbox {} still starting (state: {}), retrying...", sandbox_id, sb.state);
                    Err(SandboxError::SandboxOperationError("Sandbox still starting".to_string()))
                }
                WorkspaceStatus::Stopped => {
                    error!("Sandbox {} stopped unexpectedly (state: {})", sandbox_id, sb.state);
                    Err(SandboxError::SandboxOperationError("Sandbox stopped unexpectedly".to_string()))
                }
            }
        }))
        .await
        .map_err(|_| {
            error!("Timeout waiting for sandbox {} to be ready", sandbox_id);
            SandboxError::TimeoutError
        })??;

        // Clone the repository using the toolbox API
        self.clone_repository(&sandbox_id, repo_url, github_token, None)
            .await?;

        // Install Claude Code
        self.install_claude_code(&sandbox_id).await?;

        // Launch Claude Code with the task
        let repo_name = Self::extract_repo_name(repo_url)?;
        let repo_path = format!("/home/daytona/{}", repo_name);
        let (session_id, command_id) = self
            .exec_claude_code(&sandbox_id, &repo_path, prompt, task_id)
            .await?;

        let hostname = ready_sandbox
            .runner_domain
            .or(ready_sandbox.host_name)
            .or(ready_sandbox.public_ipv4)
            .unwrap_or_else(|| sandbox_id.clone());

        let status = Self::map_daytona_status(&ready_sandbox.state);

        info!(
            "Sandbox {} started successfully with hostname: {} and Claude Code running",
            sandbox_id, hostname
        );
        Ok(WorkspaceInfo {
            id: sandbox_id,
            hostname,
            status,
            session_id,
            command_id,
        })
    }

    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus> {
        let sandbox = self.get_sandbox(sandbox_id).await?;

        let status = Self::map_daytona_status(&sandbox.state);

        debug!("Sandbox {} status: {:?}", sandbox_id, status);
        Ok(status)
    }

    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<WorkspaceStatus> {
        let timeout_duration = Duration::from_secs(30 * 60); // 30 minutes
        let poll_interval = Duration::from_secs(30);

        info!(
            "Waiting for sandbox {} completion (timeout: 30 minutes)",
            sandbox_id
        );
        let result = timeout(timeout_duration, async {
            loop {
                let status = self.get_sandbox_status(sandbox_id).await?;

                match status {
                    WorkspaceStatus::Stopped | WorkspaceStatus::Failed => {
                        info!("Sandbox {} completed with status: {:?}", sandbox_id, status);
                        return Ok(status);
                    }
                    WorkspaceStatus::Starting | WorkspaceStatus::Running => {
                        debug!(
                            "Sandbox {} still running, checking again in {} seconds",
                            sandbox_id,
                            poll_interval.as_secs()
                        );
                        sleep(poll_interval).await;
                    }
                }
            }
        })
        .await;

        match result {
            Ok(status) => status,
            Err(_) => {
                warn!(
                    "Sandbox {} timed out after 30 minutes, attempting to stop",
                    sandbox_id
                );
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_name() {
        assert_eq!(
            DaytonaProvider::extract_repo_name("https://github.com/user/repo.git").unwrap(),
            "repo"
        );
        assert_eq!(
            DaytonaProvider::extract_repo_name("https://github.com/user/repo").unwrap(),
            "repo"
        );
        assert_eq!(
            DaytonaProvider::extract_repo_name("https://gitlab.com/group/subgroup/project.git")
                .unwrap(),
            "project"
        );

        assert!(DaytonaProvider::extract_repo_name("invalid-url").is_err());
        assert!(DaytonaProvider::extract_repo_name("https://github.com/").is_err());
    }

    #[test]
    fn test_error_mapping() {
        let error =
            SandboxError::SandboxOperationError("clone failed: 404 – Not Found".to_string());
        assert!(error.to_string().contains("clone failed: 404"));
    }
}
