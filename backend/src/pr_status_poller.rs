use crate::database::Database;
use crate::github_pr::GitHubPRClient;
use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;

pub struct PrStatusPoller {
    db: Arc<Database>,
    github_client: Option<GitHubPRClient>,
    poll_interval: Duration,
}

impl PrStatusPoller {
    pub fn new(db: Arc<Database>, github_token: Option<&str>) -> Self {
        let github_client = github_token.and_then(|token| {
            match GitHubPRClient::new(token) {
                Ok(client) => {
                    tracing::info!("PR status poller initialized with GitHub client");
                    Some(client)
                }
                Err(e) => {
                    tracing::error!("Failed to initialize GitHub client for PR polling: {}", e);
                    None
                }
            }
        });

        Self {
            db,
            github_client,
            poll_interval: Duration::from_secs(10 * 60), // 10 minutes
        }
    }

    pub async fn start_polling(&self) {
        if self.github_client.is_none() {
            tracing::warn!("PR status poller starting without GitHub token - no polling will occur");
            return;
        }

        tracing::info!("Starting PR status poller with {} minute interval", self.poll_interval.as_secs() / 60);
        let mut interval_timer = interval(self.poll_interval);

        loop {
            interval_timer.tick().await;
            
            if let Err(e) = self.poll_pr_statuses().await {
                tracing::error!("Error during PR status polling: {}", e);
            }
        }
    }

    async fn poll_pr_statuses(&self) -> Result<()> {
        let github_client = match &self.github_client {
            Some(client) => client,
            None => {
                tracing::debug!("Skipping PR status poll - no GitHub client");
                return Ok(());
            }
        };

        tracing::debug!("Starting PR status polling cycle");
        
        // Get all tasks that need PR status checking
        let tasks = self.db.get_tasks_needing_pr_polling().await?;
        
        if tasks.is_empty() {
            tracing::debug!("No tasks found needing PR status polling");
            return Ok(());
        }

        tracing::info!("Found {} tasks needing PR status polling", tasks.len());

        let mut merged_count = 0;
        let mut error_count = 0;

        for task in tasks {
            let pr_url = match &task.github_pr_url {
                Some(url) => url,
                None => {
                    tracing::warn!("Task {} has status 'pr_opened' but no github_pr_url", task.id);
                    continue;
                }
            };

            match GitHubPRClient::parse_pr_url(pr_url) {
                Ok((owner, repo, pr_number)) => {
                    tracing::debug!("Checking PR merge status for task {} - {}/{} #{}", task.id, owner, repo, pr_number);
                    
                    match github_client.is_merged(&owner, &repo, pr_number).await {
                        Ok(true) => {
                            tracing::info!("PR #{} in {}/{} has been merged - updating task {} to pr_merged", pr_number, owner, repo, task.id);
                            
                            match self.db.update_task_to_pr_merged(task.id).await {
                                Ok(_) => {
                                    merged_count += 1;
                                    tracing::info!("Successfully updated task {} status to pr_merged", task.id);
                                }
                                Err(e) => {
                                    error_count += 1;
                                    tracing::error!("Failed to update task {} to pr_merged: {}", task.id, e);
                                }
                            }
                        }
                        Ok(false) => {
                            tracing::debug!("PR #{} in {}/{} is not yet merged (task {})", pr_number, owner, repo, task.id);
                        }
                        Err(e) => {
                            error_count += 1;
                            tracing::error!("Failed to check PR merge status for task {}: {}", task.id, e);
                        }
                    }
                }
                Err(e) => {
                    error_count += 1;
                    tracing::error!("Failed to parse PR URL for task {}: {} - URL: {}", task.id, e, pr_url);
                }
            }
        }

        if merged_count > 0 || error_count > 0 {
            tracing::info!(
                "PR status polling complete: {} tasks updated to merged, {} errors",
                merged_count,
                error_count
            );
        } else {
            tracing::debug!("PR status polling complete: no status changes");
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
        
        // Test creating poller without token
        let poller_no_token = PrStatusPoller::new(db.clone(), None);
        assert!(poller_no_token.github_client.is_none());
        
        // Test creating poller with invalid token  
        let poller_invalid_token = PrStatusPoller::new(db.clone(), Some("invalid_token"));
        // Note: This might still create a client as the GitHub client constructor doesn't validate the token
        
        // Test creating poller with test token
        let poller_with_token = PrStatusPoller::new(db.clone(), Some("ghp_test_token"));
        assert!(poller_with_token.github_client.is_some());
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