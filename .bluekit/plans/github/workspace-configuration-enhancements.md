# GitHub Workspace Configuration Enhancements

**Status:** Planning
**Created:** 2025-12-21
**Context:** Exploring additional GitHub API capabilities for workspace creation

## Overview

Currently, BlueKit's `create_workspace` function only sets 3 basic parameters when creating a GitHub repository:
- `name`
- `description`
- `private` (set to `false`)
- `auto_init` (set to `true`)

The GitHub API provides **significantly more configuration options** that can be set programmatically during repository creation and post-creation configuration. This document outlines all available options and recommendations for BlueKit workspaces.

## Current Implementation

**File:** `src-tauri/src/library/library.rs:36-84`

```rust
pub async fn create_workspace(
    db: &DatabaseConnection,
    name: String,
    github_owner: String,
    github_repo: String,
) -> Result<LibraryWorkspace, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    // Create the GitHub repository
    let description = format!("BlueKit library workspace: {}", name);
    github_client.create_repo(&github_repo, Some(&description), false)
        .await
        .map_err(|e| {
            // Error handling...
        })?;

    // ... database operations
}
```

**File:** `src-tauri/src/integrations/github/github.rs:149-166`

```rust
pub async fn create_repo(
    &self,
    name: &str,
    description: Option<&str>,
    private: bool,
) -> Result<GitHubRepo, String> {
    let mut body = serde_json::json!({
        "name": name,
        "private": private,
        "auto_init": true,
    });

    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc.to_string());
    }

    self.request("POST", "/user/repos".to_string(), Some(body)).await
}
```

---

## 1. Repository Creation Parameters

### Available Fields (POST /user/repos)

The following fields can be added to the repository creation request:

#### Basic Settings
| Field | Type | Description | Default | Recommendation for BlueKit |
|-------|------|-------------|---------|---------------------------|
| `name` | string | **Required** Repository name | - | ✅ Already implemented |
| `description` | string | Repository description | null | ✅ Already implemented |
| `private` | boolean | Repository visibility | false | ✅ Already `false` (public for sharing) |
| `homepage` | string | URL for project homepage | null | Optional - could be BlueKit docs URL |
| `auto_init` | boolean | Initialize with README | false | ✅ Already `true` |

#### Feature Toggles
| Field | Type | Description | Default | Recommendation for BlueKit |
|-------|------|-------------|---------|---------------------------|
| `has_issues` | boolean | Enable issue tracker | true | ❌ Disable (use main project for issues) |
| `has_projects` | boolean | Enable GitHub Projects | true | ❌ Disable (not needed for artifact storage) |
| `has_wiki` | boolean | Enable wiki | true | ✅ Enable (for workspace documentation) |
| `has_discussions` | boolean | Enable discussions | false | ❌ Disable (not needed) |
| `is_template` | boolean | Make repository a template | false | ❌ Disable (workspace is instance, not template) |

#### Initialization Templates
| Field | Type | Description | Default | Recommendation for BlueKit |
|-------|------|-------------|---------|---------------------------|
| `gitignore_template` | string | Language-specific .gitignore | null | ❌ Not needed (simple markdown files) |
| `license_template` | string | License identifier | null | ✅ `"mit"` for open sharing |

Common license templates: `"mit"`, `"apache-2.0"`, `"gpl-3.0"`, `"bsd-3-clause"`, `"unlicense"`

#### Merge Strategy Settings
| Field | Type | Description | Default | Recommendation for BlueKit |
|-------|------|-------------|---------|---------------------------|
| `allow_squash_merge` | boolean | Allow squash merging | true | ✅ Enable (cleaner history) |
| `allow_merge_commit` | boolean | Allow merge commits | true | ❌ Disable (avoid merge bubbles) |
| `allow_rebase_merge` | boolean | Allow rebase merging | true | ❌ Disable (squash is preferred) |
| `allow_auto_merge` | boolean | Enable auto-merge | false | ❌ Disable (manual approval preferred) |
| `delete_branch_on_merge` | boolean | Auto-delete head branches | false | ✅ Enable (keep repo clean) |

#### Default Branch Settings
| Field | Type | Description | Default | Recommendation for BlueKit |
|-------|------|-------------|---------|---------------------------|
| `allow_update_branch` | boolean | Allow updating PR branches | false | ❌ Not critical |

### Enhanced Implementation

