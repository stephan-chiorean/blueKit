---
id: github-auth-flow-and-integration
alias: GitHub Authentication Flow and Integration Architecture
type: walkthrough
is_base: false
version: 2
tags:
  - github
  - authentication
  - architecture
description: Complete end-to-end documentation of the current GitHub OAuth authentication flow (Authorization Code Flow with PKCE) and how it expands into Library publishing, git operations, and team collaboration
complexity: comprehensive
format: architecture
author: BlueKit Team
lastReviewed: "2025-01-19"

sections:
  - id: overview
    title: "Overview"
    summary: "What this walkthrough covers and the current state of GitHub integration in BlueKit."
    icon: "🎯"
    type: overview
    estimatedMinutes: 2

  - id: architecture-overview
    title: "Architecture Overview"
    summary: "High-level system diagram showing how React, Tauri, and external services connect."
    icon: "🏗️"
    type: reference
    estimatedMinutes: 1

  - id: part-1-current-authentication-flow
    title: "Part 1: Current Authentication Flow"
    summary: "Deep dive into Authorization Code Flow with PKCE, component architecture, security measures, and complete data flow."
    icon: "🔐"
    type: deep-dive
    estimatedMinutes: 10
    collapsed: true

  - id: part-2-github-api-integration
    title: "Part 2: GitHub API Integration"
    summary: "API client architecture, token injection points, and available operations for user and repository management."
    icon: "📡"
    type: deep-dive
    estimatedMinutes: 4
    collapsed: true

  - id: part-3-library-workspace-system
    title: "Part 3: Library Workspace System"
    summary: "Current workspace implementation, data models, and the planned publishing flow for kits and artifacts."
    icon: "📚"
    type: deep-dive
    estimatedMinutes: 5
    collapsed: true

  - id: part-4-planned-expansions
    title: "Part 4: Planned Expansions"
    summary: "Roadmap including commit viewer, repository creator, git operations, and team collaboration features."
    icon: "🚀"
    type: reference
    estimatedMinutes: 3
    collapsed: true

  - id: part-5-implementation-phases
    title: "Part 5: Implementation Phases"
    summary: "Six-phase rollout from foundation through team features, with current progress status."
    icon: "📋"
    type: reference
    estimatedMinutes: 2
    collapsed: true

  - id: part-6-security-considerations
    title: "Part 6: Security Considerations"
    summary: "Token security, API security, and git operation security measures—all the ways we keep your data safe."
    icon: "🛡️"
    type: callout
    estimatedMinutes: 2
    collapsed: true

  - id: part-7-error-handling
    title: "Part 7: Error Handling"
    summary: "How authentication, API, and git errors are gracefully handled with user-friendly recovery paths."
    icon: "⚠️"
    type: reference
    estimatedMinutes: 2
    collapsed: true

  - id: conclusion
    title: "Conclusion"
    summary: "Key takeaways and the architectural principles that make this system work."
    icon: "✨"
    type: summary
    estimatedMinutes: 1

reading:
  showProgress: true
  showOutline: true
  expandAllByDefault: false
  highlightCurrentSection: true
---

# GitHub Authentication Flow and Integration Architecture

This walkthrough documents the complete GitHub authentication system in BlueKit, from the current OAuth implementation through the planned expansion into Library publishing, git operations, and team collaboration features.

## Overview

BlueKit uses GitHub OAuth for authentication, enabling users to sign in and access GitHub-backed features like Library workspaces, publishing kits, viewing commits, and team collaboration. The system is built with security, composability, and extensibility in mind.

### Current State

- ✅ **Authentication**: Authorization Code Flow with PKCE
- ✅ **Token Storage**: OS keychain (macOS, Windows, Linux)
- ✅ **GitHub API Client**: Basic user and repository operations
- ✅ **Library Workspaces**: Database-backed workspace management
- 🔄 **In Progress**: Publishing, git operations, team features

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│  GitHubAuthProvider → GitHubAuthScreen → useGitHubAuth      │
│  (Context)         (UI)              (Hook)                  │
└───────────────────────┬───────────────────────────────────────┘
                        │ IPC (Tauri)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Tauri Backend (Rust)                             │
