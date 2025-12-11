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

### 2.5. Keychain Manager Architecture

**Yes - Unified Keychain Manager Class**

The Rust commands for OS keychain management will use a **unified `KeychainManager` class** that abstracts platform-specific implementations (keyring/winapi/secret-service) behind a common interface.

**Location**: `src-tauri/src/keychain.rs`

**Architecture:**

```rust
// Platform-agnostic trait
pub trait KeychainBackend {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String>;
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String>;
    fn delete(&self, service: &str, key: &str) -> Result<(), String>;
}

// Platform-specific implementations
#[cfg(target_os = "macos")]
pub struct MacOSKeychain {
    keyring: keyring::Entry,
}

#[cfg(target_os = "macos")]
impl KeychainBackend for MacOSKeychain {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(service, key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry.set_password(value)
            .map_err(|e| format!("Failed to store password: {}", e))?;
        Ok(())
    }
    
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String> {
        let entry = keyring::Entry::new(service, key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry.get_password()
            .map_err(|e| format!("Failed to retrieve password: {}", e))
    }
    
    fn delete(&self, service: &str, key: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(service, key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry.delete_password()
            .map_err(|e| format!("Failed to delete password: {}", e))?;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
pub struct WindowsKeychain;

#[cfg(target_os = "windows")]
impl KeychainBackend for WindowsKeychain {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String> {
        use winapi::um::wincred::*;
        // Windows Credential Manager implementation
        // Store in Credential Manager with target name like "bluekit:github_token"
        Ok(())
    }
    
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String> {
        // Retrieve from Windows Credential Manager
        Ok(String::new())
    }
    
    fn delete(&self, service: &str, key: &str) -> Result<(), String> {
        // Delete from Windows Credential Manager
        Ok(())
    }
}

#[cfg(target_os = "linux")]
pub struct LinuxKeychain;

#[cfg(target_os = "linux")]
impl KeychainBackend for LinuxKeychain {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String> {
        // Use secret-service crate for Linux
        Ok(())
    }
    
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String> {
        // Retrieve from Secret Service
        Ok(String::new())
    }
    
    fn delete(&self, service: &str, key: &str) -> Result<(), String> {
        // Delete from Secret Service
        Ok(())
    }
}

// Unified manager
pub struct KeychainManager {
    backend: Box<dyn KeychainBackend>,
}

impl KeychainManager {
    pub fn new() -> Result<Self, String> {
        #[cfg(target_os = "macos")]
        let backend: Box<dyn KeychainBackend> = Box::new(MacOSKeychain::new()?);
        
        #[cfg(target_os = "windows")]
        let backend: Box<dyn KeychainBackend> = Box::new(WindowsKeychain::new()?);
        
        #[cfg(target_os = "linux")]
        let backend: Box<dyn KeychainBackend> = Box::new(LinuxKeychain::new()?);
        
        Ok(Self { backend })
    }
    
    pub fn store_token(&self, token: &GitHubToken) -> Result<(), String> {
        let serialized = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token: {}", e))?;
        self.backend.store("bluekit", "github_token", &serialized)
    }
    
    pub fn retrieve_token(&self) -> Result<GitHubToken, String> {
        let serialized = self.backend.retrieve("bluekit", "github_token")?;
        serde_json::from_str(&serialized)
            .map_err(|e| format!("Failed to deserialize token: {}", e))
    }
    
    pub fn delete_token(&self) -> Result<(), String> {
        self.backend.delete("bluekit", "github_token")
    }
}
```

**Tauri Commands:**

```rust
#[tauri::command]
pub fn keychain_store_token(token: GitHubToken) -> Result<(), String> {
    let manager = KeychainManager::new()?;
    manager.store_token(&token)
}

#[tauri::command]
pub fn keychain_retrieve_token() -> Result<GitHubToken, String> {
    let manager = KeychainManager::new()?;
    manager.retrieve_token()
}

#[tauri::command]
pub fn keychain_delete_token() -> Result<(), String> {
    let manager = KeychainManager::new()?;
    manager.delete_token()
}
```

