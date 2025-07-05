use crate::error::{AppError, AppResult};
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub clerk_secret_key: String,
    pub github_token: Option<String>,
    pub port: u16,
    pub daytona_url: Option<String>,
    pub daytona_api_key: Option<String>,
    pub daytona_organization_id: Option<String>,
    pub daytona_region: String,
    pub openai_api_key: Option<String>,
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

        let daytona_url = env::var("DAYTONA_URL").ok();
        let daytona_api_key = env::var("DAYTONA_API_KEY").ok();
        let daytona_organization_id = env::var("DAYTONA_ORGANIZATION_ID").ok();
        let daytona_region = env::var("DAYTONA_REGION").unwrap_or_else(|_| "us".to_string());
        let openai_api_key = env::var("OPENAI_API_KEY").ok();

        Ok(Config {
            database_url,
            clerk_secret_key,
            github_token,
            port,
            daytona_url,
            daytona_api_key,
            daytona_organization_id,
            daytona_region,
            openai_api_key,
        })
    }
}
