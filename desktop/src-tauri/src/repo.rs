use anyhow::{anyhow, Result};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoSummary {
    pub root: String,
    pub name: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub relpath: String,
    pub size: u64,
    pub mtime: u64,
    pub is_binary: bool,
}

pub struct RepoManager {
    root: PathBuf,
}

impl RepoManager {
    pub fn new(path: &str) -> Result<Self> {
        let root = PathBuf::from(path).canonicalize()?;
        
        if !root.exists() || !root.is_dir() {
            return Err(anyhow!("Path does not exist or is not a directory"));
        }
        
        Ok(Self { root })
    }
    
    pub fn get_summary(&self) -> RepoSummary {
        let name = self.root.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        
        let file_count = self.list_files().unwrap_or_default().len();
        
        RepoSummary {
            root: self.root.to_string_lossy().to_string(),
            name,
            file_count,
        }
    }
    
    pub fn list_files(&self) -> Result<Vec<FileMeta>> {
        let mut files = Vec::new();
        let max_file_size = 5 * 1024 * 1024; // 5MB
        
        let walker = WalkBuilder::new(&self.root)
            .standard_filters(true)
            .hidden(false)
            .ignore(true)
            .git_ignore(true)
            .filter_entry(|entry| {
                let path = entry.path();
                if path.is_dir() {
                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    !matches!(name, ".git" | "node_modules" | "target" | "build" | "dist" | ".next" | "venv")
                } else {
                    true
                }
            })
            .build();
        
        for entry in walker {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                let metadata = fs::metadata(path)?;
                
                if metadata.len() > max_file_size {
                    continue;
                }
                
                let relpath = path.strip_prefix(&self.root)?
                    .to_string_lossy()
                    .to_string();
                
                let mtime = metadata.modified()?
                    .duration_since(SystemTime::UNIX_EPOCH)?
                    .as_secs();
                
                let is_binary = is_binary_file(path);
                
                files.push(FileMeta {
                    relpath,
                    size: metadata.len(),
                    mtime,
                    is_binary,
                });
            }
        }
        
        files.sort_by(|a, b| b.mtime.cmp(&a.mtime));
        Ok(files)
    }
    
    pub fn read_file(&self, relpath: &str) -> Result<String> {
        if relpath.contains("..") {
            return Err(anyhow!("Invalid path: contains '..'"));
        }
        
        let full_path = self.root.join(relpath);
        let canonical = full_path.canonicalize()?;
        
        if !canonical.starts_with(&self.root) {
            return Err(anyhow!("Path traversal detected"));
        }
        
        Ok(fs::read_to_string(canonical)?)
    }
    
    pub fn get_root(&self) -> &Path {
        &self.root
    }
}

fn is_binary_file(path: &Path) -> bool {
    match fs::read(path) {
        Ok(bytes) => {
            let sample = &bytes[..bytes.len().min(8192)];
            sample.iter().any(|&b| b == 0)
        }
        Err(_) => true,
    }
}