---
id: github-device-flow-auth
alias: GitHub Device Flow Authentication
type: kit
is_base: false
version: 1
tags:
  - tauri
  - authentication
  - github
description: Complete GitHub Device Flow OAuth authentication system for Tauri apps with secure keychain storage and React UI components
---
# GitHub Device Flow Authentication Kit

A complete, production-ready GitHub Device Flow OAuth authentication system for Tauri applications. This kit provides secure token storage using OS keychains, a React-based authentication UI, and a type-safe GitHub API client.

## Overview

This kit implements GitHub's Device Flow OAuth, the recommended authentication method for desktop applications. It includes:

- **Backend (Rust)**: Device flow authentication, secure keychain storage, GitHub API client
- **Frontend (React)**: Authentication provider, login screen, and hooks
- **Type Safety**: Full TypeScript and Rust type definitions
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Architecture

```
┌─────────────────┐
│  React UI       │
│  (Auth Screen)  │
└────────┬────────┘
         │ IPC
         ▼
┌─────────────────┐
│  Tauri Commands │
│  (auth_*)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Auth Module    │────▶│  Keychain     │     │  GitHub API  │
│  (Device Flow)  │     │  (Storage)    │     │  (Client)    │
└─────────────────┘     └──────────────┘     └──────────────┘
```

## Backend Implementation

### 1. Authentication Module (`src-tauri/src/auth.rs`)

Handles the GitHub Device Flow OAuth process:

```rust
/// GitHub OAuth Device Flow authentication module.
/// 
/// This module implements GitHub's Device Flow OAuth, which is the recommended
/// authentication method for desktop applications. The flow works as follows:
/// 
/// 1. Request a device code from GitHub
/// 2. Display the user code to the user
/// 3. User visits GitHub.com and enters the code
/// 4. Poll GitHub for the access token
/// 5. Store the token in the keychain when received

use serde::{Deserialize, Serialize};
use crate::keychain::{KeychainManager, GitHubToken};

/// Device flow status for tracking authentication progress.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum DeviceFlowStatus {
    /// Waiting for user to authorize
    #[serde(rename = "pending")]
    Pending,
    /// User has authorized, token received
    #[serde(rename = "authorized")]
    Authorized { token: GitHubToken },
    /// Device code expired
    #[serde(rename = "expired")]
    Expired,
    /// User denied authorization
    #[serde(rename = "denied")]
    Denied,
    /// Error occurred
    #[serde(rename = "error")]
    Error { message: String },
}

/// Starts the GitHub device flow by requesting a device code.
pub async fn start_device_flow() -> Result<(String, String, String, u64), String> {
    let client_id = get_client_id()?;
    
    let client = reqwest::Client::new();
    let mut params: Vec<(String, String)> = vec![
        ("client_id".to_string(), client_id),
    ];
    
    // Add client secret if available (recommended but not required)
    if let Some(secret) = get_client_secret() {
        params.push(("client_secret".to_string(), secret));
    }
    
    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to request device code: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({}): {}", status, text));
    }
    
    let device_response: DeviceCodeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse device code response: {}", e))?;
    
    Ok((
        device_response.device_code,
        device_response.user_code,
        device_response.verification_uri,
        device_response.interval,
    ))
}

/// Checks once for the access token using the device code (single poll, no loop).
/// This is used for button-triggered checks instead of continuous polling.
pub async fn check_token_once(
    device_code: &str,
) -> Result<DeviceFlowStatus, String> {
    let client_id = get_client_id()?;
    
    let client = reqwest::Client::new();
    let mut params: Vec<(String, String)> = vec![
        ("client_id".to_string(), client_id),
        ("device_code".to_string(), device_code.to_string()),
        ("grant_type".to_string(), "urn:ietf:params:oauth:grant-type:device_code".to_string()),
    ];
    
    // Add client secret if available
    if let Some(secret) = get_client_secret() {
        params.push(("client_secret".to_string(), secret));
    }
    
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to check token: {}", e))?;
    
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    
    if status.is_success() {
        // Try to parse as access token response
        if let Ok(token_response) = serde_json::from_str::<AccessTokenResponse>(&text) {
            let token = GitHubToken {
                access_token: token_response.access_token,
                token_type: token_response.token_type,
                scope: token_response.scope,
                expires_at: None, // GitHub tokens don't expire by default
            };
            
            // Store token in keychain
            let manager = KeychainManager::new()?;
            manager.store_token(&token)?;
            
            return Ok(DeviceFlowStatus::Authorized { token });
        }
        
        // Try to parse as error response
        if let Ok(error_response) = serde_json::from_str::<OAuthError>(&text) {
            match error_response.error.as_str() {
                "authorization_pending" => {
                    return Ok(DeviceFlowStatus::Pending);
                }
                "expired_token" => {
                    return Ok(DeviceFlowStatus::Expired);
                }
                "access_denied" => {
                    return Ok(DeviceFlowStatus::Denied);
                }
                _ => {
                    return Ok(DeviceFlowStatus::Error {
                        message: error_response.error_description
                            .unwrap_or_else(|| error_response.error.clone())
                    });
                }
            }
        }
        
        return Err(format!("Unexpected response from GitHub: {}", text));
    } else {
        return Err(format!("GitHub API error ({}): {}", status, text));
    }
}

/// Gets the current authentication status by checking for a stored token.
pub fn get_auth_status() -> Result<DeviceFlowStatus, String> {
    let manager = KeychainManager::new()?;
    match manager.retrieve_token() {
        Ok(token) => Ok(DeviceFlowStatus::Authorized { token }),
        Err(_) => Ok(DeviceFlowStatus::Pending),
    }
}

/// Gets the GitHub OAuth client ID from environment variables.
fn get_client_id() -> Result<String, String> {
    std::env::var("GITHUB_CLIENT_ID")
        .map_err(|_| "GITHUB_CLIENT_ID not set in environment variables".to_string())
}

/// Gets the GitHub OAuth client secret from environment variables (optional).
fn get_client_secret() -> Option<String> {
    std::env::var("GITHUB_CLIENT_SECRET").ok()
}
```

