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

/// Given the final agent message (markdown or plain text),
/// ask Claude to produce a clean PR title (≤72 chars) and a detailed PR body (Markdown).
pub async fn synthesize_pr_from_agent_output(
    final_md: &str,
    api_key: &str
) -> Result<(String, String)> {
    let system = r#"You are a senior engineer preparing a GitHub Pull Request.
Return:
- Title: ≤ 72 characters, imperative mood, no trailing period.
- Body: Markdown with a one-paragraph summary, then bullet-point key changes; include risks/testing if given.
If information is missing, infer minimally and be honest about assumptions."#;

    // Truncate to 20k chars if too long to stay within API limits
    let truncated_md = if final_md.len() > 20000 {
        &final_md[final_md.len() - 20000..]
    } else {
        final_md
    };

    let user = format!(r#"
From this agent transcript / result, create a PR title and body.

<AGENT_FINAL_MESSAGE>
{}
</AGENT_FINAL_MESSAGE>

Return ONLY JSON like:
{{"title": "...", "body": "..."}} 
"#, truncated_md);

    let body = json!({
        "model": "claude-sonnet-4-0",
        "max_tokens": 800,
        "temperature": 0.2,
        "system": system,
        "messages": [ { "role": "user", "content": user } ]
    });

    let resp = Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;

    let text = resp["content"][0]["text"].as_str().unwrap_or("{}");
    let parsed: serde_json::Value = serde_json::from_str(text).unwrap_or_else(|_| serde_json::json!({}));

    let title = parsed.get("title").and_then(|v| v.as_str()).unwrap_or("Improvements").trim();
    let body = parsed.get("body").and_then(|v| v.as_str()).unwrap_or("Automated changes by Swarm agent.").trim();

    // Ensure title is ≤72 chars
    let title = if title.len() > 72 {
        &title[..72]
    } else {
        title
    };

    Ok((title.to_owned(), body.to_owned()))
}
