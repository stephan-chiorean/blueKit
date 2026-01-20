# GitHub Collaborator Management in BlueKit

**Status:** Planning
**Created:** 2025-12-21
**Context:** Deep dive into collaborator management capabilities for workspace creation and management

## Overview

BlueKit workspaces can leverage GitHub's comprehensive collaborator management API to provide team collaboration features directly from the desktop app. Users can add collaborators, manage permissions, view pending invitations, and control access—all without leaving BlueKit.

---

## Table of Contents

1. [API Capabilities](#1-api-capabilities)
2. [Permission Model](#2-permission-model)
3. [Invitation Workflow](#3-invitation-workflow)
4. [User Discovery & Search](#4-user-discovery--search)
5. [BlueKit Integration Design](#5-bluekit-integration-design)
6. [Implementation Plan](#6-implementation-plan)
7. [UI/UX Design](#7-uiux-design)
8. [Database Schema](#8-database-schema)
9. [Rate Limits & Best Practices](#9-rate-limits--best-practices)

---

## 1. API Capabilities

### Core Operations

| Operation | Endpoint | Method | Use Case |
|-----------|----------|--------|----------|
| **List collaborators** | `GET /repos/{owner}/{repo}/collaborators` | GET | Show who has access to workspace |
| **Add collaborator** | `PUT /repos/{owner}/{repo}/collaborators/{username}` | PUT | Invite user to workspace |
| **Update permissions** | `PUT /repos/{owner}/{repo}/collaborators/{username}` | PUT | Change existing collaborator's role |
| **Remove collaborator** | `DELETE /repos/{owner}/{repo}/collaborators/{username}` | DELETE | Revoke workspace access |
| **Check permission** | `GET /repos/{owner}/{repo}/collaborators/{username}/permission` | GET | Verify user's current access level |
| **List pending invitations** | `GET /repos/{owner}/{repo}/invitations` | GET | Show who hasn't accepted yet |
| **Update pending invitation** | `PATCH /repos/{owner}/{repo}/invitations/{id}` | PATCH | Modify invitation before acceptance |
| **Cancel invitation** | `DELETE /repos/{owner}/{repo}/invitations/{id}` | DELETE | Revoke pending invitation |

### Advanced Features

- **Filter by affiliation**: `?affiliation=outside` (external users only), `direct`, or `all`
- **Filter by permission**: `?permission=push` (show only users with specific role)
- **Pagination**: Up to 100 results per page
- **Bulk search**: Check multiple users' permissions

---

## 2. Permission Model

### Five Permission Levels

GitHub supports **5 granular permission levels**:

| Level | API Value | Capabilities | Recommended For |
|-------|-----------|--------------|-----------------|
| **Pull** | `pull` | • Read code<br>• View issues/PRs<br>• Clone repository | Viewers, consumers of artifacts |
| **Triage** | `triage` | • Pull capabilities<br>• Manage issues (close, reopen, label)<br>• Manage PRs (request reviews, mark as ready) | Issue managers, community moderators |
| **Push** | `push` | • Triage capabilities<br>• Push to repository<br>• Merge pull requests<br>• Create/edit releases | Contributors, developers |
| **Maintain** | `maintain` | • Push capabilities<br>• Manage repository settings<br>• Manage webhooks<br>• Manage deploy keys | Project maintainers |
| **Admin** | `admin` | • Maintain capabilities<br>• Delete repository<br>• Add/remove collaborators<br>• Transfer repository | Workspace owners, administrators |

### BlueKit Workspace Recommendations

For BlueKit library workspaces:

- **Admin** → Workspace creator and co-owners (full control)
- **Push** → Active contributors who publish artifacts (most common)
- **Pull** → Consumers who only subscribe to artifacts (read-only)
- **Triage** → Not typically used (issues disabled)
- **Maintain** → Senior contributors who manage workspace settings

### Permission Response Format

API responses include both legacy and modern permission fields:

```json
{
  "login": "octocat",
  "id": 1,
  "avatar_url": "https://github.com/images/error/octocat_happy.gif",
  "permissions": {
    "pull": true,
    "triage": false,
    "push": true,
    "maintain": false,
    "admin": false
  },
  "role_name": "push"  // ⭐ Use this field for accurate role
}
```

**Important**: Always use `role_name` for the actual permission level, not the legacy `permission` field.

---

## 3. Invitation Workflow

### Complete Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                   INVITATION LIFECYCLE                       │
└─────────────────────────────────────────────────────────────┘

1. Admin creates invitation
   ↓
   PUT /repos/{owner}/{repo}/collaborators/{username}
   Body: { "permission": "push" }

2. GitHub creates pending invitation
   ↓
   Response: 201 Created (invitation sent)

3. Invited user receives notification
   ↓
   Email + GitHub notification

4. Admin can view pending invitations
   ↓
   GET /repos/{owner}/{repo}/invitations

   Admin can:
   • Update permission: PATCH /repos/{owner}/{repo}/invitations/{id}
   • Cancel invitation: DELETE /repos/{owner}/{repo}/invitations/{id}

5. Invited user views pending invitations
   ↓
   GET /user/repository_invitations

6a. User ACCEPTS invitation
    ↓
    PATCH /user/repository_invitations/{id}
    ↓
    Status: Active collaborator with specified permissions

6b. User DECLINES invitation
    ↓
    DELETE /user/repository_invitations/{id}
    ↓
    Status: No access, invitation removed
```

### Invitation States

| State | Description | Admin Actions | User Actions |
|-------|-------------|---------------|--------------|
| **Pending** | Invitation sent, awaiting response | Update permissions, Cancel | Accept, Decline |
| **Accepted** | User is active collaborator | Update permissions, Remove | N/A |
| **Declined** | User rejected invitation | Re-invite | N/A |
| **Cancelled** | Admin revoked invitation | Re-invite | N/A |
| **Expired** | Invitation timed out (7 days) | Re-invite | N/A |

### Important Constraints

- **Invitation limit**: 50 invitations per repository per 24 hours
- **Invitation expiry**: Invitations expire after 7 days
- **Re-inviting**: If invitation expires/declined, you can send a new one
- **Existing collaborators**: PUT request returns 204 (updates permission) instead of 201

---

## 4. User Discovery & Search

### The Problem

Adding collaborators shouldn't require memorizing GitHub usernames. Users need an easy way to find and add people they know or have worked with before.

### Available Discovery APIs

GitHub provides several endpoints for discovering users:

#### 4.1 Search Users API

**Endpoint:** `GET /search/users`

The primary method for finding users by name or username.

**Parameters:**
- `q` (required) - Search query (supports partial matching)
- `sort` - Sort by `followers`, `repositories`, or `joined`
- `order` - `asc` or `desc`
- `per_page` - Results per page (max 100, default 30)
- `page` - Page number for pagination

**Example:**
```
GET https://api.github.com/search/users?q=john&sort=followers&order=desc&per_page=10
```

**Response:**
```json
{
  "total_count": 12345,
  "incomplete_results": false,
  "items": [
    {
      "login": "johndoe",
      "id": 123456,
      "avatar_url": "https://avatars.githubusercontent.com/u/123456",
      "html_url": "https://github.com/johndoe",
      "type": "User",
      "score": 1.0
    }
  ]
}
```

**Rate Limit:** 30 requests per minute (separate from general 5,000/hour limit)

**Use Case:** Real-time autocomplete as user types

#### 4.2 Following/Followers API

**Endpoints:**
- `GET /user/following` - List people you follow
- `GET /user/followers` - List people following you
- `GET /users/{username}/following` - List who a user follows
- `GET /users/{username}/followers` - List a user's followers

**Benefits:**
- Pre-populated list of known connections
- Faster access than search
- No typing required

**Use Case:** "Quick add" dropdown showing people you already know

#### 4.3 Organization Members API

**Endpoints:**
- `GET /orgs/{org}/members` - List all organization members
- `GET /user/memberships/orgs` - List your organization memberships

**Filters:**
- `role` - Filter by `all`, `admin`, or `member`
- `per_page` - Results per page (max 100)
- `page` - Pagination

**Use Case:** When creating org workspace, show all org members for easy selection

#### 4.4 Repository Stargazers

**Endpoint:** `GET /repos/{owner}/{repo}/stargazers`

Find users who starred specific repositories, revealing shared technical interests.

**Use Case:** Discover potential collaborators through shared interests

### Discovery Strategy for BlueKit

Implement a **multi-source discovery system** that prioritizes relevance:

```
Priority 1: Your Social Graph
├─ People you follow (GET /user/following)
├─ Your followers (GET /user/followers)
└─ Organization members (GET /orgs/{org}/members)

Priority 2: Search Results
└─ GitHub search (GET /search/users?q=...)

Priority 3: Context-Based Suggestions
├─ Stargazers of related repos
└─ Contributors to similar projects
```

### Implementation Approach

#### Backend: GitHubClient Extensions

**File:** `src-tauri/src/integrations/github/github.rs`

```rust
/// Search for GitHub users.
pub async fn search_users(
    &self,
    query: &str,
    sort: Option<&str>,      // "followers", "repositories", "joined"
    order: Option<&str>,     // "asc", "desc"
    per_page: Option<u32>,   // max 100
) -> Result<UserSearchResponse, String> {
    let mut endpoint = format!("/search/users?q={}", query);

    if let Some(s) = sort {
        endpoint.push_str(&format!("&sort={}", s));
    }
    if let Some(o) = order {
        endpoint.push_str(&format!("&order={}", o));
    }
    if let Some(pp) = per_page {
        endpoint.push_str(&format!("&per_page={}", pp.min(100)));
    }

    self.request::<UserSearchResponse>("GET", endpoint, None).await
}

/// Get users you follow.
pub async fn get_following(&self) -> Result<Vec<GitHubUser>, String> {
    self.request::<Vec<GitHubUser>>("GET", "/user/following".to_string(), None).await
}

/// Get your followers.
pub async fn get_followers(&self) -> Result<Vec<GitHubUser>, String> {
    self.request::<Vec<GitHubUser>>("GET", "/user/followers".to_string(), None).await
}

/// Get organization members.
pub async fn get_org_members(
    &self,
    org: &str,
    role: Option<&str>, // "all", "admin", "member"
) -> Result<Vec<GitHubUser>, String> {
    let mut endpoint = format!("/orgs/{}/members", org);

    if let Some(r) = role {
        endpoint.push_str(&format!("?role={}", r));
    }

    self.request::<Vec<GitHubUser>>("GET", endpoint, None).await
}

/// Get your organization memberships.
pub async fn get_user_orgs(&self) -> Result<Vec<GitHubOrganization>, String> {
    self.request::<Vec<GitHubOrganization>>("GET", "/user/memberships/orgs".to_string(), None).await
}
```

**Response Types:**

```rust
/// User search response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSearchResponse {
    pub total_count: u64,
    pub incomplete_results: bool,
    pub items: Vec<GitHubSearchUser>,
}

/// Search user result (lighter than full GitHubUser)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubSearchUser {
    pub login: String,
    pub id: u64,
    pub avatar_url: String,
    pub html_url: String,
    #[serde(rename = "type")]
    pub user_type: String, // "User" or "Organization"
    pub score: f64,
}

/// GitHub organization
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubOrganization {
    pub login: String,
    pub id: u64,
    pub avatar_url: String,
    pub description: Option<String>,
}
```

#### Tauri Commands

**File:** `src-tauri/src/commands.rs`

```rust
/// Searches for GitHub users.
#[tauri::command]
pub async fn github_search_users(
    query: String,
    sort: Option<String>,
    order: Option<String>,
    per_page: Option<u32>,
) -> Result<UserSearchResponse, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client
        .search_users(
            &query,
            sort.as_deref(),
            order.as_deref(),
            per_page,
        )
        .await
}

/// Gets users you follow.
#[tauri::command]
pub async fn github_get_following() -> Result<Vec<GitHubUser>, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.get_following().await
}

/// Gets your followers.
#[tauri::command]
pub async fn github_get_followers() -> Result<Vec<GitHubUser>, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.get_followers().await
}

/// Gets organization members.
#[tauri::command]
pub async fn github_get_org_members(
    org: String,
    role: Option<String>,
) -> Result<Vec<GitHubUser>, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.get_org_members(&org, role.as_deref()).await
}

/// Gets your organizations.
#[tauri::command]
pub async fn github_get_user_orgs() -> Result<Vec<GitHubOrganization>, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.get_user_orgs().await
}
```

#### Frontend: IPC Wrappers

**File:** `src/ipc/github.ts`

```typescript
/**
 * Search for GitHub users.
 */
export async function invokeGitHubSearchUsers(
  query: string,
  options?: {
    sort?: 'followers' | 'repositories' | 'joined';
    order?: 'asc' | 'desc';
    perPage?: number;
  }
): Promise<UserSearchResponse> {
  return await invokeWithTimeout<UserSearchResponse>(
    'github_search_users',
    {
      query,
      sort: options?.sort,
      order: options?.order,
      perPage: options?.perPage,
    },
    10000
  );
}

/**
 * Get users you follow.
 */
export async function invokeGitHubGetFollowing(): Promise<GitHubUser[]> {
  return await invokeWithTimeout<GitHubUser[]>('github_get_following', {}, 10000);
}

/**
 * Get your followers.
 */
export async function invokeGitHubGetFollowers(): Promise<GitHubUser[]> {
  return await invokeWithTimeout<GitHubUser[]>('github_get_followers', {}, 10000);
}

/**
 * Get organization members.
 */
export async function invokeGitHubGetOrgMembers(
  org: string,
  role?: 'all' | 'admin' | 'member'
): Promise<GitHubUser[]> {
  return await invokeWithTimeout<GitHubUser[]>(
    'github_get_org_members',
    { org, role },
    10000
  );
}

/**
 * Get your organizations.
 */
export async function invokeGitHubGetUserOrgs(): Promise<GitHubOrganization[]> {
  return await invokeWithTimeout<GitHubOrganization[]>('github_get_user_orgs', {}, 10000);
}
```

**TypeScript Types:**

```typescript
// Add to src/types/github.ts

export interface UserSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchUser[];
}

export interface GitHubSearchUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Organization';
  score: number;
}

