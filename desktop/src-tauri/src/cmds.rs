use crate::config::{load_config, save_config};
use crate::repo::{FileMeta, RepoManager, RepoSummary};
use crate::tokens::{count_tokens_for_files, count_tokens_for_text_blobs, TokenReport};
use eventsource_stream::Eventsource;
use futures::StreamExt;
use lazy_static::lazy_static;
use log::{debug, error, info};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

lazy_static! {
    static ref REPO_MANAGER: Arc<RwLock<Option<RepoManager>>> = Arc::new(RwLock::new(None));
    static ref STREAM_CANCELS: Arc<Mutex<HashMap<String, CancellationToken>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAttachment {
    pub data: String, // base64 data URL
    #[serde(rename = "type")]
    pub image_type: String, // MIME type
    pub name: String, // file name
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<ImageAttachment>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamToken {
    pub request_id: String,
    pub conversation_id: String,
    pub delta: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamDone {
    pub request_id: String,
    pub conversation_id: String,
    pub finish_reason: Option<String>,
    pub canceled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatPayload {
    pub request_id: String,
    pub conversation_id: String,
    pub payload: serde_json::Value,
}

// Map ChatMsg to Responses API input format
fn to_responses_input(messages: &[ChatMsg]) -> serde_json::Value {
    let items: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            let content_type = match m.role.as_str() {
                "assistant" => "output_text",
                "system" => "input_text", // System messages are input_text
                _ => "input_text",
            };

            let mut content = vec![serde_json::json!({
                "type": content_type,
                "text": m.content
            })];

            // Add images if present
            if let Some(images) = &m.images {
                for img in images {
                    content.push(serde_json::json!({
                        "type": "input_image",
                        "image_url": img.data
                    }));
                }
            }

            serde_json::json!({
                "role": m.role,
                "content": content
            })
        })
        .collect();

    serde_json::Value::Array(items)
}

#[tauri::command]
pub async fn repo_open(app: AppHandle) -> Result<RepoSummary, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .set_directory(".")
        .blocking_pick_folder();

    match file_path {
        Some(path) => {
            let path_str = path.to_string();
            let repo = RepoManager::new(&path_str).map_err(|e| e.to_string())?;
            let summary = repo.get_summary();

            let mut manager = REPO_MANAGER.write().await;
            *manager = Some(repo);

            let mut config = load_config().map_err(|e| e.to_string())?;
            config.last_root = Some(path_str);
            config.selected_files = Vec::new(); // Clear selected files when opening new repo
            save_config(&config).map_err(|e| e.to_string())?;

            Ok(summary)
        }
        None => Err("No folder selected".to_string()),
    }
}

#[tauri::command]
pub async fn repo_recent() -> Result<Option<RepoSummary>, String> {
    let config = load_config().map_err(|e| e.to_string())?;

    if let Some(path) = config.last_root {
        let repo = RepoManager::new(&path).map_err(|e| e.to_string())?;
        let summary = repo.get_summary();

        let mut manager = REPO_MANAGER.write().await;
        *manager = Some(repo);

        Ok(Some(summary))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn repo_list_files() -> Result<Vec<FileMeta>, String> {
    let manager = REPO_MANAGER.read().await;

    match &*manager {
        Some(repo) => repo.list_files().map_err(|e| e.to_string()),
        None => Err("No repository opened".to_string()),
    }
}

#[tauri::command]
pub async fn repo_read_file(relpath: String) -> Result<String, String> {
    let manager = REPO_MANAGER.read().await;

    match &*manager {
        Some(repo) => repo.read_file(&relpath).map_err(|e| e.to_string()),
        None => Err("No repository opened".to_string()),
    }
}

#[tauri::command]
pub async fn repo_read_files_bulk(
    relpaths: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    let manager = REPO_MANAGER.read().await;
    match &*manager {
        Some(repo) => {
            let mut out = HashMap::new();
            for rel in relpaths {
                if let Ok(content) = repo.read_file(&rel) {
                    out.insert(rel, content);
                }
            }
            Ok(out)
        }
        None => Err("No repository opened".to_string()),
    }
}

#[tauri::command]
pub async fn repo_count_tokens(relpaths: Vec<String>) -> Result<TokenReport, String> {
    info!("Counting tokens for {} files", relpaths.len());
    let manager = REPO_MANAGER.read().await;

    match &*manager {
        Some(repo) => {
            let result = count_tokens_for_files(repo, relpaths).await.map_err(|e| {
                error!("Failed to count tokens: {}", e);
                e.to_string()
            });
            if let Ok(ref report) = result {
                info!("Token count complete: {} total tokens", report.total_tokens);
            }
            result
        }
        None => {
            error!("No repository opened when trying to count tokens");
            Err("No repository opened".to_string())
        }
    }
}

#[tauri::command]
pub async fn chat_stream_start(
    app: AppHandle,
    conversation_id: String,
    messages: Vec<ChatMsg>,
    reasoning_effort: Option<String>,
) -> Result<String, String> {
    info!("Starting chat stream with {} messages", messages.len());
    for (i, msg) in messages.iter().enumerate() {
        debug!(
            "Message {}: role={}, content_len={}",
            i,
            msg.role,
            msg.content.len()
        );
    }
    let request_id = Uuid::new_v4().to_string();
    info!("Request ID: {}", request_id);
    let cancel_token = CancellationToken::new();

    {
        let mut cancels = STREAM_CANCELS.lock().await;
        // Do not cancel all existing streams, allow concurrent streaming
        cancels.insert(request_id.clone(), cancel_token.clone());
    }

    let config = load_config().map_err(|e| e.to_string())?;
    let api_key = config.openai_api_key.ok_or_else(|| {
        error!("OpenAI API key not configured");
        "OpenAI API key not configured".to_string()
    })?;
    // Trim the API key to remove any whitespace or newlines
    let api_key = api_key.trim().to_string();
    debug!(
        "API key length: {}, starts with: {}, ends with: {}",
        api_key.len(),
        &api_key[..5.min(api_key.len())],
        &api_key[api_key.len().saturating_sub(5)..]
    );

    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-5".to_string());
    info!("Using model: {}", model);

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    let mut headers = HeaderMap::new();
    let auth_header = format!("Bearer {}", api_key);
    debug!("Auth header length: {}", auth_header.len());

    // Check for common issues with the API key
    if api_key.contains('\n') || api_key.contains('\r') {
        error!("API key contains newline characters");
        return Err(
            "API key contains newline characters - please check your API key configuration"
                .to_string(),
        );
    }

    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_header).map_err(|e| {
            error!(
                "Failed to create auth header: {} (key might contain invalid characters)",
                e
            );
            format!(
                "Invalid API key format: {} (check for special characters or newlines)",
                e
            )
        })?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let mut body = serde_json::json!({
        "model": model,
        "input": to_responses_input(&messages),
        "stream": true
    });

    // Add tools conditionally based on reasoning effort
    if let Some(ref eff) = reasoning_effort {
        if eff != "minimal" {
            body["tools"] = serde_json::json!([{ "type": "web_search" }]);
        }
        body["reasoning"] = serde_json::json!({"effort": eff});
    } else {
        // Default case - include tools when no reasoning effort specified
        body["tools"] = serde_json::json!([{ "type": "web_search" }]);
    }
    debug!(
        "Request body: {}",
        serde_json::to_string_pretty(&body).unwrap()
    );

    let req_id_clone = request_id.clone();
    let conv_id_clone = conversation_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        info!("Spawned streaming task for request {}", req_id_clone);
        let mut retry_count = 0;
        let max_retries = 4;

        loop {
            info!("Attempting stream (retry {})", retry_count);
            match stream_with_retry(
                &client,
                &headers,
                &body,
                &app_clone,
                &req_id_clone,
                &conv_id_clone,
                cancel_token.clone(),
            )
            .await
            {
                Ok(_) => {
                    info!("Stream completed successfully for request {}", req_id_clone);
                    break;
                }
                Err(e) => {
                    error!("Stream error for request {}: {}", req_id_clone, e);
                    if retry_count >= max_retries {
                        let _ = app_clone.emit(
                            "chat_done",
                            StreamDone {
                                request_id: req_id_clone.clone(),
                                conversation_id: conv_id_clone.clone(),
                                finish_reason: Some(format!("error: {}", e)),
                                canceled: false,
                            },
                        );
                        break;
                    }
                    retry_count += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(
                        500 * (1 << retry_count),
                    ))
                    .await;
                }
            }
        }

        let mut cancels = STREAM_CANCELS.lock().await;
        cancels.remove(&req_id_clone);
    });

    Ok(request_id)
}