├─────────────────────────────────────────────────────────────┤
│  OAuth Server → Auth Module → Keychain → GitHub API Client  │
│  (localhost)   (PKCE Flow)   (Storage)  (HTTP Client)       │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services                                │
├─────────────────────────────────────────────────────────────┤
│  GitHub OAuth API → GitHub REST API → OS Keychain            │
└─────────────────────────────────────────────────────────────┘
```

## Part 1: Current Authentication Flow

### 1.1 Authorization Code Flow with PKCE

BlueKit implements GitHub's Authorization Code Flow with PKCE (Proof Key for Code Exchange), which is more secure than the standard authorization code flow for desktop applications.

#### Flow Steps

1. **Generate PKCE Parameters**
   - Generate random `code_verifier` (128 characters)
   - Compute `code_challenge` (SHA256 hash, base64url encoded)
   - Generate random `state` parameter (32 characters) for CSRF protection

2. **Start OAuth Server**
   - Start local HTTP server on `localhost:8080` (or alternative port)
   - Server listens for OAuth callback at `/oauth/callback`
   - Store `state` → `code_verifier` mapping in memory

3. **Generate Authorization URL**
   - Build URL: `https://github.com/login/oauth/authorize`
   - Parameters: `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`
   - Scopes: `repo`, `user`, `read:org`

4. **User Authorization**
   - Open browser with authorization URL
   - User authorizes on GitHub
   - GitHub redirects to `http://localhost:8080/oauth/callback?code=...&state=...`

5. **Receive Callback**
   - OAuth server receives callback
   - Validates `state` parameter
   - Emits Tauri event `oauth-callback` with code and state

6. **Exchange Code for Token**
   - Frontend receives event
   - Calls `auth_exchange_code` Tauri command
   - Backend exchanges authorization code for access token
   - Includes `code_verifier` to prove possession

7. **Store Token**
   - Token stored in OS keychain
   - Token structure: `{ access_token, token_type, scope, expires_at }`

8. **Fetch User Info**
   - After token storage, fetch user info from GitHub API
   - Update React context with user data

### 1.2 Component Architecture

#### Frontend Components

**GitHubAuthProvider** (`src/auth/github/GitHubAuthProvider.tsx`)
- React context provider for authentication state
- Manages: `isAuthenticated`, `isLoading`, `user`, `token`
- Provides: `signIn()`, `signOut()`, `refreshAuth()`, `setToken()`, `setUser()`
- Loads token from keychain on mount
- Fetches user info when token is available

**GitHubAuthScreen** (`src/auth/github/GitHubAuthScreen.tsx`)
- UI component for authentication flow
- Starts authorization on mount
- Opens browser with GitHub authorization URL
- Listens for `oauth-callback` Tauri event
- Handles token exchange and success/error states
- Calls `setToken()` on successful authentication

**useGitHubAuth** (`src/auth/github/useGitHubAuth.ts`)
- Custom React hook for accessing auth context
- Throws error if used outside `GitHubAuthProvider`
- Provides type-safe access to auth state and actions

#### Backend Modules

**Auth Module** (`src-tauri/src/auth.rs`)
- `generate_code_verifier()`: Creates random PKCE verifier
- `generate_code_challenge()`: Computes SHA256 challenge
- `generate_state()`: Creates CSRF protection token
- `generate_authorization_url()`: Builds OAuth URL with PKCE
- `exchange_code_for_token()`: Exchanges code for access token
- `get_auth_status()`: Checks if token exists in keychain

**OAuth Server** (`src-tauri/src/oauth_server.rs`)
- Starts local HTTP server on available port
- Handles `/oauth/callback` endpoint
- Validates state parameter
- Emits Tauri event with callback data
- Handles errors and edge cases

**Keychain Module** (`src-tauri/src/keychain.rs`)
- Platform-agnostic trait: `KeychainBackend`
- Platform implementations:
  - **macOS**: Uses `keyring` crate
  - **Windows**: Uses `winapi` with Credential Manager
  - **Linux**: Uses `secret-service` crate
- Unified `KeychainManager` interface
- Methods: `store_token()`, `retrieve_token()`, `delete_token()`

**GitHub API Client** (`src-tauri/src/github.rs`)
- `GitHubClient` struct with token injection
- Token retrieved from keychain on each request
- Methods: `get_user()`, `get_user_repos()`, `get_file()`, `create_or_update_file()`, etc.
- All requests include `Authorization: Bearer <token>` header

### 1.3 Security Architecture

#### Token Security

- **Storage**: OS keychain (most secure option)
  - macOS: Keychain Access
  - Windows: Credential Manager
  - Linux: Secret Service API
- **Never Logged**: Tokens never appear in logs or console
- **In-Memory**: Tokens only in memory during API calls
- **Scope Minimization**: Request only necessary scopes (`repo`, `user`, `read:org`)

#### PKCE Security

- **Code Verifier**: 128 random characters
- **Code Challenge**: SHA256 hash, base64url encoded
- **State Parameter**: 32 random characters for CSRF protection
- **HTTPS Only**: All GitHub API calls use HTTPS

#### OAuth Server Security

- **Localhost Only**: Server only listens on `127.0.0.1`
- **State Validation**: Validates state parameter to prevent CSRF
- **Port Selection**: Tries ports starting from 8080, uses first available
- **Event-Based**: Uses Tauri events for secure IPC communication