export interface GitHubOrganization {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
}
```

### Rate Limit Considerations

**Search API has separate limits:**
- Search: 30 requests/minute (separate quota)
- Following/Followers: Uses general 5,000/hour quota
- Org members: Uses general 5,000/hour quota

**Optimization strategies:**
1. **Debounce search input** - Wait 300ms after user stops typing
2. **Cache search results** - Store recent searches for 5 minutes
3. **Prioritize social graph** - Load following/followers once, cache indefinitely
4. **Client-side filtering** - Filter cached results before making new API calls

---

## 5. BlueKit Integration Design

### User Experience Goals

1. **Seamless onboarding**: Add collaborators during workspace creation
2. **Centralized management**: View and manage all collaborators from BlueKit
3. **Real-time status**: See who has accepted invitations
4. **Permission control**: Easy permission level adjustment
5. **Visibility**: Know who can access each workspace

### Key Features to Implement

#### Feature 1: Add Collaborators During Workspace Creation

**Workflow:**
```
User creates workspace
  ↓
Workspace creation form includes "Collaborators" section
  ↓
User enters GitHub usernames and selects permissions
  ↓
BlueKit creates repository
  ↓
BlueKit sends invitations to all specified users
  ↓
User sees confirmation with invitation status
```

#### Feature 2: Workspace Collaborator Dashboard

**View:**
- List of all collaborators (active + pending)
- Permission level for each
- Invitation status (accepted/pending/declined)
- Avatar, name, GitHub profile link
- Last activity timestamp

**Actions:**
- Add new collaborator
- Update existing collaborator's permission
- Remove collaborator
- Resend pending invitation
- Cancel pending invitation

#### Feature 3: Collaborator Search

**Functionality:**
- Search GitHub users by username
- Show user's profile info before adding
- Validate user exists before sending invitation
- Suggest permission level based on role

#### Feature 4: Permission Templates

**Pre-defined templates for common scenarios:**

```typescript
const permissionTemplates = {
  "workspace-owner": {
    permission: "admin",
    description: "Full control over workspace",
  },
  "contributor": {
    permission: "push",
    description: "Can publish and update artifacts",
  },
  "viewer": {
    permission: "pull",
    description: "Read-only access to artifacts",
  },
};
```

#### Feature 5: Bulk Invitation Management

**For team workspaces:**
- Import collaborators from CSV
- Add multiple users at once
- Set default permission level for bulk invites
- Review before sending

---

## 5. Implementation Plan

### Phase 1: Backend (Rust)

#### Step 1.1: Extend GitHubClient

**File:** `src-tauri/src/integrations/github/github.rs`

```rust
// List all collaborators
pub async fn list_collaborators(
    &self,
    owner: &str,
    repo: &str,
    affiliation: Option<&str>, // "outside", "direct", "all"
    permission: Option<&str>,  // "pull", "push", "admin", etc.
) -> Result<Vec<GitHubCollaborator>, String> {
    let mut endpoint = format!("/repos/{}/{}/collaborators", owner, repo);

    let mut params = vec![];
    if let Some(aff) = affiliation {
        params.push(format!("affiliation={}", aff));
    }
    if let Some(perm) = permission {
        params.push(format!("permission={}", perm));
    }

    if !params.is_empty() {
        endpoint.push_str("?");
        endpoint.push_str(&params.join("&"));
    }

    self.request::<Vec<GitHubCollaborator>>("GET", endpoint, None).await
}

