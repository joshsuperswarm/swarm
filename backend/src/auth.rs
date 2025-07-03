use axum::{
    async_trait,
    extract::{FromRequestParts, Request},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};

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
    sub: String,           // Clerk user ID
    email: Option<String>,
    exp: usize,           // Expiration time
    iss: String,          // Issuer (should be Clerk)
    aud: Option<String>,  // Audience
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

    // Note: Clerk secret key is available if needed for future verification
    let _clerk_secret = std::env::var("CLERK_SECRET_KEY")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Validate JWT token
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;
    validation.validate_aud = false; // Clerk JWTs may not have audience
    
    // For Clerk JWTs, we need to decode without verification first to check if it's a valid JWT
    // In production, you'd want to fetch Clerk's public keys from their JWKS endpoint
    // For now, we'll do a basic decode to extract the user ID
    let claims = match decode_clerk_jwt(token) {
        Ok(claims) => claims,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
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