use anyhow::Result;
use reqwest::Client;
use serde_json::json;

/// Generate a concise task title (≤ 80 chars) with Claude Sonnet 4.
pub async fn generate_title(desc: &str, api_key: &str) -> Result<String> {
    let user_content = format!("Return a concise, human-readable task title (≤ 80 characters) for this task description: {}", desc);

    let body = json!({
        // rolling alias; replace with a pinned snapshot if you prefer
        "model": "claude-sonnet-4-0",
        "max_tokens": 16,
        "temperature": 0.2,
        "messages": [ { "role": "user", "content": user_content } ]
    });

    let resp = Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?
        .error_for_status()? // surface 4xx / 5xx
        .json::<serde_json::Value>()
        .await?;

    Ok(resp["content"][0]["text"]
        .as_str()
        .unwrap_or("Untitled task")
        .trim()
        .to_owned())
}
