# GitHub Integration Plan

## Overview

This document outlines the complete plan for integrating GitHub authentication and API functionality into BlueKit. The integration will enable users to sign in with GitHub, publish kits to the Library (which syncs with GitHub repos), view commits, push changes, create repositories, and interact with GitHub's API throughout the application.

## Goals

1. **Authentication Flow**: Implement GitHub OAuth for desktop applications (composable, reusable module)
2. **Token Management**: Securely store and manage GitHub access tokens
3. **API Integration**: Create GitHub API client in Rust backend (src-tauri) for Library sync and operations
4. **User Context**: Provide GitHub user information and authentication state throughout the app
5. **Library Integration**: Enable publishing kits/walkthroughs to Library, which syncs with GitHub repos
6. **Core Features**: Enable viewing commits, pushing to GitHub, and creating repositories

## Architecture Overview

### Flow Diagram

```
Welcome Screen → Get Started → GitHub Auth Screen → Home Page
                                              ↓
                                    [User Authenticated]
                                              ↓
                          GitHub Context Available Throughout App
                                              ↓
        [Library Workspaces] [Publish Kits] [View Commits] [Push Changes] [Create Repos]
```

### Component Architecture

```
App.tsx
├── WelcomeScreen (initial)
├── GitHubAuthScreen (after "Get Started") - Composable auth module
└── HomePage (after authentication)
    └── GitHubProvider (composable auth context)
        └── Library (GitHub-backed workspace system)
```

## 1. GitHub OAuth for Desktop Apps

### Understanding Desktop OAuth Flow

Desktop applications cannot use the standard web OAuth flow because:
- They don't have a redirect URI that can be handled by a web server
- They need to handle the OAuth callback within the app itself

**GitHub's Device Flow** (recommended for desktop apps):
1. App requests a device code from GitHub
2. User visits GitHub.com and enters the code
3. GitHub provides access token via polling
4. App receives token and stores it securely

**Alternative: OAuth App with Custom Protocol**:
1. Register OAuth app with custom protocol redirect (e.g., `bluekit://oauth/callback`)
2. Open browser for authorization
3. GitHub redirects to custom protocol
4. Tauri handles the protocol and extracts the code
5. Exchange code for access token

### Recommended Approach: Device Flow

**Why Device Flow?**
- ✅ No need to register custom protocol handlers
- ✅ Works on all platforms (Windows, macOS, Linux)
- ✅ More secure (user authorizes on GitHub.com)
- ✅ Better UX for desktop apps
- ✅ GitHub officially recommends this for desktop apps
- ✅ **No homepage URL required** - Device flow doesn't need a callback URL

**How It Works:**
1. App calls `POST https://github.com/login/device/code` with client_id
2. GitHub returns `device_code` and `user_code`
3. App displays `user_code` and opens GitHub authorization URL
4. App polls `POST https://github.com/login/oauth/access_token` with device_code
5. When user authorizes, polling returns access_token
6. App stores token securely

### Homepage URL for OAuth App

**Answer: Not Required for Device Flow**
- Device flow doesn't require a valid homepage URL
- You can use `http://localhost` or any placeholder
- GitHub only needs it for display purposes
- For desktop apps, this field is essentially ignored

## 2. Token Storage & Security

### Storage Options

**Option 1: Secure Storage (Recommended)**
- Use Tauri's secure storage or OS keychain
- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: Secret Service API (libsecret)

**Option 2: Encrypted File Storage**
- Store token in encrypted file at `~/.bluekit/github_token.enc`
- Use OS-level encryption or app-level encryption
- Less secure than keychain but more portable

**Option 3: Database Storage**
- Store in SQLite database (already exists for tasks)
- Encrypt the token column
- More complex but centralized

### Recommended: OS Keychain via Rust Commands

**Implementation:**
- Create Rust commands that use OS keychain APIs:
  - macOS: `keyring` crate
  - Windows: `winapi` with Credential Manager
  - Linux: `secret-service` crate

**Token Structure:**
```rust
#[derive(Serialize, Deserialize)]
pub struct GitHubToken {
    pub access_token: String,
    pub token_type: String, // "bearer"
    pub scope: String, // "repo,user,read:org"
    pub expires_at: Option<i64>, // Unix timestamp (if applicable)
}
```

### Security Best Practices

1. **Never log tokens**: Never log access tokens in console or files
2. **Token rotation**: Implement token refresh if GitHub supports it
3. **Scope minimization**: Request only necessary scopes
4. **Token validation**: Check token validity before making API calls
5. **Secure deletion**: Properly clear tokens when user signs out

