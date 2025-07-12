use crate::error::{AppError, AppResult};
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub clerk_secret_key: String,
    pub github_token: Option<String>,
    pub port: u16,
    pub modal_url: Option<String>,
    pub modal_region: Option<String>,
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
}

impl Config {
    pub fn from_env() -> AppResult<Self> {
        // Load environment variables from .env file
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());

        let clerk_secret_key = env::var("CLERK_SECRET_KEY").map_err(|_| {
            AppError::Internal("CLERK_SECRET_KEY environment variable is required".to_string())
        })?;

        let github_token = env::var("GITHUB_TOKEN").ok();

        let port = env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse::<u16>()
            .map_err(|_| AppError::Internal("Invalid PORT value".to_string()))?;

        let modal_url = env::var("MODAL_URL").ok();
        let modal_region = env::var("MODAL_REGION").ok();
        let openai_api_key = env::var("OPENAI_API_KEY").ok();
        let anthropic_api_key = env::var("ANTHROPIC_API_KEY").ok();

        Ok(Config {
            database_url,
            clerk_secret_key,
            github_token,
            port,
            modal_url,
            modal_region,
            openai_api_key,
            anthropic_api_key,
        })
    }
}