### 2. Keychain Module (`src-tauri/src/keychain.rs`)

Provides secure, cross-platform token storage:

```rust
/// Keychain management module for secure token storage.
/// 
/// This module provides a unified interface for storing and retrieving
/// sensitive data (like GitHub tokens) using the OS keychain:
/// - macOS: Keychain
/// - Windows: Credential Manager
/// - Linux: Secret Service API

use serde::{Deserialize, Serialize};

/// GitHub token structure for storage in keychain.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubToken {
    pub access_token: String,
    pub token_type: String, // "bearer"
    pub scope: String,     // "repo,user,read:org"
    pub expires_at: Option<i64>, // Unix timestamp (if applicable)
}

/// Platform-agnostic trait for keychain backends.
pub trait KeychainBackend {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String>;
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String>;
    fn delete(&self, service: &str, key: &str) -> Result<(), String>;
}

/// Unified keychain manager that abstracts platform-specific implementations.
pub struct KeychainManager {
    backend: Box<dyn KeychainBackend>,
}

impl KeychainManager {
    /// Creates a new KeychainManager with the appropriate backend for the current platform.
    pub fn new() -> Result<Self, String> {
        #[cfg(target_os = "macos")]
        let backend: Box<dyn KeychainBackend> = Box::new(MacOSKeychain);
        
        #[cfg(target_os = "windows")]
        let backend: Box<dyn KeychainBackend> = Box::new(WindowsKeychain);
        
        #[cfg(target_os = "linux")]
        let backend: Box<dyn KeychainBackend> = Box::new(LinuxKeychain);
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return Err("Unsupported platform for keychain operations".to_string());
        
        Ok(Self { backend })
    }
    
    /// Stores a GitHub token in the keychain.
    pub fn store_token(&self, token: &GitHubToken) -> Result<(), String> {
        let serialized = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token: {}", e))?;
        self.backend.store("bluekit", "github_token", &serialized)
    }
    
    /// Retrieves a GitHub token from the keychain.
    pub fn retrieve_token(&self) -> Result<GitHubToken, String> {
        let serialized = self.backend.retrieve("bluekit", "github_token")?;
        serde_json::from_str(&serialized)
            .map_err(|e| format!("Failed to deserialize token: {}", e))
    }
    
    /// Deletes a GitHub token from the keychain.
    pub fn delete_token(&self) -> Result<(), String> {
        self.backend.delete("bluekit", "github_token")
    }
}
```

**Platform Implementations:**

- **macOS**: Uses `keyring` crate
- **Windows**: Uses Windows Credential Manager API
- **Linux**: Uses Secret Service API

### 3. GitHub API Client (`src-tauri/src/github.rs`)

