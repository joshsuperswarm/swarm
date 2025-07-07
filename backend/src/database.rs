use crate::error::AppResult;
use crate::models::{
    CreateGitHubToken, CreateRepository, CreateTask, CreateUser, GitHubToken, Repository,
    RepositoryWithTasks, Task, User, TaskLog,
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
        let user = sqlx::query_as!(
            User,
            "SELECT * FROM users WHERE id = $1",
            user_id
        )
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

    pub async fn update_user_anthropic_key(
        &self,
        user_id: i32,
        anthropic_api_key: Option<String>,
    ) -> AppResult<User> {
        let user = sqlx::query_file_as!(
            User,
            "sql/update_user_anthropic_key.sql",
            user_id,
            anthropic_api_key
        )
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
            task.title,
            task.description
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(task)
    }

    pub async fn get_user_tasks(&self, user_id: i32) -> AppResult<Vec<Task>> {
        let tasks = sqlx::query_file_as!(Task, "sql/get_user_tasks.sql", user_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(tasks)
    }

    pub async fn get_task_by_id(&self, task_id: i32) -> AppResult<Option<Task>> {
        let task = sqlx::query_as!(
            Task,
            "SELECT * FROM tasks WHERE id = $1",
            task_id
        )
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

        Ok(task)
    }

    pub async fn update_task_sandbox(
        &self,
        task_id: i32,
        sandbox_id: &str,
        hostname: &str,
        status: &str,
    ) -> AppResult<Task> {
        let task = sqlx::query_file_as!(
            Task,
            "sql/update_task_sandbox.sql",
            task_id,
            sandbox_id,
            hostname,
            status
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(task)
    }

    pub async fn update_task_command_ids(
        &self,
        task_id: i32,
        session_id: &str,
        command_id: &str,
    ) -> AppResult<Task> {
        let task = sqlx::query_file_as!(
            Task,
            "sql/update_task_command_ids.sql",
            task_id,
            session_id,
            command_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(task)
    }

    pub async fn update_task_branch(
        &self,
        task_id: i32,
        github_branch: &str,
    ) -> AppResult<Task> {
        let task = sqlx::query_file_as!(
            Task,
            "sql/update_task_branch.sql",
            task_id,
            github_branch
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(task)
    }

    // Task log operations
    pub async fn insert_task_log(&self, task_id: i32, log_line: &str) -> AppResult<()> {
        tracing::debug!("→ Inserting log line for task {} (length: {} chars)", task_id, log_line.len());
        
        // Parse the log line as JSON
        let json_value: serde_json::Value = match serde_json::from_str(log_line) {
            Ok(json) => json,
            Err(e) => {
                tracing::warn!("⚠ Failed to parse log line as JSON for task {}: {}", task_id, e);
                tracing::warn!("   Line: {}", if log_line.len() > 200 { 
                    format!("{}...", &log_line[..200]) 
                } else { 
                    log_line.to_string() 
                });
                return Ok(()); // Skip non-JSON lines
            }
        };
        
        match sqlx::query!(
            "INSERT INTO task_logs (task_id, log_line) VALUES ($1, $2::jsonb)",
            task_id,
            json_value
        )
        .execute(&self.pool)
        .await {
            Ok(result) => {
                tracing::debug!("✓ Successfully inserted log line for task {}, rows affected: {}", 
                    task_id, result.rows_affected());
                Ok(())
            }
            Err(e) => {
                tracing::error!("✗ Database error inserting log line for task {}: {}", task_id, e);
                tracing::error!("   Line preview: {}", 
                    if log_line.len() > 100 { 
                        format!("{}...", &log_line[..100]) 
                    } else { 
                        log_line.to_string() 
                    });
                Err(e.into())
            }
        }
    }

    pub async fn get_task_logs(&self, task_id: i32) -> AppResult<Vec<TaskLog>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, task_id, log_line as "log_line: serde_json::Value", created_at
            FROM task_logs
            WHERE task_id = $1
            ORDER BY id ASC
            "#,
            task_id
        )
        .fetch_all(&self.pool)
        .await?;
        
        let logs = rows.into_iter().map(|row| TaskLog {
            id: row.id,
            task_id: row.task_id.expect("task_id should not be null"),
            log_line: row.log_line,
            created_at: row.created_at,
        }).collect();
        
        Ok(logs)
    }

    pub async fn stream_task_logs(
        &self,
        task_id: i32,
        after_id: Option<i64>,
    ) -> AppResult<Vec<TaskLog>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, task_id, log_line as "log_line: serde_json::Value", created_at
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
        
        let logs = rows.into_iter().map(|row| TaskLog {
            id: row.id,
            task_id: row.task_id.expect("task_id should not be null"),
            log_line: row.log_line,
            created_at: row.created_at,
        }).collect();
        
        Ok(logs)
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
}
