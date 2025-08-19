use anyhow::{anyhow, Result};
use ignore::{WalkBuilder, WalkState};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};
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
    files_cache: Arc<StdMutex<Option<Vec<FileMeta>>>>,
}

impl RepoManager {
    pub fn new(path: &str) -> Result<Self> {
        let root = PathBuf::from(path).canonicalize()?;

        if !root.exists() || !root.is_dir() {
            return Err(anyhow!("Path does not exist or is not a directory"));
        }

        Ok(Self {
            root,
            files_cache: Arc::new(StdMutex::new(None)),
        })
    }

    pub fn get_summary(&self) -> RepoSummary {
        let name = self
            .root
            .file_name()
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
        // Fast path: return cached files if available
        if let Some(cached) = self.files_cache.lock().unwrap().as_ref() {
            return Ok(cached.clone());
        }

        let root = self.root.clone();
        let max_file_size = 5 * 1024 * 1024; // 5MB
        let out = Arc::new(StdMutex::new(Vec::new()));

        let mut builder = WalkBuilder::new(&root);
        builder
            .standard_filters(true)
            .hidden(false)
            .ignore(true)
            .git_ignore(true)
            .threads(num_cpus::get()) // Use all available cores for parallel walking
            .filter_entry(|entry| {
                let path = entry.path();
                if path.is_dir() {
                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    !matches!(
                        name,
                        ".git" | "node_modules" | "target" | "build" | "dist" | ".next" | "venv"
                    )
                } else {
                    true
                }
            });

        builder.build_parallel().run(|| {
            let out = out.clone();
            let root = root.clone();
            Box::new(move |entry| {
                match entry {
                    Ok(dirent) => {
                        let path = dirent.path().to_path_buf();
                        if path.is_file() {
                            if let Ok(metadata) = fs::metadata(&path) {
                                if metadata.len() <= max_file_size {
                                    let relpath = path
                                        .strip_prefix(&root)
                                        .ok()
                                        .and_then(|p| p.to_str())
                                        .unwrap_or("")
                                        .to_string();
                                    if !relpath.is_empty() {
                                        let mtime = metadata
                                            .modified()
                                            .ok()
                                            .and_then(|m| {
                                                m.duration_since(SystemTime::UNIX_EPOCH).ok()
                                            })
                                            .map(|d| d.as_secs())
                                            .unwrap_or(0);
                                        let is_binary = is_binary_file(&path);
                                        let mut guard = out.lock().unwrap();
                                        guard.push(FileMeta {
                                            relpath,
                                            size: metadata.len(),
                                            mtime,
                                            is_binary,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    Err(_) => {}
                }
                WalkState::Continue
            })
        });

        let mut list = out.lock().unwrap().clone();
        list.sort_by(|a, b| b.mtime.cmp(&a.mtime));

        // Cache the results
        *self.files_cache.lock().unwrap() = Some(list.clone());

        Ok(list)
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
    // Read only first 8KB instead of entire file for binary detection
    let mut f = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return true,
    };
    let mut buf = [0u8; 8192];
    let n = match f.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return true,
    };
    buf[..n].iter().any(|&b| b == 0)
}
