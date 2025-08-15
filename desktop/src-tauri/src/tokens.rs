use crate::repo::RepoManager;
use anyhow::Result;
use directories::ProjectDirs;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tiktoken_rs::{get_bpe_from_model, CoreBPE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileToken {
    pub relpath: String,
    pub bytes: u64,
    pub tokens: u64,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenReport {
    pub files: Vec<FileToken>,
    pub total_tokens: u64,
    pub total_bytes: u64,
    pub encoding: String,
    pub model_context_window: u32,
    pub may_exceed_context: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedCount {
    mtime: u64,
    size: u64,
    tokens: u64,
}

static TOKENIZER: Lazy<CoreBPE> = Lazy::new(|| {
    // GPT-5 uses the same tokenizer as GPT-4o
    get_bpe_from_model("gpt-4o").unwrap()
});

static TOKEN_CACHE: Lazy<Mutex<HashMap<String, CachedCount>>> =
    Lazy::new(|| Mutex::new(load_token_cache().unwrap_or_default()));

fn cache_path() -> Option<std::path::PathBuf> {
    ProjectDirs::from("com", "swarm", "swarm").map(|d| d.cache_dir().join("token-cache.json"))
}

fn load_token_cache() -> Option<HashMap<String, CachedCount>> {
    let p = cache_path()?;
    let bytes = fs::read(p).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn save_token_cache() {
    if let Some(p) = cache_path() {
        if let Ok(bytes) = serde_json::to_vec(&*TOKEN_CACHE.lock()) {
            let _ = fs::create_dir_all(p.parent().unwrap());
            let _ = fs::write(p, bytes);
        }
    }
}

pub async fn count_tokens_for_files(
    repo: &RepoManager,
    relpaths: Vec<String>,
) -> Result<TokenReport> {
    // Use cached list which is now much faster with parallel walking
    let meta_map: HashMap<_, _> = repo
        .list_files()?
        .into_iter()
        .map(|m| (m.relpath.clone(), m))
        .collect();

    // Process files in parallel for maximum speed
    let results: Vec<FileToken> = relpaths
        .par_iter()
        .filter_map(|rel| {
            let meta = meta_map.get(rel)?;
            let relpath = rel.clone();

            if meta.is_binary {
                return Some(FileToken {
                    relpath,
                    bytes: meta.size,
                    tokens: 0,
                    is_binary: true,
                });
            }

            // Check cache with combined key including mtime
            let cache_key = format!(
                "{}:{}:{}",
                repo.get_root().to_string_lossy(),
                rel,
                meta.mtime
            );

            // Fast path: check cache
            if let Some(c) = TOKEN_CACHE.lock().get(&cache_key) {
                return Some(FileToken {
                    relpath,
                    bytes: meta.size,
                    tokens: c.tokens,
                    is_binary: false,
                });
            }

            // Slow path: tokenize
            let content = repo.read_file(rel).ok()?;
            let tokens = TOKENIZER.encode_ordinary(&content).len() as u64;

            // Update cache
            TOKEN_CACHE.lock().insert(
                cache_key,
                CachedCount {
                    mtime: meta.mtime,
                    size: meta.size,
                    tokens,
                },
            );

            Some(FileToken {
                relpath,
                bytes: meta.size,
                tokens,
                is_binary: false,
            })
        })
        .collect();

    // Save cache to disk for persistence across runs
    save_token_cache();

    let mut files = results;
    files.sort_by(|a, b| b.tokens.cmp(&a.tokens));

    let total_tokens = files.iter().map(|f| f.tokens).sum();
    let total_bytes = files.iter().map(|f| f.bytes).sum();

    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-5".to_string());
    let context_window = get_model_context_window(&model);

    Ok(TokenReport {
        files,
        total_tokens,
        total_bytes,
        encoding: model.clone(),
        model_context_window: context_window,
        may_exceed_context: total_tokens > context_window as u64 * 9 / 10, // 90% threshold
    })
}

fn get_model_context_window(model: &str) -> u32 {
    let context_from_env = std::env::var("MODEL_CONTEXT_TOKENS")
        .ok()
        .and_then(|s| s.parse::<u32>().ok());

    if let Some(context) = context_from_env {
        return context;
    }

    match model {
        "gpt-5" | "gpt-5-latest" | "gpt-5-mini" => 272000, // ~272k tokens for GPT-5/GPT-5-mini
        "gpt-4o" | "gpt-4o-2024-08-06" => 128000,
        "gpt-4o-mini" => 128000,
        "gpt-4-turbo" | "gpt-4-turbo-preview" => 128000,
        "gpt-4" => 8192,
        "gpt-4-32k" => 32768,
        "gpt-3.5-turbo" => 16385,
        _ => 128000, // Default to gpt-4o context
    }
}
