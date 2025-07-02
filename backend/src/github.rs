use octocrab::{Octocrab, OctocrabBuilder};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepository {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubUser,
    pub private: bool,
    pub html_url: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub id: i64,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPullRequest {
    pub id: i64,
    pub number: i32,
    pub title: String,
    pub html_url: String,
    pub state: String,
}

pub struct GitHubClient {
    client: Octocrab,
}

impl GitHubClient {
    pub fn new(access_token: &str) -> Result<Self, octocrab::Error> {
        let client = OctocrabBuilder::new()
            .personal_token(access_token.to_string())
            .build()?;

        Ok(Self { client })
    }

    pub async fn get_current_user(&self) -> Result<GitHubUser, octocrab::Error> {
        let user = self.client.current().user().await?;
        
        Ok(GitHubUser {
            login: user.login,
            id: user.id.0, // Extract inner i64 from UserId
            html_url: user.html_url.map(|u| u.to_string()).unwrap_or_default(),
        })
    }

    pub async fn get_user_repositories(&self, per_page: u8) -> Result<Vec<GitHubRepository>, octocrab::Error> {
        let mut repositories = Vec::new();
        let mut page = 1u32;

        loop {
            let repos_page = self
                .client
                .current()
                .list_repos_for_authenticated_user()
                .type_("all")
                .sort("updated")
                .per_page(per_page)
                .page(page)
                .send()
                .await?;

            if repos_page.items.is_empty() {
                break;
            }

            for repo in repos_page.items {
                let owner = repo.owner.unwrap_or_else(|| {
                    octocrab::models::Author {
                        login: "unknown".to_string(),
                        id: octocrab::models::UserId(0),
                        html_url: None,
                        gravatar_id: None,
                        r#type: "User".to_string(),
                        site_admin: false,
                        ..Default::default()
                    }
                });

                repositories.push(GitHubRepository {
                    id: repo.id.0, // Extract inner i64 from RepositoryId
                    name: repo.name,
                    full_name: repo.full_name.unwrap_or_else(|| {
                        format!("{}/{}", owner.login, repo.name)
                    }),
                    owner: GitHubUser {
                        login: owner.login.clone(),
                        id: owner.id.0, // Extract inner i64 from UserId
                        html_url: owner.html_url.map(|u| u.to_string()).unwrap_or_default(),
                    },
                    private: repo.private.unwrap_or(false),
                    html_url: repo.html_url.map(|u| u.to_string()).unwrap_or_default(),
                    description: repo.description,
                    language: repo.language.map(|v| v.to_string()),
                    updated_at: repo.updated_at.map(|dt| dt.to_rfc3339()).unwrap_or_default(),
                });
            }

            // Check if we've reached the last page
            if repos_page.items.len() < per_page as usize {
                break;
            }

            page += 1;
        }

        Ok(repositories)
    }

    pub async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        title: &str,
        body: &str,
        head: &str,
        base: &str,
    ) -> Result<GitHubPullRequest, octocrab::Error> {
        let pr = self
            .client
            .pulls(owner, repo)
            .create(title, head, base)
            .body(body)
            .send()
            .await?;

        Ok(GitHubPullRequest {
            id: pr.id.0, // Extract inner i64 from PullRequestId
            number: pr.number,
            title: pr.title,
            html_url: pr.html_url.to_string(),
            state: pr.state.to_string(),
        })
    }

    pub async fn get_repository(&self, owner: &str, repo: &str) -> Result<GitHubRepository, octocrab::Error> {
        let repo_data = self.client.repos(owner, repo).get().await?;

        let owner = repo_data.owner.unwrap_or_else(|| {
            // Default owner in case it's None
            octocrab::models::Author {
                login: "unknown".to_string(),
                id: octocrab::models::UserId(0),
                html_url: None,
                gravatar_id: None,
                r#type: "User".to_string(),
                site_admin: false,
                ..Default::default()
            }
        });

        Ok(GitHubRepository {
            id: repo_data.id.0, // Extract the inner i64 from RepositoryId
            name: repo_data.name,
            full_name: repo_data.full_name.unwrap_or_else(|| {
                format!("{}/{}", owner.login, repo_data.name)
            }),
            owner: GitHubUser {
                login: owner.login,
                id: owner.id.0, // Extract the inner i64 from UserId
                html_url: owner.html_url.map(|u| u.to_string()).unwrap_or_default(),
            },
            private: repo_data.private.unwrap_or(false),
            html_url: repo_data.html_url.map(|u| u.to_string()).unwrap_or_default(),
            description: repo_data.description,
            language: repo_data.language.map(|v| v.to_string()),
            updated_at: repo_data.updated_at.map(|dt| dt.to_rfc3339()).unwrap_or_default(),
        })
    }

    pub async fn check_repository_access(&self, owner: &str, repo: &str) -> Result<bool, octocrab::Error> {
        match self.get_repository(owner, repo).await {
            Ok(_) => Ok(true),
            Err(octocrab::Error::GitHub { source, .. }) => {
                if source.status_code == http::StatusCode::NOT_FOUND 
                   || source.status_code == http::StatusCode::FORBIDDEN {
                    Ok(false)
                } else {
                    Err(octocrab::Error::GitHub { source, backtrace: std::backtrace::Backtrace::disabled() })
                }
            }
            Err(e) => Err(e),
        }
    }
}

// Helper function to extract repo owner and name from full name
pub fn parse_repo_full_name(full_name: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = full_name.split('/').collect();
    if parts.len() == 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}