```rust
// src-tauri/src/integrations/github/github.rs

pub async fn create_repo(
    &self,
    name: &str,
    description: Option<&str>,
    private: bool,
    // NEW PARAMETERS:
    homepage: Option<&str>,
    has_issues: Option<bool>,
    has_projects: Option<bool>,
    has_wiki: Option<bool>,
    has_discussions: Option<bool>,
    is_template: Option<bool>,
    gitignore_template: Option<&str>,
    license_template: Option<&str>,
    allow_squash_merge: Option<bool>,
    allow_merge_commit: Option<bool>,
    allow_rebase_merge: Option<bool>,
    allow_auto_merge: Option<bool>,
    delete_branch_on_merge: Option<bool>,
) -> Result<GitHubRepo, String> {
    let mut body = serde_json::json!({
        "name": name,
        "private": private,
        "auto_init": true,
    });

    // Add optional fields
    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc.to_string());
    }
    if let Some(hp) = homepage {
        body["homepage"] = serde_json::Value::String(hp.to_string());
    }
    if let Some(issues) = has_issues {
        body["has_issues"] = serde_json::Value::Bool(issues);
    }
    if let Some(projects) = has_projects {
        body["has_projects"] = serde_json::Value::Bool(projects);
    }
    if let Some(wiki) = has_wiki {
        body["has_wiki"] = serde_json::Value::Bool(wiki);
    }
    if let Some(discussions) = has_discussions {
        body["has_discussions"] = serde_json::Value::Bool(discussions);
    }
    if let Some(template) = is_template {
        body["is_template"] = serde_json::Value::Bool(template);
    }
    if let Some(gitignore) = gitignore_template {
        body["gitignore_template"] = serde_json::Value::String(gitignore.to_string());
    }
    if let Some(license) = license_template {
        body["license_template"] = serde_json::Value::String(license.to_string());
    }
    if let Some(squash) = allow_squash_merge {
        body["allow_squash_merge"] = serde_json::Value::Bool(squash);
    }
    if let Some(merge) = allow_merge_commit {
        body["allow_merge_commit"] = serde_json::Value::Bool(merge);
    }
    if let Some(rebase) = allow_rebase_merge {
        body["allow_rebase_merge"] = serde_json::Value::Bool(rebase);
    }
    if let Some(auto_merge) = allow_auto_merge {
        body["allow_auto_merge"] = serde_json::Value::Bool(auto_merge);
    }
    if let Some(delete_branch) = delete_branch_on_merge {
        body["delete_branch_on_merge"] = serde_json::Value::Bool(delete_branch);
    }

    self.request("POST", "/user/repos".to_string(), Some(body)).await
}
```

---

## 2. Post-Creation Configuration

These operations require additional API calls after the repository is created:

### 2.1 Repository Topics (Tags)

**Endpoint:** `PUT /repos/{owner}/{repo}/topics`

Topics improve discoverability in GitHub search. BlueKit workspaces should be tagged for easy finding.

```rust
pub async fn set_repo_topics(
    &self,
    owner: &str,
    repo: &str,
    topics: Vec<&str>,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/topics", owner, repo);
    let body = serde_json::json!({
        "names": topics,
    });

    // Requires special media type header
    let response = self
        .client
        .request(reqwest::Method::PUT, &format!("https://api.github.com{}", endpoint))
        .header("Authorization", format!("Bearer {}", self.token))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "BlueKit/1.0")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to set topics: {}", response.status()));
    }

    Ok(())
}
```

**Recommended topics for BlueKit:**
- `"bluekit"`
- `"knowledge-base"`
- `"code-artifacts"`
- `"developer-tools"`
- `"reusable-code"`

### 2.2 Branch Protection Rules

**Endpoint:** `PUT /repos/{owner}/{repo}/branches/{branch}/protection`

Enforce code quality standards by requiring reviews before merging.

```rust
pub async fn create_branch_protection(
    &self,
    owner: &str,
    repo: &str,
    branch: &str,
    require_pull_request: bool,
    required_approving_review_count: Option<u32>,
    require_code_owner_reviews: bool,
    dismiss_stale_reviews: bool,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/branches/{}/protection", owner, repo, branch);

    let body = serde_json::json!({
        "required_status_checks": null,
        "enforce_admins": false,
        "required_pull_request_reviews": if require_pull_request {
            Some(serde_json::json!({
                "dismiss_stale_reviews": dismiss_stale_reviews,
                "require_code_owner_reviews": require_code_owner_reviews,
                "required_approving_review_count": required_approving_review_count.unwrap_or(1),
            }))
        } else {
            None
        },
        "restrictions": null,
        "allow_force_pushes": false,
        "allow_deletions": false,
    });

    self.request::<serde_json::Value>("PUT", endpoint, Some(body)).await?;
    Ok(())
}
```