**Benefits:**
- ✅ Single interface for all platforms
- ✅ Easy to test (can mock the trait)
- ✅ Platform-specific code isolated
- ✅ Type-safe token storage/retrieval

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

### 3.5. Token Injection Points

**When and Where is the GitHub API Token Injected?**

The GitHub API token is injected at **two distinct points** in the Rust backend:

#### 1. GitHub API Client (HTTP Requests)

**Location**: `src-tauri/src/github.rs`

The token is injected when:
- Creating `GitHubClient` instance: `GitHubClient::new(token)`
- Making HTTP requests: Token added as `Authorization: Bearer <token>` header

**Implementation:**

```rust
impl GitHubClient {
    pub fn new(token: String) -> Self {
        Self {
            token,
            client: reqwest::Client::new(),
        }
    }
    
    async fn request<T>(&self, method: &str, endpoint: String, body: Option<serde_json::Value>) -> Result<T, String>
    where
        T: serde::de::DeserializeOwned,
    {
        let url = format!("https://api.github.com{}", endpoint);
        let mut request = self.client
            .request(method.parse().unwrap(), &url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "BlueKit/1.0");
        
        if let Some(body) = body {
            request = request.json(&body);
        }
        
        let response = request.send().await
            .map_err(|e| format!("Request failed: {}", e))?;
        
        // ... handle response
    }
}
```

**Flow:**
1. Tauri command called (e.g., `github_get_user()`)
2. Command retrieves token from keychain: `keychain_retrieve_token()`
3. Creates `GitHubClient` with token: `GitHubClient::new(token)`
4. Makes API request with token in Authorization header
5. Returns result to frontend

#### 2. Libgit2 (Git Operations)

**Is libgit2 for token injection?** 

**No** - libgit2 is for **git operations** (push, pull, commit), not for token injection. However, the token **is injected** into libgit2's credential callbacks for authentication.

**Location**: `src-tauri/src/git_operations.rs`

**Token Injection in Git Operations:**

```rust
use git2::{Repository, Cred, RemoteCallbacks};

impl GitOperations {
    pub fn push_to_github(
        repo: &Repository,
        remote: &str,
        branch: &str,
        token: &str,  // Token passed as parameter
    ) -> Result<(), String> {
        let mut remote = repo.find_remote(remote)
            .map_err(|e| format!("Remote not found: {}", e))?;
        
        // Create credential callback that injects token
        let mut callbacks = RemoteCallbacks::new();
        let token = token.to_string(); // Clone for closure
        callbacks.credentials(move |_url, username, _allowed| {
            // Inject token into git credential callback
            Cred::userpass_plaintext(username.unwrap_or("x"), &token)
        });
        
        let mut push_options = git2::PushOptions::new();
        push_options.remote_callbacks(callbacks);
        
        remote.push(&[&format!("refs/heads/{}", branch)], Some(&mut push_options))
            .map_err(|e| format!("Push failed: {}", e))?;
        
        Ok(())
    }
}
```

**Flow:**
1. Tauri command called (e.g., `git_push()`)
2. Command retrieves token from keychain: `keychain_retrieve_token()`
3. Calls `push_to_github(repo, remote, branch, token)`
4. Token injected into libgit2 credential callback
5. Libgit2 uses token for HTTPS authentication with GitHub
6. Push operation completes

**Summary:**

| Operation | Token Source | Injection Point | Purpose |
|-----------|-------------|-----------------|---------|
| GitHub API Calls | Keychain → `GitHubClient::new(token)` | HTTP Authorization header | Authenticate REST API requests |
| Git Operations | Keychain → `push_to_github(..., token)` | Libgit2 credential callback | Authenticate git push/pull operations |

**Key Points:**
- ✅ Token stored once in keychain
- ✅ Token retrieved when needed (lazy loading)
- ✅ Token injected at operation time
- ✅ Never stored in memory longer than necessary
- ✅ Libgit2 handles HTTPS authentication, not token storage

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

## 8. Implementation Steps (Detailed Phases)

