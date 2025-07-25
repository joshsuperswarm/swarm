use crate::error::{AppError, AppResult};
use crate::models::{
    AgentTodo, CreateGitHubToken, CreateMessage, CreateRepository, CreateTask, CreateUser,
    GitHubToken, Message, MessageWithRun, Repository, RepositoryWithTasks, Run, RunWithMeta, Task,
    TaskDetails, TaskLog, TaskLogsPaginated, TaskWithRun, TaskWithRunDB, User,
};
use sqlx::PgPool;

#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // User operations
    pub async fn create_user(&self, user: CreateUser) -> AppResult<User> {
        let user = sqlx::query_file_as!(
            User,
            "sql/create_user.sql",
            user.clerk_user_id,
            user.github_username,
            user.github_user_id,
            user.email
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn get_user_by_clerk_id(&self, clerk_user_id: &str) -> AppResult<Option<User>> {
        let user = sqlx::query_file_as!(User, "sql/get_user_by_clerk_id.sql", clerk_user_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(user)
    }

    pub async fn get_user_by_id(&self, user_id: i32) -> AppResult<Option<User>> {
        let user = sqlx::query_as!(User, "SELECT id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at FROM users WHERE id = $1", user_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(user)
    }

    pub async fn update_user_github_info(
        &self,
        user_id: i32,
        github_username: Option<String>,
        github_user_id: Option<i32>,
    ) -> AppResult<User> {
        let user = sqlx::query_file_as!(
            User,
            "sql/update_user_github_info.sql",
            user_id,
            github_username,
            github_user_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn set_default_repository(
        &self,
        user_id: i32,
        repo_id: Option<i32>,
    ) -> AppResult<User> {
        let user = sqlx::query_file_as!(User, "sql/set_default_repository.sql", user_id, repo_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(user)
    }

    // Repository operations
    pub async fn create_repository(&self, repo: CreateRepository) -> AppResult<Repository> {
        let repository = sqlx::query_file_as!(
            Repository,
            "sql/create_repository.sql",
            repo.github_repo_id,
            repo.owner,
            repo.name,
            repo.full_name,
            repo.user_id,
            repo.is_private
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(repository)
    }

    pub async fn get_user_repositories(&self, user_id: i32) -> AppResult<Vec<RepositoryWithTasks>> {
        let repos = sqlx::query_file!("sql/get_user_repositories.sql", user_id)
            .fetch_all(&self.pool)
            .await?;

        let repositories = repos
            .into_iter()
            .map(|row| RepositoryWithTasks {
                id: row.id,
                github_repo_id: row.github_repo_id,
                owner: row.owner,
                name: row.name,
                full_name: row.full_name,
                is_private: row.is_private,
                task_count: row.task_count.unwrap_or(0),
                created_at: row.created_at,
                last_fetched_at: row.last_fetched_at,
            })
            .collect();

        Ok(repositories)
    }

    pub async fn get_repository_by_id(
        &self,
        repo_id: i32,
        user_id: i32,
    ) -> AppResult<Option<Repository>> {
        let repo =
            sqlx::query_file_as!(Repository, "sql/get_repository_by_id.sql", repo_id, user_id)
                .fetch_optional(&self.pool)
                .await?;

        Ok(repo)
    }

    pub async fn sync_repositories(
        &self,
        _user_id: i32,
        repos: Vec<CreateRepository>,
    ) -> AppResult<Vec<Repository>> {
        let mut synced_repos = Vec::new();

        for repo in repos {
            let synced_repo = self.create_repository(repo).await?;
            synced_repos.push(synced_repo);
        }

        Ok(synced_repos)
    }

    // GitHub token operations
    pub async fn create_or_update_github_token(
        &self,
        token: CreateGitHubToken,
    ) -> AppResult<GitHubToken> {
        let github_token = sqlx::query_file_as!(
            GitHubToken,
            "sql/create_or_update_github_token.sql",
            token.user_id,
            token.access_token,
            token.token_type,
            token.scope
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(github_token)
    }

    pub async fn get_github_token(&self, user_id: i32) -> AppResult<Option<GitHubToken>> {
        let token = sqlx::query_file_as!(GitHubToken, "sql/get_github_token.sql", user_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(token)
    }

    // Legacy method name for compatibility
    pub async fn store_github_token(&self, token: CreateGitHubToken) -> AppResult<GitHubToken> {
        self.create_or_update_github_token(token).await
    }

    // Task operations
    pub async fn create_task(&self, task: CreateTask) -> AppResult<Task> {
        let task = sqlx::query_file_as!(
            Task,
            "sql/create_task.sql",
            task.user_id,
            task.repository_id,
            task.title
        )
        .fetch_one(&self.pool)
        .await?;

        // Note: Runs are now updated directly via run update methods

        Ok(task)
    }

    pub async fn get_user_tasks(&self, user_id: i32) -> AppResult<Vec<Task>> {
        let tasks = sqlx::query_file_as!(Task, "sql/get_user_tasks.sql", user_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(tasks)
    }

    pub async fn get_user_runs_latest(&self, user_id: i32) -> AppResult<Vec<TaskWithRun>> {
        let rows = sqlx::query_file_as!(TaskWithRunDB, "sql/get_user_runs_latest.sql", user_id)
            .fetch_all(&self.pool)
            .await?;

        // Convert TaskWithRunDB to TaskWithRun (without todos for now)
        let tasks = rows
            .into_iter()
            .map(|row| TaskWithRun {
                run_id: row.run_id,
                task_id: row.task_id,
                title: row.title,
                description: row.description,
                repository_id: row.repository_id,
                user_id: row.user_id,
                status: row.status,
                github_branch: row.github_branch,
                sandbox_id: row.sandbox_id,
                sandbox_hostname: row.sandbox_hostname,
                session_id: row.session_id,
                command_id: row.command_id,
                commit_title: row.commit_title,
                commit_body: row.commit_body,
                mode: row.mode,
                pr_title: row.pr_title,
                pr_body: row.pr_body,
                created_at: row.created_at,
                updated_at: row.updated_at,
                github_pr_url: row.github_pr_url,
                latest_todos: None, // Will be populated in the handler if requested
            })
            .collect();

        Ok(tasks)
    }

    pub async fn get_task_by_id(&self, task_id: i32) -> AppResult<Option<Task>> {
        let task = sqlx::query_as!(Task, "SELECT id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, created_at, updated_at FROM tasks WHERE id = $1", task_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(task)
    }

    pub async fn update_task_status(
        &self,
        task_id: i32,
        status: &str,
        pr_url: Option<&str>,
    ) -> AppResult<Task> {
        let task =
            sqlx::query_file_as!(Task, "sql/update_task_status.sql", task_id, status, pr_url)
                .fetch_one(&self.pool)
                .await?;

        // Note: Runs are now updated directly via run update methods

        Ok(task)
    }

    pub async fn update_task_title(&self, task_id: i32, title: &str) -> AppResult<Task> {
        let task = sqlx::query_file_as!(Task, "sql/update_task_title.sql", task_id, title)
            .fetch_one(&self.pool)
            .await?;

        // Note: Runs are now updated directly via run update methods

        Ok(task)
    }

    pub async fn update_task_pr_url(&self, task_id: i32, pr_url: &str) -> AppResult<Task> {
        let task = sqlx::query_as!(
            Task,
            "UPDATE tasks SET github_pr_url = $1 WHERE id = $2 RETURNING id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, created_at, updated_at",
            pr_url,
            task_id
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(task)
    }

    pub async fn set_task_pr_artifacts(
        &self,
        task_id: i32,
        pr_title: Option<String>,
        pr_body: Option<String>,
    ) -> AppResult<Task> {
        let task = sqlx::query_as!(
            Task,
            r#"
            UPDATE tasks 
            SET pr_title = $2, pr_body = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, created_at, updated_at
            "#,
            task_id,
            pr_title,
            pr_body
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(task)
    }

    // Task log operations
    pub async fn insert_task_log(
        &self,
        task_id: i32,
        run_id: i32,
        log_line: &str,
    ) -> AppResult<()> {
        tracing::debug!(
            "→ Inserting log line for task {} run {} (length: {} chars)",
            task_id,
            run_id,
            log_line.len()
        );

        // Parse the log line as JSON
        let json_value: serde_json::Value = match serde_json::from_str(log_line) {
            Ok(json) => json,
            Err(e) => {
                tracing::warn!(
                    "⚠ Failed to parse log line as JSON for task {} run {}: {}",
                    task_id,
                    run_id,
                    e
                );
                tracing::warn!(
                    "   Line: {}",
                    if log_line.len() > 200 {
                        format!("{}...", &log_line[..200])
                    } else {
                        log_line.to_string()
                    }
                );
                return Ok(()); // Skip non-JSON lines
            }
        };

        match sqlx::query!(
            "INSERT INTO task_logs (task_id, run_id, log_line) VALUES ($1, $2, $3::jsonb)",
            task_id,
            run_id,
            json_value
        )
        .execute(&self.pool)
        .await
        {
            Ok(result) => {
                tracing::debug!(
                    "✓ Successfully inserted log line for task {} run {}, rows affected: {}",
                    task_id,
                    run_id,
                    result.rows_affected()
                );
                Ok(())
            }
            Err(e) => {
                tracing::error!(
                    "✗ Database error inserting log line for task {} run {}: {}",
                    task_id,
                    run_id,
                    e
                );
                tracing::error!(
                    "   Line preview: {}",
                    if log_line.len() > 100 {
                        format!("{}...", &log_line[..100])
                    } else {
                        log_line.to_string()
                    }
                );
                Err(e.into())
            }
        }
    }

    pub async fn get_task_logs(&self, task_id: i32) -> AppResult<Vec<TaskLog>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, task_id, run_id, log_line as "log_line: serde_json::Value", created_at
            FROM task_logs
            WHERE task_id = $1
            ORDER BY id ASC
            "#,
            task_id
        )
        .fetch_all(&self.pool)
        .await?;

        let logs = rows
            .into_iter()
            .map(|row| TaskLog {
                id: row.id as i32,
                task_id: row.task_id.expect("task_id should not be null"),
                run_id: row.run_id,
                log_line: row.log_line,
                created_at: row.created_at,
            })
            .collect();

        Ok(logs)
    }

    pub async fn stream_task_logs(
        &self,
        task_id: i32,
        after_id: Option<i64>,
    ) -> AppResult<Vec<TaskLog>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, task_id, run_id, log_line as "log_line: serde_json::Value", created_at
            FROM task_logs
            WHERE task_id = $1 AND ($2::BIGINT IS NULL OR id > $2)
            ORDER BY id ASC
            LIMIT 100
            "#,
            task_id,
            after_id
        )
        .fetch_all(&self.pool)
        .await?;

        let logs = rows
            .into_iter()
            .map(|row| TaskLog {
                id: row.id as i32,
                task_id: row.task_id.expect("task_id should not be null"),
                run_id: row.run_id,
                log_line: row.log_line,
                created_at: row.created_at,
            })
            .collect();

        Ok(logs)
    }

    pub async fn get_agent_todos(&self, task_id: i32) -> AppResult<Vec<AgentTodo>> {
        let rows = sqlx::query_as!(
            AgentTodo,
            r#"SELECT todo_id, content, priority, status, updated_at
               FROM agent_todos
               WHERE task_id = $1
               ORDER BY updated_at"#,
            task_id
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    pub async fn get_agent_todos_for_user(
        &self,
        task_id: i32,
        user_id: i32,
    ) -> AppResult<Vec<AgentTodo>> {
        let rows = sqlx::query_file_as!(
            AgentTodo,
            "sql/get_agent_todos_for_user.sql",
            task_id,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    pub async fn get_run_by_id(&self, run_id: i32) -> AppResult<Option<Run>> {
        let run = sqlx::query_as!(
            Run,
            "SELECT id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at FROM runs WHERE id = $1",
            run_id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn get_latest_run_id_for_task(&self, task_id: i32) -> AppResult<Option<i32>> {
        let row = sqlx::query!(
            "SELECT id FROM runs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1",
            task_id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|r| r.id))
    }

    pub async fn assemble_run_meta(&self, run: &Run) -> AppResult<RunWithMeta> {
        // Get todos for this task
        let todos = self
            .get_agent_todos(run.task_id)
            .await?
            .into_iter()
            .filter(|t| t.status != "completed")
            .collect();

        // Get last 100 log lines for this run
        let rows = sqlx::query!(
            r#"
            SELECT id, task_id, run_id, log_line as "log_line: serde_json::Value", created_at
            FROM task_logs
            WHERE run_id = $1
            ORDER BY id DESC
            LIMIT 100
            "#,
            run.id
        )
        .fetch_all(&self.pool)
        .await?;

        let entries = rows
            .into_iter()
            .map(|r| TaskLog {
                id: r.id as i32,
                task_id: r.task_id.expect("task_id should not be null"),
                run_id: r.run_id,
                log_line: r.log_line,
                created_at: r.created_at,
            })
            .collect::<Vec<_>>();

        let total_count: i32 =
            sqlx::query_scalar!("SELECT COUNT(*) FROM task_logs WHERE run_id = $1", run.id)
                .fetch_one(&self.pool)
                .await?
                .unwrap_or(0) as i32;

        let cursor = entries.last().map(|l| l.id as i64);

        Ok(RunWithMeta {
            run: run.clone(),
            todos,
            logs: TaskLogsPaginated {
                entries,
                total_count,
                has_more: total_count > 100,
                cursor,
            },
        })
    }

    // Direct Run update methods (bypassing sync_run_from_task)
    pub async fn update_run_status(&self, run_id: i32, status: &str) -> AppResult<Run> {
        let run = sqlx::query_as!(
            Run,
            r#"
            UPDATE runs
               SET status = $2, updated_at = NOW()
             WHERE id = $1
            RETURNING id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at
            "#,
            run_id,
            status
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn update_run_command_ids(
        &self,
        run_id: i32,
        session: &str,
        cmd: &str,
    ) -> AppResult<Run> {
        let run = sqlx::query_as!(
            Run,
            r#"
            UPDATE runs
               SET session_id = $2, command_id = $3, updated_at = NOW()
             WHERE id = $1
            RETURNING id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at
            "#,
            run_id,
            session,
            cmd
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn set_run_artifacts(
        &self,
        run_id: i32,
        commit_title: Option<String>,
        commit_body: Option<String>,
    ) -> AppResult<Run> {
        let run = sqlx::query_as!(
            Run,
            r#"
            UPDATE runs
               SET commit_title = $2, commit_body = $3, updated_at = NOW()
             WHERE id = $1
            RETURNING id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at
            "#,
            run_id,
            commit_title,
            commit_body
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn update_run_branch(&self, run_id: i32, branch: &str) -> AppResult<Run> {
        let run = sqlx::query_as!(
            Run,
            r#"
            UPDATE runs
               SET branch = $2, updated_at = NOW()
             WHERE id = $1
            RETURNING id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at
            "#,
            run_id,
            branch
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn update_run_sandbox(
        &self,
        run_id: i32,
        sandbox_id: &str,
        hostname: &str,
    ) -> AppResult<Run> {
        let run = sqlx::query_as!(
            Run,
            r#"
            UPDATE runs
               SET sandbox_id = $2, sandbox_hostname = $3, updated_at = NOW()
             WHERE id = $1
            RETURNING id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at
            "#,
            run_id,
            sandbox_id,
            hostname
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn create_run(&self, task_id: i32, mode: &str) -> AppResult<Run> {
        let run = sqlx::query_as!(
            Run,
            r#"
            INSERT INTO runs (task_id, mode, status, created_at, updated_at)
            VALUES ($1, $2, 'pending', NOW(), NOW())
            RETURNING id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, command_id, branch, status, commit_title, commit_body, mode, created_at, updated_at
            "#,
            task_id,
            mode,
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(run)
    }

    pub async fn upsert_message(
        &self,
        task_id: i32,
        run_id: i32,
        mode: &str,
        body_md: &str,
        sha: &str,
        role: &str,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO messages (task_id, run_id, mode, body_md, sha, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (task_id, run_id, mode) WHERE run_id IS NOT NULL
            DO UPDATE SET
                body_md = EXCLUDED.body_md,
                sha = EXCLUDED.sha,
                role = EXCLUDED.role,
                created_at = NOW()
            "#,
            task_id,
            run_id,
            mode,
            body_md,
            sha,
            role
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // Message operations for the new chat architecture
    pub async fn get_task_messages(&self, task_id: i32) -> AppResult<Vec<MessageWithRun>> {
        let rows = sqlx::query!(
            r#"
            SELECT 
                m.id, m.task_id, m.role, m.body_md as content, m.created_at, 
                m.metadata as "metadata: serde_json::Value",
                r.id as "run_id?", r.task_id as "run_task_id?", r.message_id as "message_id?", 
                r.sandbox_id as "sandbox_id?", r.sandbox_hostname as "sandbox_hostname?", 
                r.session_id as "session_id?", r.command_id as "command_id?", 
                r.branch as "branch?", r.status as "status?", 
                r.commit_title as "commit_title?", r.commit_body as "commit_body?", 
                r.mode as "mode?", r.created_at as "run_created_at?", 
                r.updated_at as "run_updated_at?"
            FROM messages m
            LEFT JOIN runs r ON r.id = m.run_id
            WHERE m.task_id = $1
            ORDER BY m.created_at ASC
            "#,
            task_id
        )
        .fetch_all(&self.pool)
        .await?;

        let mut messages = Vec::new();

        for row in rows {
            let run = if let Some(run_id) = row.run_id {
                // Only create RunWithMeta if we have the required non-nullable fields
                if let Some(mode) = row.mode {
                    let run = Run {
                        id: run_id,
                        task_id: row.run_task_id.unwrap_or(task_id),
                        message_id: row.message_id,
                        sandbox_id: row.sandbox_id,
                        sandbox_hostname: row.sandbox_hostname,
                        session_id: row.session_id,
                        command_id: row.command_id,
                        branch: row.branch,
                        status: row.status,
                        commit_title: row.commit_title,
                        commit_body: row.commit_body,
                        mode: mode,
                        created_at: row.run_created_at,
                        updated_at: row.run_updated_at,
                    };
                    Some(self.assemble_run_meta(&run).await?)
                } else {
                    tracing::warn!(
                        "Run {} has NULL mode, skipping run attachment to message",
                        run_id
                    );
                    None
                }
            } else {
                None
            };

            messages.push(MessageWithRun {
                id: row.id,
                task_id: row.task_id,
                role: row.role,
                content: row.content,
                created_at: row.created_at,
                metadata: Some(row.metadata),
                run,
            });
        }

        Ok(messages)
    }

    pub async fn create_message(&self, message: CreateMessage) -> AppResult<Message> {
        let metadata = message.metadata.unwrap_or_else(|| serde_json::json!({}));
        let sha = message.sha.unwrap_or_default();

        let result = sqlx::query_as!(
            Message,
            r#"
            INSERT INTO messages (task_id, run_id, mode, body_md, sha, role, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, task_id, run_id, mode, body_md, sha, role, 
                      metadata as "metadata: serde_json::Value", created_at
            "#,
            message.task_id,
            message.run_id,
            message.mode,
            message.body_md,
            sha,
            message.role,
            metadata
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn attach_run_to_message(&self, message_id: i64, run_id: i32) -> AppResult<()> {
        sqlx::query!(
            "UPDATE messages SET run_id = $1 WHERE id = $2",
            run_id,
            message_id
        )
        .execute(&self.pool)
        .await?;

        // Also update the run to point to the message
        sqlx::query!(
            "UPDATE runs SET message_id = $1 WHERE id = $2",
            message_id,
            run_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_task_details(&self, task_id: i32) -> AppResult<TaskDetails> {
        // Get task
        let task = self
            .get_task_by_id(task_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Task {} not found", task_id)))?;

        // Get current run (latest run for this task)
        let current_run = sqlx::query_as!(
            Run,
            r#"SELECT id, task_id, message_id, sandbox_id, sandbox_hostname, session_id, 
                      command_id, branch, status, commit_title, commit_body, mode, 
                      created_at, updated_at
               FROM runs 
               WHERE task_id = $1 
               ORDER BY created_at DESC 
               LIMIT 1"#,
            task_id
        )
        .fetch_optional(&self.pool)
        .await?;

        // Get messages with runs
        let messages = self.get_task_messages(task_id).await?;

        // Get logs with pagination (last 100 entries)
        let log_rows = sqlx::query!(
            r#"
            SELECT id, task_id, run_id, log_line as "log_line: serde_json::Value", created_at
            FROM task_logs
            WHERE task_id = $1
            ORDER BY id DESC
            LIMIT 100
            "#,
            task_id
        )
        .fetch_all(&self.pool)
        .await?;

        // Get total log count
        let total_count = sqlx::query!(
            "SELECT COUNT(*) as count FROM task_logs WHERE task_id = $1",
            task_id
        )
        .fetch_one(&self.pool)
        .await?
        .count
        .unwrap_or(0) as i32;

        let logs_vec: Vec<TaskLog> = log_rows
            .into_iter()
            .map(|row| TaskLog {
                id: row.id as i32,
                task_id: row.task_id.unwrap_or(task_id),
                run_id: row.run_id,
                log_line: row.log_line,
                created_at: row.created_at,
            })
            .collect();

        let has_more = total_count > 100;
        let cursor = if has_more && !logs_vec.is_empty() {
            Some(logs_vec.last().unwrap().id as i64)
        } else {
            None
        };

        let logs = TaskLogsPaginated {
            entries: logs_vec,
            total_count,
            has_more,
            cursor,
        };

        // Get todos
        let todos = self.get_agent_todos(task_id).await?;

        Ok(TaskDetails {
            task,
            current_run,
            messages,
            logs,
            todos,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use sqlx::postgres::PgPoolOptions;

    async fn setup_test_db() -> PgPool {
        let config = Config::from_env().expect("Failed to load test config");

        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&config.database_url)
            .await
            .expect("Failed to connect to test database");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");

        pool
    }

    async fn cleanup_test_data(pool: &PgPool) {
        // Clean up test data in reverse dependency order
        let _ = sqlx::query!("DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE clerk_user_id LIKE 'test_%')")
            .execute(pool)
            .await;
        let _ = sqlx::query!("DELETE FROM github_tokens WHERE user_id IN (SELECT id FROM users WHERE clerk_user_id LIKE 'test_%')").execute(pool).await;
        let _ = sqlx::query!("DELETE FROM repositories WHERE user_id IN (SELECT id FROM users WHERE clerk_user_id LIKE 'test_%')").execute(pool).await;
        let _ = sqlx::query!("DELETE FROM users WHERE clerk_user_id LIKE 'test_%'")
            .execute(pool)
            .await;
    }

    #[tokio::test]
    async fn test_create_and_get_user() {
        let pool = setup_test_db().await;
        let db = Database::new(pool.clone());

        // Clean up before test
        cleanup_test_data(&pool).await;

        let create_user = CreateUser {
            clerk_user_id: "test_clerk_123".to_string(),
            github_username: Some("testuser".to_string()),
            github_user_id: Some(12345),
            email: Some("test@example.com".to_string()),
        };

        // Test user creation
        let created_user = db
            .create_user(create_user.clone())
            .await
            .expect("Failed to create user");
        assert_eq!(created_user.clerk_user_id, "test_clerk_123");
        assert_eq!(created_user.github_username, Some("testuser".to_string()));

        // Test getting user by Clerk ID
        let retrieved_user = db
            .get_user_by_clerk_id("test_clerk_123")
            .await
            .expect("Failed to get user");
        assert!(retrieved_user.is_some());
        let user = retrieved_user.unwrap();
        assert_eq!(user.id, created_user.id);

        // Clean up after test
        cleanup_test_data(&pool).await;
    }

    #[tokio::test]
    async fn test_github_token_operations() {
        let pool = setup_test_db().await;
        let db = Database::new(pool.clone());

        cleanup_test_data(&pool).await;

        // Create a user first
        let create_user = CreateUser {
            clerk_user_id: "test_clerk_token".to_string(),
            github_username: Some("tokenuser".to_string()),
            github_user_id: Some(67890),
            email: Some("token@example.com".to_string()),
        };

        let user = db
            .create_user(create_user)
            .await
            .expect("Failed to create user");

        // Test storing GitHub token
        let create_token = CreateGitHubToken {
            user_id: user.id,
            access_token: "ghp_test_token_123".to_string(),
            token_type: "bearer".to_string(),
            scope: Some("repo,user".to_string()),
        };

        let stored_token = db
            .store_github_token(create_token)
            .await
            .expect("Failed to store token");
        assert_eq!(stored_token.user_id, user.id);
        assert_eq!(stored_token.access_token, "ghp_test_token_123");

        // Test getting GitHub token
        let retrieved_token = db
            .get_github_token(user.id)
            .await
            .expect("Failed to get token");
        assert!(retrieved_token.is_some());

        cleanup_test_data(&pool).await;
    }

    #[tokio::test]
    async fn test_user_and_assistant_messages_separate() {
        let pool = setup_test_db().await;
        let db = Database::new(pool.clone());

        cleanup_test_data(&pool).await;

        // Create test user
        let create_user = CreateUser {
            clerk_user_id: "test_clerk_messages".to_string(),
            github_username: Some("messageuser".to_string()),
            github_user_id: Some(98765),
            email: Some("messages@example.com".to_string()),
        };
        let user = db.create_user(create_user).await.unwrap();

        // Create test repository
        let create_repo = crate::models::CreateRepository {
            github_repo_id: 123456,
            owner: "testowner".to_string(),
            name: "testrepo".to_string(),
            full_name: "testowner/testrepo".to_string(),
            user_id: user.id,
            is_private: false,
        };
        let repo = db.create_repository(create_repo).await.unwrap();

        // Create test task
        let create_task = crate::models::CreateTask {
            user_id: user.id,
            repository_id: repo.id,
            title: "Test Task".to_string(),
        };
        let task = db.create_task(create_task).await.unwrap();

        // Create user message (no run_id)
        let user_msg = db
            .create_message(CreateMessage {
                task_id: task.id,
                run_id: None,
                mode: "execute".into(),
                body_md: "User prompt".into(),
                role: "user".into(),
                sha: None,
                metadata: None,
            })
            .await
            .unwrap();

        // Create run
        let run = db.create_run(task.id, "execute").await.unwrap();

        // Create placeholder assistant message
        db.upsert_message(task.id, run.id, "execute", "", "", "assistant")
            .await
            .unwrap();

        // Update assistant message with content
        db.upsert_message(
            task.id,
            run.id,
            "execute",
            "Agent reply",
            "abc123",
            "assistant",
        )
        .await
        .unwrap();

        // Verify messages are separate
        let msgs = db.get_task_messages(task.id).await.unwrap();
        assert_eq!(msgs.len(), 2);

        let user_message = msgs.iter().find(|m| m.role == "user").unwrap();
        let assistant_message = msgs.iter().find(|m| m.role == "assistant").unwrap();

        assert_eq!(user_message.content, "User prompt");
        assert_eq!(assistant_message.content, "Agent reply");

        // Verify run associations
        let msgs_with_runs = db.get_task_messages(task.id).await.unwrap();
        let user_msg_with_run = msgs_with_runs.iter().find(|m| m.role == "user").unwrap();
        let assistant_msg_with_run = msgs_with_runs
            .iter()
            .find(|m| m.role == "assistant")
            .unwrap();

        assert!(
            user_msg_with_run.run.is_none(),
            "User message should not have a run"
        );
        assert!(
            assistant_msg_with_run.run.is_some(),
            "Assistant message should have a run"
        );
        assert_eq!(assistant_msg_with_run.run.as_ref().unwrap().id, run.id);

        cleanup_test_data(&pool).await;
    }
}
