use axum::{
    async_trait,
    extract::{FromRequestParts, Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use base64::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClerkUser {
    pub id: String,
    pub email: Option<String>,
    // Add other fields as needed
}

#[derive(Deserialize)]
pub struct GitHubTokenBody {
    pub access_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClerkClaims {
    sub: String,
    email: Option<String>,
    exp: usize,
}

pub async fn clerk_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip authentication for health endpoint
    if req.uri().path() == "/health" {
        return Ok(next.run(req).await);
    }

    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(token) => token,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // For development: create a mock user from token
    // In production, this would validate the JWT against Clerk
    let user = ClerkUser {
        id: format!("user_{}", base64::prelude::BASE64_STANDARD.encode(token.chars().take(10).collect::<String>()).chars().take(8).collect::<String>()),
        email: Some("dev@example.com".to_string()),
    };

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

// Extract CurrentUser from request
pub struct CurrentUser(pub ClerkUser);

#[async_trait]
impl<S> FromRequestParts<S> for CurrentUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<ClerkUser>()
            .cloned()
            .map(CurrentUser)
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}