**Note**: The library will be complex. These phases break down the work into manageable, testable increments.

### Phase 1A: Keychain Infrastructure (Week 1)

**Goal**: Create unified keychain manager for all platforms

1. Create `src-tauri/src/keychain.rs` module
2. Define `KeychainBackend` trait interface
3. Implement macOS backend using `keyring` crate
4. Implement Windows backend using `winapi` with Credential Manager
5. Implement Linux backend using `secret-service` crate
6. Create `KeychainManager` unified wrapper
7. Add unit tests for each platform backend
8. Create Tauri commands: `keychain_store_token`, `keychain_retrieve_token`, `keychain_delete_token`
9. Test token storage/retrieval on each platform

**Deliverables:**
- ✅ Working keychain manager for all platforms
- ✅ Token storage/retrieval tested
- ✅ Tauri commands exposed

### Phase 1B: Device Flow Authentication (Week 1-2)

**Goal**: Implement GitHub device flow OAuth in Rust backend

1. Create `src-tauri/src/auth.rs` module
2. Implement device code request (`POST /login/device/code`)
3. Implement polling mechanism (`POST /login/oauth/access_token`)
4. Handle device code expiration
5. Store received token in keychain
6. Add error handling for auth failures
7. Create Tauri commands: `auth_start_device_flow`, `auth_poll_token`, `auth_get_status`
8. Test full device flow end-to-end

**Deliverables:**
- ✅ Device flow working in Rust
- ✅ Token stored in keychain after auth
- ✅ Error handling for all failure cases

### Phase 1C: Frontend Auth Module (Week 2)

**Goal**: Create composable React auth module

1. Create `src/auth/github/` directory structure
2. Create `GitHubAuthProvider.tsx` context provider
3. Implement token loading from backend on mount
4. Create `GitHubAuthScreen.tsx` component
5. Display device code and user code
6. Implement polling UI with status updates
7. Add "Open GitHub" button functionality
8. Create `useGitHubAuth.ts` custom hook
9. Update `App.tsx` routing to include auth screen
10. Test full auth flow in UI

**Deliverables:**
- ✅ Composable auth module structure
- ✅ Working auth screen with device flow
- ✅ Auth state available throughout app

### Phase 2A: GitHub API Client Core (Week 2-3)

**Goal**: Create GitHub API client with token injection

1. Create `src-tauri/src/github.rs` module
2. Implement `GitHubClient` struct with token storage
3. Implement `request()` method with token injection in Authorization header
4. Add rate limiting header tracking
5. Implement `get_user()` endpoint
6. Implement `get_user_repos()` endpoint
7. Add error handling for 401, 403, 404, 429
8. Create TypeScript types for `GitHubUser` and `GitHubRepo`
9. Create Tauri commands: `github_get_user`, `github_get_repos`
10. Test API calls with real GitHub token

**Deliverables:**
- ✅ GitHub API client with token injection
- ✅ User info and repos fetching working
- ✅ Error handling implemented

### Phase 2B: GitHub API Content Operations (Week 3)

**Goal**: Implement file CRUD operations for Library

1. Implement `get_file_contents()` endpoint
2. Implement `create_or_update_file()` endpoint
3. Implement `delete_file()` endpoint
4. Implement `get_tree()` for folder operations
5. Add base64 encoding/decoding for file content
6. Add conflict detection (file exists check)
7. Create TypeScript types for content operations
8. Create Tauri commands: `github_get_file`, `github_create_file`, `github_update_file`, `github_delete_file`
9. Test file operations with test repo

**Deliverables:**
- ✅ Full file CRUD via GitHub API
- ✅ Tree/blob operations working
- ✅ Ready for Library publishing

### Phase 3A: Library Data Model (Week 3-4)

**Goal**: Design and implement Library workspace storage

1. Design database schema for workspaces (SQLite)
2. Create `LibraryWorkspace` struct
3. Create `LibraryArtifact` struct
4. Create `src-tauri/src/library.rs` module
5. Implement workspace CRUD operations
6. Implement workspace storage in database
7. Add workspace metadata tracking
8. Create Tauri commands: `library_create_workspace`, `library_list_workspaces`, `library_get_workspace`, `library_delete_workspace`
9. Test workspace persistence

