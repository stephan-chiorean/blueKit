---
id: github-commit-enrichment-rate-limits
alias: GitHub Commit Enrichment & Rate Limit Strategy
type: walkthrough
is_base: false
version: 1
tags:
  - github-api
  - rate-limits
  - performance
description: Understanding the commit file detail enrichment strategy, GitHub API rate limit management, and scaling approach for cross-project timelines
complexity: comprehensive
format: architecture
---
# GitHub Commit Enrichment & Rate Limit Strategy

## Overview

This walkthrough explains how BlueKit fetches commit file details from GitHub, manages API rate limits, and provides strategies for scaling to a cross-project timeline feature.

## The Problem

GitHub's commits list endpoint (`GET /repos/{owner}/{repo}/commits`) returns basic commit metadata but **does not include file change details** by default. To calculate activity scores (showing visual indicators of commit impact), we need:

- Number of files changed
- Lines added per file
- Lines deleted per file

This requires fetching each commit individually using `GET /repos/{owner}/{repo}/commits/{sha}`, which includes the `files` array with detailed change statistics.

## Current Implementation

### Architecture Flow

```
User Views Timeline
       ↓
fetch_project_commits() called
       ↓
Check cache (project_id, branch, page)
       ↓
Cache HIT? → Return cached commits ✓
       ↓
Cache MISS → Fetch from GitHub API
       ↓
1. List commits (1 API call)
   GET /repos/{owner}/{repo}/commits?per_page=30&page=1
       ↓
2. Enrich each commit (N API calls)
   GET /repos/{owner}/{repo}/commits/{sha} × 30
   - Parallel fetching (3 concurrent)
   - Graceful fallback on failure
       ↓
3. Cache enriched results
       ↓
Return to frontend
```

### Code Location

**Backend**: `src-tauri/src/commands.rs:4050-4091`

```rust
// Enrich commits with file details by fetching each commit individually
// GitHub API rate limits: 5,000 requests/hour for authenticated users
// This adds N additional API calls for N commits (e.g., 30 commits = 30 extra calls)

let enriched_commits: Vec<GitHubCommit> = stream::iter(commits.into_iter().map(|commit| {
    let client = &client;
    let owner = owner.clone();
    let repo = repo.clone();
    let sha = commit.sha.clone();

    async move {
        match client.get_commit(&owner, &repo, &sha).await {
            Ok(detailed_commit) => detailed_commit,
            Err(e) => {
                eprintln!("Failed to fetch details for commit {}: {}", sha, e);
                commit // Fallback to basic info
            }
        }
    }
}))
.buffer_unordered(3) // 3 concurrent requests
.collect()
.await;

// Cache the results to avoid re-fetching
commit_cache.set(&project_id, branch.as_deref(), page_num, enriched_commits.clone());
```

**Frontend**: `src/components/commits/TimelineTabContent.tsx:60-76`

```typescript
const CHANGES_PER_CIRCLE = 1000; // 1 circle = 1000 lines changed
const MAX_CIRCLES = 10;

const calculateCommitActivity = (commits: GitHubCommit[]): number => {
  const totalChanges = commits.reduce((sum, commit) => {
    const commitChanges = (commit.files || []).reduce(
      (fileSum, file) => fileSum + file.additions + file.deletions,
      0
    );
    return sum + commitChanges;
  }, 0);

  return Math.min(totalChanges / CHANGES_PER_CIRCLE, MAX_CIRCLES);
};
```

## Rate Limit Management

### GitHub API Rate Limits

**OAuth App (Default Application)**:
- **Authenticated**: 5,000 requests/hour per user
- **Unauthenticated**: 60 requests/hour per IP (not used)

**GitHub App** (future consideration):
- 15,000 requests/hour per installation
- Better for multi-user scenarios

### Current Mitigation Strategies

#### 1. **Caching** (Primary Defense)

**Cache Structure**: `CommitCache` in `src-tauri/src/integrations/github/commit_cache.rs`

```rust
pub struct CommitCache {
    cache: Arc<Mutex<HashMap<String, Vec<GitHubCommit>>>>,
}

// Cache key: "{project_id}:{branch}:{page}"
```

