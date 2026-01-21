/// GitHub OAuth Authorization Code Flow authentication module.
/// 
/// This module implements GitHub's Authorization Code Flow OAuth with PKCE,
/// which is the recommended authentication method for desktop applications.
/// The flow works as follows:
/// 
/// 1. Generate PKCE code verifier and challenge
/// 2. Generate random state parameter for CSRF protection
/// 3. Create authorization URL with state and code challenge
/// 4. User authorizes on GitHub and is redirected to localhost
/// 5. Exchange authorization code for access token
/// 6. Store the token in the keychain

use serde::{Deserialize, Serialize};
use super::github::GitHubToken;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

/// Access token response from GitHub.
#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: String,
    token_type: String,
    scope: String,
}

/// Error response from GitHub OAuth API.
#[derive(Debug, Deserialize)]
struct OAuthError {
    error: String,
    error_description: Option<String>,
    error_uri: Option<String>,
}

/// Simplified authentication status.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum AuthStatus {
    /// User has authorized, token received
    #[serde(rename = "authorized")]
    Authorized { token: GitHubToken },
    /// Error occurred
    #[serde(rename = "error")]
    Error { message: String },
}

/// Gets the GitHub OAuth client ID from environment variables.
fn get_client_id() -> Result<String, String> {
    std::env::var("GITHUB_CLIENT_ID")
        .map_err(|_| "GITHUB_CLIENT_ID not set in environment variables".to_string())
}

/// Gets the GitHub OAuth client secret from environment variables (required for auth code flow).
fn get_client_secret() -> Result<String, String> {
    std::env::var("GITHUB_CLIENT_SECRET")
        .map_err(|_| "GITHUB_CLIENT_SECRET not set in environment variables".to_string())
}

/// Generates a random string for PKCE code verifier.
pub fn generate_code_verifier() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = rand::thread_rng();
    (0..128)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Generates PKCE code challenge from verifier.
pub fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(hash)
}

/// Generates a random state parameter for CSRF protection.
pub fn generate_state() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Generates the authorization URL with PKCE and state.
/// 
/// Returns (authorization_url, code_verifier)
/// 
/// Note: redirect_uri is hardcoded to http://localhost:8080/oauth/callback
/// If port 8080 is unavailable, the OAuth server will try alternative ports,
/// but the redirect URI in the GitHub OAuth app must match.
pub fn generate_authorization_url(port: u16, state: String) -> Result<(String, String), String> {
    let client_id = get_client_id()?;
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    
    let redirect_uri = format!("http://localhost:{}/oauth/callback", port);
    
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=repo,user,read:org,write:org,user:follow&state={}&code_challenge={}&code_challenge_method=S256",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state),
        urlencoding::encode(&code_challenge)
    );
    
    Ok((url, code_verifier))
}

/// Exchanges the authorization code for an access token.
pub async fn exchange_code_for_token(
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> Result<AuthStatus, String> {
    let client_id = get_client_id()?;
    let client_secret = get_client_secret()?;
    
    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", code.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
        ("code_verifier", code_verifier.to_string()),
    ];
    
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to exchange code for token: {}", e))?;
    
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    
    tracing::info!("Token exchange response: status={}, body={}", status, text);
    tracing::info!("Exchange parameters: redirect_uri={}, code_verifier length={}", redirect_uri, code_verifier.len());
    
    if status.is_success() {
        // Try to parse as access token response
        if let Ok(token_response) = serde_json::from_str::<AccessTokenResponse>(&text) {
            tracing::info!("Successfully parsed access token response");
            let token = GitHubToken {
                access_token: token_response.access_token,
                token_type: token_response.token_type,
                scope: token_response.scope,
                expires_at: None, // GitHub tokens don't expire by default
            };
            
            // Store token in keychain - REMOVED: We now rely on Supabase for storage
            // The token is returned to the frontend which saves it to Supabase
            tracing::info!("Token exchange successful");
            
            return Ok(AuthStatus::Authorized { token });
        }
        
        // Try to parse as error response
        if let Ok(error_response) = serde_json::from_str::<OAuthError>(&text) {
            tracing::warn!("GitHub returned OAuth error: {}", error_response.error);
            return Ok(AuthStatus::Error {
                message: error_response.error_description
                    .unwrap_or_else(|| error_response.error.clone())
            });
        }
        
        tracing::error!("Unexpected response format from GitHub: {}", text);
        return Err(format!("Unexpected response from GitHub: {}", text));
    } else {
        tracing::error!("GitHub API returned error status: {} - {}", status, text);
        return Err(format!("GitHub API error ({}): {}", status, text));
    }
}

/// Gets the current authentication status.
/// 
/// Note: Since we moved away from Keychain storage, this essentially just
/// returns "not authenticated" as the backend doesn't persist the token anymore.
/// The frontend manages the token state via Supabase.
pub fn get_auth_status() -> Result<AuthStatus, String> {
    // We no longer store tokens in the backend keychain
    Ok(AuthStatus::Error {
        message: "Not authenticated (backend storage removed)".to_string(),
    })
}