**Deliverables:**
- ✅ Library data model defined
- ✅ Workspace storage working
- ✅ Database schema implemented

### Phase 3B: Library UI Foundation (Week 4)

**Goal**: Create Library UI components

1. Create `src/components/library/` directory
2. Create `LibraryWorkspaceSelector.tsx` component
3. Create workspace creation dialog
4. Create `LibraryView.tsx` main view component
5. Implement workspace switching logic
6. Add workspace list display
7. Create `LibraryArtifactCard.tsx` component (placeholder)
8. Integrate Library view into app navigation
9. Test UI with mock workspaces

**Deliverables:**
- ✅ Library UI components created
- ✅ Workspace management in UI
- ✅ Navigation integrated

### Phase 4A: Publishing - File Operations (Week 4-5)

**Goal**: Implement artifact selection and path mapping

1. Create `PublishToLibraryDialog.tsx` component
2. Implement artifact selection UI (individual items, folders)
3. Create path mapping logic (local → Library paths)
4. Implement file content reading from local filesystem
5. Add base64 encoding for file content
6. Implement conflict detection (check if file exists in repo)
7. Add batch file operation preparation
8. Create Tauri commands: `library_prepare_publish`, `library_check_conflicts`
9. Test path mapping and file reading

**Deliverables:**
- ✅ Artifact selection UI working
- ✅ Path mapping logic implemented
- ✅ File content preparation ready

### Phase 4B: Publishing - GitHub Integration (Week 5)

**Goal**: Publish artifacts to GitHub via API

1. Integrate publishing with GitHub API client
2. Implement batch file creation/updates
3. Add commit message handling
4. Implement publishing progress tracking
5. Add error recovery for failed file operations
6. Create Tauri command: `library_publish_artifacts`
7. Test publishing with real GitHub repo
8. Handle edge cases (large files, many files, network failures)

**Deliverables:**
- ✅ Publishing to GitHub working
- ✅ Batch operations implemented
- ✅ Error recovery working

### Phase 5A: Libgit2 Setup (Week 5)

**Goal**: Set up libgit2 for git operations

1. Add `git2` dependency to `Cargo.toml`
2. Create `src-tauri/src/git_operations.rs` module
3. Implement `init_repo()` function
4. Implement `add_remote()` function
5. Create credential callback structure
6. Implement token injection in credential callback
7. Test basic git operations (init, add remote)
8. Test credential callback with GitHub token

**Deliverables:**
- ✅ Libgit2 integrated
- ✅ Credential callback working
- ✅ Basic git operations tested

### Phase 5B: Git Push Integration (Week 5-6)

**Goal**: Integrate git push with Library publishing

1. Implement `push_to_github()` function
2. Implement `commit_and_push()` function
3. Integrate git push after GitHub API file creation
4. Add error handling for git failures
5. Handle merge conflicts
6. Create Tauri commands: `git_push`, `git_commit_and_push`
7. Test full publish flow: API → Git push
8. Test with real GitHub repos

**Deliverables:**
- ✅ Git push integrated with publishing
- ✅ Full publish flow working
- ✅ Error handling for git operations

### Phase 6: Core Features (Week 6-7)

**Goal**: Add user-facing GitHub features

1. Create `GitHubProfile.tsx` component
2. Display user avatar and username
3. Create `CommitViewer.tsx` component
4. Implement commit list fetching
5. Add commit details view
6. Create `CreateRepoDialog.tsx` component
7. Implement repository creation
8. Integrate GitHub features into existing views
9. Add GitHub links to artifacts

**Deliverables:**
- ✅ User profile display
- ✅ Commit viewer working
- ✅ Repository creation working

### Phase 7: Polish & Testing (Week 7-8)

**Goal**: Finalize and test entire system

