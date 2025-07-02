use sqlx::PgPool;
use crate::models::{
    User, CreateUser, Repository, CreateRepository,
    RepositoryWithTasks, GitHubToken, CreateGitHubToken
};

#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // User operations with simplified queries
    pub async fn create_user(&self, user: CreateUser) -> Result<User, sqlx::Error> {
        // Use a simple query that works
        let result = sqlx::query!(
            "INSERT INTO users (clerk_user_id, github_username, github_user_id, email) VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at",
            user.clerk_user_id,
            user.github_username,
            user.github_user_id,
            user.email
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(User {
            id: result.id,
            clerk_user_id: user.clerk_user_id,
            github_username: user.github_username,
            github_user_id: user.github_user_id,
            email: user.email,
            default_repo_id: None,
            created_at: result.created_at,
            updated_at: result.updated_at,
        })
    }

    pub async fn get_user_by_clerk_id(&self, clerk_user_id: &str) -> Result<Option<User>, sqlx::Error> {
        let result = sqlx::query!(
            "SELECT id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at FROM users WHERE clerk_user_id = $1",
            clerk_user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = result {
            Ok(Some(User {
                id: row.id,
                clerk_user_id: row.clerk_user_id,
                github_username: row.github_username,
                github_user_id: row.github_user_id,
                email: row.email,
                default_repo_id: row.default_repo_id,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn update_user_github_info(&self, user_id: i32, github_username: Option<String>, github_user_id: Option<i32>) -> Result<User, sqlx::Error> {
        let result = sqlx::query!(
            "UPDATE users SET github_username = $2, github_user_id = $3, updated_at = NOW() WHERE id = $1 RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at",
            user_id,
            github_username,
            github_user_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(User {
            id: result.id,
            clerk_user_id: result.clerk_user_id,
            github_username: result.github_username,
            github_user_id: result.github_user_id,
            email: result.email,
            default_repo_id: result.default_repo_id,
            created_at: result.created_at,
            updated_at: result.updated_at,
        })
    }

    pub async fn get_user_repositories(&self, user_id: i32) -> Result<Vec<RepositoryWithTasks>, sqlx::Error> {
        let results = sqlx::query!(
            "SELECT r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at, COUNT(t.id) as task_count FROM repositories r LEFT JOIN tasks t ON r.id = t.repository_id WHERE r.user_id = $1 GROUP BY r.id ORDER BY r.created_at DESC",
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        let repositories = results
            .into_iter()
            .map(|row| RepositoryWithTasks {
                id: row.id,
                github_repo_id: row.github_repo_id,
                owner: row.owner,
                name: row.name,
                full_name: row.full_name,
                is_private: row.is_private.unwrap_or(false),
                task_count: row.task_count.unwrap_or(0),
                created_at: Some(row.created_at.unwrap_or_else(|| chrono::Utc::now())),
            })
            .collect();

        Ok(repositories)
    }

    pub async fn create_repository(&self, repo: CreateRepository) -> Result<Repository, sqlx::Error> {
        let result = sqlx::query!(
            "INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (github_repo_id, user_id) DO UPDATE SET owner = EXCLUDED.owner, name = EXCLUDED.name, full_name = EXCLUDED.full_name, is_private = EXCLUDED.is_private RETURNING id, created_at",
            repo.github_repo_id,
            repo.owner,
            repo.name,
            repo.full_name,
            repo.user_id,
            repo.is_private
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(Repository {
            id: result.id,
            github_repo_id: repo.github_repo_id,
            owner: repo.owner,
            name: repo.name,
            full_name: repo.full_name,
            user_id: repo.user_id,
            is_private: repo.is_private,
            created_at: result.created_at,
        })
    }

    // GitHub token operations
    pub async fn store_github_token(&self, token: CreateGitHubToken) -> Result<GitHubToken, sqlx::Error> {
        let result = sqlx::query!(
            "INSERT INTO github_tokens (user_id, access_token, token_type, scope) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET access_token = EXCLUDED.access_token, token_type = EXCLUDED.token_type, scope = EXCLUDED.scope, updated_at = NOW() RETURNING id, created_at, updated_at",
            token.user_id,
            token.access_token,
            token.token_type,
            token.scope
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(GitHubToken {
            id: result.id,
            user_id: token.user_id,
            access_token: token.access_token,
            token_type: token.token_type,
            scope: token.scope,
            created_at: result.created_at,
            updated_at: result.updated_at,
        })
    }

    pub async fn get_github_token(&self, user_id: i32) -> Result<Option<GitHubToken>, sqlx::Error> {
        let result = sqlx::query!(
            "SELECT id, user_id, access_token, token_type, scope, created_at, updated_at FROM github_tokens WHERE user_id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = result {
            Ok(Some(GitHubToken {
                id: row.id,
                user_id: row.user_id,
                access_token: row.access_token,
                token_type: row.token_type.unwrap_or_else(|| "bearer".to_string()),
                scope: row.scope,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn sync_repositories(&self, _user_id: i32, repos: Vec<CreateRepository>) -> Result<Vec<Repository>, sqlx::Error> {
        let mut synced_repos = Vec::new();
        
        for repo in repos {
            let synced_repo = self.create_repository(repo).await?;
            synced_repos.push(synced_repo);
        }
        
        Ok(synced_repos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::postgres::PgPoolOptions;
    use tokio_test;

    async fn setup_test_db() -> PgPool {
        // Use existing database for tests to avoid creating separate test DB
        let database_url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());
        
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
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
        let _ = sqlx::query!("DELETE FROM tasks").execute(pool).await;
        let _ = sqlx::query!("DELETE FROM github_tokens").execute(pool).await;
        let _ = sqlx::query!("DELETE FROM repositories").execute(pool).await;
        let _ = sqlx::query!("DELETE FROM users").execute(pool).await;
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
        let created_user = db.create_user(create_user.clone()).await.expect("Failed to create user");
        assert_eq!(created_user.clerk_user_id, "test_clerk_123");
        assert_eq!(created_user.github_username, Some("testuser".to_string()));
        assert_eq!(created_user.github_user_id, Some(12345));
        assert_eq!(created_user.email, Some("test@example.com".to_string()));

        // Test getting user by Clerk ID
        let retrieved_user = db.get_user_by_clerk_id("test_clerk_123").await.expect("Failed to get user");
        assert!(retrieved_user.is_some());
        let user = retrieved_user.unwrap();
        assert_eq!(user.id, created_user.id);
        assert_eq!(user.clerk_user_id, "test_clerk_123");

        // Test getting non-existent user
        let non_existent = db.get_user_by_clerk_id("does_not_exist").await.expect("Query should succeed");
        assert!(non_existent.is_none());

        // Clean up after test
        cleanup_test_data(&pool).await;
    }

    #[tokio::test]
    async fn test_github_token_operations() {
        let pool = setup_test_db().await;
        let db = Database::new(pool.clone());
        
        // Clean up before test
        cleanup_test_data(&pool).await;

        // Create a user first
        let create_user = CreateUser {
            clerk_user_id: "test_clerk_token".to_string(),
            github_username: Some("tokenuser".to_string()),
            github_user_id: Some(67890),
            email: Some("token@example.com".to_string()),
        };

        let user = db.create_user(create_user).await.expect("Failed to create user");

        // Test storing GitHub token
        let create_token = CreateGitHubToken {
            user_id: user.id,
            access_token: "ghp_test_token_123".to_string(),
            token_type: "bearer".to_string(),
            scope: Some("repo,user".to_string()),
        };

        let stored_token = db.store_github_token(create_token.clone()).await.expect("Failed to store token");
        assert_eq!(stored_token.user_id, user.id);
        assert_eq!(stored_token.access_token, "ghp_test_token_123");
        assert_eq!(stored_token.token_type, "bearer");

        // Test getting GitHub token
        let retrieved_token = db.get_github_token(user.id).await.expect("Failed to get token");
        assert!(retrieved_token.is_some());
        let token = retrieved_token.unwrap();
        assert_eq!(token.access_token, "ghp_test_token_123");

        // Test updating token (upsert behavior)
        let update_token = CreateGitHubToken {
            user_id: user.id,
            access_token: "ghp_updated_token_456".to_string(),
            token_type: "bearer".to_string(),
            scope: Some("repo,user,admin".to_string()),
        };

        let updated_token = db.store_github_token(update_token).await.expect("Failed to update token");
        assert_eq!(updated_token.access_token, "ghp_updated_token_456");
        assert_eq!(updated_token.scope, Some("repo,user,admin".to_string()));

        // Test getting non-existent token
        let non_existent_token = db.get_github_token(99999).await.expect("Query should succeed");
        assert!(non_existent_token.is_none());

        // Clean up after test
        cleanup_test_data(&pool).await;
    }

    #[tokio::test]
    async fn test_repository_operations() {
        let pool = setup_test_db().await;
        let db = Database::new(pool.clone());
        
        // Clean up before test
        cleanup_test_data(&pool).await;

        // Create a user first
        let create_user = CreateUser {
            clerk_user_id: "test_clerk_repo".to_string(),
            github_username: Some("repouser".to_string()),
            github_user_id: Some(11111),
            email: Some("repo@example.com".to_string()),
        };

        let user = db.create_user(create_user).await.expect("Failed to create user");

        // Test creating repository
        let create_repo = CreateRepository {
            github_repo_id: 123456789,
            owner: "repouser".to_string(),
            name: "test-repo".to_string(),
            full_name: "repouser/test-repo".to_string(),
            user_id: user.id,
            is_private: false,
        };

        let created_repo = db.create_repository(create_repo.clone()).await.expect("Failed to create repository");
        assert_eq!(created_repo.github_repo_id, 123456789);
        assert_eq!(created_repo.name, "test-repo");
        assert_eq!(created_repo.user_id, user.id);

        // Test getting user repositories
        let repos = db.get_user_repositories(user.id).await.expect("Failed to get repositories");
        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].name, "test-repo");
        assert_eq!(repos[0].task_count, 0); // No tasks yet

        // Test repository sync (upsert behavior)
        let sync_repos = vec![
            CreateRepository {
                github_repo_id: 123456789, // Same ID - should update
                owner: "repouser".to_string(),
                name: "test-repo-updated".to_string(),
                full_name: "repouser/test-repo-updated".to_string(),
                user_id: user.id,
                is_private: true, // Changed to private
            },
            CreateRepository {
                github_repo_id: 987654321, // New repo
                owner: "repouser".to_string(),
                name: "another-repo".to_string(),
                full_name: "repouser/another-repo".to_string(),
                user_id: user.id,
                is_private: false,
            },
        ];

        let synced_repos = db.sync_repositories(user.id, sync_repos).await.expect("Failed to sync repositories");
        assert_eq!(synced_repos.len(), 2);

        // Verify repositories were synced correctly
        let all_repos = db.get_user_repositories(user.id).await.expect("Failed to get all repositories");
        assert_eq!(all_repos.len(), 2);

        // Find the updated repo
        let updated_repo = all_repos.iter().find(|r| r.github_repo_id == 123456789).unwrap();
        assert_eq!(updated_repo.name, "test-repo-updated");
        assert_eq!(updated_repo.is_private, true);

        // Clean up after test
        cleanup_test_data(&pool).await;
    }

    #[tokio::test]
    async fn test_user_update_operations() {
        let pool = setup_test_db().await;
        let db = Database::new(pool.clone());
        
        // Clean up before test
        cleanup_test_data(&pool).await;

        // Create a user without GitHub info
        let create_user = CreateUser {
            clerk_user_id: "test_clerk_update".to_string(),
            github_username: None,
            github_user_id: None,
            email: Some("update@example.com".to_string()),
        };

        let user = db.create_user(create_user).await.expect("Failed to create user");
        assert!(user.github_username.is_none());
        assert!(user.github_user_id.is_none());

        // Test updating GitHub info
        let updated_user = db.update_user_github_info(
            user.id,
            Some("updateduser".to_string()),
            Some(55555),
        ).await.expect("Failed to update user");

        assert_eq!(updated_user.github_username, Some("updateduser".to_string()));
        assert_eq!(updated_user.github_user_id, Some(55555));
        assert_eq!(updated_user.email, Some("update@example.com".to_string()));

        // Clean up after test
        cleanup_test_data(&pool).await;
    }
}