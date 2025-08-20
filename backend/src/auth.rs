use crate::database::Database;
use crate::AppState;
use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
use axum::{
    async_trait,
    extract::{FromRequestParts, Request, State},
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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClerkClaims {
    sub: String, // Clerk user ID
    email: Option<String>,
    exp: usize,          // Expiration time
    iss: String,         // Issuer (should be Clerk)
    aud: Option<String>, // Audience
}

fn looks_like_api_key(token: &str) -> bool {
    token.starts_with("sk_live.") || token.starts_with("sk_test.")
}

async fn try_api_key_auth(token: &str, db: &Database) -> Result<ClerkUser, StatusCode> {
    // Format: sk_live.<token_id>.<secret>
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let _prefix = parts[0];
    let token_id = parts[1];

    let rec = db
        .get_api_token_by_id(token_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(rec) = rec else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Check not revoked/expired
    if rec.revoked_at.is_some()
        || rec
            .expires_at
            .map(|e| e < chrono::Utc::now())
            .unwrap_or(false)
    {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Verify Argon2id of full token
    let parsed =
        PasswordHash::new(&rec.token_hash).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if Argon2::default()
        .verify_password(token.as_bytes(), &parsed)
        .is_err()
    {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Touch last_used_at in the background
    let db_clone = db.clone();
    let token_id_owned = rec.token_id.clone();
    tokio::spawn(async move {
        let _ = db_clone.touch_api_token_last_used(&token_id_owned).await;
    });

    // Map to ClerkUser (existing shape)
    let user = db
        .get_user_by_id(rec.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    Ok(ClerkUser {
        id: user.clerk_user_id,
        email: user.email,
    })
}

pub async fn auth_middleware(
    State(app): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if req.uri().path() == "/health" {
        return Ok(next.run(req).await);
    }

    // Prefer Authorization: Bearer ...; allow X-API-Key as well.
    let token = req
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
        .or_else(|| {
            req.headers()
                .get("x-api-key")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string())
        })
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Path 1: API key
    if looks_like_api_key(&token) {
        let user = try_api_key_auth(&token, &app.database).await?;
        req.extensions_mut().insert(user);
        return Ok(next.run(req).await);
    }

    // Path 2: existing Clerk JWT
    let claims = decode_clerk_jwt(&token).map_err(|_| StatusCode::UNAUTHORIZED)?;
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
