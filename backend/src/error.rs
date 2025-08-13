use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("GitHub API error: {0}")]
    GitHub(String),

    #[error("Clerk API error: {0}")]
    Clerk(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        AppError::Internal(message)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Database(ref e) => {
                tracing::error!("Database error: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error")
            }
            AppError::Auth(ref message) => {
                tracing::warn!("Auth error: {}", message);
                (StatusCode::UNAUTHORIZED, "Authentication failed")
            }
            AppError::GitHub(ref message) => {
                tracing::error!("GitHub API error: {}", message);
                (StatusCode::BAD_GATEWAY, "GitHub API error")
            }
            AppError::Clerk(ref message) => {
                tracing::error!("Clerk API error: {}", message);
                (StatusCode::BAD_GATEWAY, "Authentication service error")
            }
            AppError::Validation(ref message) => {
                tracing::warn!("Validation error: {}", message);
                (StatusCode::BAD_REQUEST, message.as_str())
            }
            AppError::NotFound(ref message) => {
                tracing::info!("Not found: {}", message);
                (StatusCode::NOT_FOUND, message.as_str())
            }
            AppError::Internal(ref message) => {
                tracing::error!("Internal error: {}", message);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
            AppError::Http(ref e) => {
                tracing::error!("HTTP request error: {}", e);
                (StatusCode::BAD_GATEWAY, "HTTP request failed")
            }
            AppError::Crypto(ref message) => {
                tracing::error!("Crypto error: {}", message);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Cryptographic operation failed",
                )
            }
            AppError::Forbidden(ref message) => {
                tracing::warn!("Forbidden access: {}", message);
                (StatusCode::FORBIDDEN, message.as_str())
            }
        };

        let body = Json(json!({
            "error": error_message,
            "message": self.to_string()
        }));

        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