1. Comprehensive error handling throughout
2. Loading states for all async operations
3. Token validation before operations
4. Sign out functionality
5. Token refresh handling (if needed)
6. End-to-end testing of full flows
7. Performance optimization
8. Documentation (code comments, user docs)
9. Security audit
10. Final testing on all platforms

**Deliverables:**
- ✅ Production-ready GitHub integration
- ✅ Comprehensive error handling
- ✅ Full documentation
- ✅ Tested on all platforms

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

## 17.5. Team Sharing Architecture

### Team Sharing Concept

**Core Idea**: Teams can link multiple GitHub accounts to share Library workspaces. Team members can publish to shared repos, and changes sync across all team members automatically.

### Use Cases

1. **Team Collaboration**: Multiple developers share kits/walkthroughs in a team workspace
2. **Organization Libraries**: GitHub organizations can have shared BlueKit libraries
3. **Cross-Account Sharing**: Users can invite others to their workspaces
4. **Permission Management**: Different roles (owner, admin, member) with different permissions

### Data Model

```rust
// Team structure
pub struct Team {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

// Team member (linked GitHub account)
pub struct TeamMember {
    pub id: String,
    pub team_id: String,
    pub github_username: String,
    pub github_user_id: String,
    pub github_avatar_url: Option<String>,
    pub role: TeamRole, // owner, admin, member
    pub joined_at: i64,
    pub invited_by: Option<String>, // member_id who invited
}

pub enum TeamRole {
    Owner,   // Can delete team, manage all members, all operations
    Admin,   // Can manage members, all workspace operations
    Member,  // Can publish to workspaces, view team content
}

// Shared workspace (team-owned)
pub struct SharedWorkspace {
    pub id: String,
    pub team_id: String,
    pub name: String,
    pub description: Option<String>,
    pub github_owner: String, // Team org or shared account
    pub github_repo: String,
    pub created_by: String, // member_id
    pub created_at: i64,
    pub updated_at: i64,
}

// Team invitation
pub struct TeamInvitation {
    pub id: String,
    pub team_id: String,
    pub github_username: String,
    pub invited_by: String, // member_id
    pub role: TeamRole,
    pub created_at: i64,
    pub expires_at: i64,
    pub accepted: bool,
}
```

### Team Workflow

#### 1. Team Creation
```
User → Creates Team → Becomes Owner → Team ID Generated
```

#### 2. Inviting Members
```
Owner/Admin → Invites by GitHub Username → Invitation Created
Invitee → Authenticates with GitHub → System Verifies Account → Joins Team
```

#### 3. Shared Workspaces
```
Team → Creates Shared Workspace → Links to GitHub Org Repo
All Members → Can Publish to Workspace → Changes Visible to All
```

#### 4. Permissions Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Delete team | ✅ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Change member roles | ✅ | ✅ | ❌ |
| Create workspace | ✅ | ✅ | ✅ |
| Delete workspace | ✅ | ✅ | ❌ |
| Publish to workspace | ✅ | ✅ | ✅ |
| View team content | ✅ | ✅ | ✅ |

### Implementation Approach

**Recommended: GitHub Organizations**

**Why GitHub Orgs?**
- ✅ Built-in permission management
- ✅ Secure (GitHub handles auth)
- ✅ Scalable (unlimited members)
- ✅ Professional (standard for teams)
- ✅ No shared account security issues

**How It Works:**
1. Team creates/uses GitHub Organization
2. Team members join GitHub org (via GitHub)
3. Workspaces link to org repos
4. GitHub handles permissions automatically
5. BlueKit just needs org member's personal tokens

**Alternative: Shared Account (Fallback)**
- Use shared GitHub account for teams without orgs
- All members use same token (less secure)
- Simpler but less flexible
- Good for small teams or personal projects

**Hybrid Approach:**
- Prefer GitHub orgs when available
- Fallback to shared account
- Best of both worlds

### Team Sharing UI Components

**Location**: `src/components/teams/`