### 1.4 Data Flow

```
User Action: Click "Sign In"
    │
    ▼
GitHubAuthScreen.startAuth()
    │
    ▼
Tauri: auth_start_authorization()
    │
    ├─→ Generate PKCE parameters
    ├─→ Start OAuth server (localhost:8080)
    ├─→ Store state → code_verifier mapping
    └─→ Return authorization URL
    │
    ▼
Open browser with GitHub URL
    │
    ▼
User authorizes on GitHub
    │
    ▼
GitHub redirects to localhost:8080/oauth/callback
    │
    ▼
OAuth server receives callback
    │
    ├─→ Validate state parameter
    └─→ Emit Tauri event: oauth-callback
    │
    ▼
GitHubAuthScreen receives event
    │
    ▼
Tauri: auth_exchange_code(code, state, code_verifier, redirect_uri)
    │
    ├─→ Exchange code for token (GitHub API)
    └─→ Store token in keychain
    │
    ▼
GitHubAuthProvider.setToken(token)
    │
    ├─→ Update React state
    └─→ Fetch user info (GitHub API)
    │
    ▼
User authenticated, context updated
```

## Part 2: GitHub API Integration

### 2.1 API Client Architecture

The GitHub API client is implemented in Rust and accessed via Tauri commands. All API calls include the access token from the keychain.

#### Client Structure

```rust
pub struct GitHubClient {
    token: String,
    client: reqwest::Client,
}

impl GitHubClient {
    pub fn from_keychain() -> Result<Self, String> {
        let manager = KeychainManager::new()?;
        let token = manager.retrieve_token()?;
        Ok(Self {
            token: token.access_token,
            client: reqwest::Client::new(),
        })
    }

    async fn request<T>(&self, method: &str, endpoint: String) -> Result<T, String> {
        // Token injected here in Authorization header
        let response = self.client
            .request(method.parse().unwrap(), &url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await?;
        // ... handle response
    }
}
```

#### Available Operations

**User Operations**
- `get_user()`: Get authenticated user info
- `get_user_repos()`: List user's repositories

**Repository Operations**
- `get_file()`: Get file contents
- `get_file_sha()`: Get file SHA (for updates)
- `create_or_update_file()`: Create or update file
- `delete_file()`: Delete file
- `get_tree()`: Get directory tree

**Future Operations** (from plan)
- `create_repo()`: Create new repository
- `get_repo()`: Get repository info
- `get_commits()`: List commits
- `get_commit()`: Get single commit

### 2.2 Token Injection Points

The GitHub token is injected at two distinct points:

1. **GitHub API Client** (HTTP Requests)
   - Token retrieved from keychain when `GitHubClient` is created
   - Added to `Authorization: Bearer <token>` header
   - Used for all REST API calls

2. **Git Operations** (Future - libgit2)
   - Token retrieved from keychain before git operations
   - Injected into libgit2 credential callback
   - Used for HTTPS authentication with GitHub

## Part 3: Library Workspace System

### 3.1 Current Implementation

The Library workspace system is partially implemented, providing the foundation for publishing kits and artifacts to GitHub repositories.

#### Data Model

```rust
pub struct LibraryWorkspace {
    pub id: String,
    pub name: String,
    pub github_owner: String,
    pub github_repo: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct LibraryArtifact {
    pub id: String,
    pub workspace_id: String,
    pub local_path: String,
    pub library_path: String,
    pub artifact_type: String,
    pub published_at: i64,
    pub last_synced_at: i64,
}
```

#### Database Schema

Workspaces and artifacts are stored in SQLite database:
- `library_workspaces` table
- `library_artifacts` table
- Foreign key relationships
- Timestamps for sync tracking

#### Current Operations

- `library_create_workspace()`: Create new workspace linked to GitHub repo
- `library_list_workspaces()`: List all workspaces
- `library_get_workspace()`: Get workspace by ID
- `library_delete_workspace()`: Delete workspace

### 3.2 Publishing Flow (Planned)

The publishing flow will enable users to publish kits, walkthroughs, and other artifacts to Library workspaces (which sync with GitHub repos).

#### Flow Steps

1. **Select Artifacts**
   - User selects kits/walkthroughs to publish
   - Can select individual items or folders
   - UI: `PublishToLibraryDialog.tsx`

2. **Map Paths**
   - Local path: `.bluekit/walkthroughs/guide/my-walkthrough.md`
   - Library path: `walkthroughs/guide/my-walkthrough.md` (in GitHub repo)
   - Maintain folder structure

3. **Check Conflicts**
   - Check if file exists in GitHub repo
   - Get file SHA if exists (for updates)
   - Handle conflicts appropriately