**Benefits**:
- Subsequent views of same commits = **0 API calls**
- Persists during app session
- Per-page granularity (viewing page 2 doesn't invalidate page 1)

**Cache Invalidation**:
- User clicks "Sync" button → calls `invalidate_commit_cache()`
- App restart (in-memory cache cleared)

#### 2. **Concurrency Limiting**

- **3 concurrent requests** (buffer_unordered(3))
- Conservative to avoid overwhelming API
- Balances speed with rate limit respect

#### 3. **Graceful Fallback**

If individual commit fetch fails:
- Falls back to basic commit info (no files data)
- Activity score = 0 for that commit
- UI still functional

#### 4. **User Feedback**

- Loading states show "Loading commits..."
- Errors displayed via toast notifications
- No silent failures

### API Call Math

**Single Project Timeline** (30 commits/page):
- Initial load: 1 + 30 = **31 calls**
- Cached subsequent views: **0 calls**
- Load 3 pages: 1+30 + 1+30 + 1+30 = **93 calls** (1.86% of hourly limit)

**After caching all 3 pages**:
- User scrolling through timeline: **0 calls**
- User clicks Sync (invalidates all): **93 calls** again

**Conservative estimate**: User could sync ~50 times/hour before hitting limit

## Scaling to Cross-Project Timeline

### Challenge

A cross-project timeline consolidates commits from **all registered projects**:

- User has 10 projects → 10 repositories to query
- Each project loads 30 commits → 300 commits total
- API calls: 10 + 300 = **310 calls** per refresh
- Only ~16 refreshes before hitting hourly limit

### Optimization Strategies

#### Strategy 0: **Smart Project Filtering** (MOST IMPORTANT - Do This First!)

Instead of fetching commits from ALL projects, identify which projects have recent activity using lightweight checks:

**Option A: GitHub Events API** (Recommended - 1 API call for all repos)

```rust
// GET /users/{username}/events
// Returns recent activity across all repos (last 90 days)
pub async fn get_active_repos(
    client: &GitHubClient,
    since_days: u32,
) -> Result<HashSet<String>, String> {
    let events = client.get_user_events(1, 100).await?; // 1 API call

    let cutoff = SystemTime::now() - Duration::from_secs(since_days as u64 * 86400);
    let mut active_repos = HashSet::new();

    for event in events {
        if event.event_type == "PushEvent" && event.created_at > cutoff {
            active_repos.insert(event.repo.full_name);
        }
    }

    Ok(active_repos)
}
```

**Option B: Lightweight HEAD Checks** (N calls, but very cheap)

```rust
// Store last known commit SHA in database
pub struct ProjectSyncState {
    pub project_id: String,
    pub last_commit_sha: String,
    pub last_checked_at: i64,
}

// Check if repo has new commits (lightweight)
pub async fn has_new_commits(
    client: &GitHubClient,
    owner: &str,
    repo: &str,
    branch: &str,
    last_known_sha: &str,
) -> Result<bool, String> {
    // GET /repos/{owner}/{repo}/branches/{branch}
    // Returns just the latest commit SHA (~1KB response)
    let branch_info = client.get_branch(owner, repo, branch).await?;
    Ok(branch_info.commit.sha != last_known_sha)
}
```

**Option C: GraphQL Batch HEAD Check** (1 call for 10+ repos)

```graphql
query CheckMultipleReposForNewCommits {
  repo1: repository(owner: "user", name: "repo1") {
    defaultBranchRef {
      target { oid } # Just the SHA
    }
  }
  repo2: repository(owner: "user", name: "repo2") {
    defaultBranchRef {
      target { oid }
    }
  }
  # ... up to 10-15 repos per query
}
```

**Consolidated Timeline Architecture**:

```
User Opens Cross-Project Timeline
       ↓
[1] Identify Active Projects (1-10 API calls)
    - Option A: Events API (1 call) → get repos with PushEvents
    - Option B: HEAD checks (N calls) → compare cached SHAs
    - Option C: GraphQL batch (1-2 calls) → check 10+ repos at once
       ↓
[2] Filter to Active Projects Only
    - Example: 50 total projects → 8 have commits in last 7 days
       ↓
[3] Fetch Commits from Active Projects (8 × 31 = 248 calls)
    - Only query the 8 active repos
    - Use existing enrichment logic
       ↓
[4] Merge & Sort by Date
    - Combine all commits into single timeline
    - Sort by commit date (descending)
    - Label each commit card with project name
       ↓
Display Unified Timeline
```

**API Call Comparison**:

| Approach | Active Project Detection | Commit Fetching | Total |
|----------|-------------------------|-----------------|-------|
| Naive (all projects) | 0 | 50 × 31 = 1,550 | 1,550 |
| Events API + Filter | 1 | 8 × 31 = 248 | 249 |
| HEAD Checks + Filter | 50 | 8 × 31 = 248 | 298 |
| GraphQL + Filter | 5 (batches of 10) | 8 × 31 = 248 | 253 |

**Recommended Flow for Consolidated Timeline**:

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn fetch_cross_project_timeline(
    db: State<'_, DatabaseConnection>,
    commit_cache: State<'_, CommitCache>,
    days_back: Option<u32>, // e.g., 7 days
) -> Result<Vec<TimelineCommit>, String> {
    let days = days_back.unwrap_or(7);

    // Step 1: Get all registered projects
    let all_projects = db_get_projects(&db).await?;

    // Step 2: Filter to active projects (lightweight!)
    let client = GitHubClient::from_keychain()?;
    let active_repos = get_active_repos(&client, days).await?; // 1 API call

    let active_projects: Vec<_> = all_projects
        .into_iter()
        .filter(|p| {
            if let Some(url) = &p.git_url {
                active_repos.contains(&parse_repo_full_name(url))
            } else {
                false
            }
        })
        .collect();

    tracing::info!(
        "Consolidated timeline: {} active projects (filtered from {})",
        active_projects.len(),
        all_projects.len()
    );

    // Step 3: Fetch commits from active projects only
    let mut all_commits = Vec::new();
    for project in active_projects {
        let commits = fetch_project_commits(
            db.clone(),
            commit_cache.clone(),
            project.id.clone(),
            None, // default branch
            Some(1), // first page only
            Some(30),
        ).await?;

        // Add project context to each commit
        for commit in commits {
            all_commits.push(TimelineCommit {
                project_id: project.id.clone(),
                project_name: project.name.clone(),
                commit,
            });
        }
    }

    // Step 4: Sort by date (most recent first)
    all_commits.sort_by(|a, b| {
        b.commit.commit.author.date.cmp(&a.commit.commit.author.date)
    });

    Ok(all_commits)
}

#[derive(Serialize, Deserialize)]
pub struct TimelineCommit {
    pub project_id: String,
    pub project_name: String,
    #[serde(flatten)]
    pub commit: GitHubCommit,
}
```

**Frontend Display**:

```typescript
// Consolidated timeline with project labels
interface TimelineCommitWithProject extends GitHubCommit {
  projectId: string;
  projectName: string;
}

const CrossProjectTimeline = () => {
  const [commits, setCommits] = useState<TimelineCommitWithProject[]>([]);

  useEffect(() => {
    invokeFetchCrossProjectTimeline(7) // last 7 days
      .then(setCommits);
  }, []);

  return (
    <Timeline.Root>
      {commits.map(commit => (
        <Timeline.Item key={`${commit.projectId}-${commit.sha}`}>
          <Timeline.Indicator />
          <Timeline.Content>
            <Card.Root>
              <CardHeader>
                {/* Project badge */}
                <Badge colorPalette="blue">{commit.projectName}</Badge>

                {/* Commit message */}
                <Text>{commit.commit.message}</Text>

                {/* Activity circles */}
                <ActivityCircles activityScore={calculateActivity(commit)} />
              </CardHeader>
            </Card.Root>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline.Root>
  );
};
```

**Benefits**:
- **Massive API savings**: 249 calls vs 1,550 calls (84% reduction!)
- **Faster loading**: Only fetch from repos with activity
- **Smart filtering**: Automatically focuses on what matters
- **Cache-friendly**: Active projects likely already cached from project views

**Trade-offs**:
- Requires 1 extra call to Events API (or N HEAD checks)
- May miss private repo activity in Events API (use GraphQL instead)
- Users wanting "all commits ever" need separate view

#### Strategy 1: **Lazy Loading + Virtualization** (Secondary Optimization)

Only fetch commits when project comes into viewport:

```typescript
// Pseudo-code for cross-project timeline
const CrossProjectTimeline = () => {
  const [visibleProjects, setVisibleProjects] = useState<string[]>([]);

  // Only fetch commits for visible projects
  useEffect(() => {
    visibleProjects.forEach(projectId => {
      if (!commitCache.has(projectId)) {
        fetchProjectCommits(projectId);
      }
    });
  }, [visibleProjects]);

  return (
    <VirtualScroller
      onVisibilityChange={setVisibleProjects}
      items={projects}
    />
  );
};
```

**Benefits**:
- User sees first 3-5 projects → ~50-80 API calls
- Scroll down → fetch more as needed
- Most users won't scroll through all projects

#### Strategy 2: **Selective Enrichment**

Only enrich commits that will be displayed with activity circles:

```rust
// Option A: Only enrich first page
if page_num == 1 {
    enrich_commits_with_files(commits).await
} else {
    commits // Return basic info for pagination
}

// Option B: User preference
if user_settings.show_activity_circles {
    enrich_commits_with_files(commits).await
} else {
    commits
}
```

**API savings**: 30 calls → 0 calls per page (after first)

#### Strategy 3: **Time-Based Caching**

Persist cache to disk with TTL:

```rust
// src-tauri/src/integrations/github/commit_cache_persistent.rs
pub struct PersistentCommitCache {
    cache_dir: PathBuf, // ~/.bluekit/cache/commits/
    ttl_hours: u32,     // e.g., 24 hours
}

impl PersistentCommitCache {
    pub async fn get(&self, key: &str) -> Option<Vec<GitHubCommit>> {
        let cache_file = self.cache_dir.join(format!("{}.json", key));
        
        if cache_file.exists() {
            let age = cache_file.metadata()?.modified()?.elapsed()?;
            if age.as_secs() < self.ttl_hours * 3600 {
                return Some(read_json(&cache_file)?);
            }
        }
        None
    }
}
```

**Benefits**:
- Cache survives app restart
- Fresh commits fetched after TTL expires
- Dramatically reduces repeat fetching for active users

**Trade-offs**:
- Stale data (mitigated by Sync button)
- Disk space usage (minimal: ~1KB per commit page)

#### Strategy 4: **GraphQL API Migration** (Long-term)

Switch from REST to GraphQL for batch fetching:

```graphql
query GetMultipleRepoCommits {
  project1: repository(owner: "user", name: "repo1") {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 30) {
            nodes {
              oid
              message
              author { name email date }
              additions
              deletions
              changedFiles
            }
          }
        }
      }
    }
  }
  project2: repository(owner: "user", name: "repo2") {
    # Same structure
  }
}
```

**Benefits**:
- Single API call for multiple repos
- Get file stats without individual commit fetches
- GraphQL rate limit: Same 5,000/hour but more efficient

**Implementation**:
- Add GraphQL client: `octocrab` or `graphql-client` crate
- Batch up to 10 repos per query (stay under complexity limits)
- Fallback to REST if GraphQL unavailable

#### Strategy 5: **Smart Refresh**

Only fetch new commits since last sync:

```rust
pub async fn fetch_new_commits_since(
    project_id: &str,
    since_sha: &str,
) -> Result<Vec<GitHubCommit>, String> {
    // GET /repos/{owner}/{repo}/commits?since={date}
    // Only fetch commits after last known SHA
}
```

**Database tracking**:

```sql
-- Store last synced commit per project
CREATE TABLE project_sync_state (
    project_id TEXT PRIMARY KEY,
    last_commit_sha TEXT NOT NULL,
    last_synced_at INTEGER NOT NULL
);
```

**API savings**:
- First sync: 31 calls
- Subsequent syncs: 1-5 calls (only new commits)

#### Strategy 6: **Rate Limit Monitoring**

Add rate limit tracking and user feedback:

```rust
pub struct RateLimitInfo {
    pub limit: u32,        // 5000
    pub remaining: u32,    // How many calls left
    pub reset_at: u64,     // Unix timestamp when limit resets
}

