use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use reqwest::{Client, StatusCode};
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

static HTTP: Lazy<Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("reqwest client")
});

fn is_retryable_status(s: StatusCode) -> bool {
    // 429 and any 5xx (includes vendor codes like 529)
    s == StatusCode::TOO_MANY_REQUESTS || (s.as_u16() >= 500 && s.as_u16() <= 599)
}

fn retry_after_delay(resp: &reqwest::Response) -> Option<Duration> {
    if let Some(v) = resp.headers().get(reqwest::header::RETRY_AFTER) {
        if let Ok(s) = v.to_str() {
            if let Ok(secs) = s.parse::<u64>() {
                return Some(
                    Duration::from_secs(secs)
                        .clamp(Duration::from_millis(500), Duration::from_secs(5)),
                );
            }
        }
    }
    None
}

async fn anthropic_post_with_retry(
    api_key: &str,
    body: serde_json::Value,
) -> Result<serde_json::Value> {
    let url = "https://api.anthropic.com/v1/messages";
    let mut delay = Duration::from_millis(500);

    // 3 attempts total
    for attempt in 1..=3 {
        let resp = HTTP
            .post(url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                return r
                    .json::<serde_json::Value>()
                    .await
                    .context("parse anthropic json");
            }
            Ok(r) => {
                let status = r.status();
                let wait = retry_after_delay(&r).unwrap_or(delay);
                let text = r.text().await.unwrap_or_default();

                if attempt == 3 || !is_retryable_status(status) {
                    anyhow::bail!("Anthropic HTTP {}: {}", status, text);
                }

                sleep(wait).await;
                delay = (delay * 2).min(Duration::from_secs(2));
            }
            Err(e) => {
                // Network-ish errors retry; others fail fast
                let retryable = e.is_timeout() || e.is_connect() || e.is_request();
                if attempt == 3 || !retryable {
                    return Err(e).context("Anthropic request error");
                }
                sleep(delay).await;
                delay = (delay * 2).min(Duration::from_secs(2));
            }
        }
    }

    unreachable!()
}

/// Generate a concise task title (≤ 80 chars) with Claude Sonnet 4.
pub async fn generate_title(desc: &str, api_key: &str) -> Result<String> {
    let user_content = format!(
        "Return a concise, human-readable task title (≤ 80 characters) for this task description: {}",
        desc
    );

    let body = json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 16,
        "temperature": 0.2,
        "messages": [ { "role": "user", "content": user_content } ]
    });

    let resp = anthropic_post_with_retry(api_key, body).await?;
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
    // Truncate to 20k chars to stay within token limits
    let truncated_md = if final_md.len() > 20_000 {
        &final_md[final_md.len() - 20_000..]
    } else {
        final_md
    };

    // Title
    let title_body = json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 50,
        "temperature": 0.2,
        "messages": [{
            "role": "user",
            "content": format!(
                "From this agent transcript / result, create a concise GitHub PR title (≤ 72 characters, imperative mood, no trailing period). \
                 Do not include any other text or explanation.\n\n<AGENT_FINAL_MESSAGE>\n{}\n</AGENT_FINAL_MESSAGE>",
                truncated_md
            )
        }]
    });
    let title_json = anthropic_post_with_retry(api_key, title_body).await?;
    let pr_title = title_json["content"][0]["text"]
        .as_str()
        .unwrap_or("Improvements")
        .trim()
        .chars()
        .take(72)
        .collect::<String>();

    // Body
    let body_body = json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 800,
        "temperature": 0.2,
        "messages": [{
            "role": "user",
            "content": format!(
                "From this agent transcript / result, create a GitHub PR body in Markdown format. \
                 Start with a one-paragraph summary, then bullet-point the key changes, and include risks/testing if available. \
                 Do not include a title. Just return the PR body.\n\n<AGENT_FINAL_MESSAGE>\n{}\n</AGENT_FINAL_MESSAGE>",
                truncated_md
            )
        }]
    });
    let body_json = anthropic_post_with_retry(api_key, body_body).await?;
    let pr_body = body_json["content"][0]["text"]
        .as_str()
        .unwrap_or("Automated changes by Swarm agent.")
        .trim()
        .to_owned();

    Ok((pr_title, pr_body))
}
