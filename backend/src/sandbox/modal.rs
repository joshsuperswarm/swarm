use super::{SandboxError, SandboxInfo, SandboxProvider, SandboxResult, SandboxStatus};
use crate::error::AppResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::{sleep, timeout};
use tokio_retry::strategy::ExponentialBackoff;
use tokio_retry::Retry;
use tracing::{debug, error, info, warn};
use url::Url;

#[derive(Debug, Clone)]
pub struct ModalProvider {
    client: ModalSandboxClient,
    region: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSandboxRequest {
    pub repo_url: String,
    pub branch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSandboxResponse {
    pub sandbox_id: String,
    pub hostname: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecRequest {
    pub cmd: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResponse {
    pub proc_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExitCodeResponse {
    pub code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogsResponse {
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxStatusResponse {
    pub status: String, // "starting", "running", "stopped", "failed"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_email: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ModalSandboxClient {
    base_url: String,
    client: reqwest::Client,
}

impl ModalSandboxClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            client: reqwest::Client::new(),
        }
    }

    pub async fn create_sandbox(
        &self,
        req: CreateSandboxRequest,
    ) -> AppResult<CreateSandboxResponse> {
        let url = format!("{}/sandboxes", self.base_url);

        let response = self.client.post(&url).json(&req).send().await?;

        if response.status().is_success() {
            let sandbox_resp: CreateSandboxResponse = response.json().await?;
            Ok(sandbox_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to create sandbox: {}", error_text).into())
        }
    }

    pub async fn exec_command(
        &self,
        sandbox_id: &str,
        req: ExecRequest,
    ) -> AppResult<ExecResponse> {
        let url = format!("{}/sandboxes/{}/exec", self.base_url, sandbox_id);

        let response = self.client.post(&url).json(&req).send().await?;

        if response.status().is_success() {
            let exec_resp: ExecResponse = response.json().await?;
            Ok(exec_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to execute command: {}", error_text).into())
        }
    }

    pub async fn get_exit_code(
        &self,
        sandbox_id: &str,
        proc_id: &str,
    ) -> AppResult<ExitCodeResponse> {
        let url = format!(
            "{}/sandboxes/{}/procs/{}/exit_code",
            self.base_url, sandbox_id, proc_id
        );

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let exit_code_resp: ExitCodeResponse = response.json().await?;
            Ok(exit_code_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to get exit code: {}", error_text).into())
        }
    }

    pub async fn get_logs(
        &self,
        sandbox_id: &str,
        proc_id: &str,
        since: Option<u64>,
    ) -> AppResult<LogsResponse> {
        let mut url = format!(
            "{}/sandboxes/{}/procs/{}/logs",
            self.base_url, sandbox_id, proc_id
        );

        if let Some(offset) = since {
            url.push_str(&format!("?since={}", offset));
        }

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let logs_resp: LogsResponse = response.json().await?;
            Ok(logs_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to get logs: {}", error_text).into())
        }
    }

    pub async fn get_sandbox_status(&self, sandbox_id: &str) -> AppResult<SandboxStatusResponse> {
        let url = format!("{}/sandboxes/{}", self.base_url, sandbox_id);

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let status_resp: SandboxStatusResponse = response.json().await?;
            Ok(status_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to get sandbox status: {}", error_text).into())
        }
    }

    pub async fn terminate_sandbox(&self, sandbox_id: &str) -> AppResult<()> {
        let url = format!("{}/sandboxes/{}", self.base_url, sandbox_id);

        let response = self.client.delete(&url).send().await?;

        if response.status().is_success() {
            Ok(())
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to terminate sandbox: {}", error_text).into())
        }
    }
}

impl ModalProvider {
    pub fn new(base_url: String, region: Option<String>) -> Self {
        Self {
            client: ModalSandboxClient::new(base_url),
            region,
        }
    }

    /// Execute Claude Code with the given task prompt - delegates to modal shim
    pub async fn exec_claude_code(
        &self,
        sandbox_id: &str,
        repo_path: &str,
        prompt: &str,
        task_id: i32,
        github_token: &str,
        anthropic_api_key: &str,
        openai_api_key: Option<&str>,
        branch: &str,
        author_name: &str,
        author_email: &str,
    ) -> SandboxResult<String> {
        info!(
            "Executing Claude Code via modal shim in sandbox {} for task {}",
            sandbox_id, task_id
        );

        // Create request payload for modal shim
        let claude_req = serde_json::json!({
            "repo_path": repo_path,
            "prompt": prompt,
            "task_id": task_id,
            "github_token": github_token,
            "anthropic_api_key": anthropic_api_key,
            "openai_api_key": openai_api_key,
            "branch": branch,
            "author_name": author_name,
            "author_email": author_email
        });

        // Make HTTP request to modal shim for Claude Code execution
        let url = format!("{}/sandboxes/{}/exec_claude_code", self.client.base_url, sandbox_id);
        let response = self.client.client
            .post(&url)
            .json(&claude_req)
            .send()
            .await
            .map_err(|e| SandboxError::SandboxOperationError(format!("HTTP request failed: {}", e)))?;

        if response.status().is_success() {
            let exec_resp: ExecResponse = response.json().await
                .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to parse response: {}", e)))?;
            
            info!(
                "Successfully launched Claude Code in sandbox {} with proc ID {}",
                sandbox_id, exec_resp.proc_id
            );
            
            Ok(exec_resp.proc_id)
        } else {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(SandboxError::SandboxOperationError(format!(
                "Failed to execute Claude Code: {}", error_text
            )))
        }
    }


    /// Push changes to GitHub branch - delegates to modal shim
    pub async fn push_changes(
        &self,
        sandbox_id: &str,
        repo_path: &str,
        branch: &str,
        task_id: i32,
        author_name: &str,
        author_email: &str,
        commit_title: &str,
        commit_body: &str,
    ) -> SandboxResult<()> {
        info!(
            "Pushing changes via modal shim to branch {} in sandbox {}",
            branch, sandbox_id
        );

        // Create request payload for modal shim
        let push_req = serde_json::json!({
            "repo_path": repo_path,
            "branch": branch,
            "task_id": task_id,
            "author_name": author_name,
            "author_email": author_email,
            "commit_title": commit_title,
            "commit_body": commit_body
        });

        // Make HTTP request to modal shim for push changes
        let url = format!("{}/sandboxes/{}/push_changes_advanced", self.client.base_url, sandbox_id);
        let response = self.client.client
            .post(&url)
            .json(&push_req)
            .send()
            .await
            .map_err(|e| SandboxError::SandboxOperationError(format!("HTTP request failed: {}", e)))?;

        if response.status().is_success() {
            let _exec_resp: ExecResponse = response.json().await
                .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to parse response: {}", e)))?;
            
            info!(
                "✓ Successfully pushed changes to branch {} in sandbox {}",
                branch, sandbox_id
            );
            
            Ok(())
        } else {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(SandboxError::SandboxOperationError(format!(
                "Failed to push changes: {}", error_text
            )))
        }
    }

    /// Stream command logs from Modal shim with artifact parsing and database storage
    pub async fn stream_command_logs(
        &self,
        db: &crate::database::Database,
        task_id: i32,
        sandbox_id: &str,
        proc_id: &str,
    ) -> SandboxResult<()> {
        info!(
            "→ Starting log stream via modal shim for task {} from proc {}",
            task_id, proc_id
        );

        let mut task_completed = false;
        let mut lines_stored = 0;

        // Poll logs from modal shim until process completes
        loop {
            // Get logs and artifacts from modal shim
            let url = format!("{}/sandboxes/{}/stream_logs/{}", self.client.base_url, sandbox_id, proc_id);
            let response = self.client.client
                .get(&url)
                .send()
                .await
                .map_err(|e| SandboxError::SandboxOperationError(format!("HTTP request failed: {}", e)))?;

            if response.status().is_success() {
                let logs_data: serde_json::Value = response.json().await
                    .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to parse response: {}", e)))?;

                // Store logs in database
                let combined_output = format!(
                    "{}{}",
                    logs_data.get("stdout").and_then(|v| v.as_str()).unwrap_or(""),
                    logs_data.get("stderr").and_then(|v| v.as_str()).unwrap_or("")
                );

                if !combined_output.is_empty() {
                    for line in combined_output.lines() {
                        let line = line.trim();
                        if !line.is_empty() {
                            if let Err(e) = db.insert_task_log(task_id, line).await {
                                warn!("✗ Failed to store log line for task {}: {}", task_id, e);
                            } else {
                                lines_stored += 1;
                                if lines_stored % 10 == 0 {
                                    info!("   Stored {} log lines for task {}", lines_stored, task_id);
                                }
                            }
                        }
                    }
                }

                // Check if artifacts are complete
                if let Some(artifacts) = logs_data.get("artifacts").and_then(|v| v.as_object()) {
                    if artifacts.contains_key("commit_title") 
                        && artifacts.contains_key("commit_body")
                        && artifacts.contains_key("pr_title")
                        && artifacts.contains_key("pr_body") {
                        
                        info!("✓ Found all 4 AI artifacts for task {}", task_id);
                        
                        let commit_title = artifacts.get("commit_title").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let commit_body = artifacts.get("commit_body").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let pr_title = artifacts.get("pr_title").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let pr_body = artifacts.get("pr_body").and_then(|v| v.as_str()).map(|s| s.to_string());

                        match db.set_task_artifacts(task_id, commit_title, commit_body, pr_title, pr_body).await {
                            Ok(_) => {
                                info!("✓ Stored AI-generated artifacts for task {}", task_id);
                            }
                            Err(e) => {
                                error!("✗ Failed to store artifacts for task {}: {}", task_id, e);
                            }
                        }
                    }
                }

                // Check if task is completed
                if logs_data.get("completed").and_then(|v| v.as_bool()).unwrap_or(false) {
                    task_completed = true;
                    
                    // Update task status to done
                    match db.update_task_status(task_id, "done", None).await {
                        Ok(_) => {
                            info!("✓ Task {} status updated to 'done'", task_id);
                        }
                        Err(e) => {
                            error!("✗ Failed to update task {} status to done: {}", task_id, e);
                        }
                    }
                    break;
                }

                // Check if process has finished
                if logs_data.get("process_finished").and_then(|v| v.as_bool()).unwrap_or(false) {
                    break;
                }

            } else {
                warn!("Error fetching logs for task {}: HTTP {}", task_id, response.status());
            }

            // Small delay before next poll
            sleep(Duration::from_secs(2)).await;
        }

        info!("▬ Log processing summary for task {}:", task_id);
        info!("   Lines stored in DB: {}", lines_stored);
        info!("   Task completed: {}", task_completed);

        // If stream ended without completion, mark as failed
        if !task_completed {
            info!("Task {} ended without completion, marking as failed", task_id);
            if let Err(e) = db.update_task_status(task_id, "failed", None).await {
                error!("Failed to update task {} status to failed: {}", task_id, e);
            }
        }

        info!("Log stream ended for task {}", task_id);
        Ok(())
    }

    fn extract_repo_name(repo_url: &str) -> SandboxResult<String> {
        let parsed_url = Url::parse(repo_url).map_err(|e| {
            SandboxError::SandboxOperationError(format!("Invalid repository URL: {}", e))
        })?;

        let path = parsed_url.path();
        let repo_name = path
            .split('/')
            .next_back()
            .ok_or_else(|| {
                SandboxError::SandboxOperationError(
                    "Cannot extract repository name from URL".to_string(),
                )
            })?
            .strip_suffix(".git")
            .unwrap_or(path.split('/').next_back().unwrap())
            .to_string();

        if repo_name.is_empty() {
            return Err(SandboxError::SandboxOperationError(
                "Repository name is empty".to_string(),
            ));
        }

        Ok(repo_name)
    }

    fn extract_repo_full_name(repo_url: &str) -> SandboxResult<String> {
        let parsed_url = Url::parse(repo_url).map_err(|e| {
            SandboxError::SandboxOperationError(format!("Invalid repository URL: {}", e))
        })?;

        let path = parsed_url.path().trim_start_matches('/');
        let repo_full_name = path.strip_suffix(".git").unwrap_or(path).to_string();

        if repo_full_name.is_empty() {
            return Err(SandboxError::SandboxOperationError(
                "Repository full name is empty".to_string(),
            ));
        }

        Ok(repo_full_name)
    }

    fn map_modal_status(status: &str) -> SandboxStatus {
        match status.to_lowercase().as_str() {
            "starting" | "pending" => SandboxStatus::Starting,
            "running" => SandboxStatus::Running,
            "stopped" | "succeeded" => SandboxStatus::Stopped,
            "failed" | "error" => SandboxStatus::Failed,
            _ => SandboxStatus::Starting,
        }
    }
}

#[async_trait]
impl SandboxProvider for ModalProvider {
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
    ) -> SandboxResult<SandboxInfo> {
        info!(
            "Starting Modal sandbox for task {}, repository: {}",
            task_id, repo_url
        );

        // Create sandbox
        let create_request = CreateSandboxRequest {
            repo_url: repo_url.to_string(),
            branch: "main".to_string(), // Clone from main, we'll create branch later
            region: self.region.clone(),
            github_token: Some(github_token.to_string()),
            author_name: Some(author_name.to_string()),
            author_email: Some(author_email.to_string()),
        };

        let sandbox_resp = self
            .client
            .create_sandbox(create_request)
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to create sandbox: {}", e))
            })?;

        let sandbox_id = sandbox_resp.sandbox_id.clone();

        info!("Created Modal sandbox {} for task {}", sandbox_id, task_id);

        // Wait for sandbox to be ready with retry logic
        info!("Waiting for sandbox {} to be ready", sandbox_id);
        let retry_strategy = ExponentialBackoff::from_millis(1000)
            .max_delay(Duration::from_secs(10))
            .take(30); // Limit to 30 retries (about 5 minutes total)

        let _ready = timeout(
            Duration::from_secs(10 * 60),
            Retry::spawn(retry_strategy, || async {
                match self.client.get_sandbox_status(&sandbox_id).await {
                    Ok(status_resp) => {
                        let status = Self::map_modal_status(&status_resp.status);
                        match status {
                            SandboxStatus::Running => {
                                info!("Sandbox {} is running", sandbox_id);
                                Ok(())
                            }
                            SandboxStatus::Failed => {
                                error!("Sandbox {} failed to start", sandbox_id);
                                Err(SandboxError::SandboxOperationError(
                                    "Sandbox failed to start".to_string(),
                                ))
                            }
                            SandboxStatus::Starting => {
                                debug!("Sandbox {} still starting, retrying...", sandbox_id);
                                Err(SandboxError::SandboxOperationError(
                                    "Sandbox still starting".to_string(),
                                ))
                            }
                            SandboxStatus::Stopped => {
                                error!("Sandbox {} stopped unexpectedly", sandbox_id);
                                Err(SandboxError::SandboxOperationError(
                                    "Sandbox stopped unexpectedly".to_string(),
                                ))
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Error checking sandbox status: {}", e);
                        Err(SandboxError::SandboxOperationError(
                            "Error checking status".to_string(),
                        ))
                    }
                }
            }),
        )
        .await
        .map_err(|_| {
            error!("Timeout waiting for sandbox {} to be ready", sandbox_id);
            SandboxError::TimeoutError
        })??;

        // Claude Code and Git are now configured during sandbox creation in the Modal shim

        // Get repo info for Claude Code execution
        let repo_name = Self::extract_repo_name(repo_url)?;
        let repo_path = format!("/home/swarm/{}", repo_name);

        // Launch Claude Code with the task
        let proc_id = self
            .exec_claude_code(
                &sandbox_id,
                &repo_path,
                prompt,
                task_id,
                github_token,
                anthropic_api_key,
                openai_api_key,
                branch,
                author_name,
                author_email,
            )
            .await?;

        let hostname = sandbox_resp.hostname;
        let status = SandboxStatus::Running;

        info!(
            "Modal sandbox {} started successfully with hostname: {} and Claude Code running",
            sandbox_id, hostname
        );

        Ok(SandboxInfo {
            id: sandbox_id,
            hostname,
            status,
            session_id: "modal".to_string(), // Modal doesn't use sessions, use placeholder
            command_id: proc_id,             // Use proc_id as command_id
            branch: branch.to_string(),
        })
    }

    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus> {
        let status_resp = self
            .client
            .get_sandbox_status(sandbox_id)
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to get status: {}", e))
            })?;

        let status = Self::map_modal_status(&status_resp.status);
        debug!("Modal sandbox {} status: {:?}", sandbox_id, status);
        Ok(status)
    }

    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus> {
        let timeout_duration = Duration::from_secs(30 * 60); // 30 minutes
        let poll_interval = Duration::from_secs(30);

        info!(
            "Waiting for Modal sandbox {} completion (timeout: 30 minutes)",
            sandbox_id
        );

        let result = timeout(timeout_duration, async {
            loop {
                let status = self.get_sandbox_status(sandbox_id).await?;

                match status {
                    SandboxStatus::Stopped | SandboxStatus::Failed => {
                        info!(
                            "Modal sandbox {} completed with status: {:?}",
                            sandbox_id, status
                        );
                        return Ok(status);
                    }
                    SandboxStatus::Starting | SandboxStatus::Running => {
                        debug!(
                            "Modal sandbox {} still running, checking again in {} seconds",
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
                    "Modal sandbox {} timed out after 30 minutes, attempting to stop",
                    sandbox_id
                );
                // Timeout occurred, try to stop the sandbox
                let _ = self.stop_sandbox(sandbox_id).await;
                Err(SandboxError::TimeoutError)
            }
        }
    }

    async fn stop_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        info!("Stopping Modal sandbox {}", sandbox_id);
        self.client
            .terminate_sandbox(sandbox_id)
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to stop sandbox: {}", e))
            })
    }

    async fn get_command_exit_code(
        &self,
        sandbox_id: &str,
        _session_id: &str, // Modal doesn't use sessions
        command_id: &str,  // This is the proc_id
    ) -> SandboxResult<Option<i32>> {
        match self.client.get_exit_code(sandbox_id, command_id).await {
            Ok(exit_code_resp) => Ok(exit_code_resp.code),
            Err(e) => Err(SandboxError::SandboxOperationError(format!(
                "Failed to get exit code: {}",
                e
            ))),
        }
    }

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
    ) -> SandboxResult<()> {
        self.push_changes(
            sandbox_id,
            repo_path,
            branch,
            task_id,
            author_name,
            author_email,
            commit_title,
            commit_body,
        )
        .await
    }

    async fn delete_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        self.client
            .terminate_sandbox(sandbox_id)
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to delete sandbox: {}", e))
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_name() {
        assert_eq!(
            ModalProvider::extract_repo_name("https://github.com/user/repo.git").unwrap(),
            "repo"
        );
        assert_eq!(
            ModalProvider::extract_repo_name("https://github.com/user/repo").unwrap(),
            "repo"
        );
        assert_eq!(
            ModalProvider::extract_repo_name("https://gitlab.com/group/subgroup/project.git")
                .unwrap(),
            "project"
        );

        assert!(ModalProvider::extract_repo_name("invalid-url").is_err());
        assert!(ModalProvider::extract_repo_name("https://github.com/").is_err());
    }

    #[test]
    fn test_map_modal_status() {
        assert!(matches!(
            ModalProvider::map_modal_status("running"),
            SandboxStatus::Running
        ));
        assert!(matches!(
            ModalProvider::map_modal_status("starting"),
            SandboxStatus::Starting
        ));
        assert!(matches!(
            ModalProvider::map_modal_status("stopped"),
            SandboxStatus::Stopped
        ));
        assert!(matches!(
            ModalProvider::map_modal_status("failed"),
            SandboxStatus::Failed
        ));
    }
}