impl GitHubClient {
    pub fn get_rate_limit_info(&self, response: &Response) -> RateLimitInfo {
        RateLimitInfo {
            limit: parse_header(response, "x-ratelimit-limit"),
            remaining: parse_header(response, "x-ratelimit-remaining"),
            reset_at: parse_header(response, "x-ratelimit-reset"),
        }
    }
}
```

**UI Integration**:
- Show rate limit in settings: "4,847 / 5,000 API calls remaining"
- Warning when < 100 remaining
- Calculate reset time: "Resets in 42 minutes"

## Recommended Implementation Plan for Cross-Project Timeline

### Phase 1: Foundation (Immediate)
1. ✅ Implement per-page commit enrichment with caching (DONE)
2. Add persistent disk cache with 24-hour TTL
3. Add rate limit monitoring and display

### Phase 2: Cross-Project View (Next - CRITICAL)
4. **🎯 Implement Smart Project Filtering (Strategy 0)**
   - Add GitHub Events API support (`get_user_events`)
   - Filter to projects with recent PushEvents (last 7-30 days)
   - **Reduces 1,550 calls → 249 calls** (84% reduction!)
5. Build consolidated timeline UI
   - Single merged timeline sorted by date
   - Project badges on each commit card
   - Activity circles for visual impact
6. Implement `fetch_cross_project_timeline` command
   - Returns `TimelineCommit` with project context
   - Merges and sorts commits from active projects

### Phase 3: Optimization (Future)
7. Add GraphQL batch HEAD checks (optional alternative to Events API)
8. Implement smart refresh (only fetch new commits since last sync)
9. Add user preference to disable activity circles
10. Background sync for active projects every 15 mins

### Phase 4: Scale (Long-term)
11. Migrate to GraphQL API for batch commit fetching
12. Consider GitHub App installation for 15k/hour limit
13. Server-side caching layer (if multi-user)
14. Webhook-based updates (real-time without polling)

### Why Smart Project Filtering is CRITICAL

**Without it** (naive approach):
- 50 projects × 31 calls = **1,550 API calls**
- Only 3 full refreshes before hitting hourly limit
- Slow loading (fetching from all repos)

**With it** (Events API filter):
- 1 call to detect activity + (8 active × 31) = **249 calls**
- 20 full refreshes before hitting limit
- Fast loading (only active repos)
- Better UX (shows what matters)

## Code References

### Key Files

- **Commit fetching**: `src-tauri/src/commands.rs:3999-4092` (`fetch_project_commits`)
- **GitHub client**: `src-tauri/src/integrations/github/github.rs:322-336` (`get_commit`)
- **Commit cache**: `src-tauri/src/integrations/github/commit_cache.rs`
- **Activity calculation**: `src/components/commits/TimelineTabContent.tsx:65-76`
- **Timeline UI**: `src/components/commits/TimelineTabContent.tsx`

### Adding Persistent Cache

**New file**: `src-tauri/src/integrations/github/commit_cache_persistent.rs`

```rust
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, Duration};