**Recommendation:** For team workspaces, enable branch protection on `main` requiring 1 approval.

### 2.3 Webhooks

**Endpoint:** `POST /repos/{owner}/{repo}/hooks`

Enable CI/CD or custom notifications when workspace content changes.

```rust
pub async fn create_webhook(
    &self,
    owner: &str,
    repo: &str,
    url: &str,
    events: Vec<&str>,
    secret: Option<&str>,
) -> Result<WebhookResponse, String> {
    let endpoint = format!("/repos/{}/{}/hooks", owner, repo);

    let mut config = serde_json::json!({
        "url": url,
        "content_type": "json",
        "insecure_ssl": "0", // Require SSL
    });

    if let Some(s) = secret {
        config["secret"] = serde_json::Value::String(s.to_string());
    }

    let body = serde_json::json!({
        "name": "web",
        "active": true,
        "events": events,
        "config": config,
    });

    self.request("POST", endpoint, Some(body)).await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebhookResponse {
    pub id: u64,
    pub url: String,
    pub test_url: String,
    pub ping_url: String,
    pub deliveries_url: String,
    pub created_at: String,
    pub updated_at: String,
}
```

**Useful webhook events:**
- `"push"` - Code pushed to repository
- `"pull_request"` - PR opened/closed/merged
- `"release"` - New release created
- `"issues"` - Issue activity
- `"workflow_run"` - GitHub Actions workflow completed

### 2.4 Repository Labels

**Endpoint:** `POST /repos/{owner}/{repo}/labels`

Create standard labels for organizing issues and PRs.

```rust
pub async fn create_label(
    &self,
    owner: &str,
    repo: &str,
    name: &str,
    color: &str,
    description: Option<&str>,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/labels", owner, repo);

    let mut body = serde_json::json!({
        "name": name,
        "color": color, // 6-digit hex code without '#'
    });

    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc.to_string());
    }

    self.request::<serde_json::Value>("POST", endpoint, Some(body)).await?;
    Ok(())
}

pub async fn create_default_labels(
    &self,
    owner: &str,
    repo: &str,
) -> Result<(), String> {
    let labels = vec![
        ("kit", "0E8A16", "Kit artifact"),
        ("walkthrough", "1D76DB", "Walkthrough artifact"),
        ("blueprint", "5319E7", "Blueprint artifact"),
        ("diagram", "D4C5F9", "Diagram artifact"),
        ("enhancement", "A2EEEF", "New feature or request"),
        ("bug", "D73A4A", "Something isn't working"),
    ];

    for (name, color, description) in labels {
        self.create_label(owner, repo, name, color, Some(description)).await?;
    }

    Ok(())
}
```

### 2.5 Collaborators

**Endpoint:** `PUT /repos/{owner}/{repo}/collaborators/{username}`

Add team members with specific permissions.

```rust
pub async fn add_collaborator(
    &self,
    owner: &str,
    repo: &str,
    username: &str,
    permission: &str,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/collaborators/{}", owner, repo, username);

    let body = serde_json::json!({
        "permission": permission,
    });

    self.request::<serde_json::Value>("PUT", endpoint, Some(body)).await?;
    Ok(())
}
```

**Permission levels:**
- `"pull"` - Read-only access
- `"triage"` - Read + manage issues/PRs without write access
- `"push"` - Read + write access (can push)
- `"maintain"` - Push + manage without admin
- `"admin"` - Full admin access

### 2.6 Security Features

**Vulnerability Alerts:** `PUT /repos/{owner}/{repo}/vulnerability-alerts`
**Automated Security Fixes:** `PUT /repos/{owner}/{repo}/automated-security-fixes`

