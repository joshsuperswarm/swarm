use anyhow::Result;
use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const TAURI_IDENTIFIER: &str = "com.swarm";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub last_root: Option<String>,
    #[serde(default)]
    pub selected_files: Vec<String>,
    #[serde(default)]
    pub selected_folders: Vec<String>,
    #[serde(default)]
    pub openai_api_key: Option<String>,
    #[serde(default)]
    pub swarm_api_key: Option<String>,
    #[serde(default)]
    pub swarm_base_url: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            last_root: None,
            selected_files: Vec::new(),
            selected_folders: Vec::new(),
            openai_api_key: None,
            swarm_api_key: None,
            swarm_base_url: None,
        }
    }
}

fn app_local_data_root() -> Result<PathBuf> {
    let base = BaseDirs::new()
        .ok_or_else(|| anyhow::anyhow!("Failed to resolve base dirs"))?;
    let mut p = base.data_local_dir().to_path_buf();
    // Match Tauri's BaseDirectory::AppLocalData, which uses the bundle identifier
    p.push(TAURI_IDENTIFIER);
    fs::create_dir_all(&p)?;
    Ok(p)
}

fn get_config_path() -> Result<PathBuf> {
    let root = app_local_data_root()?;
    Ok(root.join("config.json"))
}

pub fn load_config() -> Result<Config> {
    let path = get_config_path()?;

    if path.exists() {
        let contents = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&contents)?)
    } else {
        Ok(Config::default())
    }
}

pub fn save_config(config: &Config) -> Result<()> {
    let path = get_config_path()?;
    let contents = serde_json::to_string_pretty(config)?;
    fs::write(path, contents)?;
    Ok(())
}