#[derive(Serialize, Deserialize)]
struct CacheEntry {
    commits: Vec<GitHubCommit>,
    cached_at: u64, // Unix timestamp
}

pub struct PersistentCommitCache {
    cache_dir: PathBuf,
    ttl_seconds: u64,
}

impl PersistentCommitCache {
    pub fn new(cache_dir: PathBuf, ttl_hours: u32) -> Self {
        std::fs::create_dir_all(&cache_dir).ok();
        Self {
            cache_dir,
            ttl_seconds: (ttl_hours as u64) * 3600,
        }
    }

    pub async fn get(&self, key: &str) -> Option<Vec<GitHubCommit>> {
        let path = self.cache_dir.join(format!("{}.json", key));
        
        if !path.exists() {
            return None;
        }

        // Check age
        let metadata = std::fs::metadata(&path).ok()?;
        let modified = metadata.modified().ok()?;
        let age = SystemTime::now().duration_since(modified).ok()?;
        
        if age.as_secs() > self.ttl_seconds {
            std::fs::remove_file(&path).ok();
            return None;
        }

        // Read cache
        let content = std::fs::read_to_string(&path).ok()?;
        let entry: CacheEntry = serde_json::from_str(&content).ok()?;
        Some(entry.commits)
    }

    pub async fn set(&self, key: &str, commits: Vec<GitHubCommit>) -> Result<(), String> {
        let entry = CacheEntry {
            commits,
            cached_at: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_secs(),
        };

        let path = self.cache_dir.join(format!("{}.json", key));
        let json = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| e.to_string())?;
        