async fn stream_with_retry(
    client: &reqwest::Client,
    headers: &HeaderMap,
    body: &serde_json::Value,
    app: &AppHandle,
    request_id: &str,
    conversation_id: &str,
    cancel_token: CancellationToken,
) -> Result<(), String> {
    // Log the size of the request
    let body_str = body.to_string();
    info!(
        "Request body size: {} bytes, {} chars",
        body_str.len(),
        body_str.chars().count()
    );

    // Log estimated token count (rough estimate: ~4 chars per token)
    if let Some(input) = body["input"].as_array() {
        let total_chars: usize = input
            .iter()
            .filter_map(|item| {
                item["content"]
                    .as_array()
                    .and_then(|content| content.get(0))
                    .and_then(|text_obj| text_obj["text"].as_str())
            })
            .map(|c| c.len())
            .sum();
        info!(
            "Total input content: {} chars, ~{} tokens (estimate)",
            total_chars,
            total_chars / 4
        );
    }

    let start_time = std::time::Instant::now();
    info!(
        "Sending request to OpenAI API for request {} at {:?}",
        request_id, start_time
    );

    let response = client
        .post("https://api.openai.com/v1/responses")
        .headers(headers.clone())
        .json(body)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to send request: {}", e);
            e.to_string()
        })?;

    let headers_time = start_time.elapsed();
    info!(
        "Got response headers after {:.2}s with status: {}",
        headers_time.as_secs_f32(),
        response.status()
    );

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        error!("API error {}: {}", status, text);
        return Err(format!("API error {}: {}", status, text));
    }

    let mut stream = response.bytes_stream().eventsource();
    let first_byte_time = start_time.elapsed();
    info!(
        "Started streaming response for request {} after {:.2}s total",
        request_id,
        first_byte_time.as_secs_f32()
    );
    let mut token_count = 0;
    let mut first_token_time: Option<std::time::Duration> = None;

    while let Some(event) = tokio::select! {
        event = stream.next() => event,
        _ = cancel_token.cancelled() => {
            let _ = app.emit("chat_done", StreamDone {
                request_id: request_id.to_string(),
                conversation_id: conversation_id.to_string(),
                finish_reason: None,
                canceled: true,
            });
            return Ok(());
        }
    } {
        match event {
            Ok(event) => {
                let eventsource_stream::Event { data, .. } = event;

                // Responses API does NOT use "[DONE]"; it ends with a "response.completed" event.
                // Each line of `data` is a JSON object with a "type" discriminator.
                let parsed: serde_json::Value = match serde_json::from_str(&data) {
                    Ok(v) => v,
                    Err(_) => {
                        // Some providers send keep-alives or non-JSON comments; ignore them.
                        continue;
                    }
                };

                let etype = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");

                match etype {
                    // This carries the streamed text chunks
                    "response.output_text.delta" => {
                        if let Some(delta) = parsed.get("delta").and_then(|d| d.as_str()) {
                            token_count += 1;
                            if first_token_time.is_none() {
                                first_token_time = Some(start_time.elapsed());
                                info!(
                                    "First token received after {:.2}s for request {}",
                                    first_token_time.unwrap().as_secs_f32(),
                                    request_id
                                );
                            }
                            let _ = app.emit(
                                "chat_token",
                                StreamToken {
                                    request_id: request_id.to_string(),
                                    conversation_id: conversation_id.to_string(),
                                    delta: delta.to_string(),
                                },
                            );
                        }
                    }

                    // Useful to ignore; marks end of a text block
                    "response.output_text.done" => {
                        // no-op
                    }

                    // Final event for the whole response
                    "response.completed" => {
                        let finish = parsed
                            .get("response")
                            .and_then(|r| r.get("status"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("completed");

                        // Emit full response payload so the UI can parse citations.
                        let full = parsed
                            .get("response")
                            .cloned()
                            .unwrap_or(serde_json::json!({}));
                        let _ = app.emit(
                            "chat_payload",
                            ChatPayload {
                                request_id: request_id.to_string(),
                                conversation_id: conversation_id.to_string(),
                                payload: full,
                            },
                        );

                        info!(
                            "Received response.completed signal for request {}, total tokens: {}",
                            request_id, token_count
                        );

                        let _ = app.emit(
                            "chat_done",
                            StreamDone {
                                request_id: request_id.to_string(),
                                conversation_id: conversation_id.to_string(),
                                finish_reason: Some(finish.to_string()),
                                canceled: false,
                            },
                        );
                        break;
                    }

                    // Surface API-side errors mid-stream
                    "response.error" => {
                        let msg = parsed
                            .get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .unwrap_or("unknown error");
                        error!("Responses API error: {}", msg);

                        let _ = app.emit(
                            "chat_done",
                            StreamDone {
                                request_id: request_id.to_string(),
                                conversation_id: conversation_id.to_string(),
                                finish_reason: Some(format!("error: {}", msg)),
                                canceled: false,
                            },
                        );
                        break;
                    }

                    // Other events you might see; safe to ignore for basic text streaming:
                    // "response.created", "response.in_progress", "response.refusal.delta", etc.
                    _ => { /* ignore */ }
                }
            }
            Err(e) => return Err(format!("Stream error: {}", e)),
        }
    }

    let total_time = start_time.elapsed();
    info!(
        "Stream completed for request {} - Total time: {:.2}s, Tokens: {}",
        request_id,
        total_time.as_secs_f32(),
        token_count
    );

    Ok(())
}

#[tauri::command]
pub async fn save_selected_files(files: Vec<String>) -> Result<(), String> {
    let mut config = load_config().map_err(|e| e.to_string())?;
    config.selected_files = files;
    save_config(&config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_selected_files() -> Result<Vec<String>, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    Ok(config.selected_files)
}

#[tauri::command]
pub async fn save_selected_folders(folders: Vec<String>) -> Result<(), String> {
    let mut config = load_config().map_err(|e| e.to_string())?;
    config.selected_folders = folders;
    save_config(&config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_selected_folders() -> Result<Vec<String>, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    Ok(config.selected_folders)
}

#[tauri::command]
pub async fn chat_stream_cancel(request_id: String) -> Result<(), String> {
    let mut cancels = STREAM_CANCELS.lock().await;
    if let Some(token) = cancels.remove(&request_id) {
        token.cancel();
        Ok(())
    } else {
        Err("Request not found".to_string())
    }
}

#[tauri::command]
pub async fn set_openai_api_key(api_key: String) -> Result<(), String> {
    let mut config = load_config().map_err(|e| e.to_string())?;
    config.openai_api_key = Some(api_key);
    save_config(&config).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_openai_api_key() -> Result<Option<String>, String> {
    let config = load_config().map_err(|e| e.to_string())?;
    Ok(config.openai_api_key)
}

#[tauri::command]
pub async fn gen_chat_title(messages: Vec<ChatMsg>) -> Result<String, String> {
    info!(
        "Generating title for conversation with {} messages",
        messages.len()
    );

    let config = load_config().map_err(|e| e.to_string())?;
    let api_key = config.openai_api_key.ok_or_else(|| {
        error!("OpenAI API key not configured");
        "OpenAI API key not configured".to_string()
    })?;

    let api_key = api_key.trim().to_string();

    // Use environment variable for title model, default to gpt-5-mini
    let model = std::env::var("OPENAI_TITLE_MODEL").unwrap_or_else(|_| "gpt-5-mini".to_string());
    info!("Using title generation model: {}", model);

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut headers = HeaderMap::new();
    let auth_header = format!("Bearer {}", api_key);

    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_header).map_err(|e| {
            error!("Failed to create auth header: {}", e);
            format!("Invalid API key format: {}", e)
        })?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    // Extract only visible text content from messages (exclude file contents for cost optimization)
    let title_messages: Vec<ChatMsg> = messages
        .into_iter()
        .map(|msg| ChatMsg {
            role: msg.role,
            content: msg.content,
            images: None, // Don't send images to title generation
        })
        .collect();

    // Create a system message for title generation
    let mut title_input = vec![ChatMsg {
        role: "system".to_string(),
        content: "Generate a concise, descriptive title for this conversation. The title should be 3-8 words and capture the main topic or request. Do not use quotes or semicolons in the title.".to_string(),
        images: None,
    }];
    title_input.extend(title_messages);

    let body = serde_json::json!({
        "model": model,
        "input": to_responses_input(&title_input),
        "stream": false
    });

    let mut retry_count = 0;
    let max_retries = 3;

    loop {
        info!("Attempting title generation (retry {})", retry_count);

        let response = client
            .post("https://api.openai.com/v1/responses")
            .headers(headers.clone())
            .json(&body)
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    let response_body: serde_json::Value = resp
                        .json()
                        .await
                        .map_err(|e| format!("Failed to parse response: {}", e))?;

                    debug!(
                        "Title generation API response: {}",
                        serde_json::to_string_pretty(&response_body).unwrap_or_default()
                    );

                    // Extract title from Responses API shape:
                    // - Prefer top-level "output_text" if present.
                    // - Else, scan "output" array for a "message" item and
                    //   take the first "content" entry with
                    //   type == "output_text", use its "text".
                    let title_result = extract_title_from_responses(&response_body);
                    let title = title_result.as_deref().unwrap_or("New Chat");

                    // Sanitize title
                    let sanitized_title = sanitize_title(title);
                    info!("Generated title: {}", sanitized_title);
                    return Ok(sanitized_title);
                } else if status.as_u16() == 429 || status.is_server_error() {
                    // Retry on 429 (rate limit) or 5xx errors
                    let error_body = resp.text().await.unwrap_or_default();
                    error!("API error {}: {}", status, error_body);

                    if retry_count >= max_retries {
                        return Err(format!(
                            "API error after {} retries: {}",
                            max_retries, status
                        ));
                    }

                    retry_count += 1;
                    let delay = std::time::Duration::from_millis(500 * (1 << retry_count));
                    tokio::time::sleep(delay).await;
                    continue;
                } else {
                    let error_body = resp.text().await.unwrap_or_default();
                    error!("API error {}: {}", status, error_body);
                    return Err(format!("API error {}: {}", status, error_body));
                }
            }
            Err(e) => {
                error!("Request failed: {}", e);
                if retry_count >= max_retries {
                    return Err(format!(
                        "Request failed after {} retries: {}",
                        max_retries, e
                    ));
                }

                retry_count += 1;
                let delay = std::time::Duration::from_millis(500 * (1 << retry_count));
                tokio::time::sleep(delay).await;
            }
        }
    }
}