// Add or update collaborator
pub async fn add_collaborator(
    &self,
    owner: &str,
    repo: &str,
    username: &str,
    permission: &str, // "pull", "triage", "push", "maintain", "admin"
) -> Result<CollaboratorInvitationResponse, String> {
    let endpoint = format!("/repos/{}/{}/collaborators/{}", owner, repo, username);

    let body = serde_json::json!({
        "permission": permission,
    });

    let response = self.request_with_status("PUT", endpoint, Some(body)).await?;

    match response.status {
        201 => Ok(CollaboratorInvitationResponse::InvitationSent(response.body)),
        204 => Ok(CollaboratorInvitationResponse::PermissionsUpdated),
        _ => Err(format!("Unexpected status: {}", response.status)),
    }
}

// Remove collaborator
pub async fn remove_collaborator(
    &self,
    owner: &str,
    repo: &str,
    username: &str,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/collaborators/{}", owner, repo, username);

    self.request::<serde_json::Value>("DELETE", endpoint, None).await?;
    Ok(())
}

// Get collaborator permission level
pub async fn get_collaborator_permission(
    &self,
    owner: &str,
    repo: &str,
    username: &str,
) -> Result<CollaboratorPermission, String> {
    let endpoint = format!("/repos/{}/{}/collaborators/{}/permission", owner, repo, username);

    self.request::<CollaboratorPermission>("GET", endpoint, None).await
}

// List pending invitations
pub async fn list_pending_invitations(
    &self,
    owner: &str,
    repo: &str,
) -> Result<Vec<GitHubInvitation>, String> {
    let endpoint = format!("/repos/{}/{}/invitations", owner, repo);

    self.request::<Vec<GitHubInvitation>>("GET", endpoint, None).await
}

// Update pending invitation
pub async fn update_pending_invitation(
    &self,
    owner: &str,
    repo: &str,
    invitation_id: u64,
    permission: &str,
) -> Result<GitHubInvitation, String> {
    let endpoint = format!("/repos/{}/{}/invitations/{}", owner, repo, invitation_id);

    let body = serde_json::json!({
        "permissions": permission,
    });

    self.request("PATCH", endpoint, Some(body)).await
}

// Cancel pending invitation
pub async fn cancel_pending_invitation(
    &self,
    owner: &str,
    repo: &str,
    invitation_id: u64,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/invitations/{}", owner, repo, invitation_id);

    self.request::<serde_json::Value>("DELETE", endpoint, None).await?;
    Ok(())
}