Type-safe GitHub API client:

```rust
/// GitHub API client module.
/// 
/// This module provides a type-safe client for interacting with GitHub's REST API.
/// All API calls are authenticated using the GitHub token stored in the keychain.

use serde::{Deserialize, Serialize};
use crate::keychain::KeychainManager;

/// GitHub API client for making authenticated requests.
pub struct GitHubClient {
    token: String,
    client: reqwest::Client,
}

impl GitHubClient {
    /// Creates a new GitHub client by retrieving the token from the keychain.
    pub fn from_keychain() -> Result<Self, String> {
        let manager = KeychainManager::new()?;
        let token_data = manager.retrieve_token()?;
        Ok(Self::new(token_data.access_token))
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
}
```

## Frontend Implementation

### 1. TypeScript Types (`src/types/github.ts`)

```typescript
/**
 * GitHub token structure stored in keychain.
 */
export interface GitHubToken {
  /** OAuth access token */
  access_token: string;
  /** Token type (typically "bearer") */
  token_type: string;
  /** Comma-separated list of scopes (e.g., "repo,user,read:org") */
  scope: string;
  /** Optional expiration timestamp (Unix timestamp) */
  expires_at?: number;
}

/**
 * GitHub user information from API.
 */
export interface GitHubUser {
  /** GitHub user ID */
  id: number;
  /** GitHub username */
  login: string;
  /** Display name */
  name: string | null;
  /** Email address */
  email: string | null;
  /** Avatar URL */
  avatar_url: string;
  /** Profile URL */
  html_url: string;
  /** Bio */
  bio: string | null;
  /** Company */
  company: string | null;
  /** Location */
  location: string | null;
  /** Public repositories count */
  public_repos: number;
  /** Followers count */
  followers: number;
  /** Following count */
  following: number;
}

/**
 * Device flow status for tracking authentication progress.
 */
export type DeviceFlowStatus =
  | { type: 'pending' }
  | { type: 'authorized'; token: GitHubToken }
  | { type: 'expired' }
  | { type: 'denied' }
  | { type: 'error'; message: string };
```

### 2. Authentication Provider (`src/auth/github/GitHubAuthProvider.tsx`)

```typescript
/**
 * GitHub Authentication Provider.
 * 
 * This React context provider manages GitHub authentication state throughout the app.
 * It handles token loading, authentication status, and provides auth actions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GitHubToken, DeviceFlowStatus, GitHubUser } from '../../types/github';
import {
  invokeKeychainRetrieveToken,
  invokeKeychainDeleteToken,
  invokeAuthGetStatus,
  invokeGitHubGetUser,
} from '../../ipc';

interface GitHubAuthContextValue {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GitHubUser | null;
  token: GitHubToken | null;

  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setToken: (token: GitHubToken) => void;
  setUser: (user: GitHubUser | null) => void;
}

const GitHubAuthContext = createContext<GitHubAuthContextValue | undefined>(undefined);

export function GitHubAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<GitHubToken | null>(null);

  // Load token and user info from keychain on mount
  const loadStoredToken = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedToken = await invokeKeychainRetrieveToken();
      setToken(storedToken);
      setIsAuthenticated(true);
      
      // Fetch user info from GitHub API
      try {
        const userInfo = await invokeGitHubGetUser();
        setUser(userInfo);
      } catch (error) {
        console.warn('Failed to fetch user info:', error);
      }
    } catch (error) {
      setToken(null);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load token on mount
  useEffect(() => {
    loadStoredToken();
  }, [loadStoredToken]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await invokeKeychainDeleteToken();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }, []);

  const value: GitHubAuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    token,
    signIn: loadStoredToken,
    signOut,
    refreshAuth: loadStoredToken,
    setToken: async (newToken: GitHubToken) => {
      setToken(newToken);
      setIsAuthenticated(true);
      try {
        const userInfo = await invokeGitHubGetUser();
        setUser(userInfo);
      } catch (error) {
        console.warn('Failed to fetch user info:', error);
      }
    },
    setUser,
  };

  return (
    <GitHubAuthContext.Provider value={value}>
      {children}
    </GitHubAuthContext.Provider>
  );
}

export function useGitHubAuth() {
  const context = useContext(GitHubAuthContext);
  if (!context) {
    throw new Error('useGitHubAuth must be used within GitHubAuthProvider');
  }
  return context;
}
```

