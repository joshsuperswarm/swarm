use anyhow::Result;
use reqwest::Client;
use serde_json::json;

/// Generate a concise task title (≤ 80 chars) with Claude Sonnet 4.
pub async fn generate_title(desc: &str, api_key: &str) -> Result<String> {
    let user_content = format!("Return a concise, human-readable task title (≤ 80 characters) for this task description: {}", desc);

    let body = json!({
        // rolling alias; replace with a pinned snapshot if you prefer
        "model": "claude-sonnet-4-20250514",
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

/// Given the final agent message (markdown or plain text),
/// call Claude twice: once to produce a PR title, once for the PR body.
pub async fn synthesize_pr_from_agent_output(
    final_md: &str,
    api_key: &str,
) -> Result<(String, String)> {
    use reqwest::Client;
    use serde_json::json;

    // Truncate to 20k chars to stay within token limits
    let truncated_md = if final_md.len() > 20_000 {
        &final_md[final_md.len() - 20_000..]
    } else {
        final_md
    };

    let client = Client::new();

    // --- First call: PR Title ---
    let title_prompt = format!(
        "From this agent transcript / result, create a concise GitHub PR title (≤ 72 characters, imperative mood, no trailing period). \
         Do not include any other text or explanation.\n\n<AGENT_FINAL_MESSAGE>\n{}\n</AGENT_FINAL_MESSAGE>",
        truncated_md
    );

    let title_resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 50,
            "temperature": 0.2,
            "messages": [ { "role": "user", "content": title_prompt } ]
        }))
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;

    let pr_title = title_resp["content"][0]["text"]
        .as_str()
        .unwrap_or("Improvements")
        .trim()
        .chars()
        .take(72)
        .collect::<String>();

    // --- Second call: PR Body ---
    let body_prompt = format!(
        "From this agent transcript / result, create a GitHub PR body in Markdown format. \
         Start with a one-paragraph summary, then bullet-point the key changes, and include risks/testing if available. \
         Do not include a title. Just return the PR body.\n\n<AGENT_FINAL_MESSAGE>\n{}\n</AGENT_FINAL_MESSAGE>",
        truncated_md
    );

    let body_resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 800,
            "temperature": 0.2,
            "messages": [ { "role": "user", "content": body_prompt } ]
        }))
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;

    let pr_body = body_resp["content"][0]["text"]
        .as_str()
        .unwrap_or("Automated changes by Swarm agent.")
        .trim()
        .to_owned();

    Ok((pr_title, pr_body))
}