- `TeamSelector.tsx` - Select/create teams, show current team
- `TeamMembersList.tsx` - View team members, roles, avatars
- `InviteMemberDialog.tsx` - Invite by GitHub username, select role
- `TeamSettings.tsx` - Team management, delete team, change name
- `SharedWorkspaceCard.tsx` - Display shared workspaces with team info
- `TeamRoleBadge.tsx` - Display member roles (Owner/Admin/Member)
- `TeamInvitationsList.tsx` - View pending invitations

### Backend Commands

```rust
// Team management
#[tauri::command]
pub async fn team_create(name: String, description: Option<String>) -> Result<Team, String>;

#[tauri::command]
pub async fn team_list() -> Result<Vec<Team>, String>;

#[tauri::command]
pub async fn team_get(team_id: String) -> Result<Team, String>;

#[tauri::command]
pub async fn team_update(team_id: String, name: Option<String>, description: Option<String>) -> Result<Team, String>;

#[tauri::command]
pub async fn team_delete(team_id: String) -> Result<(), String>;

// Team members
#[tauri::command]
pub async fn team_invite_member(
    team_id: String,
    github_username: String,
    role: TeamRole,
) -> Result<TeamInvitation, String>;

#[tauri::command]
pub async fn team_list_members(team_id: String) -> Result<Vec<TeamMember>, String>;

#[tauri::command]
pub async fn team_remove_member(team_id: String, member_id: String) -> Result<(), String>;

#[tauri::command]
pub async fn team_update_member_role(
    team_id: String,
    member_id: String,
    role: TeamRole,
) -> Result<TeamMember, String>;

#[tauri::command]
pub async fn team_accept_invitation(invitation_id: String) -> Result<TeamMember, String>;

#[tauri::command]
pub async fn team_list_invitations(team_id: String) -> Result<Vec<TeamInvitation>, String>;

// Shared workspaces
#[tauri::command]
pub async fn team_create_shared_workspace(
    team_id: String,
    name: String,
    description: Option<String>,
    github_org: String,
    github_repo: String,
) -> Result<SharedWorkspace, String>;

#[tauri::command]
pub async fn team_list_shared_workspaces(team_id: String) -> Result<Vec<SharedWorkspace>, String>;

#[tauri::command]
pub async fn team_delete_shared_workspace(workspace_id: String) -> Result<(), String>;
```

### Database Schema

```sql
-- Teams table
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Team members table
CREATE TABLE team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    github_username TEXT NOT NULL,
    github_user_id TEXT NOT NULL,
    github_avatar_url TEXT,
    role TEXT NOT NULL, -- 'owner', 'admin', 'member'
    joined_at INTEGER NOT NULL,
    invited_by TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(team_id, github_user_id)
);

-- Shared workspaces table
CREATE TABLE shared_workspaces (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    github_owner TEXT NOT NULL,
    github_repo TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES team_members(id)
);

-- Team invitations table
CREATE TABLE team_invitations (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    github_username TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES team_members(id)
);
```

### Security Considerations

1. **Invitation Verification**: Verify GitHub username exists and matches authenticated user
2. **Role-Based Access**: Enforce permissions at backend level, not just UI
3. **Token Security**: Each member uses their own GitHub token (not shared)
4. **Invitation Expiry**: Invitations expire after 7 days
5. **Team Deletion**: Only owner can delete team, requires confirmation

### Future Enhancements

- **GitHub Org Integration**: Auto-detect org membership
- **Team Activity Feed**: Show who published what
- **Team Notifications**: Notify members of new publishes
- **Workspace Permissions**: Per-workspace permissions (read-only, write, admin)
- **Team Templates**: Pre-configured workspace templates
- **Team Analytics**: Usage stats per team member

## 18. Next Steps

1. **Review this plan** and confirm approach
2. **Create GitHub OAuth app** and note Client ID
3. **Set up environment variables** (.env file)
4. **Start with Phase 1**: Foundation & Auth Module
5. **Iterate**: Build features incrementally, test as you go

---

**Last Updated**: 2025-01-27
**Status**: Planning Phase - Updated with Keychain Architecture, Token Injection Details, Detailed Implementation Phases, and Team Sharing Design
**Owner**: Development Team
