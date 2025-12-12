/// GitHub API client module.
/// 
/// This module provides a type-safe client for interacting with GitHub's REST API.
/// All API calls are authenticated using the GitHub token stored in the keychain.

use serde::{Deserialize, Serialize};
use super::keychain::KeychainManager;

/// GitHub API client for making authenticated requests.
pub struct GitHubClient {
    token: String,
    client: reqwest::Client,
}

impl GitHubClient {
    /// Creates a new GitHub client with a token.
    pub fn new(token: String) -> Self {
        Self {
            token,
            client: reqwest::Client::new(),
        }
    }

    /// Creates a new GitHub client by retrieving the token from the keychain.
    pub fn from_keychain() -> Result<Self, String> {
        let manager = KeychainManager::new()?;
        let token_data = manager.retrieve_token()?;
        Ok(Self::new(token_data.access_token))
    }

    /// Makes an authenticated request to the GitHub API.
    async fn request<T>(
        &self,
        method: &str,
        endpoint: String,
        body: Option<serde_json::Value>,
    ) -> Result<T, String>
    where
        T: serde::de::DeserializeOwned,
    {
        let url = format!("https://api.github.com{}", endpoint);
        let mut request = self
            .client
            .request(
                method
                    .parse()
                    .map_err(|e| format!("Invalid HTTP method: {}", e))?,
                &url,
            )
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "BlueKit/1.0");

        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();

        // Handle rate limiting (429)
        if status == 429 {
            // Extract rate limit info from headers
            let remaining = response
                .headers()
                .get("x-ratelimit-remaining")
                .and_then(|h| h.to_str().ok())
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(0);

            if remaining == 0 {
                let reset_time = response
                    .headers()
                    .get("x-ratelimit-reset")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .map(|t| {
                        use std::time::{SystemTime, UNIX_EPOCH};
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs();
                        t.saturating_sub(now)
                    });

                let message = if let Some(secs) = reset_time {
                    format!("Rate limit exceeded. Try again in {} seconds.", secs)
                } else {
                    "Rate limit exceeded. Please try again later.".to_string()
                };

                return Err(message);
            }
        }

        // Handle authentication errors
        if status == 401 {
            return Err("Authentication failed. Please sign in again.".to_string());
        }

        if status == 403 {
            return Err("Access forbidden. Check your token permissions.".to_string());
        }

        if status == 404 {
            return Err("Resource not found.".to_string());
        }

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error ({}): {}", status, error_text));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    /// Gets the authenticated user's information.
    pub async fn get_user(&self) -> Result<GitHubUser, String> {
        self.request::<GitHubUser>("GET", "/user".to_string(), None).await
    }

    /// Gets the authenticated user's repositories.
    pub async fn get_user_repos(&self) -> Result<Vec<GitHubRepo>, String> {
        self.request::<Vec<GitHubRepo>>("GET", "/user/repos".to_string(), None)
            .await
    }

    /// Gets the contents of a file from a repository.
    pub async fn get_file_contents(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<String, String> {
        let endpoint = format!("/repos/{}/{}/contents/{}", owner, repo, path);
        let response: GitHubContentResponse = self
            .request("GET", endpoint, None)
            .await?;

        // Decode base64 content
        use base64::prelude::*;
        let content = BASE64_STANDARD
            .decode(response.content.replace('\n', ""))
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        String::from_utf8(content)
            .map_err(|e| format!("Failed to convert to UTF-8: {}", e))
    }

    /// Creates or updates a file in a repository.
    pub async fn create_or_update_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        content: &str,
        message: &str,
        sha: Option<&str>, // Required for updates
    ) -> Result<GitHubFileResponse, String> {
        let endpoint = format!("/repos/{}/{}/contents/{}", owner, repo, path);
        
        // Encode content to base64
        use base64::prelude::*;
        let encoded_content = BASE64_STANDARD.encode(content);

        let mut body = serde_json::json!({
            "message": message,
            "content": encoded_content,
        });

        // Add SHA for updates
        if let Some(sha) = sha {
            body["sha"] = serde_json::Value::String(sha.to_string());
        }

        self.request("PUT", endpoint, Some(body)).await
    }

    /// Deletes a file from a repository.
    pub async fn delete_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        message: &str,
        sha: &str, // Required for deletion
    ) -> Result<GitHubFileResponse, String> {
        let endpoint = format!("/repos/{}/{}/contents/{}", owner, repo, path);
        
        let body = serde_json::json!({
            "message": message,
            "sha": sha,
        });

        self.request("DELETE", endpoint, Some(body)).await
    }

    /// Gets a file's SHA (for checking if file exists and getting SHA for updates).
    pub async fn get_file_sha(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<Option<String>, String> {
        let endpoint = format!("/repos/{}/{}/contents/{}", owner, repo, path);
        
        match self.request::<GitHubContentResponse>("GET", endpoint, None).await {
            Ok(response) => Ok(Some(response.sha)),
            Err(e) => {
                if e.contains("404") || e.contains("not found") {
                    Ok(None)
                } else {
                    Err(e)
                }
            }
        }
    }

    /// Gets a tree (directory contents) from a repository.
    pub async fn get_tree(
        &self,
        owner: &str,
        repo: &str,
        tree_sha: &str,
    ) -> Result<GitHubTreeResponse, String> {
        let endpoint = format!("/repos/{}/{}/git/trees/{}", owner, repo, tree_sha);
        self.request("GET", endpoint, None).await
    }
}

/// GitHub content response (file or directory).
#[derive(Debug, Serialize, Deserialize, Clone)]
struct GitHubContentResponse {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub size: u64,
    pub url: String,
    pub html_url: String,
    pub git_url: String,
    pub download_url: Option<String>,
    #[serde(rename = "type")]
    pub content_type: String, // "file" or "dir"
    pub content: String, // Base64 encoded for files
    pub encoding: Option<String>, // "base64" for files
}

/// GitHub file operation response.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubFileResponse {
    pub content: GitHubContentResponse,
    pub commit: GitHubCommitInfo,
}

/// GitHub commit information.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubCommitInfo {
    pub sha: String,
    pub html_url: String,
    pub message: String,
    pub author: GitHubCommitAuthor,
    pub committer: GitHubCommitAuthor,
}

/// GitHub commit author information.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubCommitAuthor {
    pub name: String,
    pub email: String,
    pub date: String,
}

/// GitHub tree response.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubTreeResponse {
    pub sha: String,
    pub url: String,
    pub tree: Vec<GitHubTreeItem>,
    pub truncated: bool,
}

/// GitHub tree item (file or directory in tree).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubTreeItem {
    pub path: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub item_type: String, // "blob" or "tree"
    pub sha: String,
    pub size: Option<u64>,
    pub url: String,
}

// Make types public for use in commands

/// GitHub user information from API.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: String,
    pub html_url: String,
    pub bio: Option<String>,
    pub company: Option<String>,
    pub location: Option<String>,
    pub public_repos: u32,
    pub followers: u32,
    pub following: u32,
}

/// GitHub repository information from API.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubRepoOwner,
    pub description: Option<String>,
    pub private: bool,
    pub fork: bool,
    pub default_branch: String,
    pub html_url: String,
    pub clone_url: String,
    pub ssh_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub pushed_at: String,
    pub stargazers_count: u32,
    pub watchers_count: u32,
    pub forks_count: u32,
    pub language: Option<String>,
}

/// GitHub repository owner information.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubRepoOwner {
    pub login: String,
    pub id: u64,
    pub avatar_url: String,
    pub html_url: String,
}
