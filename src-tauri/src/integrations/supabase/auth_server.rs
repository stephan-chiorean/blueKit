/// Supabase OAuth loopback server.
/// 
/// Handles OAuth callback from Supabase by capturing tokens from the redirect URL.
/// Supabase returns session tokens directly in the URL fragment (hash).

use axum::{
    extract::Query,
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use tauri::{AppHandle, Manager};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

/// Query parameters from Supabase OAuth callback.
/// Supabase may return tokens in query params or hash fragment.
#[derive(Debug, Deserialize)]
pub struct AuthCallback {
    access_token: Option<String>,
    refresh_token: Option<String>,
    token_type: Option<String>,
    expires_in: Option<i64>,
    error: Option<String>,
    error_description: Option<String>,
    // PKCE code flow params
    code: Option<String>,
}

/// Starts the Supabase auth callback server on an available port.
/// Returns the port number and a channel to receive shutdown signal.
pub async fn start_auth_server(
    app_handle: AppHandle,
) -> Result<(u16, oneshot::Sender<()>), String> {
    // Try ports 8080-8089
    for port in 8080..8090 {
        match try_bind_port(port, app_handle.clone()).await {
            Ok(result) => return Ok(result),
            Err(_) => continue,
        }
    }
    Err("Could not bind to any port in range 8080-8089".to_string())
}

async fn try_bind_port(
    port: u16,
    app_handle: AppHandle,
) -> Result<(u16, oneshot::Sender<()>), String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    
    let listener = TcpListener::bind(addr).await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;
    
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    
    let router = Router::new()
        .route("/auth/callback", get({
            let app_handle = app_handle.clone();
            move |query: Query<AuthCallback>| {
                let app_handle = app_handle.clone();
                async move {
                    handle_callback(query, app_handle).await
                }
            }
        }))
        // Also handle root for hash fragment extraction
        .route("/", get({
            let app_handle = app_handle.clone();
            move || {
                async move {
                    // Return HTML that extracts hash fragment and posts to /auth/callback
                    Html(HASH_EXTRACTOR_HTML.to_string())
                }
            }
        }));
    
    tracing::info!("Supabase auth server listening on http://localhost:{}", port);
    
    // Spawn server with graceful shutdown
    tokio::spawn(async move {
        let server = axum::serve(listener, router);
        tokio::select! {
            result = server => {
                if let Err(e) = result {
                    tracing::error!("Supabase auth server error: {}", e);
                }
            }
            _ = shutdown_rx => {
                tracing::info!("Supabase auth server shutting down");
            }
        }
    });
    
    Ok((port, shutdown_tx))
}

/// HTML page that extracts hash fragment and redirects to callback endpoint.
/// Supabase returns tokens in the URL fragment (#access_token=...).
const HASH_EXTRACTOR_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <title>BlueKit - Signing In...</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3f 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: rgba(255,255,255,0.6); }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>Signing in to BlueKit...</h1>
        <p>You can close this window after sign-in completes.</p>
    </div>
    <script>
        // Extract hash fragment and send to callback
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        if (params.get('access_token')) {
            // Redirect to callback endpoint with params as query string
            window.location.href = '/auth/callback?' + hash;
        } else if (window.location.search) {
            // Already have query params (code flow), redirect to callback
            window.location.href = '/auth/callback' + window.location.search;
        } else {
            document.querySelector('h1').textContent = 'No authentication data received';
            document.querySelector('p').textContent = 'Please try signing in again.';
            document.querySelector('.spinner').style.display = 'none';
        }
    </script>
</body>
</html>
"#;

/// Success HTML shown after authentication completes.
const SUCCESS_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <title>BlueKit - Signed In!</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3f 100%);
            color: white;
        }
        .container { text-align: center; padding: 2rem; }
        .checkmark {
            width: 60px;
            height: 60px;
            background: #22c55e;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
            font-size: 2rem;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #22c55e; }
        p { color: rgba(255,255,255,0.6); }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">✓</div>
        <h1>Successfully Signed In!</h1>
        <p>You can close this window and return to BlueKit.</p>
    </div>
</body>
</html>
"#;

/// Error HTML shown when authentication fails.
const ERROR_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
    <title>BlueKit - Sign In Failed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3f 100%);
            color: white;
        }
        .container { text-align: center; padding: 2rem; }
        .error-icon {
            width: 60px;
            height: 60px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
            font-size: 2rem;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #ef4444; }
        p { color: rgba(255,255,255,0.6); }
        .error-detail { font-size: 0.875rem; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">✕</div>
        <h1>Sign In Failed</h1>
        <p>{{ERROR_MESSAGE}}</p>
        <p class="error-detail">Please close this window and try again.</p>
    </div>
</body>
</html>
"#;

/// Handles the OAuth callback request.
async fn handle_callback(
    Query(params): Query<AuthCallback>,
    app_handle: AppHandle,
) -> impl IntoResponse {
    tracing::info!("Received Supabase auth callback");
    
    // Check for errors
    if let Some(error) = params.error {
        let description = params.error_description.unwrap_or_else(|| error.clone());
        tracing::error!("Supabase auth error: {} - {}", error, description);
        
        let _ = app_handle.emit_all("supabase-auth-callback", serde_json::json!({
            "error": error,
            "error_description": description,
        }));
        
        let html = ERROR_HTML.replace("{{ERROR_MESSAGE}}", &description);
        return Html(html);
    }
    
    // Handle token response (implicit flow)
    if let (Some(access_token), Some(refresh_token)) = (params.access_token, params.refresh_token) {
        tracing::info!("Received tokens from Supabase");
        
        let _ = app_handle.emit_all("supabase-auth-callback", serde_json::json!({
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": params.token_type.unwrap_or_else(|| "bearer".to_string()),
            "expires_in": params.expires_in,
        }));
        
        return Html(SUCCESS_HTML.to_string());
    }
    
    // Handle code response (PKCE flow)
    if let Some(code) = params.code {
        tracing::info!("Received authorization code from Supabase");
        
        let _ = app_handle.emit_all("supabase-auth-callback", serde_json::json!({
            "code": code,
        }));
        
        return Html(SUCCESS_HTML.to_string());
    }
    
    // No query params received - tokens may be in hash fragment
    // Serve HTML that extracts hash fragment and redirects with query params
    tracing::info!("No query params, serving hash extractor for fragment-based tokens");
    Html(HASH_EXTRACTOR_HTML.to_string())
}