```rust
pub async fn enable_vulnerability_alerts(
    &self,
    owner: &str,
    repo: &str,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/vulnerability-alerts", owner, repo);

    self.client
        .request(reqwest::Method::PUT, &format!("https://api.github.com{}", endpoint))
        .header("Authorization", format!("Bearer {}", self.token))
        .header("Accept", "application/vnd.github.dorian-preview+json")
        .header("User-Agent", "BlueKit/1.0")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    Ok(())
}

pub async fn enable_automated_security_fixes(
    &self,
    owner: &str,
    repo: &str,
) -> Result<(), String> {
    let endpoint = format!("/repos/{}/{}/automated-security-fixes", owner, repo);

    self.client
        .request(reqwest::Method::PUT, &format!("https://api.github.com{}", endpoint))
        .header("Authorization", format!("Bearer {}", self.token))
        .header("Accept", "application/vnd.github.london-preview+json")
        .header("User-Agent", "BlueKit/1.0")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    Ok(())
}
```

### 2.7 README Template

Create a standardized README for all BlueKit workspaces.

```rust
pub async fn create_readme_template(
    &self,
    owner: &str,
    repo: &str,
    workspace_name: &str,
    workspace_description: Option<&str>,
) -> Result<(), String> {
    let content = format!(
        r#"# {}

{}

## BlueKit Workspace

This repository is a BlueKit library workspace for sharing reusable code artifacts across projects.

### What's Inside

This workspace contains:
- **Kits**: Reusable code patterns and solutions
- **Walkthroughs**: Educational guides and documentation
- **Blueprints**: Multi-step project scaffolding workflows
- **Diagrams**: Visual architecture and flow diagrams

### Using This Workspace

1. **Browse Artifacts**: Explore the `.bluekit/` directory structure
2. **Pull Artifacts**: Use BlueKit to subscribe to and pull artifacts into your projects
3. **Contribute**: Submit PRs to add new artifacts or improve existing ones

### Learn More

- [BlueKit Documentation](https://github.com/your-org/bluekit)
- [How to Use Library Workspaces](https://github.com/your-org/bluekit/docs/workspaces.md)

---

*Generated by [BlueKit](https://github.com/your-org/bluekit)*
"#,
        workspace_name,
        workspace_description.unwrap_or("A BlueKit library workspace for sharing code knowledge.")
    );

    // Get current README SHA if it exists
    let sha = self.get_file_sha(owner, repo, "README.md").await?;

    self.create_or_update_file(
        owner,
        repo,
        "README.md",
        &content,
        "Initialize BlueKit workspace README",
        sha.as_deref(),
    ).await?;

    Ok(())
}
```

---

## 3. Recommended Implementation

### Phased Approach

#### Phase 1: Essential Configuration (High Priority)
```rust
// src-tauri/src/library/library.rs

pub async fn create_workspace(
    db: &DatabaseConnection,
    name: String,
    github_owner: String,
    github_repo: String,
) -> Result<LibraryWorkspace, String> {
    let github_client = GitHubClient::from_keychain()
        .map_err(|e| format!("GitHub authentication required: {}", e))?;

    let description = format!("BlueKit library workspace: {}", name);

    // PHASE 1: Repository creation with essential settings
    github_client.create_repo(
        &github_repo,
        Some(&description),
        false,                  // public for sharing
        None,                   // no homepage yet
        Some(false),            // disable issues
        Some(false),            // disable projects
        Some(true),             // enable wiki
        Some(false),            // no discussions
        Some(false),            // not a template
        None,                   // no .gitignore
        Some("mit"),            // MIT license
        Some(true),             // allow squash merge
        Some(false),            // disable merge commits
        Some(false),            // disable rebase merge
        Some(false),            // no auto-merge
        Some(true),             // delete branches after merge
    ).await?;

    // PHASE 1: Set topics for discoverability
    github_client.set_repo_topics(
        &github_owner,
        &github_repo,
        vec!["bluekit", "knowledge-base", "code-artifacts"],
    ).await?;

    // PHASE 1: Create README
    github_client.create_readme_template(
        &github_owner,
        &github_repo,
        &name,
        Some(&description),
    ).await?;

    // PHASE 1: Enable security (don't fail if this doesn't work)
    let _ = github_client.enable_vulnerability_alerts(&github_owner, &github_repo).await;
    let _ = github_client.enable_automated_security_fixes(&github_owner, &github_repo).await;

    // ... existing database code
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    let workspace = library_workspace::ActiveModel {
        id: Set(id.clone()),
        name: Set(name.clone()),
        github_owner: Set(github_owner.clone()),
        github_repo: Set(github_repo.clone()),
        created_at: Set(now),
        updated_at: Set(now),
    };

    library_workspace::Entity::insert(workspace)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to create workspace: {}", e))?;

    Ok(LibraryWorkspace {
        id,
        name,
        github_owner,
        github_repo,
        created_at: now,
        updated_at: now,
    })
}
```

