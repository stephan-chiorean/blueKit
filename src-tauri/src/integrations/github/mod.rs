/// GitHub integration module.
/// 
/// This module contains all GitHub-related functionality:
/// - OAuth authentication (PKCE flow)
/// - Secure keychain storage
/// - OAuth callback server
/// - GitHub API client

pub mod auth;
pub mod github;
pub mod keychain;
pub mod oauth_server;

// Re-export commonly used types
pub use auth::{AuthStatus, generate_code_verifier, generate_code_challenge, generate_state, generate_authorization_url, exchange_code_for_token, get_auth_status};
pub use github::{GitHubClient, GitHubUser, GitHubRepo, GitHubFileResponse, GitHubTreeResponse};
pub use keychain::{KeychainManager, GitHubToken};
