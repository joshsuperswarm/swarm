use reqwest::Client;
use serde::Deserialize;

/// Response body for Clerk's *Retrieve OAuth access token* endpoint
#[derive(Debug, Deserialize)]
pub struct ClerkTokenResponse {
    pub object: String,
    pub external_account_id: String,
    pub provider_user_id: String,
    pub token: String,
    pub expires_at: Option<String>,
    pub provider: String,
    pub scopes: Vec<String>,
}

/// Fetch the GitHub PAT for a Clerk user.
///
/// Clerk dashboard requirements (already handled outside code):
///   • GitHub connection enabled  
///   • "Store OAuth tokens" checked  
///   • Scopes include at least `repo` & `user:email`
pub async fn fetch_github_token(
    clerk_user_id: &str,
    clerk_secret: &str,
) -> Result<String, reqwest::Error> {
    let url = format!(
        "https://api.clerk.com/v1/users/{}/oauth_access_tokens/oauth_github",
        clerk_user_id
    );

    tracing::debug!("🔍 Calling Clerk API: {}", url);
    tracing::debug!("🔍 User ID: {}", clerk_user_id);

    let response = Client::new()
        .get(&url)
        .bearer_auth(clerk_secret)
        .send()
        .await?;

    tracing::debug!("🔍 Clerk API response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        tracing::error!("🔍 Clerk API error body: {}", error_text);
        // Convert to a reqwest error by creating a fake response and calling error_for_status
        let fake_response =
            reqwest::Response::from(http::Response::builder().status(status).body("").unwrap());
        return Err(fake_response.error_for_status().unwrap_err());
    }

    // Debug: log the raw response body
    let response_text = response.text().await?;
    tracing::debug!("🔍 Clerk API raw response: {}", response_text);

    let tokens: Vec<ClerkTokenResponse> = serde_json::from_str(&response_text).map_err(|e| {
        tracing::error!("🔍 JSON parse error: {}", e);
        // Create a proper reqwest error
        let fake_response =
            reqwest::Response::from(http::Response::builder().status(422).body("").unwrap());
        fake_response.error_for_status().unwrap_err()
    })?;

    // Get the GitHub token from the array
    let github_token = tokens
        .into_iter()
        .find(|t| t.provider == "oauth_github")
        .ok_or_else(|| {
            tracing::error!("🔍 No GitHub token found in response");
            let fake_response =
                reqwest::Response::from(http::Response::builder().status(404).body("").unwrap());
            fake_response.error_for_status().unwrap_err()
        })?;

    tracing::debug!(
        "🔍 Found GitHub token with scopes: {:?}",
        github_token.scopes
    );
    Ok(github_token.token)
}
