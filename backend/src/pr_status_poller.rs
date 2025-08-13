use crate::database::Database;
use crate::github_pr::GitHubPRClient;
use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;

pub struct PrStatusPoller {
    db: Arc<Database>,
    poll_interval: Duration,
}

impl PrStatusPoller {
    pub fn new(db: Arc<Database>, _github_token: Option<&str>) -> Self {
        // ignore the global token entirely
        Self {
            db,
            poll_interval: Duration::from_secs(10 * 60), // 10 minutes
        }
    }

    pub async fn start_polling(&self) {
        tracing::info!("Starting PR status poller (interval: {}m)", self.poll_interval.as_secs() / 60);

        // run once immediately so it doesn't look idle
        if let Err(e) = self.poll_pr_statuses().await {
            tracing::error!("Initial PR poll failed: {}", e);
        }

        let mut interval_timer = interval(self.poll_interval);
        loop {
            interval_timer.tick().await;
            if let Err(e) = self.poll_pr_statuses().await {
                tracing::error!("PR poll error: {}", e);
            }
        }
    }

    async fn poll_pr_statuses(&self) -> Result<()> {
        let tasks = self.db.get_tasks_needing_pr_polling().await?;
        if tasks.is_empty() {
            tracing::debug!("PR poll: nothing to do");
            return Ok(());
        }
        tracing::info!("PR poll: {} tasks", tasks.len());

        let mut merged = 0usize;
        let mut errors = 0usize;

        for task in tasks {
            let Some(pr_url) = &task.github_pr_url else { continue };

            let (owner, repo, number) = match GitHubPRClient::parse_pr_url(pr_url) {
                Ok(t) => t,
                Err(e) => { errors += 1; tracing::warn!("Bad PR URL on task {}: {} ({})", task.id, e, pr_url); continue; }
            };

            // 🔑 fetch the correct user's token for this task
            let token = match self.db.get_github_token(task.user_id).await? {
                Some(t) => t.access_token,
                None => { tracing::warn!("No GitHub token for user {} (task {})", task.user_id, task.id); continue; }
            };

            let client = match GitHubPRClient::new(&token) {
                Ok(c) => c,
                Err(e) => { errors += 1; tracing::error!("Make client failed for task {}: {}", task.id, e); continue; }
            };

            match client.is_merged(&owner, &repo, number).await {
                Ok(true) => {
                    if let Err(e) = self.db.update_task_to_pr_merged(task.id).await {
                        errors += 1; tracing::error!("Mark merged failed for task {}: {}", task.id, e);
                    } else {
                        merged += 1; tracing::info!("Task {} PR merged (#{})", task.id, number);
                    }
                }
                Ok(false) => { /* not merged yet */ }
                Err(e) => { errors += 1; tracing::error!("Check merged failed (task {}): {}", task.id, e); }
            }
        }

        if merged > 0 || errors > 0 {
            tracing::info!("PR poll: {} merged, {} errors", merged, errors);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::models::{CreateRepository, CreateTask, CreateUser};
    use sqlx::postgres::PgPoolOptions;

    #[tokio::test]
    async fn test_pr_status_poller_creation() {
        let config = Config::from_env().expect("Failed to load config");
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&config.database_url)
            .await
            .expect("Failed to connect to database");
        
        let db = Arc::new(Database::new(pool));
        
        // Test creating poller without token (should work now)
        let poller_no_token = PrStatusPoller::new(db.clone(), None);
        assert_eq!(poller_no_token.poll_interval.as_secs(), 10 * 60);
        
        // Test creating poller with token (should ignore it)
        let poller_with_token = PrStatusPoller::new(db.clone(), Some("ghp_test_token"));
        assert_eq!(poller_with_token.poll_interval.as_secs(), 10 * 60);
    }
    
    #[tokio::test]
    async fn test_get_tasks_needing_pr_polling() {
        let config = Config::from_env().expect("Failed to load config");
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&config.database_url)
            .await
            .expect("Failed to connect to database");
        
        let db = Database::new(pool);
        
        // Clean up test data
        let _ = sqlx::query!("DELETE FROM tasks WHERE title LIKE 'Test PR Polling%'").execute(&db.pool).await;
        let _ = sqlx::query!("DELETE FROM users WHERE clerk_user_id = 'test_pr_polling'").execute(&db.pool).await;
        
        // Create test user and repo
        let user = db.create_user(CreateUser {
            clerk_user_id: "test_pr_polling".to_string(),
            github_username: Some("testuser".to_string()),
            github_user_id: Some(12345),
            email: Some("test@example.com".to_string()),
        }).await.expect("Failed to create user");
        
        let repo = db.create_repository(CreateRepository {
            github_repo_id: 98765,
            owner: "testowner".to_string(),
            name: "testrepo".to_string(),
            full_name: "testowner/testrepo".to_string(),
            user_id: user.id,
            is_private: false,
            github_pushed_at: None,
        }).await.expect("Failed to create repo");
        
        // Create task with pr_opened status
        let task = db.create_task(CreateTask {
            user_id: user.id,
            repository_id: repo.id,
            title: "Test PR Polling Task".to_string(),
            description: None,
        }).await.expect("Failed to create task");
        
        // Update task to pr_opened with PR URL
        db.update_task_status(task.id, "pr_opened", Some("https://github.com/testowner/testrepo/pull/123")).await.expect("Failed to update task status");
        
        // Test querying tasks needing PR polling
        let tasks = db.get_tasks_needing_pr_polling().await.expect("Failed to get tasks");
        assert!(tasks.len() >= 1);
        let found_task = tasks.iter().find(|t| t.id == task.id).expect("Task not found");
        assert_eq!(found_task.status.as_deref(), Some("pr_opened"));
        assert!(found_task.github_pr_url.is_some());
        
        // Clean up
        let _ = sqlx::query!("DELETE FROM tasks WHERE id = $1", task.id).execute(&db.pool).await;
        let _ = sqlx::query!("DELETE FROM repositories WHERE id = $1", repo.id).execute(&db.pool).await;
        let _ = sqlx::query!("DELETE FROM users WHERE id = $1", user.id).execute(&db.pool).await;
    }
}