// Helper method to handle response with status code
async fn request_with_status<T>(
    &self,
    method: &str,
    endpoint: String,
    body: Option<serde_json::Value>,
) -> Result<ResponseWithStatus<T>, String>
where
    T: serde::de::DeserializeOwned,
{
    let url = format!("https://api.github.com{}", endpoint);
    let mut request = self
        .client
        .request(
            method.parse().map_err(|e| format!("Invalid HTTP method: {}", e))?,
            &url,
        )
        .header("Authorization", format!("Bearer {}", self.token))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "BlueKit/1.0");

    if let Some(body) = body {
        request = request.json(&body);
    }

    let response = request.send().await.map_err(|e| format!("Request failed: {}", e))?;
    let status = response.status().as_u16();

    // For 204 No Content, return empty value
    if status == 204 {
        // Can't deserialize from empty body, handle specially
        return Ok(ResponseWithStatus {
            status,
            body: serde_json::from_str("{}").unwrap(), // Placeholder
        });
    }

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({}): {}", status, error_text));
    }

    let body = response.json().await.map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(ResponseWithStatus { status, body })
}
```

#### Step 1.2: Define Response Types

**File:** `src-tauri/src/integrations/github/github.rs`

```rust
/// GitHub collaborator information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubCollaborator {
    pub login: String,
    pub id: u64,
    pub avatar_url: String,
    pub html_url: String,
    pub permissions: CollaboratorPermissions,
    pub role_name: String, // Actual role: pull, triage, push, maintain, admin
}

/// Collaborator permission flags
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollaboratorPermissions {
    pub pull: bool,
    pub triage: bool,
    pub push: bool,
    pub maintain: bool,
    pub admin: bool,
}

/// Collaborator permission response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollaboratorPermission {
    pub permission: String,  // Legacy: "read", "write", "admin", "none"
    pub role_name: String,   // Actual: "pull", "triage", "push", "maintain", "admin"
    pub user: GitHubUser,
}

/// Pending invitation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubInvitation {
    pub id: u64,
    pub repository: InvitationRepository,
    pub invitee: GitHubUser,
    pub inviter: GitHubUser,
    pub permissions: String, // "read", "write", "admin"
    pub created_at: String,
    pub expired: bool,
    pub url: String,
    pub html_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvitationRepository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubRepoOwner,
}

/// Response for add_collaborator operation
#[derive(Debug)]
pub enum CollaboratorInvitationResponse {
    InvitationSent(GitHubInvitation),
    PermissionsUpdated,
}

/// Helper struct for responses with status code
struct ResponseWithStatus<T> {
    status: u16,
    body: T,
}
```

#### Step 1.3: Create Tauri Commands

**File:** `src-tauri/src/commands.rs`

```rust
/// Lists all collaborators for a workspace repository.
#[tauri::command]
pub async fn github_list_collaborators(
    owner: String,
    repo: String,
    affiliation: Option<String>,
    permission: Option<String>,
) -> Result<Vec<GitHubCollaborator>, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client
        .list_collaborators(
            &owner,
            &repo,
            affiliation.as_deref(),
            permission.as_deref(),
        )
        .await
}

/// Adds a collaborator to a workspace repository.
#[tauri::command]
pub async fn github_add_collaborator(
    owner: String,
    repo: String,
    username: String,
    permission: String,
) -> Result<String, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    // Validate permission level
    if !["pull", "triage", "push", "maintain", "admin"].contains(&permission.as_str()) {
        return Err(format!("Invalid permission level: {}", permission));
    }

    match github_client.add_collaborator(&owner, &repo, &username, &permission).await? {
        CollaboratorInvitationResponse::InvitationSent(_) => {
            Ok(format!("Invitation sent to {}", username))
        }
        CollaboratorInvitationResponse::PermissionsUpdated => {
            Ok(format!("Updated permissions for {}", username))
        }
    }
}

/// Removes a collaborator from a workspace repository.
#[tauri::command]
pub async fn github_remove_collaborator(
    owner: String,
    repo: String,
    username: String,
) -> Result<String, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.remove_collaborator(&owner, &repo, &username).await?;
    Ok(format!("Removed {} from repository", username))
}

/// Gets a specific collaborator's permission level.
#[tauri::command]
pub async fn github_get_collaborator_permission(
    owner: String,
    repo: String,
    username: String,
) -> Result<CollaboratorPermission, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.get_collaborator_permission(&owner, &repo, &username).await
}

/// Lists all pending invitations for a workspace repository.
#[tauri::command]
pub async fn github_list_pending_invitations(
    owner: String,
    repo: String,
) -> Result<Vec<GitHubInvitation>, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.list_pending_invitations(&owner, &repo).await
}

/// Updates a pending invitation's permission level.
#[tauri::command]
pub async fn github_update_pending_invitation(
    owner: String,
    repo: String,
    invitation_id: u64,
    permission: String,
) -> Result<GitHubInvitation, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client
        .update_pending_invitation(&owner, &repo, invitation_id, &permission)
        .await
}

/// Cancels a pending invitation.
#[tauri::command]
pub async fn github_cancel_pending_invitation(
    owner: String,
    repo: String,
    invitation_id: u64,
) -> Result<String, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    github_client.cancel_pending_invitation(&owner, &repo, invitation_id).await?;
    Ok("Invitation cancelled".to_string())
}
```

#### Step 1.4: Register Commands

**File:** `src-tauri/src/main.rs`

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...

            // Collaborator management commands
            commands::github_list_collaborators,
            commands::github_add_collaborator,
            commands::github_remove_collaborator,
            commands::github_get_collaborator_permission,
            commands::github_list_pending_invitations,
            commands::github_update_pending_invitation,
            commands::github_cancel_pending_invitation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Phase 2: Frontend (TypeScript)

#### Step 2.1: Define TypeScript Types

**File:** `src/types/github.ts`

```typescript
/**
 * GitHub collaborator permissions.
 */
export interface CollaboratorPermissions {
  pull: boolean;
  triage: boolean;
  push: boolean;
  maintain: boolean;
  admin: boolean;
}

/**
 * GitHub collaborator information.
 */
export interface GitHubCollaborator {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  permissions: CollaboratorPermissions;
  role_name: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
}

/**
 * Collaborator permission level response.
 */
export interface CollaboratorPermission {
  permission: string; // Legacy
  role_name: 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
  user: GitHubUser;
}

/**
 * Repository invitation.
 */
export interface GitHubInvitation {
  id: number;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
      avatar_url: string;
      html_url: string;
    };
  };
  invitee: GitHubUser;
  inviter: GitHubUser;
  permissions: string;
  created_at: string;
  expired: boolean;
  url: string;
  html_url: string;
}

/**
 * Permission level type.
 */
export type PermissionLevel = 'pull' | 'triage' | 'push' | 'maintain' | 'admin';
```

#### Step 2.2: Create IPC Wrappers

**File:** `src/ipc/github.ts`

```typescript
/**
 * Lists all collaborators for a repository.
 */
