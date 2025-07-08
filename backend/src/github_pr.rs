use octocrab::Octocrab;
use anyhow::Result;
use crate::models::Task;

pub struct GitHubPRClient {
    octocrab: Octocrab,
}

impl GitHubPRClient {
    pub fn new(github_token: &str) -> Result<Self> {
        let octocrab = Octocrab::builder()
            .personal_token(github_token.to_string())
            .build()?;
        
        Ok(Self { octocrab })
    }

    /// Create or update a pull request for the given task
    pub async fn create_or_update_pr(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        task: &Task,
    ) -> Result<String> {
        tracing::info!("Starting PR creation for task {} in {}/{} on branch {}", task.id, owner, repo, branch);
        
        let title = format!("Swarm: {}", task.title);
        let body = task.description
            .as_deref()
            .unwrap_or("Automated changes by Swarm AI agent")
            .to_string();

        tracing::debug!("PR title: '{}', body length: {} chars", title, body.len());

        // Check if PR already exists for this branch
        tracing::info!("Checking for existing PRs for branch '{}'", branch);
        let existing_prs = match self.octocrab
            .pulls(owner, repo)
            .list()
            .head(branch)
            .state(octocrab::params::State::Open)
            .send()
            .await {
            Ok(prs) => {
                tracing::info!("Found {} existing PRs for branch '{}'", prs.items.len(), branch);
                prs
            }
            Err(e) => {
                tracing::error!("Failed to check existing PRs for {}/{} branch '{}': {}", owner, repo, branch, e);
                return Err(e.into());
            }
        };

        if let Some(existing_pr) = existing_prs.items.first() {
            // Update existing PR
            tracing::info!("Updating existing PR #{} for task {}", existing_pr.number, task.id);
            let updated_pr = match self.octocrab
                .pulls(owner, repo)
                .update(existing_pr.number)
                .title(&title)
                .body(&body)
                .send()
                .await {
                Ok(pr) => {
                    tracing::info!(
                        "Successfully updated PR #{} for task {} in {}/{}",
                        pr.number,
                        task.id,
                        owner,
                        repo
                    );
                    pr
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to update PR #{} for task {} in {}/{}: {}",
                        existing_pr.number,
                        task.id,
                        owner,
                        repo,
                        e
                    );
                    return Err(e.into());
                }
            };

            Ok(updated_pr.html_url
                .map(|url| url.to_string())
                .unwrap_or_else(|| format!("https://github.com/{}/{}/pull/{}", owner, repo, updated_pr.number)))
        } else {
            // Create new PR
            tracing::info!("Creating new PR for task {} from branch '{}' to 'main'", task.id, branch);
            let new_pr = match self.octocrab
                .pulls(owner, repo)
                .create(&title, branch, "main")
                .body(&body)
                .send()
                .await {
                Ok(pr) => {
                    tracing::info!(
                        "Successfully created PR #{} for task {} in {}/{}: {}",
                        pr.number,
                        task.id,
                        owner,
                        repo,
                        pr.html_url.as_ref().map(|u| u.as_str()).unwrap_or("no URL")
                    );
                    pr
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to create PR for task {} in {}/{} from branch '{}' to 'main': {}",
                        task.id,
                        owner,
                        repo,
                        branch,
                        e
                    );
                    
                    // Log additional error context if available
                    tracing::error!("Error type: {}", std::any::type_name_of_val(&e));
                    
                    // Try to extract more specific error information
                    let error_string = format!("{:?}", e);
                    if error_string.contains("422") {
                        tracing::error!("GitHub returned 422 Unprocessable Entity - likely a validation error");
                        tracing::error!("Common causes: branch doesn't exist, invalid base branch, or PR already exists");
                    } else if error_string.contains("404") {
                        tracing::error!("GitHub returned 404 Not Found - repository or branch may not exist");
                    } else if error_string.contains("403") {
                        tracing::error!("GitHub returned 403 Forbidden - insufficient permissions or rate limit");
                    } else if error_string.contains("401") {
                        tracing::error!("GitHub returned 401 Unauthorized - invalid or expired token");
                    }
                    
                    tracing::debug!("Full error details: {:?}", e);
                    
                    return Err(e.into());
                }
            };

            Ok(new_pr.html_url
                .map(|url| url.to_string())
                .unwrap_or_else(|| format!("https://github.com/{}/{}/pull/{}", owner, repo, new_pr.number)))
        }
    }
}