### 3. Authentication Screen (`src/auth/github/GitHubAuthScreen.tsx`)

```typescript
/**
 * GitHub Authentication Screen.
 * 
 * This component handles the GitHub device flow OAuth process.
 * It displays the user code, opens GitHub in the browser, and checks for token on button click.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  Center,
  Separator,
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/shell';
import { useGitHubAuth } from './GitHubAuthProvider';
import {
  invokeAuthStartDeviceFlow,
  invokeAuthCheckTokenOnce,
} from '../../ipc';
import { toaster } from '../../components/ui/toaster';

interface GitHubAuthScreenProps {
  onSuccess?: () => void;
  onSkip?: () => void;
}

export function GitHubAuthScreen({ onSuccess, onSkip }: GitHubAuthScreenProps) {
  const { setToken } = useGitHubAuth();
  
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  // Start device flow
  const startFlow = useCallback(async () => {
    try {
      setIsLoading(true);
      const [code, user, uri] = await invokeAuthStartDeviceFlow();
      setDeviceCode(code);
      setUserCode(user);
      setVerificationUri(uri);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start authentication';
      toaster.create({
        type: 'error',
        title: 'Authentication Error',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start flow on mount
  useEffect(() => {
    startFlow();
  }, [startFlow]);

  // Check token once (button-triggered)
  const checkToken = useCallback(async () => {
    if (!deviceCode || isChecking) return;

    setIsChecking(true);
    try {
      const status = await invokeAuthCheckTokenOnce(deviceCode);

      if (status.type === 'authorized') {
        await setToken(status.token);
        toaster.create({
          type: 'success',
          title: 'Signed in successfully',
          description: 'You have been authenticated with GitHub.',
        });
        if (onSuccess) {
          onSuccess();
        }
      } else if (status.type === 'expired') {
        toaster.create({
          type: 'error',
          title: 'Code expired',
          description: 'The authentication code has expired. Please try again.',
        });
        startFlow();
      } else if (status.type === 'pending') {
        toaster.create({
          type: 'info',
          title: 'Not authorized yet',
          description: 'Please complete the authorization on GitHub and try again.',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check authentication';
      toaster.create({
        type: 'error',
        title: 'Authentication error',
        description: errorMessage,
      });
    } finally {
      setIsChecking(false);
    }
  }, [deviceCode, isChecking, setToken, onSuccess, startFlow]);

  // Open GitHub in browser
  const handleOpenGitHub = useCallback(async () => {
    if (verificationUri) {
      try {
        await open(verificationUri);
      } catch (err) {
        toaster.create({
          type: 'warning',
          title: 'Failed to open browser',
          description: 'Please visit the URL manually.',
        });
      }
    }
  }, [verificationUri]);

  // Format user code with hyphen
  const formattedCode = userCode ? userCode.match(/.{1,4}/g)?.join('-') : '';

  if (isLoading || !userCode) {
    return (
      <Center h="100vh">
        <Box bg="bg.surface" borderRadius="xl" p={8} w="400px" boxShadow="lg">
          <VStack gap={6}>
            <Heading size="xl" fontWeight="bold" textAlign="center">
              Sign In
            </Heading>
            <Text color="fg.muted" textAlign="center">
              Setting up authentication...
            </Text>
          </VStack>
        </Box>
      </Center>
    );
  }

  return (
    <Center h="100vh" bg="main.bg">
      <Box bg="bg.surface" borderRadius="xl" p={8} w="400px" boxShadow="lg">
        <VStack gap={6} align="stretch">
          <Heading size="xl" fontWeight="bold" textAlign="center">
            Sign In
          </Heading>

          <VStack gap={4}>
            <Box w="100%">
              <Text fontSize="sm" color="fg.muted" mb={2}>
                Enter this code on GitHub
              </Text>
              <Input
                value={formattedCode}
                readOnly
                fontSize="lg"
                fontWeight="semibold"
                textAlign="center"
                letterSpacing="wide"
                bg="gray.50"
                borderColor="gray.200"
                _dark={{
                  bg: 'gray.800',
                  borderColor: 'gray.700',
                }}
                cursor="text"
                onClick={(e) => {
                  (e.target as HTMLInputElement).select();
                }}
              />
            </Box>

            <Button
              onClick={handleOpenGitHub}
              width="100%"
              size="lg"
              colorPalette="blue"
            >
              Open GitHub to Authorize
            </Button>

            {verificationUri && (
              <>
                <Separator />
                <Text fontSize="xs" color="fg.muted" textAlign="center">
                  Or visit: {verificationUri}
                </Text>
              </>
            )}

            <Button
              onClick={checkToken}
              width="100%"
              size="lg"
              loading={isChecking}
              disabled={!deviceCode || isChecking}
            >
              {isChecking ? 'Checking...' : 'Continue'}
            </Button>
          </VStack>

          {onSkip && (
            <Button
              variant="ghost"
              onClick={onSkip}
              size="sm"
              mt={2}
            >
              Skip for now
            </Button>
          )}
        </VStack>
      </Box>
    </Center>
  );
}
```