## 3. GitHub API Client Architecture

### **Decision: Backend API Client (src-tauri)**

**Why Backend?**
- ✅ Better for Library sync operations (background syncing)
- ✅ Tokens never leave backend (more secure)
- ✅ Can work with git operations seamlessly
- ✅ Better for batch operations and publishing
- ✅ Supports multiple workspaces/repos with different permissions

**Location**: `src-tauri/src/github.rs`

**Structure:**
```rust
pub struct GitHubClient {
    token: String,
    client: reqwest::Client,
}

impl GitHubClient {
    pub fn new(token: String) -> Self {
        Self {
            token,
            client: reqwest::Client::new(),
        }
    }
    
    // User operations
    pub async fn get_user(&self) -> Result<GitHubUser, String>;
    pub async fn get_user_repos(&self) -> Result<Vec<GitHubRepo>, String>;
    
    // Repository operations
    pub async fn create_repo(&self, name: String, options: CreateRepoOptions) -> Result<GitHubRepo, String>;
    pub async fn get_repo(&self, owner: String, repo: String) -> Result<GitHubRepo, String>;
    
    // Content operations (for Library)
    pub async fn create_or_update_file(&self, owner: String, repo: String, path: String, content: String, message: String) -> Result<(), String>;
    pub async fn get_file_contents(&self, owner: String, repo: String, path: String) -> Result<String, String>;
    
    // Generic request method
    async fn request<T>(&self, method: &str, endpoint: String, body: Option<serde_json::Value>) -> Result<T, String>
    where
        T: serde::de::DeserializeOwned;
}
```

### Tauri Commands for API Access

All GitHub API operations will be exposed via Tauri commands:

```rust
#[tauri::command]
pub async fn github_get_user() -> Result<GitHubUser, String>;

#[tauri::command]
pub async fn github_get_repos() -> Result<Vec<GitHubRepo>, String>;

#[tauri::command]
pub async fn github_create_repo(name: String, description: Option<String>, private: bool) -> Result<GitHubRepo, String>;

#[tauri::command]
pub async fn github_publish_to_library(
    workspace_id: String,
    artifact_paths: Vec<String>,
    commit_message: String,
) -> Result<(), String>;
```

### Rate Limiting

GitHub API has rate limits:
- **Authenticated**: 5,000 requests/hour
- **Unauthenticated**: 60 requests/hour

**Implementation:**
- Track rate limit headers in responses internally
- **No user-facing rate limit display** (as requested)
- Implement request queuing if needed
- Cache responses when appropriate
- Handle 429 errors gracefully with retry logic

## 4. Composable Authentication Module

### **Goal: Clean, Reusable Auth System**

All authentication-related code should be isolated and composable for use in future apps or independent development.

### Module Structure

```
src/
└── auth/
    ├── github/
    │   ├── GitHubAuthProvider.tsx    # React context provider
    │   ├── GitHubAuthScreen.tsx      # Auth screen component
    │   ├── useGitHubAuth.ts          # Custom hook
    │   ├── types.ts                  # Auth types
    │   └── index.ts                  # Public exports
    └── index.ts                      # Auth module exports
```

### React Context Structure

**Location**: `src/auth/github/GitHubAuthProvider.tsx`

**State:**
```typescript
interface GitHubAuthContextValue {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GitHubUser | null;
  
  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}
```

**Provider Structure:**
```typescript
export function GitHubAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load token on mount
  useEffect(() => {
    loadStoredToken();
  }, []);
  
  // ... implementation
  
  return (
    <GitHubAuthContext.Provider value={{ isAuthenticated, isLoading, user, signIn, signOut, refreshAuth }}>
      {children}
    </GitHubAuthContext.Provider>
  );
}
```

### Custom Hook

**Location**: `src/auth/github/useGitHubAuth.ts`

```typescript
export function useGitHubAuth() {
  const context = useContext(GitHubAuthContext);
  if (!context) {
    throw new Error('useGitHubAuth must be used within GitHubAuthProvider');
  }
  return context;
}
```

### App Flow Integration

