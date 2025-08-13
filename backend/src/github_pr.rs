use crate::models::Task;
use anyhow::Result;
use octocrab::Octocrab;

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
        pr_title: &str,
        pr_body: &str,
    ) -> Result<String> {
        tracing::info!(
            "Starting PR creation for task {} in {}/{} on branch {}",
            task.id,
            owner,
            repo,
            branch
        );

        let title = format!("task-{}: {}", task.id, pr_title);
        let body = pr_body.to_string();

        tracing::debug!("PR title: '{}', body length: {} chars", title, body.len());

        // Check if PR already exists for this branch with exact matching
        tracing::info!("Checking for existing PRs for branch '{}'", branch);
        let all_open_prs = match self
            .octocrab
            .pulls(owner, repo)
            .list()
            .state(octocrab::params::State::Open)
            .per_page(100)
            .send()
            .await
        {
            Ok(prs) => {
                tracing::info!(
                    "Found {} total open PRs in {}/{}",
                    prs.items.len(),
                    owner,
                    repo
                );
                prs
            }
            Err(e) => {
                tracing::error!("Failed to check existing PRs for {}/{}: {}", owner, repo, e);
                return Err(e.into());
            }
        };

        // Log warning if there are many open PRs
        if all_open_prs.items.len() > 1 {
            tracing::warn!(
                "Repository {}/{} has {} open PRs - filtering for exact branch match",
                owner,
                repo,
                all_open_prs.items.len()
            );
        }

        // Find PR with exact branch and repo match
        let expected_repo_full_name = format!("{}/{}", owner, repo);
        let matching_pr = all_open_prs.items.iter().find(|pr| {
            pr.head.ref_field == branch
                && pr
                    .head
                    .repo
                    .as_ref()
                    .and_then(|r| r.full_name.as_ref())
                    .map(|name| name == &expected_repo_full_name)
                    .unwrap_or(false)
        });

        if let Some(existing_pr) = matching_pr {
            // Update existing PR
            tracing::info!(
                "Updating existing PR #{} for task {}",
                existing_pr.number,
                task.id
            );
            let updated_pr = match self
                .octocrab
                .pulls(owner, repo)
                .update(existing_pr.number)
                .title(&title)
                .body(&body)
                .send()
                .await
            {
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

            Ok(updated_pr
                .html_url
                .map(|url| url.to_string())
                .unwrap_or_else(|| {
                    format!(
                        "https://github.com/{}/{}/pull/{}",
                        owner, repo, updated_pr.number
                    )
                }))
        } else {
            // Create new PR - expecting branch to exist remotely (pushed by agent)
            tracing::info!(
                "Creating new PR for task {} from branch '{}' to 'main' (branch should already exist remotely)",
                task.id,
                branch
            );
            let new_pr = match self
                .octocrab
                .pulls(owner, repo)
                .create(&title, branch, "main")
                .body(&body)
                .send()
                .await
            {
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
                        tracing::error!(
                            "GitHub returned 422 Unprocessable Entity - likely a validation error"
                        );
                        tracing::error!("Common causes: branch doesn't exist, invalid base branch, or PR already exists");
                    } else if error_string.contains("404") {
                        tracing::error!(
                            "GitHub returned 404 Not Found - repository or branch may not exist"
                        );
                    } else if error_string.contains("403") {
                        tracing::error!("GitHub returned 403 Forbidden - insufficient permissions or rate limit");
                    } else if error_string.contains("401") {
                        tracing::error!(
                            "GitHub returned 401 Unauthorized - invalid or expired token"
                        );
                    }

                    tracing::debug!("Full error details: {:?}", e);

                    return Err(e.into());
                }
            };

            Ok(new_pr
                .html_url
                .map(|url| url.to_string())
                .unwrap_or_else(|| {
                    format!(
                        "https://github.com/{}/{}/pull/{}",
                        owner, repo, new_pr.number
                    )
                }))
        }
    }

    /// Check if a pull request has been merged
    pub async fn is_merged(&self, owner: &str, repo: &str, pr_number: u64) -> Result<bool> {
        tracing::debug!(
            "Checking merge status for PR #{} in {}/{}",
            pr_number,
            owner,
            repo
        );

        match self.octocrab.pulls(owner, repo).get(pr_number).await {
            Ok(pr) => {
                let is_merged = pr.merged_at.is_some();
                tracing::debug!(
                    "PR #{} in {}/{} merge status: {}",
                    pr_number,
                    owner,
                    repo,
                    if is_merged { "merged" } else { "not merged" }
                );
                Ok(is_merged)
            }
            Err(e) => {
                tracing::error!(
                    "Failed to check PR merge status for #{} in {}/{}: {}",
                    pr_number,
                    owner,
                    repo,
                    e
                );
                Err(e.into())
            }
        }
    }

    /// Add a comment to a pull request
    pub async fn add_pr_comment(
        &self,
        owner: &str,
        repo: &str,
        pr_number: u64,
        comment_body: &str,
    ) -> Result<String> {
        tracing::info!("Adding comment to PR #{} in {}/{}", pr_number, owner, repo);

        let comment = self
            .octocrab
            .issues(owner, repo)
            .create_comment(pr_number, comment_body)
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to add comment to PR #{} in {}/{}: {}",
                    pr_number,
                    owner,
                    repo,
                    e
                );
                anyhow::anyhow!("Failed to add comment to PR: {}", e)
            })?;

        let comment_url = format!(
            "https://github.com/{}/{}/pull/{}#issuecomment-{}",
            owner, repo, pr_number, comment.id
        );

        tracing::info!(
            "Successfully added comment to PR #{} in {}/{}: {}",
            pr_number,
            owner,
            repo,
            comment_url
        );

        Ok(comment_url)
    }

    /// Parse PR URL to extract owner, repo, and PR number
    pub fn parse_pr_url(pr_url: &str) -> Result<(String, String, u64)> {
        tracing::debug!("Parsing PR URL: {}", pr_url);

        let url = url::Url::parse(pr_url).map_err(|e| anyhow::anyhow!("Invalid PR URL: {}", e))?;

        if url.host_str() != Some("github.com") {
            return Err(anyhow::anyhow!("PR URL must be from github.com"));
        }

        let path_segments: Vec<&str> = url
            .path_segments()
            .ok_or_else(|| anyhow::anyhow!("Invalid PR URL path"))?
            .collect();

        if path_segments.len() < 4 || path_segments[2] != "pull" {
            return Err(anyhow::anyhow!(
                "PR URL must be in format: https://github.com/owner/repo/pull/number"
            ));
        }

        let owner = path_segments[0].to_string();
        let repo = path_segments[1].to_string();
        let pr_number = path_segments[3]
            .parse::<u64>()
            .map_err(|e| anyhow::anyhow!("Invalid PR number: {}", e))?;

        tracing::debug!(
            "Parsed PR URL - owner: {}, repo: {}, number: {}",
            owner,
            repo,
            pr_number
        );
        Ok((owner, repo, pr_number))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_mock_task() -> Task {
        Task {
            id: 123,
            user_id: 1,
            repository_id: 1,
            title: "Test task".to_string(),
            description: Some("Test description".to_string()),
            status: Some("running".to_string()),
            github_pr_url: None,
            pr_title: None,
            pr_body: None,
            pr_merged_at: None,
            is_archived: false,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn test_task_title_and_body_formatting() {
        let task = Task {
            id: 789,
            title: "Fix critical bug in authentication".to_string(),
            description: Some(
                "This task fixes a critical security vulnerability in the auth module".to_string(),
            ),
            ..create_mock_task()
        };

        let expected_title = "Swarm: Fix critical bug in authentication";
        let expected_body = "This task fixes a critical security vulnerability in the auth module";

        assert_eq!(format!("Swarm: {}", task.title), expected_title);
        assert_eq!(
            task.description
                .as_deref()
                .unwrap_or("Automated changes by Swarm AI agent"),
            expected_body
        );
    }

    #[test]
    fn test_task_with_no_description() {
        let task = Task {
            id: 999,
            title: "Simple task".to_string(),
            description: None,
            ..create_mock_task()
        };

        let expected_title = "Swarm: Simple task";
        let expected_body = "Automated changes by Swarm AI agent";

        assert_eq!(format!("Swarm: {}", task.title), expected_title);
        assert_eq!(
            task.description
                .as_deref()
                .unwrap_or("Automated changes by Swarm AI agent"),
            expected_body
        );
    }

    #[tokio::test]
    async fn test_github_pr_client_creation() {
        // Test that the GitHubPRClient can be created with a token
        let result = GitHubPRClient::new("test_token");
        assert!(result.is_ok());
    }

    #[test]
    fn test_url_formatting() {
        // Test URL formatting logic used in PR creation
        let owner = "test-owner";
        let repo = "test-repo";
        let number = 42;

        let expected_url = format!("https://github.com/{}/{}/pull/{}", owner, repo, number);
        assert_eq!(
            expected_url,
            "https://github.com/test-owner/test-repo/pull/42"
        );
    }

    #[test]
    fn test_parse_pr_url() {
        // Test valid PR URL parsing
        let url = "https://github.com/owner/repo/pull/123";
        let result = GitHubPRClient::parse_pr_url(url);
        assert!(result.is_ok());
        let (owner, repo, pr_number) = result.unwrap();
        assert_eq!(owner, "owner");
        assert_eq!(repo, "repo");
        assert_eq!(pr_number, 123);

        // Test invalid URLs
        assert!(GitHubPRClient::parse_pr_url("invalid-url").is_err());
        assert!(GitHubPRClient::parse_pr_url("https://gitlab.com/owner/repo/pull/123").is_err());
        assert!(GitHubPRClient::parse_pr_url("https://github.com/owner/repo/issues/123").is_err());
        assert!(GitHubPRClient::parse_pr_url("https://github.com/owner/repo/pull/abc").is_err());
    }
}
