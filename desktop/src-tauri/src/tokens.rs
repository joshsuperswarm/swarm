use crate::repo::RepoManager;
use anyhow::Result;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
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

#[derive(Debug, Clone)]
struct CachedCount {
    mtime: u64,
    size: u64,
    tokens: u64,
}

static TOKENIZER: Lazy<CoreBPE> = Lazy::new(|| {
    let encoding = std::env::var("OPENAI_ENCODING").unwrap_or_else(|_| "o200k_base".to_string());
    get_bpe_from_model(&encoding).unwrap_or_else(|_| get_bpe_from_model("o200k_base").unwrap())
});

static TOKEN_CACHE: Lazy<Mutex<HashMap<String, CachedCount>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

pub async fn count_tokens_for_files(
    repo: &RepoManager,
    relpaths: Vec<String>,
) -> Result<TokenReport> {
    let mut files = Vec::new();
    let mut total_tokens = 0u64;
    let mut total_bytes = 0u64;
    
    let file_metas = repo.list_files()?;
    let meta_map: HashMap<_, _> = file_metas
        .into_iter()
        .map(|m| (m.relpath.clone(), m))
        .collect();
    
    for relpath in relpaths {
        if let Some(meta) = meta_map.get(&relpath) {
            total_bytes += meta.size;
            
            if meta.is_binary {
                files.push(FileToken {
                    relpath: relpath.clone(),
                    bytes: meta.size,
                    tokens: 0,
                    is_binary: true,
                });
                continue;
            }
            
            let tokens = count_tokens_for_file(repo, &relpath, meta.mtime, meta.size)?;
            total_tokens += tokens;
            
            files.push(FileToken {
                relpath: relpath.clone(),
                bytes: meta.size,
                tokens,
                is_binary: false,
            });
        }
    }
    
    files.sort_by(|a, b| b.tokens.cmp(&a.tokens));
    
    let encoding = std::env::var("OPENAI_ENCODING").unwrap_or_else(|_| "o200k_base".to_string());
    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".to_string());
    let context_window = get_model_context_window(&model);
    
    Ok(TokenReport {
        files,
        total_tokens,
        total_bytes,
        encoding,
        model_context_window: context_window,
        may_exceed_context: total_tokens > context_window as u64 * 9 / 10, // 90% threshold
    })
}

fn count_tokens_for_file(
    repo: &RepoManager,
    relpath: &str,
    mtime: u64,
    size: u64,
) -> Result<u64> {
    let cache_key = format!("{}:{}", repo.get_root().to_string_lossy(), relpath);
    
    {
        let cache = TOKEN_CACHE.lock().unwrap();
        if let Some(cached) = cache.get(&cache_key) {
            if cached.mtime == mtime && cached.size == size {
                return Ok(cached.tokens);
            }
        }
    }
    
    let content = repo.read_file(relpath)?;
    let tokens = TOKENIZER.encode_ordinary(&content).len() as u64;
    
    {
        let mut cache = TOKEN_CACHE.lock().unwrap();
        cache.insert(cache_key, CachedCount {
            mtime,
            size,
            tokens,
        });
    }
    
    Ok(tokens)
}

fn get_model_context_window(model: &str) -> u32 {
    let context_from_env = std::env::var("MODEL_CONTEXT_TOKENS")
        .ok()
        .and_then(|s| s.parse::<u32>().ok());
    
    if let Some(context) = context_from_env {
        return context;
    }
    
    match model {
        "gpt-4o" | "gpt-4o-2024-08-06" => 128000,
        "gpt-4o-mini" => 128000,
        "gpt-4-turbo" | "gpt-4-turbo-preview" => 128000,
        "gpt-4" => 8192,
        "gpt-4-32k" => 32768,
        "gpt-3.5-turbo" => 16385,
        _ => 128000, // Default to gpt-4o context
    }
}