**Updated App.tsx Flow:**
```typescript
import { GitHubAuthProvider, GitHubAuthScreen } from './auth/github';

type View = 'welcome' | 'github-auth' | 'home' | 'project-detail' | 'plans';

function App() {
  const { isAuthenticated, isLoading } = useGitHubAuth();
  const [currentView, setCurrentView] = useState<View>('welcome');
  
  const handleGetStarted = () => {
    if (isAuthenticated) {
      setCurrentView('home');
    } else {
      setCurrentView('github-auth');
    }
  };
  
  return (
    <GitHubAuthProvider>
      {currentView === 'welcome' ? (
        <WelcomeScreen onGetStarted={handleGetStarted} />
      ) : currentView === 'github-auth' ? (
        <GitHubAuthScreen onSuccess={() => setCurrentView('home')} />
      ) : (
        // ... rest of app
      )}
    </GitHubAuthProvider>
  );
}
```

## 5. UI Components

### GitHub Auth Screen

**Location**: `src/pages/GitHubAuthScreen.tsx`

**Features:**
- Display device code and user code
- Show QR code (optional, for easier entry)
- Open GitHub authorization URL automatically
- Polling status indicator
- Error handling and retry
- "Skip for now" option (optional)

**UI Elements:**
- Large, readable user code
- Instructions for user
- "Open GitHub" button
- Loading spinner during polling
- Success/error messages

### GitHub User Profile Component

**Location**: `src/components/github/GitHubProfile.tsx`

**Display:**
- User avatar
- Username
- Sign out button
- Token status/validity

### Commit Viewer Component

**Location**: `src/components/github/CommitViewer.tsx`

**Features:**
- List of commits for a repository
- Filter by branch, author, date
- Commit details (message, author, date, files changed)
- Link to GitHub web interface

### Repository Creator Component

**Location**: `src/components/github/CreateRepoDialog.tsx`

**Features:**
- Repository name input
- Description input
- Public/private toggle
- Initialize with README option
- Create button

## 5.5. Library Architecture (GitHub-Backed)

### Library Concept

The Library is a **cloud-hosted, GitHub-backed system** for sharing kits, walkthroughs, and other artifacts:

- **Local → Library**: Users publish kits from local projects to Library
- **Library → GitHub**: Library automatically syncs with GitHub repositories
- **Multiple Workspaces**: Different repos can be linked as separate workspaces
- **Permissions**: Each workspace can have different GitHub permissions/scopes
- **Publishing**: Can publish individual items, folders, or collections

### Library Data Model

```rust
// Library workspace (linked to a GitHub repo)
pub struct LibraryWorkspace {
    pub id: String,
    pub name: String,
    pub github_owner: String,
    pub github_repo: String,
    pub github_token: String, // Encrypted, workspace-specific
    pub created_at: i64,
    pub updated_at: i64,
}

// Published artifact in Library
pub struct LibraryArtifact {
    pub id: String,
    pub workspace_id: String,
    pub local_path: String, // Original path in local project
    pub library_path: String, // Path in GitHub repo
    pub artifact_type: String, // kit, walkthrough, blueprint, etc.
    pub published_at: i64,
    pub last_synced_at: i64,
}
```

### Library Workflow

```
1. User creates/selects Library Workspace
   └── Links to GitHub repo (creates if doesn't exist)

2. User selects kits/walkthroughs to publish
   └── Can select individual items or folders

3. App publishes to Library
   └── Creates/updates files in GitHub repo
   └── Commits with message
   └── Pushes to GitHub

4. Library syncs from GitHub
   └── Pulls latest from repo
   └── Updates local Library view
   └── Shows published artifacts
```

### Library Implementation Logic

**What needs to be built:**

1. **Workspace Management**
   - Create workspace (link to GitHub repo)
   - List workspaces
   - Switch between workspaces
   - Delete workspace

2. **Publishing System**
   - Select artifacts to publish (individual or folder)
   - Map local paths to Library paths
   - Create/update files in GitHub repo
   - Handle conflicts (if file exists)
   - Commit and push changes

3. **Syncing System**
   - Pull latest from GitHub repo
   - Parse published artifacts
   - Update Library view
   - Handle merge conflicts

4. **Path Mapping**
   - Local: `.bluekit/walkthroughs/guide/my-walkthrough.md`
   - Library: `walkthroughs/guide/my-walkthrough.md` (in GitHub repo)
   - Maintain folder structure

5. **Metadata Tracking**
   - Track which local artifacts are published
   - Track last sync time
   - Track workspace associations

### Library UI Components

**Location**: `src/components/library/`

- `LibraryWorkspaceSelector.tsx` - Select/create workspace
- `PublishToLibraryDialog.tsx` - Select artifacts to publish
- `LibraryView.tsx` - View published artifacts
- `LibraryArtifactCard.tsx` - Display published artifact