        Ok(())
    }
}
```

**Integration in main.rs**:

```rust
let cache_dir = app_handle
    .path_resolver()
    .app_data_dir()
    .unwrap()
    .join("cache")
    .join("commits");

let persistent_cache = PersistentCommitCache::new(cache_dir, 24); // 24-hour TTL
app_handle.manage(persistent_cache);
```

## Best Practices

### DO:
- ✅ Cache aggressively (memory + disk)
- ✅ Lazy load data only when needed
- ✅ Monitor rate limits and warn users
- ✅ Provide manual Sync button for user control
- ✅ Gracefully degrade (show commits even without file data)
- ✅ Log API usage for debugging

### DON'T:
- ❌ Auto-refresh without user action
- ❌ Fetch all projects upfront in cross-project view
- ❌ Enrich commits that won't be displayed
- ❌ Make API calls on every navigation
- ❌ Hide rate limit errors from users
- ❌ Assume unlimited API budget

## Monitoring API Usage

Add logging to track actual usage:

```rust
use tracing::info;

// In fetch_project_commits
info!(
    project_id = %project_id,
    page = page_num,
    commits_count = commits.len(),
    api_calls = commits.len() + 1,
    "Fetched and enriched commits"
);

// In main.rs, add file logging
use tracing_appender::rolling::{RollingFileAppender, Rotation};

