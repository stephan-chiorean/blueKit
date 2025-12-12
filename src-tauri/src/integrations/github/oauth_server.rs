/// Local HTTP server for handling OAuth redirects.
/// 
/// This module creates a local HTTP server that listens on localhost:8080
/// to receive the OAuth authorization code from GitHub's redirect.

use axum::{
    extract::Query,
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

/// Query parameters from GitHub OAuth callback.
#[derive(Debug, Deserialize)]
pub struct CallbackParams {
    /// Authorization code from GitHub
    code: Option<String>,
    /// State parameter for CSRF protection
    state: Option<String>,
    /// Error code if authorization was denied
    error: Option<String>,
    /// Error description
    error_description: Option<String>,
}

/// Starts the OAuth callback server.
/// 
/// Returns the port number the server is listening on, or an error.
/// The server will shut down after receiving a callback or on timeout.
pub async fn start_oauth_server(
    app_handle: AppHandle,
    oauth_state: Arc<Mutex<HashMap<String, String>>>,
    expected_state: String,
) -> Result<u16, String> {
    // Try ports starting from 8080
    let mut port = 8080u16;
    let max_attempts = 10;
    
    for _ in 0..max_attempts {
        match try_bind_port(port, app_handle.clone(), oauth_state.clone(), expected_state.clone()).await {
            Ok(()) => return Ok(port),
            Err(e) => {
                if port < 8080 + max_attempts - 1 {
                    port += 1;
                    tracing::warn!("Port {} in use, trying {}", port - 1, port);
                    continue;
                } else {
                    return Err(format!("Failed to bind to any port: {}", e));
                }
            }
        }
    }
    
    Err("Failed to find available port".to_string())
}

/// Attempts to bind to a specific port and start the server.
async fn try_bind_port(
    port: u16,
    app_handle: AppHandle,
    oauth_state: Arc<Mutex<HashMap<String, String>>>,
    expected_state: String,
) -> Result<(), String> {
    let redirect_uri = format!("http://localhost:{}/oauth/callback", port);
    
    // Build the router
    let router = Router::new().route(
        "/oauth/callback",
        get(move |query: Query<HashMap<String, String>>| {
            let app_handle = app_handle.clone();
            let oauth_state = oauth_state.clone();
            let expected_state = expected_state.clone();
            let redirect_uri = redirect_uri.clone();
            
            async move {
                handle_callback(query, app_handle, oauth_state, expected_state, redirect_uri).await
            }
        }),
    );
    
    // Try to bind to the port - 127.0.0.1 works fine, localhost resolves to it
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;
    
    let addr = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?;
    
    tracing::info!("OAuth server listening on http://{}", addr);
    
    // Spawn server in background task (it will run until shutdown or error)
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            tracing::error!("OAuth server error: {}", e);
        }
    });
    
    Ok(())
}

/// Handles the OAuth callback request.
async fn handle_callback(
    query: Query<HashMap<String, String>>,
    app_handle: AppHandle,
    oauth_state: Arc<Mutex<HashMap<String, String>>>,
    expected_state: String,
    redirect_uri: String,
) -> Response {
    // Parse query parameters
    let params = CallbackParams {
        code: query.get("code").cloned(),
        state: query.get("state").cloned(),
        error: query.get("error").cloned(),
        error_description: query.get("error_description").cloned(),
    };
    
    // Validate state matches expected
    if let Some(ref received_state) = params.state {
        if received_state != &expected_state {
            tracing::warn!("State mismatch: expected {}, got {}", expected_state, received_state);
            return Html(r#"
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authorization Failed</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                        }
                        .container {
                            text-align: center;
                            padding: 2rem;
                            background: white;
                            border-radius: 8px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        }
                        h1 { color: #dc3545; margin: 0 0 1rem 0; }
                        p { color: #666; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>✗ Authorization Failed</h1>
                        <p>Invalid state parameter. This may be a security issue.</p>
                    </div>
                </body>
                </html>
            "#).into_response();
        }
    }
    
    // If we have a code, look up the verifier and emit event with both
    if let Some(ref code) = params.code {
        if let Some(ref state) = params.state {
            let code_verifier = {
                let state_map = oauth_state.lock().unwrap();
                state_map.get(state).cloned()
            };
            
            if let Some(verifier) = code_verifier {
                tracing::info!("Found code_verifier for state, emitting oauth-callback event");
                // Emit event with code, state, verifier, and redirect_uri
                let _ = app_handle.emit_all("oauth-callback", serde_json::json!({
                    "code": code,
                    "state": state,
                    "code_verifier": verifier,
                    "redirect_uri": redirect_uri,
                }));
                
                // Clean up state
                {
                    let mut state_map = oauth_state.lock().unwrap();
                    state_map.remove(state);
                }
            } else {
                tracing::error!("No code_verifier found for state: {}. Available states: {:?}", 
                    state, 
                    oauth_state.lock().unwrap().keys().collect::<Vec<_>>());
                // Emit error event
                let _ = app_handle.emit_all("oauth-callback", serde_json::json!({
                    "error": "invalid_state",
                    "error_description": format!("No code_verifier found for state: {}", state),
                }));
            }
        }
    } else if let Some(ref error) = params.error {
        // Emit error event
        let _ = app_handle.emit_all("oauth-callback", serde_json::json!({
            "error": error,
            "error_description": params.error_description,
        }));
    }
    
    // Return HTML response
    let html_content = if params.code.is_some() {
        r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Successful</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .container {
                        text-align: center;
                        padding: 2rem;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    h1 { color: #28a745; margin: 0 0 1rem 0; }
                    p { color: #666; margin: 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✓ Authorization Successful</h1>
                    <p>You can close this window and return to the application.</p>
                </div>
            </body>
            </html>
        "#.to_string()
    } else if let Some(error) = &params.error {
        let error_msg = params.error_description.as_deref().unwrap_or(error);
        format!(r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Failed</title>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }}
                    .container {{
                        text-align: center;
                        padding: 2rem;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }}
                    h1 {{ color: #dc3545; margin: 0 0 1rem 0; }}
                    p {{ color: #666; margin: 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✗ Authorization Failed</h1>
                    <p>{}</p>
                </div>
            </body>
            </html>
        "#, error_msg.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#x27;"))
    } else {
        r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }
                    .container {
                        text-align: center;
                        padding: 2rem;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    p { color: #666; margin: 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <p>Processing authorization...</p>
                </div>
            </body>
            </html>
        "#.to_string()
    };
    
    Html(html_content).into_response()
}