### Library Backend Commands

```rust
// Workspace management
#[tauri::command]
pub async fn library_create_workspace(
    name: String,
    github_owner: String,
    github_repo: String,
) -> Result<LibraryWorkspace, String>;

#[tauri::command]
pub async fn library_list_workspaces() -> Result<Vec<LibraryWorkspace>, String>;

// Publishing
#[tauri::command]
pub async fn library_publish_artifacts(
    workspace_id: String,
    artifact_paths: Vec<String>,
    commit_message: String,
) -> Result<(), String>;

// Syncing
#[tauri::command]
pub async fn library_sync_workspace(workspace_id: String) -> Result<Vec<LibraryArtifact>, String>;

// Querying
#[tauri::command]
pub async fn library_get_artifacts(workspace_id: Option<String>) -> Result<Vec<LibraryArtifact>, String>;
```

## 6. GitHub API Endpoints to Use

### User Information
- `GET /user` - Get authenticated user
- `GET /user/repos` - List user repositories

### Commits
- `GET /repos/{owner}/{repo}/commits` - List commits
- `GET /repos/{owner}/{repo}/commits/{sha}` - Get single commit

### Repositories
- `POST /user/repos` - Create repository
- `GET /repos/{owner}/{repo}` - Get repository
- `GET /repos/{owner}/{repo}/branches` - List branches

### Content (for Library)
- `GET /repos/{owner}/{repo}/contents/{path}` - Get file contents
- `PUT /repos/{owner}/{repo}/contents/{path}` - Create/update file
- `DELETE /repos/{owner}/{repo}/contents/{path}` - Delete file
- `GET /repos/{owner}/{repo}/git/trees/{tree_sha}` - Get tree (for folders)

### Scopes Required
- `repo` - Full control of private repositories (needed for Library)
- `user` - Read user profile information
- `read:org` - Read org information (optional)

## 7. Git Operations (Push to GitHub)

### **Decision: Use Libgit2 (Bundled)**

**Why Libgit2?**
- ✅ **No external dependency** - Bundled with app
- ✅ Users don't need to install git separately
- ✅ More control over git operations
- ✅ Better for Library sync operations
- ✅ Can handle authentication programmatically

**Implementation:**
- Use `git2` crate in Rust backend
- All git operations happen in backend
- No need for git CLI

### Libgit2 Implementation

**Location**: `src-tauri/src/git_operations.rs`

```rust
use git2::{Repository, Signature, Cred, RemoteCallbacks};

pub struct GitOperations;

impl GitOperations {
    pub fn init_repo(path: &str) -> Result<Repository, String>;
    
    pub fn add_remote(repo: &Repository, name: &str, url: &str) -> Result<(), String>;
    
    pub fn push_to_github(
        repo: &Repository,
        remote: &str,
        branch: &str,
        token: &str,
    ) -> Result<(), String>;
    
    pub fn commit_and_push(
        repo_path: &str,
        files: Vec<String>,
        message: &str,
        remote: &str,
        branch: &str,
        token: &str,
    ) -> Result<(), String>;
}
```

### Tauri Commands for Git Operations

```rust
#[tauri::command]
pub async fn git_init_repo(path: String) -> Result<(), String>;

#[tauri::command]
pub async fn git_add_remote(
    repo_path: String,
    name: String,
    url: String,
) -> Result<(), String>;

#[tauri::command]
pub async fn git_push(
    repo_path: String,
    remote: String,
    branch: String,
) -> Result<(), String>;

#[tauri::command]
pub async fn git_commit_and_push(
    repo_path: String,
    files: Vec<String>,
    message: String,
    remote: String,
    branch: String,
) -> Result<(), String>;
```

## 8. Implementation Steps

### Phase 1: Foundation & Auth Module
1. ✅ Set up environment variables (Tauri system)
2. ✅ Create composable auth module structure
3. ✅ Implement token storage (Rust commands for secure storage)
4. ✅ Implement device flow authentication (Rust backend)
5. ✅ Create GitHub auth screen component
6. ✅ Create GitHubAuthProvider context
7. ✅ Update App.tsx routing

### Phase 2: Backend API Client
1. ✅ Create GitHub API client in Rust (src-tauri/src/github.rs)
2. ✅ Implement user information fetching
3. ✅ Add error handling
4. ✅ Create Tauri commands for API access
5. ✅ Create TypeScript types for GitHub API responses