export async function invokeGitHubListCollaborators(
  owner: string,
  repo: string,
  options?: {
    affiliation?: 'outside' | 'direct' | 'all';
    permission?: PermissionLevel;
  }
): Promise<GitHubCollaborator[]> {
  return await invokeWithTimeout<GitHubCollaborator[]>(
    'github_list_collaborators',
    {
      owner,
      repo,
      affiliation: options?.affiliation,
      permission: options?.permission,
    },
    10000
  );
}

/**
 * Adds a collaborator to a repository.
 */
export async function invokeGitHubAddCollaborator(
  owner: string,
  repo: string,
  username: string,
  permission: PermissionLevel
): Promise<string> {
  return await invokeWithTimeout<string>(
    'github_add_collaborator',
    { owner, repo, username, permission },
    10000
  );
}

/**
 * Removes a collaborator from a repository.
 */
export async function invokeGitHubRemoveCollaborator(
  owner: string,
  repo: string,
  username: string
): Promise<string> {
  return await invokeWithTimeout<string>(
    'github_remove_collaborator',
    { owner, repo, username },
    10000
  );
}

/**
 * Gets a collaborator's permission level.
 */
export async function invokeGitHubGetCollaboratorPermission(
  owner: string,
  repo: string,
  username: string
): Promise<CollaboratorPermission> {
  return await invokeWithTimeout<CollaboratorPermission>(
    'github_get_collaborator_permission',
    { owner, repo, username },
    10000
  );
}

/**
 * Lists all pending invitations for a repository.
 */
export async function invokeGitHubListPendingInvitations(
  owner: string,
  repo: string
): Promise<GitHubInvitation[]> {
  return await invokeWithTimeout<GitHubInvitation[]>(
    'github_list_pending_invitations',
    { owner, repo },
    10000
  );
}

/**
 * Updates a pending invitation's permission level.
 */
export async function invokeGitHubUpdatePendingInvitation(
  owner: string,
  repo: string,
  invitationId: number,
  permission: PermissionLevel
): Promise<GitHubInvitation> {
  return await invokeWithTimeout<GitHubInvitation>(
    'github_update_pending_invitation',
    { owner, repo, invitationId, permission },
    10000
  );
}

/**
 * Cancels a pending invitation.
 */
export async function invokeGitHubCancelPendingInvitation(
  owner: string,
  repo: string,
  invitationId: number
): Promise<string> {
  return await invokeWithTimeout<string>(
    'github_cancel_pending_invitation',
    { owner, repo, invitationId },
    10000
  );
}
```

#### Step 2.3: Permission Helper Utilities

**File:** `src/utils/permissions.ts`

```typescript
import { PermissionLevel } from '../types/github';

/**
 * Permission level metadata.
 */
export const PERMISSION_LEVELS: Record<
  PermissionLevel,
  {
    label: string;
    description: string;
    color: string;
    capabilities: string[];
  }
> = {
  pull: {
    label: 'Pull',
    description: 'Read-only access',
    color: 'gray',
    capabilities: ['View code', 'Clone repository', 'View issues/PRs'],
  },
  triage: {
    label: 'Triage',
    description: 'Manage issues and PRs',
    color: 'blue',
    capabilities: [
      'Pull capabilities',
      'Manage issues',
      'Manage pull requests',
      'Apply labels',
    ],
  },
  push: {
    label: 'Push',
    description: 'Read and write access',
    color: 'green',
    capabilities: [
      'Triage capabilities',
      'Push to repository',
      'Merge pull requests',
      'Create releases',
    ],
  },
  maintain: {
    label: 'Maintain',
    description: 'Manage repository settings',
    color: 'orange',
    capabilities: [
      'Push capabilities',
      'Manage settings',
      'Manage webhooks',
      'Manage deploy keys',
    ],
  },
  admin: {
    label: 'Admin',
    description: 'Full administrative access',
    color: 'red',
    capabilities: [
      'Maintain capabilities',
      'Delete repository',
      'Add/remove collaborators',
      'Transfer repository',
    ],
  },
};

/**
 * Get permission badge color.
 */
export function getPermissionColor(permission: PermissionLevel): string {
  return PERMISSION_LEVELS[permission]?.color || 'gray';
}

/**
 * Get permission display label.
 */
export function getPermissionLabel(permission: PermissionLevel): string {
  return PERMISSION_LEVELS[permission]?.label || permission;
}

/**
 * Get permission description.
 */
export function getPermissionDescription(permission: PermissionLevel): string {
  return PERMISSION_LEVELS[permission]?.description || '';
}

/**
 * Check if permission level is sufficient.
 */
export function hasPermission(
  userPermission: PermissionLevel,
  requiredPermission: PermissionLevel
): boolean {
  const hierarchy: PermissionLevel[] = ['pull', 'triage', 'push', 'maintain', 'admin'];
  const userIndex = hierarchy.indexOf(userPermission);
  const requiredIndex = hierarchy.indexOf(requiredPermission);
  return userIndex >= requiredIndex;
}
```

---

## 6. UI/UX Design

### Component 1: UserSearchInput Component

**Purpose:** Intelligent autocomplete search for finding GitHub users

```tsx
// src/components/collaborators/UserSearchInput.tsx