## IPC Integration

### Tauri Commands (`src-tauri/src/commands.rs`)

Add these command handlers:

```rust
// KEYCHAIN COMMANDS
use crate::keychain::{KeychainManager, GitHubToken};

/// Stores a GitHub token in the OS keychain.
#[tauri::command]
pub async fn keychain_store_token(token: GitHubToken) -> Result<(), String> {
    let manager = KeychainManager::new()?;
    manager.store_token(&token)
}

/// Retrieves a GitHub token from the OS keychain.
#[tauri::command]
pub async fn keychain_retrieve_token() -> Result<GitHubToken, String> {
    let manager = KeychainManager::new()?;
    manager.retrieve_token()
}

/// Deletes a GitHub token from the OS keychain.
#[tauri::command]
pub async fn keychain_delete_token() -> Result<(), String> {
    let manager = KeychainManager::new()?;
    manager.delete_token()
}

// AUTHENTICATION COMMANDS
use crate::auth::{start_device_flow, check_token_once, get_auth_status, DeviceFlowStatus};

/// Starts the GitHub device flow authentication.
#[tauri::command]
pub async fn auth_start_device_flow() -> Result<(String, String, String, u64), String> {
    start_device_flow().await
}

/// Checks once for the access token using the device code.
#[tauri::command]
pub async fn auth_check_token_once(
    device_code: String,
) -> Result<DeviceFlowStatus, String> {
    check_token_once(&device_code).await
}

/// Gets the current authentication status.
#[tauri::command]
pub async fn auth_get_status() -> Result<DeviceFlowStatus, String> {
    get_auth_status()
}

// GITHUB API COMMANDS
use crate::github::{GitHubClient, GitHubUser};

/// Gets the authenticated user's information from GitHub.
#[tauri::command]
pub async fn github_get_user() -> Result<GitHubUser, String> {
    let client = GitHubClient::from_keychain()?;
    client.get_user().await
}
```

### Register Commands (`src-tauri/src/main.rs`)

```rust
mod auth;     // GitHub OAuth authentication
mod github;   // GitHub API client
mod keychain; // Secure keychain storage for tokens

// In main() function:
.invoke_handler(tauri::generate_handler![
    // ... other commands
    commands::keychain_store_token,
    commands::keychain_retrieve_token,
    commands::keychain_delete_token,
    commands::auth_start_device_flow,
    commands::auth_check_token_once,
    commands::auth_get_status,
    commands::github_get_user,
    // ... more GitHub API commands
])
```

### Frontend IPC Wrappers (`src/ipc.ts`)

```typescript
import { GitHubToken, DeviceFlowStatus, GitHubUser } from './types/github';

/**
 * Starts the GitHub device flow authentication.
 */
export async function invokeAuthStartDeviceFlow(): Promise<[string, string, string, number]> {
  return await invokeWithTimeout<[string, string, string, number]>(
    'auth_start_device_flow',
    {},
    10000
  );
}

/**
 * Checks once for the access token using the device code.
 */
export async function invokeAuthCheckTokenOnce(
  deviceCode: string
): Promise<DeviceFlowStatus> {
  return await invokeWithTimeout<DeviceFlowStatus>(
    'auth_check_token_once',
    { deviceCode },
    10000
  );
}

/**
 * Gets the current authentication status.
 */
export async function invokeAuthGetStatus(): Promise<DeviceFlowStatus> {
  return await invokeWithTimeout<DeviceFlowStatus>('auth_get_status', {}, 5000);
}

/**
 * Retrieves a GitHub token from the OS keychain.
 */
export async function invokeKeychainRetrieveToken(): Promise<GitHubToken> {
  return await invokeWithTimeout<GitHubToken>('keychain_retrieve_token', {}, 5000);
}

/**
 * Deletes a GitHub token from the OS keychain.
 */
export async function invokeKeychainDeleteToken(): Promise<void> {
  return await invokeWithTimeout<void>('keychain_delete_token', {}, 5000);
}

/**
 * Gets the authenticated user's information from GitHub.
 */
export async function invokeGitHubGetUser(): Promise<GitHubUser> {
  return await invokeWithTimeout<GitHubUser>('github_get_user', {}, 10000);
}
```

