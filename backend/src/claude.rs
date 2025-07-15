use anyhow::Result;
use reqwest::Client;
use serde_json::json;

/// Generate a concise task title (≤ 80 chars) with Claude Sonnet 4.
pub async fn generate_title(desc: &str, api_key: &str) -> Result<String> {
    let body = json!({
        // rolling alias; replace with a pinned snapshot if you prefer
        "model": "claude-sonnet-4-0",
        "max_tokens": 16,
        "temperature": 0.2,
        "system": "Return a concise, human-readable task title (≤ 80 characters).",
        "messages": [ { "role": "user", "content": desc } ]
    });

    let resp = Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .bearer_auth(api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?
        .error_for_status()?               // surface 4xx / 5xx
        .json::<serde_json::Value>()
        .await?;

    Ok(resp["content"][0]["text"]
        .as_str()
        .unwrap_or("Untitled task")
        .trim()
        .to_owned())
}