import {
  Input,
  List,
  ListItem,
  Avatar,
  HStack,
  VStack,
  Text,
  Box,
  Spinner,
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  invokeGitHubSearchUsers,
  invokeGitHubGetFollowing,
  invokeGitHubGetFollowers,
  invokeGitHubGetOrgMembers,
} from '../../ipc/github';
import type { GitHubUser, GitHubSearchUser } from '../../types/github';

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectUser: (user: GitHubUser | GitHubSearchUser) => void;
  placeholder?: string;
  orgContext?: string; // If creating org workspace, show org members
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  value,
  onChange,
  onSelectUser,
  placeholder = 'Search GitHub users...',
  orgContext,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Multi-source results
  const [searchResults, setSearchResults] = useState<GitHubSearchUser[]>([]);
  const [following, setFollowing] = useState<GitHubUser[]>([]);
  const [followers, setFollowers] = useState<GitHubUser[]>([]);
  const [orgMembers, setOrgMembers] = useState<GitHubUser[]>([]);

  const debouncedQuery = useDebounce(value, 300);

  // Load social graph on mount (cache these)
  useEffect(() => {
    const loadSocialGraph = async () => {
      try {
        const [followingData, followersData] = await Promise.all([
          invokeGitHubGetFollowing(),
          invokeGitHubGetFollowers(),
        ]);
        setFollowing(followingData);
        setFollowers(followersData);
      } catch (error) {
        console.error('Failed to load social graph:', error);
      }
    };

    loadSocialGraph();
  }, []);

  // Load org members if org context provided
  useEffect(() => {
    if (!orgContext) return;

    const loadOrgMembers = async () => {
      try {
        const members = await invokeGitHubGetOrgMembers(orgContext);
        setOrgMembers(members);
      } catch (error) {
        console.error('Failed to load org members:', error);
      }
    };

    loadOrgMembers();
  }, [orgContext]);

  // Search when query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      try {
        const result = await invokeGitHubSearchUsers(debouncedQuery, {
          sort: 'followers',
          order: 'desc',
          perPage: 10,
        });
        setSearchResults(result.items);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery]);

  // Filter social graph by query
  const filteredFollowing = following.filter((user) =>
    user.login.toLowerCase().includes(value.toLowerCase())
  );
  const filteredFollowers = followers.filter((user) =>
    user.login.toLowerCase().includes(value.toLowerCase())
  );
  const filteredOrgMembers = orgMembers.filter((user) =>
    user.login.toLowerCase().includes(value.toLowerCase())
  );

  const handleSelect = (user: GitHubUser | GitHubSearchUser) => {
    onSelectUser(user);
    onChange(''); // Clear input
    setIsOpen(false);
  };

  const hasResults =
    filteredFollowing.length > 0 ||
    filteredFollowers.length > 0 ||
    filteredOrgMembers.length > 0 ||
    searchResults.length > 0;

  return (
    <Box position="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
      />

      {isOpen && hasResults && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={1}
          bg="white"
          _dark={{ bg: 'gray.800' }}
          borderRadius="md"
          borderWidth={1}
          boxShadow="lg"
          maxH="400px"
          overflowY="auto"
          zIndex={1000}
        >
          <Tabs size="sm">
            <TabList>
              {filteredFollowing.length > 0 && (
                <Tab>Following ({filteredFollowing.length})</Tab>
              )}
              {filteredFollowers.length > 0 && (
                <Tab>Followers ({filteredFollowers.length})</Tab>
              )}
              {filteredOrgMembers.length > 0 && (
                <Tab>Organization ({filteredOrgMembers.length})</Tab>
              )}
              {searchResults.length > 0 && (
                <Tab>
                  Search Results {isSearching && <Spinner size="xs" ml={1} />}
                </Tab>
              )}
            </TabList>

            <TabPanels>
              {/* Following */}
              {filteredFollowing.length > 0 && (
                <TabPanel p={0}>
                  <List spacing={0}>
                    {filteredFollowing.slice(0, 10).map((user) => (
                      <ListItem
                        key={user.id}
                        p={2}
                        cursor="pointer"
                        _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
                        onClick={() => handleSelect(user)}
                      >
                        <UserListItem user={user} badge="Following" />
                      </ListItem>
                    ))}
                  </List>
                </TabPanel>
              )}

              {/* Followers */}
              {filteredFollowers.length > 0 && (
                <TabPanel p={0}>
                  <List spacing={0}>
                    {filteredFollowers.slice(0, 10).map((user) => (
                      <ListItem
                        key={user.id}
                        p={2}
                        cursor="pointer"
                        _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
                        onClick={() => handleSelect(user)}
                      >
                        <UserListItem user={user} badge="Follower" />
                      </ListItem>
                    ))}
                  </List>
                </TabPanel>
              )}

              {/* Org Members */}
              {filteredOrgMembers.length > 0 && (
                <TabPanel p={0}>
                  <List spacing={0}>
                    {filteredOrgMembers.slice(0, 10).map((user) => (
                      <ListItem
                        key={user.id}
                        p={2}
                        cursor="pointer"
                        _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
                        onClick={() => handleSelect(user)}
                      >
                        <UserListItem user={user} badge="Team" />
                      </ListItem>
                    ))}
                  </List>
                </TabPanel>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <TabPanel p={0}>
                  <List spacing={0}>
                    {searchResults.map((user) => (
                      <ListItem
                        key={user.id}
                        p={2}
                        cursor="pointer"
                        _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
                        onClick={() => handleSelect(user)}
                      >
                        <UserListItem user={user} />
                      </ListItem>
                    ))}
                  </List>
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>
        </Box>
      )}
    </Box>
  );
};

// Helper component for rendering user list items
const UserListItem: React.FC<{
  user: GitHubUser | GitHubSearchUser;
  badge?: string;
}> = ({ user, badge }) => (
  <HStack spacing={3}>
    <Avatar size="sm" src={user.avatar_url} name={user.login} />
    <VStack align="start" spacing={0} flex={1}>
      <Text fontWeight="medium" fontSize="sm">
        {user.login}
      </Text>
      {'name' in user && user.name && (
        <Text fontSize="xs" color="gray.600">
          {user.name}
        </Text>
      )}
    </VStack>
    {badge && (
      <Badge colorScheme="blue" fontSize="xs">
        {badge}
      </Badge>
    )}
  </HStack>
);
```

**Debounce Hook:**

```typescript
// src/hooks/useDebounce.ts

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### Component 2: CollaboratorList Component

**Purpose:** Display all collaborators and pending invitations

```tsx
// src/components/collaborators/CollaboratorList.tsx

import { Avatar, Badge, Box, Button, HStack, VStack, Text } from '@chakra-ui/react';
import { GitHubCollaborator, GitHubInvitation } from '../../types/github';
import { getPermissionColor, getPermissionLabel } from '../../utils/permissions';

interface CollaboratorListProps {
  collaborators: GitHubCollaborator[];
  pendingInvitations: GitHubInvitation[];
  onUpdatePermission: (username: string, permission: PermissionLevel) => void;
  onRemove: (username: string) => void;
  onCancelInvitation: (invitationId: number) => void;
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({
  collaborators,
  pendingInvitations,
  onUpdatePermission,
  onRemove,
  onCancelInvitation,
}) => {
  return (
    <VStack spacing={4} align="stretch">
      {/* Active Collaborators */}
      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={2}>
          Active Collaborators ({collaborators.length})
        </Text>
        {collaborators.map((collaborator) => (
          <HStack
            key={collaborator.id}
            p={3}
            borderWidth={1}
            borderRadius="md"
            justify="space-between"
          >
            <HStack spacing={3}>
              <Avatar
                size="sm"
                src={collaborator.avatar_url}
                name={collaborator.login}
              />
              <VStack align="start" spacing={0}>
                <Text fontWeight="medium">{collaborator.login}</Text>
                <Badge colorScheme={getPermissionColor(collaborator.role_name)}>
                  {getPermissionLabel(collaborator.role_name)}
                </Badge>
              </VStack>
            </HStack>

            <HStack>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Open permission change dialog
                }}
              >
                Change Permission
              </Button>
              <Button
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => onRemove(collaborator.login)}
              >
                Remove
              </Button>
            </HStack>
          </HStack>
        ))}
      </Box>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Box>
          <Text fontSize="sm" fontWeight="bold" mb={2}>
            Pending Invitations ({pendingInvitations.length})
          </Text>
          {pendingInvitations.map((invitation) => (
            <HStack
              key={invitation.id}
              p={3}
              borderWidth={1}
              borderRadius="md"
              justify="space-between"
              bg="yellow.50"
              _dark={{ bg: 'yellow.900' }}
            >
              <HStack spacing={3}>
                <Avatar
                  size="sm"
                  src={invitation.invitee.avatar_url}
                  name={invitation.invitee.login}
                />
                <VStack align="start" spacing={0}>
                  <Text fontWeight="medium">{invitation.invitee.login}</Text>
                  <Text fontSize="xs" color="gray.600">
                    Invited {new Date(invitation.created_at).toLocaleDateString()}
                  </Text>
                </VStack>
              </HStack>

              <HStack>
                <Badge colorScheme="yellow">Pending</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => onCancelInvitation(invitation.id)}
                >
                  Cancel
                </Button>
              </HStack>
            </HStack>
          ))}
        </Box>
      )}
    </VStack>
  );
};
```

