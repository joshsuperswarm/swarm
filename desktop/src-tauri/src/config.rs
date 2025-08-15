use anyhow::Result;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub last_root: Option<String>,
    #[serde(default)]
    pub selected_files: Vec<String>,
    #[serde(default)]
    pub selected_folders: Vec<String>,
    #[serde(default)]
    pub openai_api_key: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            last_root: None,
            selected_files: Vec::new(),
            selected_folders: Vec::new(),
            openai_api_key: None,
        }
    }
}

fn get_config_path() -> Result<PathBuf> {
    let project_dirs = ProjectDirs::from("com", "swarm", "swarm")
        .ok_or_else(|| anyhow::anyhow!("Failed to get project directories"))?;

    let config_dir = project_dirs.config_dir();
    fs::create_dir_all(config_dir)?;

    Ok(config_dir.join("config.json"))
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
