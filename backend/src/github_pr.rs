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
        let title = format!("Swarm: {}", task.title);
        let body = task.description
            .as_deref()
            .unwrap_or("Automated changes by Swarm AI agent")
            .to_string();

        // Check if PR already exists for this branch
        let existing_prs = self.octocrab
            .pulls(owner, repo)
            .list()
            .head(branch)
            .state(octocrab::params::State::Open)
            .send()
            .await?;

        if let Some(existing_pr) = existing_prs.items.first() {
            // Update existing PR
            let updated_pr = self.octocrab
                .pulls(owner, repo)
                .update(existing_pr.number)
                .title(&title)
                .body(&body)
                .send()
                .await?;

            tracing::info!(
                "Updated existing PR #{} for task {} in {}/{}",
                updated_pr.number,
                task.id,
                owner,
                repo
            );

            Ok(updated_pr.html_url
                .map(|url| url.to_string())
                .unwrap_or_else(|| format!("https://github.com/{}/{}/pull/{}", owner, repo, updated_pr.number)))
        } else {
            // Create new PR
            let new_pr = self.octocrab
                .pulls(owner, repo)
                .create(&title, branch, "main")
                .body(&body)
                .send()
                .await?;

            tracing::info!(
                "Created new PR #{} for task {} in {}/{}",
                new_pr.number,
                task.id,
                owner,
                repo
            );

            Ok(new_pr.html_url
                .map(|url| url.to_string())
                .unwrap_or_else(|| format!("https://github.com/{}/{}/pull/{}", owner, repo, new_pr.number)))
        }
    }
}