### Component 2: AddCollaboratorModal

**Purpose:** Add new collaborators to workspace

```tsx
// src/components/collaborators/AddCollaboratorModal.tsx

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import { PermissionLevel } from '../../types/github';
import { PERMISSION_LEVELS } from '../../utils/permissions';

interface AddCollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (username: string, permission: PermissionLevel) => Promise<void>;
}

export const AddCollaboratorModal: React.FC<AddCollaboratorModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [username, setUsername] = useState('');
  const [permission, setPermission] = useState<PermissionLevel>('push');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleAdd = async () => {
    if (!username.trim()) {
      toast({
        title: 'Username required',
        description: 'Please enter a GitHub username',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);
    try {
      await onAdd(username, permission);
      toast({
        title: 'Invitation sent',
        description: `Invited ${username} as ${PERMISSION_LEVELS[permission].label}`,
        status: 'success',
        duration: 3000,
      });
      setUsername('');
      setPermission('push');
      onClose();
    } catch (error) {
      toast({
        title: 'Failed to add collaborator',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Collaborator</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>GitHub Username</FormLabel>
              <Input
                placeholder="octocat"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Permission Level</FormLabel>
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value as PermissionLevel)}
              >
                {Object.entries(PERMISSION_LEVELS).map(([level, meta]) => (
                  <option key={level} value={level}>
                    {meta.label} - {meta.description}
                  </option>
                ))}
              </Select>
              <Text fontSize="sm" color="gray.600" mt={2}>
                {PERMISSION_LEVELS[permission].capabilities.join(' • ')}
              </Text>
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleAdd}
            isLoading={isLoading}
          >
            Send Invitation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
```

### Component 3: WorkspaceCollaboratorsTab

**Purpose:** Full collaborator management interface for workspace

```tsx
// src/components/workspaces/WorkspaceCollaboratorsTab.tsx

import { Box, Button, HStack, useDisclosure, Spinner } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { LibraryWorkspace } from '../../types/github';
import {
  invokeGitHubListCollaborators,
  invokeGitHubListPendingInvitations,
  invokeGitHubAddCollaborator,
  invokeGitHubRemoveCollaborator,
  invokeGitHubCancelPendingInvitation,
} from '../../ipc/github';
import { CollaboratorList } from '../collaborators/CollaboratorList';
import { AddCollaboratorModal } from '../collaborators/AddCollaboratorModal';

interface WorkspaceCollaboratorsTabProps {
  workspace: LibraryWorkspace;
}

export const WorkspaceCollaboratorsTab: React.FC<WorkspaceCollaboratorsTabProps> = ({
  workspace,
}) => {
  const [collaborators, setCollaborators] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [collabs, invites] = await Promise.all([
        invokeGitHubListCollaborators(workspace.github_owner, workspace.github_repo),
        invokeGitHubListPendingInvitations(workspace.github_owner, workspace.github_repo),
      ]);
      setCollaborators(collabs);
      setPendingInvitations(invites);
    } catch (error) {
      console.error('Failed to load collaborators:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace]);

  const handleAdd = async (username: string, permission: PermissionLevel) => {
    await invokeGitHubAddCollaborator(
      workspace.github_owner,
      workspace.github_repo,
      username,
      permission
    );
    await loadData(); // Refresh
  };

  const handleRemove = async (username: string) => {
    await invokeGitHubRemoveCollaborator(
      workspace.github_owner,
      workspace.github_repo,
      username
    );
    await loadData(); // Refresh
  };

  const handleCancelInvitation = async (invitationId: number) => {
    await invokeGitHubCancelPendingInvitation(
      workspace.github_owner,
      workspace.github_repo,
      invitationId
    );
    await loadData(); // Refresh
  };

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Button colorScheme="blue" onClick={onOpen}>
          Add Collaborator
        </Button>
      </HStack>

      <CollaboratorList
        collaborators={collaborators}
        pendingInvitations={pendingInvitations}
        onUpdatePermission={(username, permission) => {
          // Handle permission update
        }}
        onRemove={handleRemove}
        onCancelInvitation={handleCancelInvitation}
      />

      <AddCollaboratorModal
        isOpen={isOpen}
        onClose={onClose}
        onAdd={handleAdd}
      />
    </Box>
  );
};
```

### Component 4: Workspace Creation with Collaborators

**Enhance existing workspace creation form:**

```tsx
// Add to workspace creation form

<FormControl>
  <FormLabel>Initial Collaborators (Optional)</FormLabel>
  <VStack align="stretch" spacing={2}>
    {collaborators.map((collab, index) => (
      <HStack key={index}>
        <Input
          placeholder="GitHub username"
          value={collab.username}
          onChange={(e) => updateCollaborator(index, 'username', e.target.value)}
        />
        <Select
          value={collab.permission}
          onChange={(e) => updateCollaborator(index, 'permission', e.target.value)}
        >
          <option value="pull">Pull (Read)</option>
          <option value="push">Push (Write)</option>
          <option value="admin">Admin</option>
        </Select>
        <IconButton
          icon={<FiX />}
          onClick={() => removeCollaborator(index)}
          aria-label="Remove"
        />
      </HStack>
    ))}
    <Button
      leftIcon={<FiPlus />}
      onClick={addCollaboratorField}
      variant="ghost"
      size="sm"
    >
      Add Collaborator
    </Button>
  </VStack>
</FormControl>
```

---

## 7. Database Schema

### Option 1: Cache Collaborator Data Locally

Track collaborator state in BlueKit's database for offline access and faster loading:

