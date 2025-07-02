use sqlx::PgPool;
use crate::models::{
    User, CreateUser, Repository, CreateRepository,
    RepositoryWithTasks
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
}