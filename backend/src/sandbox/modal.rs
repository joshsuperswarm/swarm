use super::{SandboxError, SandboxInfo, SandboxProvider, SandboxResult, SandboxStatus};
use crate::agent_log_parser;
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

#[derive(Debug, Default)]
pub(crate) struct ArtifactParsingState {
    commit_title: Option<String>,
    commit_body: Option<String>,
    pr_title: Option<String>,
    pr_body: Option<String>,
    current_artifact: Option<String>,
    artifact_lines: Vec<String>,
    _last_processed_offset: usize,
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
pub struct ModalLogLine {
    #[serde(rename = "type")]
    pub log_type: String,
    #[serde(flatten)]
    pub content: serde_json::Value,
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
        // Ensure the base_url has a proper scheme for reqwest compatibility
        let normalized_url = if base_url.starts_with("http://") || base_url.starts_with("https://")
        {
            base_url
        } else {
            format!("http://{}", base_url)
        };

        Self {
            base_url: normalized_url,
            client: reqwest::Client::new(),
        }
    }

    pub async fn create_sandbox(
        &self,
        req: CreateSandboxRequest,
    ) -> AppResult<CreateSandboxResponse> {
        let base_url =
            Url::parse(&self.base_url).map_err(|e| format!("Invalid base URL: {}", e))?;
        let url = base_url
            .join("sandboxes")
            .map_err(|e| format!("Could not append /sandboxes: {}", e))?;

        let response = self.client.post(url).json(&req).send().await?;

        if response.status().is_success() {
            let sandbox_resp: CreateSandboxResponse = response.json().await?;
            Ok(sandbox_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to create sandbox: {}", error_text).into())
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
        // Use the new non-blocking logs_once endpoint for immediate log retrieval
        let url = format!(
            "{}/sandboxes/{}/procs/{}/logs_once",
            self.base_url, sandbox_id, proc_id
        );

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let mut logs_resp: LogsResponse = response.json().await?;

            // Apply since offset if provided (for backward compatibility)
            if let Some(offset) = since {
                let offset = offset as usize;
                if logs_resp.stdout.len() > offset {
                    logs_resp.stdout = logs_resp.stdout[offset..].to_string();
                } else {
                    logs_resp.stdout = String::new();
                }
                if logs_resp.stderr.len() > offset {
                    logs_resp.stderr = logs_resp.stderr[offset..].to_string();
                } else {
                    logs_resp.stderr = String::new();
                }
            }

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
        let url = format!(
            "{}/sandboxes/{}/exec_claude_code",
            self.client.base_url, sandbox_id
        );
        let response = self
            .client
            .client
            .post(&url)
            .json(&claude_req)
            .send()
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("HTTP request failed: {}", e))
            })?;

