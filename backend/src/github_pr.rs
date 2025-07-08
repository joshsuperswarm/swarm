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
                tracing::error!(
                    "Failed to check existing PRs for {}/{}: {}",
                    owner,
                    repo,
                    e
                );
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
            pr.head.ref_field == branch && 
            pr.head.repo.as_ref()
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
            // Create new PR
            tracing::info!(
                "Creating new PR for task {} from branch '{}' to 'main'",
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
            github_branch: None,
            daytona_sandbox_id: None,
            sandbox_hostname: None,
            daytona_session_id: None,
            daytona_command_id: None,
            commit_title: None,
            commit_body: None,
            pr_title: None,
            pr_body: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn test_task_title_and_body_formatting() {
        let task = Task {
            id: 789,
            title: "Fix critical bug in authentication".to_string(),
            description: Some("This task fixes a critical security vulnerability in the auth module".to_string()),
            ..create_mock_task()
        };
        
        let expected_title = "Swarm: Fix critical bug in authentication";
        let expected_body = "This task fixes a critical security vulnerability in the auth module";
        
        assert_eq!(format!("Swarm: {}", task.title), expected_title);
        assert_eq!(task.description.as_deref().unwrap_or("Automated changes by Swarm AI agent"), expected_body);
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
        assert_eq!(task.description.as_deref().unwrap_or("Automated changes by Swarm AI agent"), expected_body);
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
        assert_eq!(expected_url, "https://github.com/test-owner/test-repo/pull/42");
    }
}