## Dependencies

### Cargo.toml (`src-tauri/Cargo.toml`)

```toml
[dependencies]
# HTTP client for GitHub API
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }
# Environment variables (for development)
dotenv = "0.15"
# Base64 encoding/decoding
base64 = "0.21"

# Keychain dependencies (platform-specific)
[target.'cfg(target_os = "macos")'.dependencies]
keyring = "2.0"

[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = ["wincred"] }

[target.'cfg(target_os = "linux")'.dependencies]
secret-service = "3.0"
```

### package.json

```json
{
  "dependencies": {
    "@tauri-apps/api": "^1.5.0",
    "@chakra-ui/react": "^3.0.0"
  }
}
```

## Setup Instructions

### 1. Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Your app name
   - **Homepage URL**: Your app URL (can be placeholder)
   - **Authorization callback URL**: Not needed for device flow
4. Click "Register application"
5. Copy the **Client ID** and optionally create a **Client Secret**

### 2. Environment Variables

Create a `.env` file in your project root:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here  # Optional but recommended
```

### 3. Add Modules to Rust Project

Copy the three Rust modules:
- `src-tauri/src/auth.rs`
- `src-tauri/src/keychain.rs`
- `src-tauri/src/github.rs`

### 4. Add Frontend Components

Copy the frontend files:
- `src/types/github.ts`
- `src/auth/github/GitHubAuthProvider.tsx`
- `src/auth/github/GitHubAuthScreen.tsx`
- `src/auth/github/useGitHubAuth.ts` (re-export)
- `src/auth/github/index.ts` (optional barrel export)

### 5. Integrate in App

```typescript
// src/App.tsx
import { GitHubAuthProvider } from './auth/github/GitHubAuthProvider';
import { GitHubAuthScreen } from './auth/github/GitHubAuthScreen';
import { useGitHubAuth } from './auth/github';

function App() {
  return (
    <GitHubAuthProvider>
      <AppContent />
    </GitHubAuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useGitHubAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <GitHubAuthScreen />;
  }

  return <YourMainApp />;
}
```

## Usage Examples

### Check Authentication Status

```typescript
import { useGitHubAuth } from './auth/github';

function MyComponent() {
  const { isAuthenticated, user, signOut } = useGitHubAuth();

  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.login}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Make Authenticated GitHub API Calls

```typescript
import { invokeGitHubGetUser, invokeGitHubGetRepos } from './ipc';

async function fetchUserData() {
  try {
    const user = await invokeGitHubGetUser();
    const repos = await invokeGitHubGetRepos();
    console.log('User:', user.login);
    console.log('Repos:', repos.length);
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
}
```

## Customization

### Change Keychain Service Name

In `keychain.rs`, change the service name:

```rust
self.backend.store("your-app-name", "github_token", &serialized)
```

### Customize Auth Screen UI

Modify `GitHubAuthScreen.tsx` to match your app's design system. The component uses Chakra UI but can be adapted to any UI library.

### Add More GitHub API Methods

Extend `GitHubClient` in `github.rs` with additional methods following the same pattern.

## Security Considerations

1. **Client Secret**: While optional, including a client secret improves security
2. **Token Storage**: Tokens are stored in OS keychain, which is secure by default
3. **HTTPS Only**: All GitHub API calls use HTTPS
4. **Token Scope**: Request only the scopes you need (e.g., `repo`, `user`, `read:org`)

## Troubleshooting

### "GITHUB_CLIENT_ID not set"

Ensure your `.env` file is in the project root and contains `GITHUB_CLIENT_ID`.

### Keychain Access Denied (macOS)

On macOS, you may need to grant keychain access in System Preferences → Security & Privacy.

### Token Not Persisting

Check that the keychain backend is working correctly for your platform. Test with a simple store/retrieve operation.

## License

This kit is provided as-is for use in Tauri applications. Adapt as needed for your specific requirements.