let file_appender = RollingFileAppender::new(
    Rotation::DAILY,
    app_data_dir.join("logs"),
    "bluekit.log",
);

tracing_subscriber::fmt()
    .with_writer(file_appender)
    .with_max_level(tracing::Level::INFO)
    .init();
```

**Analyze logs**:
```bash
# Count API calls per day
grep "Fetched and enriched commits" ~/.bluekit/logs/bluekit.log.* \
  | jq -r '.api_calls' \
  | awk '{sum+=$1} END {print "Total API calls:", sum}'
```

## Future: GitHub App vs OAuth App

### When to Migrate to GitHub App

Consider if:
- Multiple users sharing same backend
- Need > 5,000 requests/hour
- Want organization-wide installations
- Need fine-grained permissions

### GitHub App Benefits

- **15,000 requests/hour** per installation (3x increase)
- Better security (installation tokens, not user tokens)
- Webhook support (real-time commit notifications)
- Organization admin can install once for all users

### Migration Path

1. Create GitHub App in GitHub settings
2. Add app credentials to BlueKit
3. Implement installation flow
4. Update auth to use installation tokens
5. Keep OAuth as fallback for personal use

## Conclusion

The current implementation is **well-positioned for single-project usage** with caching as the primary rate limit defense. For the consolidated cross-project timeline:

**🎯 KEY INSIGHT**: Smart Project Filtering (Strategy 0) is the **game-changer**.

**Without it**:
- 50 projects = 1,550 API calls
- Unsustainable at scale

**With it** (GitHub Events API):
- 50 projects → filter to 8 active = 249 API calls
- **84% reduction** in API usage
- **6x more refreshes** before hitting limit

**Recommended Short-term Stack** (works with current 5k/hour limit):
1. **Smart Project Filtering** (Events API or GraphQL HEAD checks)
2. Persistent disk cache with 24-hour TTL
3. Consolidated timeline UI with project badges
4. Smart refresh (only fetch new commits)

**Long-term Scale** (100+ projects, multi-user):
5. GraphQL API migration for batch operations
6. GitHub App installation (15k/hour limit)
7. Webhook-based real-time updates
8. Server-side caching layer

**The Bottom Line**: With Smart Project Filtering, you can **comfortably support 50+ projects** on the default OAuth app limits. The consolidated timeline becomes highly practical without requiring GraphQL or GitHub App migration upfront.

The architecture supports incremental improvements without breaking changes.