4. **Prepare Files**
   - Read file contents from local filesystem
   - Base64 encode for GitHub API
   - Batch prepare multiple files

5. **Publish to GitHub**
   - Use GitHub API `create_or_update_file()` for each file
   - Include commit message
   - Handle errors and retries

6. **Update Metadata**
   - Store artifact metadata in database
   - Track published status
   - Update last sync time

#### Git Operations (Future)

After publishing via API, optionally push changes via git:
- Initialize repo if needed
- Add remote if needed
- Create commit
- Push to GitHub (using libgit2 with token injection)

## Part 4: Planned Expansions

### 4.1 Core Features

**Commit Viewer**
- List commits for repositories
- Filter by branch, author, date
- View commit details (message, files changed)
- Link to GitHub web interface

**Repository Creator**
- Create new GitHub repositories
- Set name, description, visibility
- Initialize with README option
- Link to Library workspace

**Git Operations**
- Push changes to GitHub
- Pull latest from GitHub
- Create commits
- Handle merge conflicts
- All using libgit2 (bundled, no external git needed)

### 4.2 Team Sharing (Future)

The plan includes team collaboration features:

**Team Structure**
- Teams can link multiple GitHub accounts
- Team members share Library workspaces
- Different roles: Owner, Admin, Member
- Permission-based access control

**GitHub Organizations**
- Prefer GitHub orgs for teams
- Built-in permission management
- Secure (GitHub handles auth)
- Scalable (unlimited members)

**Team Workflow**
1. Create team
2. Invite members by GitHub username
3. Create shared workspaces (linked to org repos)
4. All members can publish to shared workspaces
5. Changes sync across all team members

### 4.3 Library Sync System

**Syncing from GitHub**
- Pull latest from GitHub repo
- Parse published artifacts
- Update Library view
- Handle merge conflicts
- Background sync support

**Path Mapping**
- Maintain folder structure
- Map GitHub repo paths to Library paths
- Handle renames and moves
- Track sync status

## Part 5: Implementation Phases

### Phase 1: Foundation ✅ (Complete)
- Keychain infrastructure
- Device flow authentication (implemented as Auth Code Flow with PKCE)
- Frontend auth module
- GitHub API client core

### Phase 2: API Expansion (In Progress)
- Content operations (file CRUD)
- Repository operations
- Commit operations

### Phase 3: Library Publishing (Planned)
- Publishing UI components
- Path mapping logic
- Batch file operations
- Conflict handling

### Phase 4: Git Operations (Planned)
- Libgit2 integration
- Git push/pull operations
- Credential callback with token injection
- Merge conflict handling

### Phase 5: Core Features (Planned)
- Commit viewer
- Repository creator
- User profile display
- GitHub links throughout app

### Phase 6: Team Features (Future)
- Team management
- Member invitations
- Shared workspaces
- Permission system

## Part 6: Security Considerations

### Token Security
- ✅ Stored in OS keychain (most secure)
- ✅ Never logged or exposed
- ✅ Only in memory during API calls
- ✅ Cleared on sign out

### API Security
- ✅ HTTPS for all API calls
- ✅ Token validation before operations
- ✅ Rate limiting handled gracefully
- ✅ Error handling for 401, 403, 429

### Git Operations Security
- ✅ Token injection via credential callback
- ✅ Repository path validation
- ✅ Input sanitization
- ✅ Secure libgit2 operations

## Part 7: Error Handling

### Authentication Errors
- Device code expired → Restart flow
- User denied authorization → Show message, allow retry
- Network errors → Retry with exponential backoff
- Token invalid → Prompt re-authentication

### API Errors
- 401 Unauthorized → Token invalid, prompt re-auth
- 403 Forbidden → Insufficient scopes, show message
- 404 Not Found → Repository/user doesn't exist
- 429 Rate Limited → Retry automatically (no user notification)

### Git Errors
- Repository not found → Show error message
- Authentication failed → Check token validity
- Network errors → Retry or show error
- Merge conflicts → Handle in Library sync

## Conclusion

The GitHub authentication system in BlueKit provides a secure, composable foundation for GitHub integration. The current implementation handles authentication, token storage, and basic API operations. The planned expansions will add Library publishing, git operations, and team collaboration features, all building on the same secure authentication foundation.

The architecture is designed to be:
- **Secure**: OS keychain storage, PKCE, HTTPS only
- **Composable**: Reusable auth module for future apps
- **Extensible**: Easy to add new GitHub API operations
- **Type-Safe**: Full TypeScript and Rust type safety
- **Cross-Platform**: Works on macOS, Windows, and Linux

---

*For implementation details, see `CLAUDE.md`, `src-tauri/src/watcher.rs`, and `src-tauri/src/commands.rs`*