### Phase 3: Library Foundation
1. ✅ Design Library data model
2. ✅ Create workspace management (Rust)
3. ✅ Implement workspace storage (database or file)
4. ✅ Create Library UI components

### Phase 4: Publishing System
1. ✅ Implement artifact selection UI
2. ✅ Create publishing logic (local → GitHub)
3. ✅ Implement file creation/updates via GitHub API
4. ✅ Add commit and push functionality (libgit2)

### Phase 5: Git Operations (Libgit2)
1. ✅ Set up libgit2 in Cargo.toml
2. ✅ Implement git operations module
3. ✅ Create Tauri commands for git operations
4. ✅ Test git operations with authentication

### Phase 6: Core Features
1. ✅ Display user profile in UI
2. ✅ Implement commit viewer
3. ✅ Add repository creation dialog
4. ✅ Integrate with existing project views

### Phase 7: Polish
1. ✅ Error handling and user feedback
2. ✅ Loading states
3. ✅ Token refresh (if needed)
4. ✅ Sign out functionality
5. ✅ Documentation

## 9. Dependencies to Add

### Backend (Cargo.toml)
```toml
[dependencies]
# HTTP client for GitHub API
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }

# Git operations (bundled, no external git needed)
git2 = { version = "0.18", features = ["https", "ssh"] }

# Secure storage
keyring = "2.0"  # For macOS keychain
# secret-service = "3.0"  # For Linux (if needed)
# winapi = { version = "0.3", features = ["wincred"] }  # For Windows

# Environment variables
dotenv = "0.15"  # For development

# Serialization (if not already present)
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Frontend (package.json)
```json
{
  "dependencies": {
    // No additional dependencies needed - all API calls via IPC
  }
}
```

## 10. GitHub OAuth App Setup

### Steps to Create OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: BlueKit
   - **Homepage URL**: `http://localhost` (not used for device flow, but required field)
   - **Authorization callback URL**: `http://localhost` (not used for device flow)
4. Note the **Client ID** (public, can be in code)
5. Generate **Client Secret** (optional for device flow, but recommended)

### Environment Variables Setup

**Development (.env file):**
```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

**Production:**
- Client ID: Can be in code or environment variable
- Client Secret: Store securely (encrypted config or environment variable)
- Device flow works without client secret, but it's recommended for security

## 10.5. Environment Variables (Tauri System)

### Using Tauri's Environment Variables

**Tauri supports environment variables** that can be accessed from both frontend and backend.

### Configuration

**Development:**
- Create `.env` file in project root
- Use `dotenv` crate in Rust to load
- Access via `std::env::var()`

**Production:**
- Bundle with app or use build-time variables
- Access via `std::env::var()` or `tauri::api::path`

### Environment Variables Needed

```bash
# .env file (development)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here  # Optional for device flow
```

### Accessing in Rust

```rust
use std::env;

pub fn get_github_client_id() -> Result<String, String> {
    env::var("GITHUB_CLIENT_ID")
        .map_err(|_| "GITHUB_CLIENT_ID not set".to_string())
}

