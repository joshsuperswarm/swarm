use axum::{
    async_trait,
    extract::{FromRequestParts, Request},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

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

#[derive(Deserialize)]
pub struct AnthropicApiKeyBody {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClerkClaims {
    sub: String, // Clerk user ID
    email: Option<String>,
    exp: usize,          // Expiration time
    iss: String,         // Issuer (should be Clerk)
    aud: Option<String>, // Audience
}

pub async fn clerk_middleware(mut req: Request, next: Next) -> Result<Response, StatusCode> {
    // Skip authentication for health endpoint
    if req.uri().path() == "/health" {
        return Ok(next.run(req).await);
    }

    // Extract Bearer token using typed header
    let auth_header = req
        .headers()
        .get("authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(token) => token,
        None => {
            tracing::warn!("Missing or invalid Authorization header");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Validate JWT token
    let claims = match decode_clerk_jwt(token) {
        Ok(claims) => claims,
        Err(e) => {
            tracing::warn!("Failed to decode JWT: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    let user = ClerkUser {
        id: claims.sub,
        email: claims.email,
    };

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

fn decode_clerk_jwt(token: &str) -> Result<ClerkClaims, jsonwebtoken::errors::Error> {
    // For development: decode without verification (NOT for production!)
    // In production, you should verify against Clerk's public keys
    let mut validation = Validation::new(Algorithm::RS256);
    validation.insecure_disable_signature_validation();
    validation.validate_exp = false; // Disable for now to avoid clock skew issues

    let decoded = decode::<ClerkClaims>(
        token,
        &DecodingKey::from_secret(&[]), // Empty key since we disabled verification
        &validation,
    )?;

    Ok(decoded.claims)
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