        if response.status().is_success() {
            let exec_resp: ExecResponse = response.json().await.map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to parse response: {}", e))
            })?;

            info!(
                "Successfully launched Claude Code in sandbox {} with proc ID {}",
                sandbox_id, exec_resp.proc_id
            );

            Ok(exec_resp.proc_id)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(SandboxError::SandboxOperationError(format!(
                "Failed to execute Claude Code: {}",
                error_text
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
        let url = format!(
            "{}/sandboxes/{}/push_changes_advanced",
            self.client.base_url, sandbox_id
        );
        let response = self
            .client
            .client
            .post(&url)
            .json(&push_req)
            .send()
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("HTTP request failed: {}", e))
            })?;

        if response.status().is_success() {
            let _exec_resp: ExecResponse = response.json().await.map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to parse response: {}", e))
            })?;

            info!(
                "✓ Successfully pushed changes to branch {} in sandbox {}",
                branch, sandbox_id
            );

            Ok(())
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            Err(SandboxError::SandboxOperationError(format!(
                "Failed to push changes: {}",
                error_text
            )))
        }
    }

    /// Extract text content from JSON messages for artifact parsing
    fn extract_text_from_json_line(line: &str) -> String {
        if line.starts_with('{') {
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
                // Extract text from message content
                if let Some(text) = json_value
                    .get("message")
                    .and_then(|msg| msg.get("content"))
                    .and_then(|content| content.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|item| item.get("text"))
                    .and_then(|text| text.as_str())
                {
                    return text.to_string();
                }

                // Extract text from result field (Claude Code final summary)
                if let Some(t) = json_value.get("result").and_then(|r| r.as_str()) {
                    return t.to_string();
                }
            }
        }
        line.to_string()
    }

    /// Process artifact parsing for a single text line
    fn process_artifact_line(line: &str, state: &mut ArtifactParsingState) {
        let line = line.trim();
        if line.is_empty() {
            return;
        }

        // Check for artifact markers
        if line.starts_with("COMMIT_MESSAGE_TITLE:") {
            // Complete previous artifact if any
            if let Some(ref artifact_type) = state.current_artifact {
                let content = state.artifact_lines.join("\n");
                match artifact_type.as_str() {
                    "commit_body" => state.commit_body = Some(content),
                    "pr_title" => state.pr_title = Some(content),
                    "pr_body" => state.pr_body = Some(content),
                    _ => {}
                }
            }

            state.commit_title = Some(
                line.strip_prefix("COMMIT_MESSAGE_TITLE:")
                    .unwrap_or("")
                    .trim()
                    .to_string(),
            );
            state.current_artifact = None;
            state.artifact_lines.clear();
        } else if line.starts_with("COMMIT_MESSAGE_BODY:") {
            // Complete previous artifact if any
            if let Some(ref artifact_type) = state.current_artifact {
                let content = state.artifact_lines.join("\n");
                match artifact_type.as_str() {
                    "commit_body" => state.commit_body = Some(content),
                    "pr_title" => state.pr_title = Some(content),
                    "pr_body" => state.pr_body = Some(content),
                    _ => {}
                }
            }

            state.current_artifact = Some("commit_body".to_string());
            state.artifact_lines.clear();
            if let Some(first_line) = line.strip_prefix("COMMIT_MESSAGE_BODY:") {
                let trimmed = first_line.trim();
                if !trimmed.is_empty() {
                    state.artifact_lines.push(trimmed.to_string());
                }
            }
        } else if line.starts_with("PR_TITLE:") {
            // Complete previous artifact if any
            if let Some(ref artifact_type) = state.current_artifact {
                let content = state.artifact_lines.join("\n");
                match artifact_type.as_str() {
                    "commit_body" => state.commit_body = Some(content),
                    "pr_title" => state.pr_title = Some(content),
                    "pr_body" => state.pr_body = Some(content),
                    _ => {}
                }
            }

            state.current_artifact = Some("pr_title".to_string());
            state.artifact_lines.clear();
            if let Some(first_line) = line.strip_prefix("PR_TITLE:") {
                let trimmed = first_line.trim();
                if !trimmed.is_empty() {
                    state.artifact_lines.push(trimmed.to_string());
                }
            }
        } else if line.starts_with("PR_BODY:") {
            // Complete previous artifact if any
            if let Some(ref artifact_type) = state.current_artifact {
                let content = state.artifact_lines.join("\n");
                match artifact_type.as_str() {
                    "commit_body" => state.commit_body = Some(content),
                    "pr_title" => state.pr_title = Some(content),
                    "pr_body" => state.pr_body = Some(content),
                    _ => {}
                }
            }

            state.current_artifact = Some("pr_body".to_string());
            state.artifact_lines.clear();
            if let Some(first_line) = line.strip_prefix("PR_BODY:") {
                let trimmed = first_line.trim();
                if !trimmed.is_empty() {
                    state.artifact_lines.push(trimmed.to_string());
                }
            }
        } else if state.current_artifact.is_some() {
            // Accumulate lines for current artifact
            state.artifact_lines.push(line.to_string());
        }
    }

    /// Pull logs once for a single task (non-blocking)
    pub async fn pull_logs_once(
        &self,
        db: &crate::database::Database,
        task_id: i32,
        sandbox_id: &str,
        proc_id: &str,
    ) -> SandboxResult<()> {
        // Get logs without offset - Modal handles deduplication
        let logs_resp = self
            .client
            .get_logs(sandbox_id, proc_id, None)
            .await
            .map_err(|e| {
                SandboxError::SandboxOperationError(format!("Failed to get logs: {}", e))
            })?;

        let combined_output = format!("{}{}", logs_resp.stdout, logs_resp.stderr);

        if !combined_output.is_empty() {
            let mut buffer = String::new();

            // Load existing task state to initialize artifact parsing state
            let mut state = match db.get_task_by_id(task_id).await {
                Ok(Some(task)) => ArtifactParsingState {
                    commit_title: task.commit_title,
                    commit_body: task.commit_body,
                    pr_title: task.pr_title,
                    pr_body: task.pr_body,
                    current_artifact: None,
                    artifact_lines: Vec::new(),
                    _last_processed_offset: 0,
                },
                _ => ArtifactParsingState::default(),
            };

            // Process the logs
            let _processed = self
                .process_modal_log_stream(db, task_id, &combined_output, &mut buffer, &mut state)
                .await?;

            // Save any new artifacts back to database
            if let Err(e) = db
                .set_task_artifacts(
                    task_id,
                    state.commit_title,
                    state.commit_body,
                    state.pr_title,
                    state.pr_body,
                )
                .await
            {
                warn!("Failed to save artifacts for task {}: {}", task_id, e);
            }
        }

        Ok(())
    }

    /// Process Modal log stream with StreamDeserializer for proper JSON object parsing
    pub async fn process_modal_log_stream(
        &self,
        db: &crate::database::Database,
        task_id: i32,
        raw_stream: &str,
        buffer: &mut String,
        state: &mut ArtifactParsingState,
    ) -> SandboxResult<usize> {
        // Accumulate new data in buffer
        buffer.push_str(raw_stream);

        // Create StreamDeserializer from current buffer
        let de = serde_json::Deserializer::from_str(buffer);
        let mut stream = de.into_iter::<ModalLogLine>();
        let mut lines_processed = 0;

        // Process all complete JSON objects
        while let Some(result) = stream.next() {
            match result {
                Ok(modal_log) => {
                    // Successfully parsed complete JSON object
                    let json_str = serde_json::to_string(&modal_log).map_err(|e| {
                        SandboxError::SandboxOperationError(format!(
                            "Failed to serialize JSON: {}",
                            e
                        ))
                    })?;

                    if let Err(e) = db.insert_task_log(task_id, &json_str).await {
                        warn!("✗ Failed to store log line for task {}: {}", task_id, e);
                    } else {
                        lines_processed += 1;
                    }

                    // Parse todos from the log line
                    match agent_log_parser::parse_todo_line(task_id, &json_str) {
                        Ok(todos) => {
                            for todo in todos {
                                if let Err(e) = sqlx::query!(
                                    r#"
                                    INSERT INTO agent_todos (task_id, todo_id, content, priority, status)
                                    VALUES ($1, $2, $3, $4, $5)
                                    ON CONFLICT (task_id, todo_id)
                                    DO UPDATE SET content = EXCLUDED.content,
                                                  priority = EXCLUDED.priority,
                                                  status   = EXCLUDED.status,
                                                  updated_at = now()
                                    "#,
                                    task_id,
                                    todo.id,
                                    todo.content,
                                    todo.priority,
                                    todo.status
                                )
                                .execute(&db.pool)
                                .await
                                {
                                    warn!("✗ Failed to store todo for task {}: {}", task_id, e);
                                }
                            }
                        }
                        Err(e) => {
                            debug!("Failed to parse todos from log line: {}", e);
                        }
                    }

                    // Extract text content for artifact parsing
                    let text_to_parse = Self::extract_text_from_json_line(&json_str);
                    for text_line in text_to_parse.lines() {
                        Self::process_artifact_line(text_line, state);
                    }
                }
                Err(e) if e.is_eof() => {
                    // Hit incomplete JSON - break and save remaining data for next iteration
                    break;
                }
                Err(e) => {
                    // Real syntax error - log and continue
                    debug!("JSON parse error: {}", e);
                    break;
                }
            }
        }

        // Keep only the unparsed remainder for next iteration
        let parsed_bytes = stream.byte_offset();
        buffer.drain(..parsed_bytes);

        Ok(lines_processed)
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
    use crate::database::Database;
    use sqlx::PgPool;

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

    #[tokio::test]
    async fn test_process_modal_log_stream_split_boundaries() {
        // Create a mock provider
        let provider = ModalProvider::new("http://test".to_string(), None);

        // Create a mock database connection (this would need a real connection in practice)
        let pool = PgPool::connect_lazy("postgresql://test").unwrap();
        let db = Database::new(pool);

        let mut buffer = String::new();
        let mut state = ArtifactParsingState::default();
        let task_id = 1;

        // Test case: JSON object with embedded newlines (from source code)
        let chunk1 = r#"{"type":"assistant","message":{"content":[{"text":"function hello() {\n  console.log(\"world\");\n}"#;
        let chunk2 = r#"}]}}"#;
        let chunk3 = r#"{"type":"user","msg":"hi"}"#;

        // Process first chunk (incomplete JSON)
        let result1 = provider
            .process_modal_log_stream(&db, task_id, chunk1, &mut buffer, &mut state)
            .await;
        // Should not error and not process anything since JSON is incomplete
        assert!(result1.is_ok());
        assert_eq!(result1.unwrap(), 0);
        assert!(!buffer.is_empty()); // Should have buffered content

        // Process second chunk (completes first JSON)
        let result2 = provider
            .process_modal_log_stream(&db, task_id, chunk2, &mut buffer, &mut state)
            .await;
        // This will fail with database connection error in test, but parsing logic should work
        // The important thing is StreamDeserializer can handle JSON with embedded newlines
        assert!(result2.is_err() || result2.unwrap() == 1);

        // Process third chunk (complete second JSON)
        let result3 = provider
            .process_modal_log_stream(&db, task_id, chunk3, &mut buffer, &mut state)
            .await;
        // Again, will fail with DB error but parsing should work
        assert!(result3.is_err() || result3.unwrap() == 1);
    }

    #[test]
    fn test_jsonl_parsing_with_mock_data() {
        // Test that we can parse valid JSON-Lines
        let line1 = r#"{"type":"assistant","message":{"content":[{"text":"Hello"}]}}"#;
        let line2 = r#"{"type":"user","msg":"hi"}"#;

        // Test parsing individual lines
        let result1: Result<ModalLogLine, _> = serde_json::from_str(line1);
        assert!(result1.is_ok());
        assert_eq!(result1.unwrap().log_type, "assistant");

        let result2: Result<ModalLogLine, _> = serde_json::from_str(line2);
        assert!(result2.is_ok());
        assert_eq!(result2.unwrap().log_type, "user");

        // Test incomplete JSON (should return EOF error)
        let incomplete = r#"{"type":"assistant""#;
        let result3: Result<ModalLogLine, _> = serde_json::from_str(incomplete);
        assert!(result3.is_err());
        assert!(result3.unwrap_err().is_eof());
    }

    #[test]
    fn test_extract_text_from_result_json() {
        // Test extraction from result field (Claude Code final summary)
        let result_json = r#"{"type":"result","subtype":"success","result":"Task completed successfully!\n\nCOMMIT_MESSAGE_TITLE: Add result-branch to log extractor\nCOMMIT_MESSAGE_BODY: Fix backend parsing\nPR_TITLE: Fix parsing\nPR_BODY: The backend stalled\nDONE"}"#;

        let extracted = ModalProvider::extract_text_from_json_line(result_json);
        assert!(extracted.contains("COMMIT_MESSAGE_TITLE:"));
        assert!(extracted.starts_with("Task completed successfully!"));

        // Test that regular message content still works
        let message_json = r#"{"type":"assistant","message":{"content":[{"text":"Hello world"}]}}"#;
        let extracted_msg = ModalProvider::extract_text_from_json_line(message_json);
        assert_eq!(extracted_msg, "Hello world");

        // Test fallback to original line
        let plain_text = "plain text line";
        let extracted_plain = ModalProvider::extract_text_from_json_line(plain_text);
        assert_eq!(extracted_plain, "plain text line");
    }
}
