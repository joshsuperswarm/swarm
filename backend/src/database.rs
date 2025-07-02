use sqlx::{PgPool, Row};
use crate::models::{
    User, CreateUser, Repository, CreateRepository, 
    GitHubToken, CreateGitHubToken, Task, CreateTask,
    UserWithDefaultRepo, RepositoryWithTasks
};

#[derive(Clone)]
pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // User operations
    pub async fn create_user(&self, user: CreateUser) -> Result<User, sqlx::Error> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (clerk_user_id, github_username, github_user_id, email)
            VALUES ($1, $2, $3, $4)
            RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at
            "#,
            user.clerk_user_id,
            user.github_username,
            user.github_user_id,
            user.email
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn get_user_by_clerk_id(&self, clerk_user_id: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as!(
            User,
            "SELECT id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at FROM users WHERE clerk_user_id = $1",
            clerk_user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn update_user_github_info(&self, user_id: i32, github_username: Option<String>, github_user_id: Option<i32>) -> Result<User, sqlx::Error> {
        let user = sqlx::query_as!(
            User,
            r#"
            UPDATE users 
            SET github_username = $2, github_user_id = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at
            "#,
            user_id,
            github_username,
            github_user_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn set_default_repository(&self, user_id: i32, repo_id: Option<i32>) -> Result<User, sqlx::Error> {
        let user = sqlx::query_as!(
            User,
            r#"
            UPDATE users 
            SET default_repo_id = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at
            "#,
            user_id,
            repo_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    // Repository operations
    pub async fn create_repository(&self, repo: CreateRepository) -> Result<Repository, sqlx::Error> {
        let repository = sqlx::query_as!(
            Repository,
            r#"
            INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (github_repo_id, user_id) DO UPDATE SET
                owner = EXCLUDED.owner,
                name = EXCLUDED.name,
                full_name = EXCLUDED.full_name,
                is_private = EXCLUDED.is_private
            RETURNING id, github_repo_id, owner, name, full_name, user_id, is_private, created_at
            "#,
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

    pub async fn get_user_repositories(&self, user_id: i32) -> Result<Vec<RepositoryWithTasks>, sqlx::Error> {
        let repos = sqlx::query!(
            r#"
            SELECT 
                r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at,
                COUNT(t.id) as task_count
            FROM repositories r
            LEFT JOIN tasks t ON r.id = t.repository_id
            WHERE r.user_id = $1
            GROUP BY r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at
            ORDER BY r.created_at DESC
            "#,
            user_id
        )
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
            })
            .collect();

        Ok(repositories)
    }

    pub async fn get_repository_by_id(&self, repo_id: i32, user_id: i32) -> Result<Option<Repository>, sqlx::Error> {
        let repo = sqlx::query_as!(
            Repository,
            "SELECT id, github_repo_id, owner, name, full_name, user_id, is_private, created_at FROM repositories WHERE id = $1 AND user_id = $2",
            repo_id,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(repo)
    }

    // GitHub token operations
    pub async fn create_or_update_github_token(&self, token: CreateGitHubToken) -> Result<GitHubToken, sqlx::Error> {
        let github_token = sqlx::query_as!(
            GitHubToken,
            r#"
            INSERT INTO github_tokens (user_id, access_token, token_type, scope)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                token_type = EXCLUDED.token_type,
                scope = EXCLUDED.scope,
                updated_at = NOW()
            RETURNING id, user_id, access_token, token_type, scope, created_at, updated_at
            "#,
            token.user_id,
            token.access_token,
            token.token_type,
            token.scope
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(github_token)
    }

    pub async fn get_github_token(&self, user_id: i32) -> Result<Option<GitHubToken>, sqlx::Error> {
        let token = sqlx::query_as!(
            GitHubToken,
            "SELECT id, user_id, access_token, token_type, scope, created_at, updated_at FROM github_tokens WHERE user_id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(token)
    }

    // Task operations
    pub async fn create_task(&self, task: CreateTask) -> Result<Task, sqlx::Error> {
        let task = sqlx::query_as!(
            Task,
            r#"
            INSERT INTO tasks (user_id, repository_id, title, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, repository_id, title, description, status, github_pr_url, created_at, updated_at
            "#,
            task.user_id,
            task.repository_id,
            task.title,
            task.description
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(task)
    }

    pub async fn get_user_tasks(&self, user_id: i32) -> Result<Vec<Task>, sqlx::Error> {
        let tasks = sqlx::query_as!(
            Task,
            "SELECT id, user_id, repository_id, title, description, status, github_pr_url, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY created_at DESC",
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(tasks)
    }

    pub async fn update_task_status(&self, task_id: i32, status: &str, pr_url: Option<&str>) -> Result<Task, sqlx::Error> {
        let task = sqlx::query_as!(
            Task,
            r#"
            UPDATE tasks 
            SET status = $2, github_pr_url = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING id, user_id, repository_id, title, description, status, github_pr_url, created_at, updated_at
            "#,
            task_id,
            status,
            pr_url
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(task)
    }
}