```sql
-- Collaborators table
CREATE TABLE workspace_collaborators (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    github_username TEXT NOT NULL,
    github_user_id INTEGER NOT NULL,
    avatar_url TEXT,
    role_name TEXT NOT NULL, -- pull, triage, push, maintain, admin
    is_pending BOOLEAN NOT NULL DEFAULT 0,
    invitation_id INTEGER, -- GitHub invitation ID (if pending)
    invited_at INTEGER, -- Unix timestamp
    accepted_at INTEGER, -- Unix timestamp (null if pending)
    last_synced_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES library_workspace(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, github_username)
);

CREATE INDEX idx_workspace_collaborators_workspace ON workspace_collaborators(workspace_id);
CREATE INDEX idx_workspace_collaborators_pending ON workspace_collaborators(workspace_id, is_pending);
```

### Option 2: Real-Time Only (No Caching)

Always fetch collaborator data from GitHub API on demand. Simpler but requires internet connection.

**Recommendation:** Start with Option 2 (real-time), add caching in Phase 2 if performance becomes an issue.

---

## 8. Rate Limits & Best Practices

### GitHub API Rate Limits

- **Authenticated requests**: 5,000/hour
- **Invitation limit**: **50 invitations per repository per 24 hours**
- **Secondary limits**: 900 points/minute

### Best Practices for BlueKit

#### 1. Batch Invitation Throttling

When adding multiple collaborators during workspace creation:

```rust
// Space out invitations by 1 second each to avoid secondary limits
pub async fn add_collaborators_batch(
    &self,
    owner: &str,
    repo: &str,
    collaborators: Vec<(String, String)>, // Vec<(username, permission)>
) -> Result<Vec<String>, String> {
    let mut results = Vec::new();

    for (username, permission) in collaborators {
        match self.add_collaborator(owner, repo, &username, &permission).await {
            Ok(_) => results.push(format!("✓ Invited {}", username)),
            Err(e) => results.push(format!("✗ Failed to invite {}: {}", username, e)),
        }

        // Wait 1 second between invitations
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }

    Ok(results)
}
```

#### 2. Cache Collaborator Lists

Don't refetch on every UI interaction—cache for 5 minutes:

```typescript
// Simple in-memory cache
const collaboratorCache = new Map<string, {
  data: GitHubCollaborator[];
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedCollaborators(
  owner: string,
  repo: string,
  forceRefresh = false
): Promise<GitHubCollaborator[]> {
  const cacheKey = `${owner}/${repo}`;
  const cached = collaboratorCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await invokeGitHubListCollaborators(owner, repo);
  collaboratorCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

#### 3. Show Rate Limit Status

Display remaining API quota to users:

```tsx
// Show in UI when managing collaborators
<Text fontSize="xs" color="gray.500">
  API Rate Limit: {rateLimitRemaining} / {rateLimitTotal} requests remaining
</Text>
```

#### 4. Handle 50 Invitations/Day Limit

```typescript
// Warn user if adding too many collaborators at once
if (collaborators.length > 50) {
  toast({
    title: 'Too many collaborators',
    description: 'GitHub limits you to 50 invitations per repository per 24 hours. Please add users in batches.',
    status: 'warning',
    duration: 8000,
  });
  return;
}
```

#### 5. Error Handling for Rate Limits

```rust
// In GitHubClient::request()
if status == 429 {
    let reset_time = response
        .headers()
        .get("x-ratelimit-reset")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .map(|t| {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            t.saturating_sub(now) / 60 // Minutes
        });

    let message = if let Some(mins) = reset_time {
        format!("GitHub rate limit exceeded. Try again in {} minutes.", mins)
    } else {
        "GitHub rate limit exceeded. Please try again later.".to_string()
    };

    return Err(message);
}
```

---

## 9. Testing Plan

### Unit Tests

**Backend (Rust):**
- Test each GitHubClient method with mock responses
- Test error handling (404, 403, 429)
- Test permission validation

**Frontend (TypeScript):**
- Test permission helper utilities
- Test component rendering with different states
- Test form validation

### Integration Tests

1. **Add collaborator flow**
   - Create test workspace
   - Add collaborator
   - Verify invitation sent
   - Check pending invitations list

2. **Update permission flow**
   - Add collaborator
   - Update permission level
   - Verify new permission

3. **Remove collaborator flow**
   - Add collaborator
   - Accept invitation
   - Remove collaborator
   - Verify access revoked

4. **Invitation cancellation flow**
   - Send invitation
   - Cancel before acceptance
   - Verify invitation removed

### Manual Testing Checklist

- [ ] Create workspace with collaborators
- [ ] Add collaborator from workspace settings
- [ ] Update existing collaborator's permission
- [ ] Remove collaborator
- [ ] View pending invitations
- [ ] Cancel pending invitation
- [ ] Handle non-existent username error
- [ ] Handle rate limit error
- [ ] Handle network error
- [ ] Verify UI updates after each operation

---

## 10. Future Enhancements

### Phase 3: Advanced Features

1. **Team Support**
   - Integrate with GitHub Teams API
   - Bulk add team members
   - Manage team permissions

2. **Collaborator Activity**
   - Show last contribution timestamp
   - Display contribution statistics
   - Track who published what artifacts

3. **Permission Templates**
   - Save custom permission configurations
   - Quick apply templates (e.g., "core team", "external contributors")

4. **Notification System**
   - Notify when invitations are accepted/declined
   - Alert when collaborators are added/removed
   - Track permission changes

5. **Audit Log**
   - Record all collaborator changes
   - Show who added/removed whom
   - Track permission history

6. **Collaborator Search**
   - Search across all workspace collaborators
   - Filter by permission level
   - Sort by activity, join date, etc.

---

## Summary

### What This Enables

✅ **Add collaborators during workspace creation**
✅ **View all workspace collaborators in BlueKit**
✅ **Manage permissions without leaving the app**
✅ **Track pending invitations**
✅ **Cancel or modify invitations**
✅ **Remove collaborators when needed**

### Implementation Checklist

**Backend:**
- [ ] Extend GitHubClient with collaborator methods
- [ ] Create Tauri commands
- [ ] Register commands in main.rs
- [ ] Add response types
- [ ] Implement rate limit handling

**Frontend:**
- [ ] Add TypeScript types
- [ ] Create IPC wrappers
- [ ] Build CollaboratorList component
- [ ] Build AddCollaboratorModal component
- [ ] Create permission utilities
- [ ] Integrate into workspace creation form
- [ ] Add collaborators tab to workspace settings

**Testing:**
- [ ] Unit tests for GitHubClient methods
- [ ] Integration tests for full flows
- [ ] Manual testing checklist
- [ ] Rate limit testing

---

## References

- [GitHub REST API - Collaborators](https://docs.github.com/en/rest/collaborators/collaborators)
- [GitHub REST API - Repository Invitations](https://docs.github.com/en/rest/collaborators/invitations)
- [GitHub Permissions Reference](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/repository-roles-for-an-organization)
- [GitHub Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
