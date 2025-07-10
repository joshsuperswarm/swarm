use super::{SandboxError, SandboxInfo, SandboxProvider, SandboxResult, SandboxStatus};
use async_trait::async_trait;
use crate::error::AppResult;
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

    pub async fn create_sandbox(&self, req: CreateSandboxRequest) -> AppResult<CreateSandboxResponse> {
        let url = format!("{}/sandboxes", self.base_url);
        
        let response = self.client
            .post(&url)
            .json(&req)
            .send()
            .await?;

        if response.status().is_success() {
            let sandbox_resp: CreateSandboxResponse = response.json().await?;
            Ok(sandbox_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to create sandbox: {}", error_text).into())
        }
    }

    pub async fn exec_command(&self, sandbox_id: &str, req: ExecRequest) -> AppResult<ExecResponse> {
        let url = format!("{}/sandboxes/{}/exec", self.base_url, sandbox_id);
        
        let response = self.client
            .post(&url)
            .json(&req)
            .send()
            .await?;

        if response.status().is_success() {
            let exec_resp: ExecResponse = response.json().await?;
            Ok(exec_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to execute command: {}", error_text).into())
        }
    }

    pub async fn get_exit_code(&self, sandbox_id: &str, proc_id: &str) -> AppResult<ExitCodeResponse> {
        let url = format!("{}/sandboxes/{}/procs/{}/exit_code", self.base_url, sandbox_id, proc_id);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

        if response.status().is_success() {
            let exit_code_resp: ExitCodeResponse = response.json().await?;
            Ok(exit_code_resp)
        } else {
            let error_text = response.text().await?;
            Err(format!("Failed to get exit code: {}", error_text).into())
        }
    }

    pub async fn get_logs(&self, sandbox_id: &str, proc_id: &str, since: Option<u64>) -> AppResult<LogsResponse> {
        let mut url = format!("{}/sandboxes/{}/procs/{}/logs", self.base_url, sandbox_id, proc_id);
        
        if let Some(offset) = since {
            url.push_str(&format!("?since={}", offset));
        }
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

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
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

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
        
        let response = self.client
            .delete(&url)
            .send()
            .await?;

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

    /// Install Claude Code using the new installation script
    async fn install_claude_code(&self, sandbox_id: &str) -> SandboxResult<()> {
        info!("Installing Claude Code in sandbox {}", sandbox_id);
        
        // Install Claude Code with proper PATH setup
        let install_cmd = r#"
            echo "Current user: $(whoami)" && \
            echo "Home directory: $HOME" && \
            curl -fsSL http://claude.ai/install.sh | bash && \
            export PATH="$HOME/.local/bin:$PATH" && \
            echo "PATH after install: $PATH" && \
            which claude && \
            claude --version
        "#;
        
        let exec_req = ExecRequest {
            cmd: vec!["bash".to_string(), "-c".to_string(), install_cmd.to_string()],
            cwd: Some("/home".to_string()),
        };
        
        let exec_resp = self.client.exec_command(sandbox_id, exec_req).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to install Claude Code: {}", e)))?;
        
        // Wait for installation to complete
        let exit_code = self.wait_for_process_completion(sandbox_id, &exec_resp.proc_id).await?;
        
        if exit_code != 0 {
            // Try to get installation logs for debugging
            match self.client.get_logs(sandbox_id, &exec_resp.proc_id, None).await {
                Ok(logs) => {
                    let combined_output = format!("{}{}", logs.stdout, logs.stderr);
                    return Err(SandboxError::SandboxOperationError(format!(
                        "Claude Code installation failed with exit code {}. Output: {}", 
                        exit_code, combined_output
                    )));
                }
                Err(_) => {
                    return Err(SandboxError::SandboxOperationError(format!(
                        "Claude Code installation failed with exit code {} (could not retrieve logs)", 
                        exit_code
                    )));
                }
            }
        }
        
        info!("Successfully installed Claude Code in sandbox {}", sandbox_id);
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
        info!("Configuring git in sandbox {}", sandbox_id);
        
        // Configure git user and remote with proper environment setup
        let git_config_commands = vec![
            // Debug and setup environment first
            "echo 'Current user:' && whoami && echo 'HOME directory:' && echo $HOME && echo 'Git version:' && git --version".to_string(),
            // Set HOME and create git config, then configure git
            format!("export HOME=/home && mkdir -p $HOME && git config --global user.name '{}'", author_name),
            format!("export HOME=/home && git config --global user.email '{}'", author_email),
            format!(
                "bash -c 'cd \"{}\" && \
                 echo \"Current directory: $(pwd)\" && \
                 echo \"Directory contents: $(ls -la)\" && \
                 echo \"Git status: $(git status --porcelain 2>&1 || echo \"Not a git repo\")\" && \
                 if [ -d .git ]; then \
                     echo \"Git repository found\" && \
                     if git remote | grep -q \"^origin$\"; then \
                         echo \"Updating existing origin remote\" && \
                         git remote set-url origin \"https://x-access-token:{}@github.com/{}\"; \
                     else \
                         echo \"Adding new origin remote\" && \
                         git remote add origin \"https://x-access-token:{}@github.com/{}\"; \
                     fi; \
                 else \
                     echo \"No git repository found in {}\"; \
                 fi'",
                repo_path, github_token, repo_full_name, github_token, repo_full_name, repo_path
            ),
        ];

        for (i, command) in git_config_commands.iter().enumerate() {
            // Show first 8 characters of token for verification, mask the rest
            let token_prefix = &github_token[..8.min(github_token.len())];
            let masked_command = command.replace(github_token, &format!("{}***", token_prefix));
            info!("Configuring git in sandbox {}: {}", sandbox_id, masked_command);
            
            // Use home directory for debug and global git config, repo directory for remote config
            let working_dir = if i < 3 { "/home" } else { repo_path };
            
            let exec_req = ExecRequest {
                cmd: vec!["bash".to_string(), "-c".to_string(), command.clone()],
                cwd: Some(working_dir.to_string()),
            };
            
            let exec_resp = self.client.exec_command(sandbox_id, exec_req).await
                .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to configure git: {}", e)))?;
            
            // Wait for git config to complete
            let exit_code = self.wait_for_process_completion(sandbox_id, &exec_resp.proc_id).await?;
            if exit_code != 0 {
                return Err(SandboxError::SandboxOperationError(format!(
                    "Git configuration failed with exit code {}: {}",
                    exit_code, masked_command
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
        github_token: &str,
        anthropic_api_key: &str,
        openai_api_key: Option<&str>,
        branch: &str,
        author_name: &str,
        author_email: &str,
    ) -> SandboxResult<String> {
        info!("Executing Claude Code in sandbox {} for task {}", sandbox_id, task_id);
        
        // Set environment variables first
        let mut env_commands = vec![
            format!("export GITHUB_TOKEN='{}'", github_token),
            format!("export ANTHROPIC_API_KEY='{}'", anthropic_api_key),
            format!("export SWARM_BRANCH='{}'", branch),
            format!("export SWARM_TASK_ID='{}'", task_id),
            format!("export GIT_AUTHOR_NAME='{}'", author_name),
            format!("export GIT_AUTHOR_EMAIL='{}'", author_email),
        ];
        
        // Add OPENAI_API_KEY if provided
        if let Some(openai_key) = openai_api_key {
            env_commands.push(format!("export OPENAI_API_KEY='{}'", openai_key));
        }
        
        // Execute environment setup
        for env_cmd in env_commands {
            let masked_cmd = if env_cmd.contains("_API_KEY") || env_cmd.contains("_TOKEN") {
                // Mask sensitive environment variables
                let parts: Vec<&str> = env_cmd.split('=').collect();
                if parts.len() >= 2 {
                    let key = parts[0];
                    format!("{}='***'", key)
                } else {
                    env_cmd.clone()
                }
            } else {
                env_cmd.clone()
            };
            
            debug!("Setting environment variable: {}", masked_cmd);
            
            let exec_req = ExecRequest {
                cmd: vec!["bash".to_string(), "-c".to_string(), env_cmd],
                cwd: Some(repo_path.to_string()),
            };
            
            self.client.exec_command(sandbox_id, exec_req).await
                .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to set environment: {}", e)))?;
        }
        
        // Create the Claude prompt with artifact markers
        let claude_prompt = format!(
            "Please work on this task {}: {}.

After completing the task, you MUST output the following markers in this exact format:

COMMIT_MESSAGE_TITLE: Your commit title here
COMMIT_MESSAGE_BODY: Your detailed commit message body here
PR_TITLE: Your pull request title here
PR_BODY: Your detailed pull request description here
DONE

The system requires these markers to automatically generate commit messages and pull requests. Without them, the task will fail.",
            task_id, prompt
        );

        // Execute Claude Code with proper PATH
        let cmd = format!(
            r#"bash -c '
                export PATH="$HOME/.local/bin:$PATH"
                cd "{}" || {{ echo "cd failed"; exit 1; }}
                set -euo pipefail
                echo "About to run claude as user: $(whoami)"
                echo "PATH: $PATH"
                echo "which claude: $(which claude)"
                claude -p "{}" \
                    --verbose \
                    --output-format stream-json \
                    --max-turns 100 \
                    --dangerously-skip-permissions \
                    < /dev/null
            '"#,
            repo_path,
            claude_prompt.replace("'", r"'\''")
        );

        info!("Launching Claude Code in sandbox {} for task {}", sandbox_id, task_id);
        
        let exec_req = ExecRequest {
            cmd: vec!["bash".to_string(), "-c".to_string(), cmd],
            cwd: Some(repo_path.to_string()),
        };
        
        let exec_resp = self.client.exec_command(sandbox_id, exec_req).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to execute Claude Code: {}", e)))?;

        info!(
            "Successfully launched Claude Code in sandbox {} with proc ID {}",
            sandbox_id, exec_resp.proc_id
        );
        
        // Return process ID for monitoring
        Ok(exec_resp.proc_id)
    }

    /// Push changes to GitHub branch after Claude Code execution
    pub async fn push_changes(
        &self,
        sandbox_id: &str,
        repo_path: &str,
        branch: &str,
        _task_id: i32,
        _author_name: &str,
        _author_email: &str,
        commit_title: &str,
        commit_body: &str,
    ) -> SandboxResult<()> {
        info!("Pushing changes to branch {} in sandbox {}", branch, sandbox_id);

        // Push script with correct git flow: commit first, then create branch, then push
        let push_script = format!(
            r#"bash -c '
cd "{}" || {{ echo "cd failed"; exit 1; }}
set -e
branch="$SWARM_BRANCH"

# Stage all changes
git add -A

# Write full commit message to temporary file
cat > /tmp/commit_message << "EOF"
{}

{}
EOF

# Commit changes to current branch
git commit --author "$GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>" \
           -F /tmp/commit_message

# Create new branch from the commit
git checkout -B "$branch"

# Push the branch to origin
git push -u origin "$branch"

'"#,
            repo_path, commit_title, commit_body
        );

        let exec_req = ExecRequest {
            cmd: vec!["bash".to_string(), "-c".to_string(), push_script],
            cwd: Some(repo_path.to_string()),
        };
        
        let exec_resp = self.client.exec_command(sandbox_id, exec_req).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to push changes: {}", e)))?;
        
        // Wait for push to complete
        let exit_code = self.wait_for_process_completion(sandbox_id, &exec_resp.proc_id).await?;
        if exit_code != 0 {
            return Err(SandboxError::SandboxOperationError(format!(
                "Push failed with exit code {}", exit_code
            )));
        }

        info!("✓ Successfully pushed changes to branch {} in sandbox {}", branch, sandbox_id);
        Ok(())
    }

    /// Wait for a process to complete and return its exit code
    async fn wait_for_process_completion(&self, sandbox_id: &str, proc_id: &str) -> SandboxResult<i32> {
        let timeout_duration = Duration::from_secs(5 * 60); // 5 minutes for individual commands
        let poll_interval = Duration::from_secs(2);

        let result = timeout(timeout_duration, async {
            loop {
                match self.client.get_exit_code(sandbox_id, proc_id).await {
                    Ok(exit_code_resp) => {
                        if let Some(code) = exit_code_resp.code {
                            return Ok(code);
                        }
                        // Process still running
                        sleep(poll_interval).await;
                    }
                    Err(e) => {
                        warn!("Error checking exit code for proc {}: {}", proc_id, e);
                        sleep(poll_interval).await;
                    }
                }
            }
        }).await;

        match result {
            Ok(exit_code) => exit_code,
            Err(_) => Err(SandboxError::TimeoutError),
        }
    }

    /// Stream command logs from Modal and store them in the database
    pub async fn stream_command_logs(
        &self,
        db: &crate::database::Database,
        task_id: i32,
        sandbox_id: &str,
        proc_id: &str,
    ) -> SandboxResult<()> {
        info!("→ Starting log stream for task {} from proc {}", task_id, proc_id);

        let mut log_offset = 0;
        let mut task_completed = false;
        let mut lines_processed = 0;
        let mut lines_stored = 0;
        let mut commit_title: Option<String> = None;
        let mut commit_body: Option<String> = None;
        let mut pr_title: Option<String> = None;
        let mut pr_body: Option<String> = None;
        let mut current_artifact: Option<String> = None;
        let mut artifact_lines: Vec<String> = Vec::new();

        // Poll logs until process completes
        loop {
            match self.client.get_logs(sandbox_id, proc_id, Some(log_offset)).await {
                Ok(logs_resp) => {
                    let combined_output = format!("{}{}", logs_resp.stdout, logs_resp.stderr);
                    
                    if !combined_output.is_empty() {
                        let lines: Vec<&str> = combined_output.lines().collect();
                        
                        for line_str in &lines {
                            let line_str = line_str.trim();
                            if line_str.is_empty() {
                                continue;
                            }
                            
                            lines_processed += 1;
                            
                            // Extract text content from JSON messages for artifact parsing
                            let text_to_parse = if line_str.starts_with('{') {
                                match serde_json::from_str::<serde_json::Value>(line_str) {
                                    Ok(json_value) => {
                                        // Extract text from message content
                                        json_value
                                            .get("message")
                                            .and_then(|msg| msg.get("content"))
                                            .and_then(|content| content.as_array())
                                            .and_then(|arr| arr.first())
                                            .and_then(|item| item.get("text"))
                                            .and_then(|text| text.as_str())
                                            .map(|s| s.to_string())
                                            .unwrap_or_else(|| line_str.to_string())
                                    }
                                    Err(_) => line_str.to_string(),
                                }
                            } else {
                                line_str.to_string()
                            };

                            // Parse artifact markers from extracted text (split by newlines)
                            for text_line in text_to_parse.lines() {
                                let text_line = text_line.trim();
                                if text_line.is_empty() {
                                    continue;
                                }

                                // Check for artifact markers
                                if text_line.starts_with("COMMIT_MESSAGE_TITLE:") {
                                    info!("Found COMMIT_MESSAGE_TITLE marker in task {}", task_id);
                                    if let Some(ref artifact_type) = current_artifact {
                                        // Complete previous artifact
                                        let content = artifact_lines.join("\n");
                                        match artifact_type.as_str() {
                                            "commit_body" => commit_body = Some(content),
                                            "pr_title" => pr_title = Some(content),
                                            "pr_body" => pr_body = Some(content),
                                            _ => {}
                                        }
                                    }
                                    commit_title = Some(
                                        text_line
                                            .strip_prefix("COMMIT_MESSAGE_TITLE:")
                                            .unwrap_or("")
                                            .trim()
                                            .to_string(),
                                    );
                                    current_artifact = None;
                                    artifact_lines.clear();
                                } else if text_line.starts_with("COMMIT_MESSAGE_BODY:") {
                                    if let Some(ref artifact_type) = current_artifact {
                                        // Complete previous artifact
                                        let content = artifact_lines.join("\n");
                                        match artifact_type.as_str() {
                                            "commit_body" => commit_body = Some(content),
                                            "pr_title" => pr_title = Some(content),
                                            "pr_body" => pr_body = Some(content),
                                            _ => {}
                                        }
                                    }
                                    current_artifact = Some("commit_body".to_string());
                                    artifact_lines.clear();
                                    if let Some(first_line) = text_line.strip_prefix("COMMIT_MESSAGE_BODY:") {
                                        let trimmed = first_line.trim();
                                        if !trimmed.is_empty() {
                                            artifact_lines.push(trimmed.to_string());
                                        }
                                    }
                                } else if text_line.starts_with("PR_TITLE:") {
                                    if let Some(ref artifact_type) = current_artifact {
                                        // Complete previous artifact
                                        let content = artifact_lines.join("\n");
                                        match artifact_type.as_str() {
                                            "commit_body" => commit_body = Some(content),
                                            "pr_title" => pr_title = Some(content),
                                            "pr_body" => pr_body = Some(content),
                                            _ => {}
                                        }
                                    }
                                    current_artifact = Some("pr_title".to_string());
                                    artifact_lines.clear();
                                    if let Some(first_line) = text_line.strip_prefix("PR_TITLE:") {
                                        let trimmed = first_line.trim();
                                        if !trimmed.is_empty() {
                                            artifact_lines.push(trimmed.to_string());
                                        }
                                    }
                                } else if text_line.starts_with("PR_BODY:") {
                                    if let Some(ref artifact_type) = current_artifact {
                                        // Complete previous artifact
                                        let content = artifact_lines.join("\n");
                                        match artifact_type.as_str() {
                                            "commit_body" => commit_body = Some(content),
                                            "pr_title" => pr_title = Some(content),
                                            "pr_body" => pr_body = Some(content),
                                            _ => {}
                                        }
                                    }
                                    current_artifact = Some("pr_body".to_string());
                                    artifact_lines.clear();
                                    if let Some(first_line) = text_line.strip_prefix("PR_BODY:") {
                                        let trimmed = first_line.trim();
                                        if !trimmed.is_empty() {
                                            artifact_lines.push(trimmed.to_string());
                                        }
                                    }
                                } else if text_line == "DONE" {
                                    // Complete any remaining artifact
                                    if let Some(ref artifact_type) = current_artifact {
                                        let content = artifact_lines.join("\n");
                                        match artifact_type.as_str() {
                                            "commit_body" => commit_body = Some(content),
                                            "pr_title" => pr_title = Some(content),
                                            "pr_body" => pr_body = Some(content),
                                            _ => {}
                                        }
                                    }
                                    current_artifact = None;
                                    artifact_lines.clear();

                                    // Store all artifacts if we have all four
                                    if commit_title.is_some()
                                        && commit_body.is_some()
                                        && pr_title.is_some()
                                        && pr_body.is_some()
                                    {
                                        info!("✓ Found all 4 AI artifacts for task {}", task_id);
                                        match db
                                            .set_task_artifacts(
                                                task_id,
                                                commit_title.clone(),
                                                commit_body.clone(),
                                                pr_title.clone(),
                                                pr_body.clone(),
                                            )
                                            .await
                                        {
                                            Ok(_) => {
                                                info!("✓ Stored AI-generated artifacts for task {}", task_id);
                                            }
                                            Err(e) => {
                                                error!("✗ Failed to store artifacts for task {}: {}", task_id, e);
                                            }
                                        }
                                    }
                                    
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
                                } else if let Some(ref _artifact_type) = current_artifact {
                                    // Accumulate lines for current artifact
                                    artifact_lines.push(text_line.to_string());
                                }
                            }

                            // Store the log line in database
                            match db.insert_task_log(task_id, line_str).await {
                                Ok(_) => {
                                    lines_stored += 1;
                                    if lines_stored % 10 == 0 {
                                        info!("   Stored {} log lines for task {}", lines_stored, task_id);
                                    }
                                }
                                Err(e) => {
                                    warn!("✗ Failed to store log line for task {}: {}", task_id, e);
                                }
                            }

                            // Check if this is a JSON line indicating completion
                            if line_str.starts_with('{') {
                                match serde_json::from_str::<serde_json::Value>(line_str) {
                                    Ok(json_value) => {
                                        if let Some(msg_type) = json_value.get("type").and_then(|t| t.as_str()) {
                                            if msg_type == "done" {
                                                info!("✓ Task {} completed successfully (received 'done' event)", task_id);
                                                task_completed = true;
                                            }
                                        }
                                    }
                                    Err(_) => {
                                        // Not valid JSON, ignore
                                    }
                                }
                            }
                        }
                        
                        // Update offset for next fetch
                        log_offset += combined_output.len() as u64;
                    }
                }
                Err(e) => {
                    warn!("Error fetching logs for task {}: {}", task_id, e);
                }
            }

            // Check if process has completed
            match self.client.get_exit_code(sandbox_id, proc_id).await {
                Ok(exit_code_resp) => {
                    if exit_code_resp.code.is_some() {
                        // Process completed
                        break;
                    }
                }
                Err(_) => {
                    // Continue polling
                }
            }

            // Small delay before next poll
            sleep(Duration::from_secs(2)).await;
        }

        info!("▬ Log processing summary for task {}:", task_id);
        info!("   Total lines processed: {}", lines_processed);
        info!("   Lines stored in DB: {}", lines_stored);
        info!("   Task completed: {}", task_completed);

        // If stream ended without a done event, check sandbox status
        if !task_completed {
            match self.get_sandbox_status(sandbox_id).await {
                Ok(SandboxStatus::Stopped) => {
                    info!("Task {} sandbox stopped without 'done' event, marking as failed", task_id);
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
        info!("Starting Modal sandbox for task {}, repository: {}", task_id, repo_url);

        // Create sandbox
        let create_request = CreateSandboxRequest {
            repo_url: repo_url.to_string(),
            branch: "main".to_string(), // Clone from main, we'll create branch later
            region: self.region.clone(),
            github_token: Some(github_token.to_string()),
        };

        let sandbox_resp = self.client.create_sandbox(create_request).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to create sandbox: {}", e)))?;

        let sandbox_id = sandbox_resp.sandbox_id.clone();

        info!("Created Modal sandbox {} for task {}", sandbox_id, task_id);

        // Wait for sandbox to be ready with retry logic
        info!("Waiting for sandbox {} to be ready", sandbox_id);
        let retry_strategy = ExponentialBackoff::from_millis(1000)
            .max_delay(Duration::from_secs(10))
            .take(30); // Limit to 30 retries (about 5 minutes total)

        let _ready = timeout(Duration::from_secs(10 * 60), Retry::spawn(retry_strategy, || async {
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
                            Err(SandboxError::SandboxOperationError("Sandbox failed to start".to_string()))
                        }
                        SandboxStatus::Starting => {
                            debug!("Sandbox {} still starting, retrying...", sandbox_id);
                            Err(SandboxError::SandboxOperationError("Sandbox still starting".to_string()))
                        }
                        SandboxStatus::Stopped => {
                            error!("Sandbox {} stopped unexpectedly", sandbox_id);
                            Err(SandboxError::SandboxOperationError("Sandbox stopped unexpectedly".to_string()))
                        }
                    }
                }
                Err(e) => {
                    warn!("Error checking sandbox status: {}", e);
                    Err(SandboxError::SandboxOperationError("Error checking status".to_string()))
                }
            }
        }))
        .await
        .map_err(|_| {
            error!("Timeout waiting for sandbox {} to be ready", sandbox_id);
            SandboxError::TimeoutError
        })??;

        // Claude Code is now installed during sandbox creation in the Modal shim

        // Configure Git with author information and authenticated remote
        let _repo_name = Self::extract_repo_name(repo_url)?;
        let repo_path = format!("/code");
        let repo_full_name = Self::extract_repo_full_name(repo_url)?;
        self.configure_git(
            &sandbox_id,
            &repo_path,
            github_token,
            author_name,
            author_email,
            &repo_full_name,
        )
        .await?;

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
            command_id: proc_id, // Use proc_id as command_id
            branch: branch.to_string(),
        })
    }

    async fn get_sandbox_status(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus> {
        let status_resp = self.client.get_sandbox_status(sandbox_id).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to get status: {}", e)))?;

        let status = Self::map_modal_status(&status_resp.status);
        debug!("Modal sandbox {} status: {:?}", sandbox_id, status);
        Ok(status)
    }

    async fn wait_for_completion(&self, sandbox_id: &str) -> SandboxResult<SandboxStatus> {
        let timeout_duration = Duration::from_secs(30 * 60); // 30 minutes
        let poll_interval = Duration::from_secs(30);

        info!("Waiting for Modal sandbox {} completion (timeout: 30 minutes)", sandbox_id);
        
        let result = timeout(timeout_duration, async {
            loop {
                let status = self.get_sandbox_status(sandbox_id).await?;

                match status {
                    SandboxStatus::Stopped | SandboxStatus::Failed => {
                        info!("Modal sandbox {} completed with status: {:?}", sandbox_id, status);
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
                warn!("Modal sandbox {} timed out after 30 minutes, attempting to stop", sandbox_id);
                // Timeout occurred, try to stop the sandbox
                let _ = self.stop_sandbox(sandbox_id).await;
                Err(SandboxError::TimeoutError)
            }
        }
    }

    async fn stop_sandbox(&self, sandbox_id: &str) -> SandboxResult<()> {
        info!("Stopping Modal sandbox {}", sandbox_id);
        self.client.terminate_sandbox(sandbox_id).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to stop sandbox: {}", e)))
    }

    async fn get_command_exit_code(
        &self,
        sandbox_id: &str,
        _session_id: &str, // Modal doesn't use sessions
        command_id: &str,   // This is the proc_id
    ) -> SandboxResult<Option<i32>> {
        match self.client.get_exit_code(sandbox_id, command_id).await {
            Ok(exit_code_resp) => Ok(exit_code_resp.code),
            Err(e) => Err(SandboxError::SandboxOperationError(format!("Failed to get exit code: {}", e))),
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
        self.client.terminate_sandbox(sandbox_id).await
            .map_err(|e| SandboxError::SandboxOperationError(format!("Failed to delete sandbox: {}", e)))
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