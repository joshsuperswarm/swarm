use crate::error::{AppError, AppResult};
use base64::engine::{general_purpose::STANDARD as BASE64_ENGINE, Engine};
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
    pub api_keys_kek: [u8; 32],
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

        let kek_b64 = env::var("API_KEYS_KEK_BASE64").map_err(|_| {
            AppError::Internal("API_KEYS_KEK_BASE64 environment variable is required".to_string())
        })?;
        
        let kek_bytes = BASE64_ENGINE
            .decode(&kek_b64)
            .map_err(|_| {
                AppError::Internal("API_KEYS_KEK_BASE64 must be valid base64".to_string())
            })?;
        
        let api_keys_kek: [u8; 32] = kek_bytes.try_into().map_err(|_| {
            AppError::Internal("API_KEYS_KEK_BASE64 must decode to exactly 32 bytes".to_string())
        })?;

        Ok(Config {
            database_url,
            clerk_secret_key,
            github_token,
            port,
            modal_url,
            modal_region,
            openai_api_key,
            anthropic_api_key,
            api_keys_kek,
        })
    }
}