fn sanitize_title(title: &str) -> String {
    title
        .trim()
        .trim_matches('"') // Remove surrounding quotes
        .replace(';', "") // Remove semicolons
        .trim_end_matches('.') // Remove trailing periods
        .chars()
        .take(80) // Limit to 80 characters
        .collect::<String>()
        .trim()
        .to_string()
}

fn extract_title_from_responses(v: &serde_json::Value) -> Option<String> {
    let arr = v.get("output")?.as_array()?;

    for item in arr {
        let is_message = item
            .get("type")
            .and_then(|t| t.as_str())
            .map(|t| t == "message")
            .unwrap_or(false);

        if !is_message {
            continue;
        }

        // Optional: require assistant role (safe to keep).
        if item
            .get("role")
            .and_then(|r| r.as_str())
            .map(|r| r != "assistant")
            .unwrap_or(false)
        {
            continue;
        }

        if let Some(content_arr) = item.get("content").and_then(|c| c.as_array()) {
            for c in content_arr {
                let is_output_text = c
                    .get("type")
                    .and_then(|t| t.as_str())
                    .map(|t| t == "output_text")
                    .unwrap_or(false);

                if !is_output_text {
                    continue;
                }

                if let Some(text) = c.get("text").and_then(|t| t.as_str()) {
                    let t = text.trim();
                    if !t.is_empty() {
                        return Some(t.to_string());
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn set_swarm_api_key(api_key: String) -> Result<(), String> {
    let mut cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    cfg.swarm_api_key = Some(api_key.trim().to_string());
    crate::config::save_config(&cfg).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_swarm_api_key() -> Result<Option<String>, String> {
    let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    Ok(cfg.swarm_api_key)
}




#[tauri::command]
pub async fn swarm_send_message(text: String) -> Result<(), String> {
    if text.trim().is_empty() {
        return Err("Message is empty".into());
    }

    let cfg = crate::config::load_config().map_err(|e| e.to_string())?;
    let api_key = cfg
        .swarm_api_key
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Swarm API key not set. Add it in Settings (gear icon).".to_string())?;

    let base = "https://api.superswarm.dev".to_string();

    let client = reqwest::Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;

    // 1) Get user profile to find default repo
    let prof_url = format!("{}/api/user/profile", base);
    let prof_resp = client
        .get(&prof_url)
        .header("x-api-key", &api_key)
        .send()
        .await
        .map_err(|e| format!("Profile request failed: {}", e))?;

    if !prof_resp.status().is_success() {
        let s = prof_resp.status();
        let b = prof_resp.text().await.unwrap_or_default();
        return Err(format!("Profile error {}: {}", s, b));
    }

    // Only require default_repo_id
    let prof_json: serde_json::Value = prof_resp
        .json()
        .await
        .map_err(|e| format!("Profile parse error: {}", e))?;

    let default_repo_id = prof_json
        .get("default_repo_id")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .or_else(|| {
            prof_json
                .get("default_repo")
                .and_then(|v| v.get("id"))
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
        });

    let repo_id = default_repo_id.ok_or_else(|| {
        "No default repository set on your Swarm account. Please set your \
         default repo in Swarm, then try again."
            .to_string()
    })?;

    // 2) Create task (execute mode by default)
    let tasks_url = format!("{}/api/tasks", base);
    let body = serde_json::json!({
        "description": text,
        "repository_id": repo_id,
        "mode": "execute"
    });

    let resp = client
        .post(&tasks_url)
        .header("x-api-key", &api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Task request failed: {}", e))?;

    if !resp.status().is_success() {
        let s = resp.status();
        let b = resp.text().await.unwrap_or_default();
        return Err(format!("Task create error {}: {}", s, b));
    }

    Ok(())
}

// New: count tokens for the full chat (system + all turns), based on apiMessages
#[tauri::command]
pub async fn chat_count_tokens(messages: Vec<ChatMsg>) -> Result<TokenReport, String> {
    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-5".to_string());
    let blobs: Vec<String> = messages.into_iter().map(|m| m.content).collect();
    Ok(count_tokens_for_text_blobs(&blobs, &model))
}
