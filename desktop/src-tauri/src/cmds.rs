use crate::config::{load_config, save_config};
use crate::repo::{FileMeta, RepoManager, RepoSummary};
use crate::tokens::{count_tokens_for_files, TokenReport};
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
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamToken {
    pub request_id: String,
    pub delta: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamDone {
    pub request_id: String,
    pub finish_reason: Option<String>,
    pub canceled: bool,
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

            serde_json::json!({
                "role": m.role,
                "content": [
                    { "type": content_type, "text": m.content }
                ]
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
pub async fn chat_stream_start(app: AppHandle, messages: Vec<ChatMsg>) -> Result<String, String> {
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
        for (_, token) in cancels.iter() {
            token.cancel();
        }
        cancels.clear();
        cancels.insert(request_id.clone(), cancel_token.clone());
    }

    let api_key = std::env::var("OPENAI_API_KEY").map_err(|_| {
        error!("OPENAI_API_KEY environment variable not set");
        "OPENAI_API_KEY not set".to_string()
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
        return Err("API key contains newline characters - please check your OPENAI_API_KEY environment variable".to_string());
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

    let body = serde_json::json!({
        "model": model,
        "input": to_responses_input(&messages),
        "stream": true
    });
    debug!(
        "Request body: {}",
        serde_json::to_string_pretty(&body).unwrap()
    );

    let req_id_clone = request_id.clone();
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

                        info!(
                            "Received response.completed signal for request {}, total tokens: {}",
                            request_id, token_count
                        );

                        let _ = app.emit(
                            "chat_done",
                            StreamDone {
                                request_id: request_id.to_string(),
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