#### Phase 2: Team Collaboration (Medium Priority)

Add when multi-user workspaces are needed:
- Branch protection rules
- Collaborator management
- Default labels

#### Phase 3: Advanced Integration (Low Priority)

Add when external integrations are needed:
- Webhooks for CI/CD
- GitHub Actions workflows
- Advanced security scanning

### User-Configurable Options

Consider allowing users to configure workspace settings via UI:

```typescript
// Frontend interface for workspace creation

interface WorkspaceSettings {
  name: string;
  githubOwner: string;
  githubRepo: string;

  // Advanced settings (optional)
  visibility: 'public' | 'private';
  enableWiki: boolean;
  license: 'mit' | 'apache-2.0' | 'gpl-3.0' | 'none';
  topics: string[];

  // Team settings
  collaborators?: Array<{
    username: string;
    permission: 'pull' | 'push' | 'maintain' | 'admin';
  }>;

  // Branch protection
  requireReviews: boolean;
  requiredReviewCount?: number;
}

// IPC command
export async function invokeLibraryCreateWorkspace(
  settings: WorkspaceSettings
): Promise<LibraryWorkspace> {
  return await invokeWithTimeout<LibraryWorkspace>(
    'library_create_workspace',
    { settings },
    15000 // Longer timeout for multiple API calls
  );
}
```

---

## 4. Testing Considerations

### OAuth Scopes Required

Ensure the GitHub OAuth token has the necessary scopes:

- `repo` - Full control of private repositories (includes public repos)
- `admin:repo_hook` - For creating webhooks
- `admin:org` - For organization repositories (if needed)
- `delete_repo` - For workspace deletion (if implemented)

### Rate Limiting

GitHub API has rate limits:
- **Authenticated requests:** 5,000 requests/hour
- **Creating repositories:** Special limit of ~10-20/hour

**Mitigation:**
- Cache repository metadata locally
- Batch operations where possible
- Show rate limit info to users
- Implement retry with exponential backoff

### Error Handling

Common scenarios to handle:
- Repository name already exists
- Insufficient permissions
- Rate limit exceeded
- Network timeout
- Invalid OAuth token

---

## 5. Future Enhancements

### GitHub Apps vs OAuth

Consider migrating to GitHub Apps for:
- Better rate limits (5,000/hour per installation)
- More granular permissions
- Organization-level installation
- Webhook automatic setup

### Template Repositories

Create a BlueKit workspace template repository that users can fork/clone instead of creating from scratch:
- Pre-configured `.bluekit/` structure
- Example kits
- README template
- GitHub Actions workflows for validation

### Workspace Sync Status

Track repository configuration in the database:
```sql
CREATE TABLE workspace_config (
    workspace_id TEXT PRIMARY KEY,
    has_wiki BOOLEAN,
    has_issues BOOLEAN,
    default_branch TEXT,
    topics TEXT, -- JSON array
    collaborator_count INTEGER,
    last_synced_at INTEGER,
    FOREIGN KEY (workspace_id) REFERENCES library_workspace(id)
);
```

---

## 6. Summary

### Currently Configured
- ✅ Repository name
- ✅ Description
- ✅ Public visibility
- ✅ Auto-init with README

### Quick Wins (Recommended for Phase 1)
- ✅ Disable issues/projects (reduce clutter)
- ✅ Enable wiki (documentation)
- ✅ Add MIT license (open sharing)
- ✅ Configure merge strategy (squash only)
- ✅ Auto-delete branches (clean repo)
- ✅ Set topics (discoverability)
- ✅ Create README template
- ✅ Enable security alerts

### Future Considerations (Phase 2+)
- Branch protection rules
- Collaborator management
- Custom labels
- Webhooks for CI/CD
- GitHub Actions integration

---

## References

- [GitHub REST API - Repositories](https://docs.github.com/en/rest/repos/repos)
- [GitHub REST API - Branch Protection](https://docs.github.com/en/rest/branches/branch-protection)
- [GitHub REST API - Webhooks](https://docs.github.com/en/rest/webhooks)
- [GitHub Topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
