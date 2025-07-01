use axum::{
    http::StatusCode,
    middleware,
    response::Json,
    routing::get,
    Router,
};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
use std::env;

mod clerk_middleware;
use clerk_middleware::{clerk_auth_middleware, fetch_clerk_jwks};

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::init();
    
    // Get port from environment or default to 3001
    let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    
    // Fetch Clerk JWKS (in production, you'd cache this and refresh periodically)
    let clerk_keys = fetch_clerk_jwks().await.unwrap_or_else(|_| {
        println!("Warning: Could not fetch Clerk JWKS, using development mode");
        clerk_middleware::ClerkKeys { keys: vec![] }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/protected", get(protected_endpoint))
        .layer(middleware::from_fn_with_state(
            clerk_keys.clone(),
            clerk_auth_middleware,
        ))
        .with_state(clerk_keys)
        .layer(cors);

    let bind_address = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&bind_address).await.unwrap();
    println!("Server running on {}", bind_address);
    
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({
        "status": "ok",
        "message": "Backend is running with authentication!",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

async fn protected_endpoint() -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({
        "message": "This is a protected endpoint - you are authenticated!",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}
