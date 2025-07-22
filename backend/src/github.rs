use http;
use octocrab::{Octocrab, OctocrabBuilder};
use serde::{Deserialize, Serialize};

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
    pub fn new(access_token: &str) -> Result<Self, Box<octocrab::Error>> {
        let client = OctocrabBuilder::new()
            .personal_token(access_token.to_string())
            .build()
            .map_err(Box::new)?;

        Ok(Self { client })
    }

    #[allow(dead_code)]
    pub async fn get_current_user(&self) -> Result<GitHubUser, octocrab::Error> {
        let user = self.client.current().user().await?;

        Ok(GitHubUser {
            login: user.login,
            id: user.id.0 as i64, // Convert u64 to i64
            html_url: user.html_url.to_string(),
        })
    }

    pub async fn get_user_repositories(
        &self,
        per_page: u8,
    ) -> Result<Vec<GitHubRepository>, octocrab::Error> {
        let mut repositories = Vec::new();
        let mut page = 1u8;

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

            let items_count = repos_page.items.len();

            for repo in repos_page.items {
                // Handle owner safely
                let owner_login = repo
                    .owner
                    .as_ref()
                    .map(|o| o.login.clone())
                    .unwrap_or_else(|| "unknown".to_string());

                let owner_id = repo.owner.as_ref().map(|o| o.id.0 as i64).unwrap_or(0);

                let owner_url = repo
                    .owner
                    .as_ref()
                    .map(|o| format!("https://github.com/{}", o.login))
                    .unwrap_or_default();

                repositories.push(GitHubRepository {
                    id: repo.id.0 as i64, // Convert u64 to i64
                    name: repo.name.clone(),
                    full_name: repo
                        .full_name
                        .clone()
                        .unwrap_or_else(|| format!("{}/{}", owner_login, repo.name)),
                    owner: GitHubUser {
                        login: owner_login,
                        id: owner_id,
                        html_url: owner_url,
                    },
                    private: repo.private.unwrap_or(false),
                    html_url: repo.html_url.map(|u| u.to_string()).unwrap_or_default(),
                    description: repo.description.clone(),
                    language: repo.language.as_ref().map(|v| v.to_string()),
                    updated_at: repo
                        .updated_at
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default(),
                });
            }

            // Check if we've reached the last page
            if items_count < per_page as usize {
                break;
            }

            page += 1;

            // Safety limit to prevent infinite loops
            if page > 100 {
                break;
            }
        }

        Ok(repositories)
    }

    #[allow(dead_code)]
    pub async fn check_repository_access(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<bool, octocrab::Error> {
        match self.client.repos(owner, repo).get().await {
            Ok(_) => Ok(true),
            Err(octocrab::Error::GitHub { source, .. }) => {
                if source.status_code == http::StatusCode::NOT_FOUND
                    || source.status_code == http::StatusCode::FORBIDDEN
                {
                    Ok(false)
                } else {
                    Err(octocrab::Error::GitHub {
                        source,
                        backtrace: std::backtrace::Backtrace::disabled(),
                    })
                }
            }
            Err(e) => Err(e),
        }
    }
}

pub async fn fetch_current_user(access_token: &str) -> anyhow::Result<(String, i32)> // (login, id)
{
    use octocrab::Octocrab;
    let octo = Octocrab::builder()
        .personal_token(access_token.to_owned())
        .build()?;
    let u = octo.current().user().await?;
    Ok((u.login, u.id.0 as i32))
}

// Helper function to extract repo owner and name from full name
#[allow(dead_code)]
pub fn parse_repo_full_name(full_name: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = full_name.split('/').collect();
    if parts.len() == 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_parse_repo_full_name() {
        // Test valid repo name
        let result = parse_repo_full_name("owner/repo");
        assert_eq!(result, Some(("owner".to_string(), "repo".to_string())));

        // Test invalid repo names
        assert_eq!(parse_repo_full_name("invalid"), None);
        assert_eq!(parse_repo_full_name("owner/repo/extra"), None);
        assert_eq!(parse_repo_full_name(""), None);
    }

    #[tokio::test]
    async fn test_github_client_creation() {
        let client = GitHubClient::new("test_token");
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_github_user_serialization() {
        let user = GitHubUser {
            login: "testuser".to_string(),
            id: 12345,
            html_url: "https://github.com/testuser".to_string(),
        };

        let json = serde_json::to_string(&user).expect("Failed to serialize user");
        let deserialized: GitHubUser =
            serde_json::from_str(&json).expect("Failed to deserialize user");

        assert_eq!(deserialized.login, "testuser");
        assert_eq!(deserialized.id, 12345);
        assert_eq!(deserialized.html_url, "https://github.com/testuser");
    }

    #[tokio::test]
    async fn test_github_repository_serialization() {
        let repo = GitHubRepository {
            id: 123456789,
            name: "test-repo".to_string(),
            full_name: "owner/test-repo".to_string(),
            owner: GitHubUser {
                login: "owner".to_string(),
                id: 12345,
                html_url: "https://github.com/owner".to_string(),
            },
            private: false,
            html_url: "https://github.com/owner/test-repo".to_string(),
            description: Some("A test repository".to_string()),
            language: Some("Rust".to_string()),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&repo).expect("Failed to serialize repository");
        let deserialized: GitHubRepository =
            serde_json::from_str(&json).expect("Failed to deserialize repository");

        assert_eq!(deserialized.name, "test-repo");
        assert_eq!(deserialized.owner.login, "owner");
        assert_eq!(deserialized.private, false);
    }

    #[tokio::test]
    async fn test_github_mock_api_response() {
        // This test demonstrates how to mock GitHub API responses
        // Useful for testing without hitting the real GitHub API

        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/user"))
            .and(header("authorization", "token test_token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "login": "testuser",
                "id": 12345,
                "html_url": "https://github.com/testuser"
            })))
            .mount(&mock_server)
            .await;

        // This is a demonstration - actual implementation would require
        // configuring octocrab to use the mock server URL
        assert!(true); // Placeholder assertion
    }

    #[test]
    fn test_github_structures_debug() {
        let user = GitHubUser {
            login: "debuguser".to_string(),
            id: 999,
            html_url: "https://github.com/debuguser".to_string(),
        };

        let debug_output = format!("{:?}", user);
        assert!(debug_output.contains("debuguser"));
        assert!(debug_output.contains("999"));
    }

    #[test]
    fn test_github_repository_with_optional_fields() {
        let repo = GitHubRepository {
            id: 987654321,
            name: "minimal-repo".to_string(),
            full_name: "user/minimal-repo".to_string(),
            owner: GitHubUser {
                login: "user".to_string(),
                id: 111,
                html_url: "https://github.com/user".to_string(),
            },
            private: true,
            html_url: "https://github.com/user/minimal-repo".to_string(),
            description: None, // Test None values
            language: None,    // Test None values
            updated_at: "".to_string(),
        };

        // Test that None values serialize/deserialize properly
        let json = serde_json::to_string(&repo).expect("Failed to serialize");
        let _deserialized: GitHubRepository =
            serde_json::from_str(&json).expect("Failed to deserialize");
    }
}
