use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Validation, Algorithm};
use serde::{Deserialize, Serialize};
use crate::{AppState, models::{CreateUser, CreateGitHubToken}};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClerkClaims {
    pub sub: String,  // User ID
    pub email: Option<String>,
    pub exp: usize,
    pub iss: String,
    pub aud: String,
    pub username: Option<String>,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub picture: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub clerk_user_id: String,
    pub email: Option<String>,
    pub username: Option<String>,
    pub user_id: i32,
}

#[derive(Clone)]
pub struct ClerkKeys {
    #[allow(dead_code)]
    pub keys: Vec<ClerkKey>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ClerkKey {
    pub kid: String,
    pub kty: String,
    pub n: String,
    pub e: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct ClerkJWKS {
    keys: Vec<ClerkKey>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ClerkOAuthToken {
    pub provider: String,
    pub token: String,
    pub provider_user_id: String,
    pub public_metadata: serde_json::Value,
    pub label: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct ClerkOAuthResponse {
    pub data: Vec<ClerkOAuthToken>,
}

pub async fn fetch_clerk_jwks() -> Result<ClerkKeys, Box<dyn std::error::Error + Send + Sync>> {
    let response = reqwest::get("https://api.clerk.com/v1/jwks")
        .await?
        .json::<ClerkJWKS>()
        .await?;
    
    Ok(ClerkKeys { keys: response.keys })
}

pub async fn fetch_github_token_from_clerk(clerk_user_id: &str) -> Result<Option<String>, Box<dyn std::error::Error + Send + Sync>> {
    let clerk_secret = env::var("CLERK_SECRET_KEY")?;
    
    let client = reqwest::Client::new();
    let url = format!("https://api.clerk.com/v1/users/{}/oauth_access_tokens/oauth_github", clerk_user_id);
    
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", clerk_secret))
        .header("Content-Type", "application/json")
        .send()
        .await?;

    if response.status().is_success() {
        let oauth_response: ClerkOAuthResponse = response.json().await?;
        
        // Find GitHub token
        for token_data in oauth_response.data {
            if token_data.provider == "oauth_github" {
                return Ok(Some(token_data.token));
            }
        }
    }
    
    Ok(None)
}

pub async fn clerk_auth_middleware(
    State(app_state): State<AppState>,
    headers: HeaderMap,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(token) => token,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // For development, we'll implement a simplified JWT parsing
    // In production, you'd want to properly verify the JWT with Clerk's public keys
    let _validation = Validation::new(Algorithm::RS256);
    
    // Extract claims from token (simplified for development)
    let clerk_user_id = if token.starts_with("clerk_") || !token.is_empty() {
        // For development, we'll create a mock user ID from the token
        // In production, you'd extract this from the verified JWT
        format!("user_{}", token.chars().take(8).collect::<String>())
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Create or get user from database
    let user = match get_or_create_user(&app_state.database, &clerk_user_id).await {
        Ok(user) => user,
        Err(e) => {
            println!("Error getting/creating user: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Add authenticated user to request extensions
    let auth_user = AuthenticatedUser {
        clerk_user_id: user.clerk_user_id.clone(),
        email: user.email.clone(),
        username: user.github_username.clone(),
        user_id: user.id,
    };

    req.extensions_mut().insert(auth_user);
    
    Ok(next.run(req).await)
}

async fn get_or_create_user(
    database: &crate::database_working::Database,
    clerk_user_id: &str,
) -> Result<crate::models::User, sqlx::Error> {
    // Try to get existing user
    if let Some(user) = database.get_user_by_clerk_id(clerk_user_id).await? {
        // Check if we need to fetch GitHub token for existing user
        if database.get_github_token(user.id).await.unwrap_or(None).is_none() {
            // Try to fetch and store GitHub token
            if let Ok(Some(github_token)) = fetch_github_token_from_clerk(clerk_user_id).await {
                let create_token = CreateGitHubToken {
                    user_id: user.id,
                    access_token: github_token,
                    token_type: "bearer".to_string(),
                    scope: Some("repo,user".to_string()),
                };
                
                // Store token (ignore errors for now)
                let _ = database.store_github_token(create_token).await;
            }
        }
        
        return Ok(user);
    }

    // Create new user if doesn't exist
    let create_user = CreateUser {
        clerk_user_id: clerk_user_id.to_string(),
        github_username: None,
        github_user_id: None,
        email: None,
    };

    let user = database.create_user(create_user).await?;
    
    // Try to fetch and store GitHub token for new user
    if let Ok(Some(github_token)) = fetch_github_token_from_clerk(clerk_user_id).await {
        let create_token = CreateGitHubToken {
            user_id: user.id,
            access_token: github_token,
            token_type: "bearer".to_string(),
            scope: Some("repo,user".to_string()),
        };
        
        // Store token (ignore errors for now)
        let _ = database.store_github_token(create_token).await;
    }
    
    Ok(user)
}