pub fn get_github_client_secret() -> Option<String> {
    env::var("GITHUB_CLIENT_SECRET").ok()
}
```

### Accessing in TypeScript (if needed)

```typescript
// Tauri doesn't directly expose env vars to frontend for security
// Access via IPC command instead
const clientId = await invoke<string>('get_github_client_id');
```

### Tauri Command for Client ID

```rust
#[tauri::command]
pub fn get_github_client_id() -> Result<String, String> {
    std::env::var("GITHUB_CLIENT_ID")
        .map_err(|_| "GITHUB_CLIENT_ID not set".to_string())
}
```

## 11. Security Considerations

### Token Security
- ✅ Store tokens in OS keychain (most secure)
- ✅ Never log tokens
- ✅ Clear tokens on sign out
- ✅ Validate tokens before use

### API Security
- ✅ Use HTTPS for all API calls
- ✅ Validate API responses
- ✅ Handle rate limiting gracefully (no user display)
- ✅ Don't expose client secret in frontend code
- ✅ All API calls from backend

### Git Operations Security
- ✅ Validate repository paths
- ✅ Sanitize user inputs
- ✅ Use token authentication for git operations
- ✅ Libgit2 handles authentication securely

## 12. Error Handling

### Common Errors

**Authentication Errors:**
- Device code expired → Restart flow
- User denied authorization → Show message, allow retry
- Network errors → Retry with exponential backoff

**API Errors:**
- 401 Unauthorized → Token invalid, prompt re-auth
- 403 Forbidden → Insufficient scopes, show message
- 404 Not Found → Repository/user doesn't exist
- 429 Rate Limited → Retry automatically (no user notification)

**Git Errors:**
- Repository not found → Show error message
- Authentication failed → Check token validity
- Network errors → Retry or show error
- Merge conflicts → Handle in Library sync

**Library Errors:**
- Workspace not found → Show error, allow creation
- Publish failed → Show error, allow retry
- Sync conflicts → Show conflict resolution UI

## 13. Testing Strategy

### Unit Tests
- GitHub API client methods (Rust)
- Token storage/retrieval
- Git operations (libgit2)
- Library workspace management
- Error handling

### Integration Tests
- Device flow authentication
- API calls with mock responses
- Git operations (with test repo)
- Library publish/sync flow

### Manual Testing
- Full authentication flow
- Publishing to Library
- Syncing from Library
- Viewing commits
- Creating repositories
- Pushing changes

## 14. Future Enhancements

### Potential Features
- **Pull Requests**: Create and manage PRs
- **Issues**: View and create issues
- **Gists**: Create and manage gists
- **Organizations**: Support for org repos
- **Multiple Accounts**: Switch between GitHub accounts
- **SSH Key Management**: Generate and manage SSH keys
- **Commit Creation**: Create commits via API (for simple changes)
- **Branch Management**: Create and switch branches
- **Webhook Management**: Set up webhooks for repos

## 15. Resources & Documentation

### GitHub Documentation
- [GitHub Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)

### Tauri Documentation
- [Tauri HTTP](https://tauri.app/v1/api/js/http/)
- [Tauri Store Plugin](https://github.com/tauri-apps/tauri-plugin-store)
- [Tauri Shell](https://tauri.app/v1/api/js/shell/) (for opening URLs)

### Rust Crates
- [reqwest](https://docs.rs/reqwest/) - HTTP client
- [git2](https://docs.rs/git2/) - Git operations
- [keyring](https://docs.rs/keyring/) - Secure storage

## 16. Questions Resolved

### ✅ Client Secret Storage
- **Answer**: Use Tauri's environment variable system
- Store in `.env` for development
- Use encrypted config or env vars for production
- Device flow works without it, but recommended

### ✅ Token Refresh
- **Answer**: GitHub tokens don't expire by default
- May need to re-authenticate if user revokes access
- Implement token validation before API calls

### ✅ Git CLI Dependency
- **Answer**: Use libgit2 (bundled with app)
- No external git installation needed
- Users don't need to install git separately

### ✅ Skip Authentication
- **Answer**: Make GitHub features optional
- Allow users to use app without GitHub
- Library features require authentication

### ✅ Multiple Workspaces
- **Answer**: Support multiple Library workspaces
- Each workspace linked to different GitHub repo
- User can switch between workspaces
- Different permissions per workspace

### ✅ Homepage URL
- **Answer**: Not required for device flow
- Use `http://localhost` as placeholder
- GitHub only needs it for display

### ✅ Environment Variables
- **Answer**: Use Tauri's system throughout app
- Access via `std::env::var()` in Rust
- Expose via IPC commands if needed in frontend

## 17. File Structure

### New Files to Create

```
src/
├── auth/
│   └── github/
│       ├── GitHubAuthProvider.tsx    # Composable auth provider
│       ├── GitHubAuthScreen.tsx     # Auth screen component
│       ├── useGitHubAuth.ts          # Custom hook
│       ├── types.ts                  # Auth types
│       └── index.ts                   # Public exports
├── components/
│   └── library/
│       ├── LibraryWorkspaceSelector.tsx
│       ├── PublishToLibraryDialog.tsx
│       ├── LibraryView.tsx
│       └── LibraryArtifactCard.tsx
└── types/
    └── github.ts                     # GitHub API types

src-tauri/src/
├── commands.rs                       # Add all GitHub/git/library commands
├── github.rs                         # GitHub API client
├── git_operations.rs                  # Libgit2 operations
├── library.rs                        # Library workspace management
└── auth.rs                           # Auth-related commands (token storage)
```

## 18. Next Steps

1. **Review this plan** and confirm approach
2. **Create GitHub OAuth app** and note Client ID
3. **Set up environment variables** (.env file)
4. **Start with Phase 1**: Foundation & Auth Module
5. **Iterate**: Build features incrementally, test as you go

---

**Last Updated**: 2025-12-11
**Status**: Planning Phase - Updated with Library Architecture
**Owner**: Development Team
