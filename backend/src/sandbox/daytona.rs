use super::{SandboxError, SandboxProvider, SandboxResult, SandboxInfo, SandboxStatus};
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
    region: String,
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
    /// Target region for the sandbox (us, eu, asia)
    target: String,
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
    pub fn new(
        base_url: String,
        api_key: String,
        organization_id: Option<String>,
        region: String,
    ) -> Self {
        Self {
            client: Client::new(),
            base_url,
            api_key,
            organization_id,
            region,
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

    fn extract_repo_full_name(repo_url: &str) -> SandboxResult<String> {
        let parsed_url = Url::parse(repo_url).map_err(|e| {
            SandboxError::SandboxOperationError(format!("Invalid repository URL: {}", e))
        })?;

        let path = parsed_url.path().trim_start_matches('/');
        let repo_full_name = path
            .strip_suffix(".git")
            .unwrap_or(path)
            .to_string();

        if repo_full_name.is_empty() {
            return Err(SandboxError::SandboxOperationError(
                "Repository full name is empty".to_string(),
            ));
        }

        Ok(repo_full_name)
    }

    fn map_daytona_status(state: &str) -> SandboxStatus {
        match state.to_lowercase().as_str() {
            "starting" | "pending" => SandboxStatus::Starting,
            "started" | "running" => SandboxStatus::Running,
            "stopped" | "succeeded" => SandboxStatus::Stopped,
            "failed" | "error" | "destroyed" => SandboxStatus::Failed,
            _ => SandboxStatus::Starting,
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
        let install_cmd = "bash -c 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get -y install nodejs && npm i -g @anthropic-ai/claude-code@1.0.24'";

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

    /// Configure Git with author information and authenticated remote URL
    pub async fn configure_git(
        &self,
        sandbox_id: &str,
        repo_path: &str,
        github_token: &str,
        author_name: &str,
        author_email: &str,
        repo_full_name: &str,
    ) -> SandboxResult<()> {
        #[derive(Serialize)]
        struct ExecBody {
            command: String,
            cwd: String,
            #[serde(rename = "runAsync")]
            run_async: bool,
        }

        // Create process session
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
        
        // Configure git user
        let git_config_commands = vec![
            format!("git config --global user.name '{}'", author_name),
            format!("git config --global user.email '{}'", author_email),
            format!("git remote set-url origin 'https://{}@github.com/{}'", github_token, repo_full_name),
        ];

        for command in git_config_commands {
            info!("Configuring git in sandbox {}: {}", sandbox_id, command.replace(github_token, "***"));

            let response = self.add_auth_headers(self.client.post(format!(
                "{}/toolbox/{}/toolbox/process/session/{}/exec",
                self.base_url, sandbox_id, returned_session_id
            )))
            .json(&ExecBody {
                command,
                cwd: repo_path.to_string(),
                run_async: false, // Wait for git config to complete
            })
            .send()
            .await?;

            if !response.status().is_success() {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                error!(
                    "Failed to configure git in sandbox {}: {} - {}",
                    sandbox_id, status, error_text
                );
                return Err(SandboxError::SandboxOperationError(format!(
                    "Git configuration failed: {} - {}",
                    status, error_text
                )));
            }
        }

        info!("Successfully configured git in sandbox {}", sandbox_id);
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
        let claude_prompt = format!("Please work on this task {}: {}.", task_id, prompt);

        // TODO: Remove max turns once I'm confident in the setup
        let cmd = format!(
            r#"bash -c '
                claude -p "{}" \
                    --verbose \
                    --output-format stream-json \
                    --max-turns 100 \
                    --dangerously-skip-permissions \
                    < /dev/null
            '"#,
            claude_prompt.replace("'", r"'\''")
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
                command: cmd.to_string(),
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

    /// Stream command logs from Daytona and store them in the database
    pub async fn stream_command_logs(
        &self,
        db: &crate::database::Database,
        task_id: i32,
        sandbox_id: &str,
        session_id: &str,
        command_id: &str,
    ) -> SandboxResult<()> {
        // Note: For true streaming, we would need to use a streaming HTTP client
        // For now, we fetch the full response and process line by line

        let url = format!(
            "{}/toolbox/{}/toolbox/process/session/{}/command/{}/logs",
            self.base_url, sandbox_id, session_id, command_id
        );

        info!("→ Starting log stream for task {} from URL: {}", task_id, url);
        info!("   Request details - sandbox: {}, session: {}, command: {}", 
            sandbox_id, session_id, command_id);

        let response = self.add_auth_headers(self.client.get(&url)).send().await?;

        let status = response.status();
        info!("← HTTP response received - status: {}", status);

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("✗ Failed to start log stream for task {}", task_id);
            error!("   Status: {}", status);
            error!("   Response: {}", error_text);
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to start log stream: {} - {}",
                status, error_text
            )));
        }

        info!("✓ HTTP request successful, reading response body...");
        
        // Read response body in chunks
        let body = response.text().await?;
        let body_size = body.len();
        info!("   Response body received - size: {} bytes", body_size);
        
        if body.is_empty() {
            warn!("⚠ Response body is empty for task {}", task_id);
            return Ok(());
        }
        
        let lines: Vec<&str> = body.lines().collect();
        info!("   Processing {} lines from response for task {}", lines.len(), task_id);
        
        let mut task_completed = false;
        let mut lines_processed = 0;
        let mut lines_stored = 0;
        let mut json_lines = 0;

        for (line_num, line_str) in lines.iter().enumerate() {
            let line_str = line_str.trim();
            lines_processed += 1;
            
            if line_num < 5 {
                // Log first few lines for debugging
                info!("   Line {}: {}", line_num + 1, 
                    if line_str.len() > 100 { 
                        format!("{}...", &line_str[..100]) 
                    } else { 
                        line_str.to_string() 
                    });
            }
            
            if !line_str.is_empty() {
                // Store the log line in database
                match db.insert_task_log(task_id, line_str).await {
                    Ok(_) => {
                        lines_stored += 1;
                        if lines_stored % 10 == 0 {
                            info!("   Stored {} log lines for task {}", lines_stored, task_id);
                        }
                    }
                    Err(e) => {
                        warn!("✗ Failed to store log line {} for task {}: {}", line_num + 1, task_id, e);
                        warn!("   Line content: {}", if line_str.len() > 200 { 
                            format!("{}...", &line_str[..200]) 
                        } else { 
                            line_str.to_string() 
                        });
                    }
                }

                // Check if this is a JSON line indicating completion
                if line_str.starts_with('{') {
                    json_lines += 1;
                    match serde_json::from_str::<serde_json::Value>(line_str) {
                        Ok(json_value) => {
                            if let Some(msg_type) = json_value.get("type").and_then(|t| t.as_str()) {
                                info!("   JSON message type: {}", msg_type);
                                if msg_type == "done" {
                                    info!("✓ Task {} completed successfully (received 'done' event)", task_id);
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
                                }
                            }
                        }
                        Err(e) => {
                            warn!("⚠ Failed to parse JSON line {} for task {}: {}", line_num + 1, task_id, e);
                            warn!("   Line: {}", if line_str.len() > 200 { 
                                format!("{}...", &line_str[..200]) 
                            } else { 
                                line_str.to_string() 
                            });
                        }
                    }
                }
            }
        }

        info!("▬ Log processing summary for task {}:", task_id);
        info!("   Total lines processed: {}", lines_processed);
        info!("   Lines stored in DB: {}", lines_stored);
        info!("   JSON lines found: {}", json_lines);
        info!("   Task completed: {}", task_completed);

        // If stream ended without a done event, check sandbox status
        if !task_completed {
            match self.get_sandbox_status(sandbox_id).await {
                Ok(SandboxStatus::Stopped) => {
                    info!(
                        "Task {} sandbox stopped without 'done' event, marking as failed",
                        task_id
                    );
                    if let Err(e) = db.update_task_status(task_id, "failed", None).await {
                        error!("Failed to update task {} status to failed: {}", task_id, e);
                    }
                }
                Ok(status) => {
                    debug!("Task {} ended with sandbox status: {:?}", task_id, status);
                }
                Err(e) => {
                    warn!("Failed to check sandbox status for task {}: {}", task_id, e);
                }
            }
        }

        info!("Log stream ended for task {}", task_id);
        Ok(())
    }

    /// Get the exit code of a command from Daytona
    pub async fn get_command_exit_code(
        &self,
        sandbox_id: &str,
        session_id: &str,
        command_id: &str,
    ) -> SandboxResult<Option<i32>> {
        let url = format!(
            "{}/toolbox/{}/toolbox/process/session/{}/command/{}",
            self.base_url, sandbox_id, session_id, command_id
        );

        debug!(
            "Getting command exit code for sandbox: {}, session: {}, command: {}",
            sandbox_id, session_id, command_id
        );

        let response = self.add_auth_headers(self.client.get(&url)).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "Failed to get command exit code for sandbox {}: {} - {}",
                sandbox_id, status, error_text
            );
            return Err(SandboxError::SandboxOperationError(format!(
                "Failed to get command exit code: {} - {}",
                status, error_text
            )));
        }

        let response_text = response.text().await?;
        debug!("Command status response: {}", response_text);

        let json_value: serde_json::Value = serde_json::from_str(&response_text)?;

        // Try different possible field names for exit code
        let exit_code = json_value
            .get("exitCode")
            .or_else(|| json_value.get("exit_code"))
            .and_then(|v| v.as_i64())
            .map(|v| v as i32);

        debug!(
            "Command exit code for {}/{}/{}: {:?}",
            sandbox_id, session_id, command_id, exit_code
        );

        Ok(exit_code)
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
        openai_api_key: Option<&str>,
        branch: &str,
        author_name: &str,
        author_email: &str,
    ) -> SandboxResult<SandboxInfo> {
        info!(
            "Starting sandbox for task {}, repository: {}",
            task_id, repo_url
        );

        let mut env_vars = json!({
            "GITHUB_TOKEN": github_token,
            "ANTHROPIC_API_KEY": anthropic_api_key,
            "SWARM_BRANCH": branch,
            "SWARM_TASK_ID": task_id,
            "GIT_AUTHOR_NAME": author_name,
            "GIT_AUTHOR_EMAIL": author_email
        });

        // Add OPENAI_API_KEY if provided
        if let Some(openai_key) = openai_api_key {
            env_vars["OPENAI_API_KEY"] = json!(openai_key);
        }

        let create_request = CreateSandboxRequest {
            repository_url: repo_url.to_string(),
            env: env_vars,
            target: self.region.clone(),
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
                SandboxStatus::Running => {
                    info!("Sandbox {} is running (state: {}, hostname: {:?}, runner_domain: {:?}, ip: {:?})",
                          sandbox_id, sb.state, sb.host_name, sb.runner_domain, sb.public_ipv4);
                    Ok(sb)
                }
                SandboxStatus::Failed => {
                    error!("Sandbox {} failed to start (state: {})", sandbox_id, sb.state);
                    Err(SandboxError::SandboxOperationError("Sandbox failed to start".to_string()))
                }
                SandboxStatus::Starting => {
                    debug!("Sandbox {} still starting (state: {}), retrying...", sandbox_id, sb.state);
                    Err(SandboxError::SandboxOperationError("Sandbox still starting".to_string()))
                }
                SandboxStatus::Stopped => {
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

        // Configure Git with author information and authenticated remote
        let repo_name = Self::extract_repo_name(repo_url)?;
        let repo_path = format!("/home/daytona/{}", repo_name);
        let repo_full_name = Self::extract_repo_full_name(repo_url)?;
        self.configure_git(&sandbox_id, &repo_path, github_token, author_name, author_email, &repo_full_name).await?;

        // Launch Claude Code with the task
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
        Ok(SandboxInfo {
            id: sandbox_id,
            hostname,
            status,
            session_id,
            command_id,
            branch: branch.to_string(),
        })
    }

    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus> {
        let sandbox = self.get_sandbox(sandbox_id).await?;

        let status = Self::map_daytona_status(&sandbox.state);

        debug!("Sandbox {} status: {:?}", sandbox_id, status);
        Ok(status)
    }

    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus> {
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
                    SandboxStatus::Stopped | SandboxStatus::Failed => {
                        info!("Sandbox {} completed with status: {:?}", sandbox_id, status);
                        return Ok(status);
                    }
                    SandboxStatus::Starting | SandboxStatus::Running => {
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
    
    async fn get_command_exit_code(
        &self,
        sandbox_id: &str,
        session_id: &str,
        command_id: &str,
    ) -> SandboxResult<Option<i32>> {
        self.get_command_exit_code(sandbox_id, session_id, command_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

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

    #[tokio::test]
    async fn test_get_command_exit_code_success() {
        let mock_server = MockServer::start().await;
        let sandbox_id = "test-sandbox";
        let session_id = "test-session";
        let command_id = "test-command";

        // Mock successful response with exit code 0
        Mock::given(method("GET"))
            .and(path(format!(
                "/toolbox/{}/toolbox/process/session/{}/command/{}",
                sandbox_id, session_id, command_id
            )))
            .and(header("authorization", "Bearer test-api-key"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "exitCode": 0,
                "state": "Succeeded"
            })))
            .mount(&mock_server)
            .await;

        let provider = DaytonaProvider::new(
            mock_server.uri(),
            "test-api-key".to_string(),
            None,
            "us".to_string(),
        );

        let result = provider
            .get_command_exit_code(sandbox_id, session_id, command_id)
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some(0));
    }

    #[tokio::test]
    async fn test_get_command_exit_code_failure() {
        let mock_server = MockServer::start().await;
        let sandbox_id = "test-sandbox";
        let session_id = "test-session";
        let command_id = "test-command";

        // Mock successful response with exit code 1 (failure)
        Mock::given(method("GET"))
            .and(path(format!(
                "/toolbox/{}/toolbox/process/session/{}/command/{}",
                sandbox_id, session_id, command_id
            )))
            .and(header("authorization", "Bearer test-api-key"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "exitCode": 1,
                "state": "Failed"
            })))
            .mount(&mock_server)
            .await;

        let provider = DaytonaProvider::new(
            mock_server.uri(),
            "test-api-key".to_string(),
            None,
            "us".to_string(),
        );

        let result = provider
            .get_command_exit_code(sandbox_id, session_id, command_id)
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some(1));
    }

    #[tokio::test]
    async fn test_get_command_exit_code_no_exit_code() {
        let mock_server = MockServer::start().await;
        let sandbox_id = "test-sandbox";
        let session_id = "test-session";
        let command_id = "test-command";

        // Mock response without exit code (command still running)
        Mock::given(method("GET"))
            .and(path(format!(
                "/toolbox/{}/toolbox/process/session/{}/command/{}",
                sandbox_id, session_id, command_id
            )))
            .and(header("authorization", "Bearer test-api-key"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "state": "Running"
            })))
            .mount(&mock_server)
            .await;

        let provider = DaytonaProvider::new(
            mock_server.uri(),
            "test-api-key".to_string(),
            None,
            "us".to_string(),
        );

        let result = provider
            .get_command_exit_code(sandbox_id, session_id, command_id)
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    async fn test_get_command_exit_code_http_error() {
        let mock_server = MockServer::start().await;
        let sandbox_id = "test-sandbox";
        let session_id = "test-session";
        let command_id = "test-command";

        // Mock HTTP error response
        Mock::given(method("GET"))
            .and(path(format!(
                "/toolbox/{}/toolbox/process/session/{}/command/{}",
                sandbox_id, session_id, command_id
            )))
            .and(header("authorization", "Bearer test-api-key"))
            .respond_with(ResponseTemplate::new(404).set_body_json(serde_json::json!({
                "error": "Command not found"
            })))
            .mount(&mock_server)
            .await;

        let provider = DaytonaProvider::new(
            mock_server.uri(),
            "test-api-key".to_string(),
            None,
            "us".to_string(),
        );

        let result = provider
            .get_command_exit_code(sandbox_id, session_id, command_id)
            .await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SandboxError::SandboxOperationError(_)));
    }
}
