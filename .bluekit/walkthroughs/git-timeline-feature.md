---
id: git-timeline-feature
alias: Git Timeline Feature
type: walkthrough
is_base: false
version: 1
tags:
  - git
  - timeline
  - checkpoints
description: Complete architecture walkthrough of the git timeline feature showing how commits are fetched from GitHub, displayed in a timeline, and how users can pin commits as checkpoints with filtering and management capabilities
complexity: comprehensive
format: architecture
---
# Git Timeline Feature Architecture

## Overview

The Git Timeline feature provides a visual timeline interface for viewing GitHub commits and managing checkpoints (pinned commits) for a project. It integrates with the GitHub API to fetch commit history, displays commits in a grouped timeline view, and allows users to pin important commits as checkpoints with metadata (name, type, description, tags).

## Component Architecture

### Main Component: `TimelineTabContent`

The main component is located at `src/components/commits/TimelineTabContent.tsx` and serves as the orchestrator for the entire feature.

**Key Responsibilities:**
- Managing view mode state (commits vs checkpoints)
- Loading and paginating commits from GitHub
- Loading and managing checkpoints from the database
- Coordinating user interactions (pin, view diff, sync, filter)
- Rendering the timeline UI with date grouping and activity indicators

**Props Interface:**
```typescript
interface TimelineTabContentProps {
  projectId: string;
  gitUrl?: string;
  gitConnected: boolean;
  onGitConnected?: () => void;
}
```

### Supporting Components

1. **`CheckpointsView`** - Separate component the checkpoints-only view with filtering
2. **`PinCheckpointModal`** - Modal for creating new checkpoints
3. **`BranchOffModal`** - Modal for creating branches from checkpoints
4. **`RollbackModal`** - Modal for rolling back to a checkpoint
5. **`FilterPanel`** - Reusable filter panel for checkpoint filtering
6. **`LiquidViewModeSwitcher`** - Custom view mode switcher component
7. **`ActivityCircles`** - Visual activity indicator component
8. **`DateHeader`** - Date group header with stats and activity indicators

## Data Flow

### Commits Flow

1. **Initial Load:**
   ```
   Component Mount → useEffect → loadCommits(1) 
   → invokeFetchProjectCommits(projectId, undefined, 1, 30)
   → Tauri Command: fetch_project_commits
   → GitHub API: GET /repos/{owner}/{repo}/commits
   → Enrich commits with file details (parallel, 3 at a time)
   → Cache results (5-minute TTL)
   → Update component state
   ```

2. **Pagination:**
   ```
   User clicks "Load More" → handleLoadMore()
   → loadCommits(nextPage, true) // append mode
   → Fetches next page and appends to existing commits
   ```

3. **Sync/Refresh:**
   ```
   User clicks "Sync" → handleSync()
   → invokeInvalidateCommitCache(projectId)
   → Reset pagination state
   → loadCommits(1, false) // replace mode
   ```

### Checkpoints Flow

1. **Loading Checkpoints:**
   ```
   Component Mount / View Mode Switch → loadCheckpoints()
   → invokeGetProjectCheckpoints(projectId)
   → Tauri Command: get_project_checkpoints
   → Database Query: SELECT * FROM checkpoints WHERE project_id = ?
   → Update component state
   ```

2. **Creating Checkpoint:**
   ```
   User clicks "Pin" on commit → handlePinCheckpoint(commit)
   → Opens PinCheckpointModal
   → User fills form → invokePinCheckpoint(...)
   → Tauri Command: pin_checkpoint
   → Database: INSERT INTO checkpoints
   → handleCheckpointPinned() → Reload checkpoints
   ```

3. **Filtering Checkpoints:**
   ```
   User applies filters → State updates (nameFilter, selectedTags)
   → useMemo: filteredCheckpoints
   → Filters by name/description and tags (case-insensitive)
   → Updates groupedCheckpoints
   → Re-renders timeline
   ```

## State Management

### Commits State

```typescript
const [commits, setCommits] = useState<GitHubCommit[]>([]);
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [error, setError] = useState<string | null>(null);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
```

**State Transitions:**
- Initial: `loading=true`, `commits=[]`
- Loading: `loading=true`, `loadingMore=false`
- Success: `loading=false`, `commits=[...]`, `hasMore=true/false`
- Error: `loading=false`, `error="message"`, `commits=[]` or existing

### Checkpoints State

```typescript
const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
const [checkpointNameFilter, setCheckpointNameFilter] = useState("");
const [checkpointSelectedTags, setCheckpointSelectedTags] = useState<string[]>([]);
const [checkpointAllTags, setCheckpointAllTags] = useState<string[]>([]);
```

**Derived State:**
- `filteredCheckpoints` - Memoized filtered list
- `groupedCheckpoints` - Memoized date-grouped list
- `isCommitPinned(sha)` - Checks if commit has associated checkpoint

### View Mode State

```typescript
const [viewMode, setViewMode] = useState<ViewMode>("commits");
```

**View Modes:**
- `"commits"` - Shows GitHub commits timeline
- `"checkpoints"` - Shows only pinned checkpoints

## UI Rendering Flow

### Commits View Rendering

1. **Date Grouping:**
   ```typescript
   groupCommitsByDate(commits)
   → Groups by date key: `${year}-${month}-${day}`
   → Formats date: "Today", "Yesterday", "Monday, Jan 15", "Jan 15, 2024"
   → Sorts groups: newest first
   → Sorts commits within groups: newest first
   ```

2. **Activity Calculation:**
   ```typescript
   calculateCommitActivity(group.commits)
   → Sums all file additions + deletions
   → Divides by CHANGES_PER_CIRCLE (1000)
   → Caps at MAX_CIRCLES (10)
   → Returns activity score (0-10)
   ```

3. **Timeline Rendering:**
   ```
   For each date group:
     → Render DateHeader (date, count, stats, activity circles)
     → Render Timeline.Root
       → For each commit:
         → Check if pinned (getCheckpointForCommit)
         → Render Timeline.Item with:
           - Timeline.Indicator (colored if pinned)
           - Card with commit details
           - Actions (Pin/View Diff)
   ```

### Checkpoints View Rendering

1. **Tag Extraction:**
   ```typescript
   useMemo(() => {
     // Parse all checkpoint tags
     // Update checkpointAllTags for FilterPanel
   }, [checkpoints])
   ```

2. **Filtering:**
   ```typescript
   filteredCheckpoints = useMemo(() => {
     return checkpoints.filter(checkpoint => {
       matchesName = nameFilter matches name/description
       matchesTags = selectedTags intersect checkpoint.tags
       return matchesName && matchesTags
     })
   }, [checkpoints, nameFilter, selectedTags])
   ```

3. **Grouping & Rendering:**
   ```
   groupedCheckpoints = useMemo(() => {
     // Group by date (same as commits)
     // Sort by date and timestamp
   }, [filteredCheckpoints])
   
   → Render similar to commits but with checkpoint-specific UI
   → Show checkpoint type badges
   → Show tags
   → Actions: View Diff, Rollback, Branch Off, Unpin
   ```

## Backend Integration

### IPC Layer (`src/ipc/commits.ts`)

**Key Functions:**
- `invokeFetchProjectCommits(projectId, branch?, page?, perPage?)` - Fetches commits with caching
- `invokeOpenCommitInGitHub(gitUrl, commitSha)` - Opens commit in browser
- `invokeInvalidateCommitCache(projectId)` - Clears commit cache

**Timeout Handling:**
- Commits: 15 second timeout (GitHub API can be slow)
- Uses `invokeWithTimeout` utility for automatic timeout handling

### Tauri Commands (`src-tauri/src/commands.rs`)

**`fetch_project_commits`:**
1. Checks 5-minute cache first
2. Validates project git connection
3. Parses GitHub URL to owner/repo
4. Fetches commits from GitHub API
5. Enriches commits with file details (parallel, 3 concurrent)
6. Sorts by date (newest first)
7. Caches results
8. Returns enriched commits

**Rate Limiting Considerations:**
- GitHub API: 5,000 requests/hour for authenticated users
- Each commit enrichment = 1 additional API call
- 30 commits = 31 API calls (1 list + 30 details)
- Mitigations:
  - Results cached for 5 minutes
  - Concurrency limited to 3
  - Falls back to basic info if detail fetch fails

**`get_project_checkpoints`:**
- Simple database query
- Filters by project_id
- Orders by pinned_at DESC (newest first)

**`pin_checkpoint`:**
- Validates checkpoint type
- Checks for duplicate (same commit SHA)
- Generates checkpoint ID
- Serializes tags to JSON
- Inserts into database
- Returns created checkpoint

### Database Schema

**Checkpoints Table:**
```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  git_commit_sha TEXT NOT NULL,
  git_branch TEXT,
  git_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT, -- JSON array
  checkpoint_type TEXT NOT NULL, -- "milestone" | "experiment" | "template" | "backup"
  parent_checkpoint_id TEXT,
  created_from_project_id TEXT,
  pinned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)
```

**Indexes:**
- `idx_checkpoints_project_id` - Fast project lookups
- `idx_checkpoints_commit_sha` - Fast commit matching
- `idx_checkpoints_type` - Filter by type
- `idx_checkpoints_parent_id` - Lineage tracking

## User Workflows

### Workflow 1: Viewing Commits

1. User opens project with git connected
2. Component mounts → `useEffect` triggers `loadCommits(1)`
3. Shows loading spinner
4. Fetches first 30 commits from GitHub (or cache)
5. Groups commits by date
6. Renders timeline with:
   - Date headers with activity indicators
   - Commit cards with message, author, date
   - Pin button (if not already pinned)
   - View Diff button
7. User scrolls to bottom → clicks "Load More"
8. Fetches next page and appends

### Workflow 2: Pinning a Checkpoint

1. User clicks "Pin" button on a commit
2. `handlePinCheckpoint(commit)` sets selected commit and opens modal
3. `PinCheckpointModal` opens with:
   - Pre-filled name (commit message first line)
   - Type selector (milestone/experiment/template/backup)
   - Description field
   - Tags input
4. User fills form and clicks "Create"
5. `invokePinCheckpoint` called with form data
6. Backend validates and creates checkpoint in database
7. Modal closes, `handleCheckpointPinned()` called
8. Checkpoints reloaded
9. Commit view updates to show pinned indicator
10. If in checkpoints view, timeline refreshes

### Workflow 3: Filtering Checkpoints

1. User switches to "Checkpoints" view
2. `CheckpointsView` component renders
3. User clicks "Filter" button
4. `FilterPanel` opens (positioned relative to button)
5. User types name filter or selects tags
6. State updates trigger `useMemo` recalculation
7. `filteredCheckpoints` updates
8. `groupedCheckpoints` recalculates
9. Timeline re-renders with filtered results
10. Filter badge shows active filter count

### Workflow 4: Managing Checkpoints

**Unpin:**
- User clicks trash icon
- `handleUnpin(checkpointId)` called
- `invokeUnpinCheckpoint` deletes from database
- Checkpoints reloaded
- Timeline updates

**Rollback:**
- User clicks rollback icon
- `RollbackModal` opens
- User confirms
- Git checkout to commit SHA
- Project files updated

**Branch Off:**
- User clicks branch icon
- `BranchOffModal` opens
- User enters branch name
- Creates new git branch from checkpoint commit
- Updates project git branch

## Activity Indicators

The feature includes visual activity indicators to show commit/checkpoint density:

**Activity Circles:**
- Each circle represents ~1000 lines changed (commits) or 1 checkpoint
- Maximum 10 circles
- Partial fill for fractional values
- Blue color scheme

**Calculation:**
```typescript
// Commits
activityScore = min(totalChanges / 1000, 10)

// Checkpoints  
activityScore = min(checkpointCount, 10)
```

## Date Formatting

**Human-Readable Dates:**
- `< 1 hour`: "X minutes ago"
- `< 24 hours`: "X hours ago"
- `< 7 days`: "X days ago"
- `>= 7 days`: "Jan 15" or "Jan 15, 2024" (if different year)

**Elegant Date Headers:**
- Today: "Today"
- Yesterday: "Yesterday"
- This week: "Monday, Jan 15"
- Older: "Jan 15" or "Jan 15, 2024"

## Error Handling

**Commit Loading Errors:**
- Network failures → Error state with retry button
- GitHub API errors → Toast notification + error state
- Cache errors → Falls back to fresh fetch

**Checkpoint Errors:**
- Duplicate pinning → Error toast (commit already pinned)
- Database errors → Error toast with message
- Validation errors → Form validation feedback

**Git Connection Errors:**
- Not connected → Empty state with "Connect Git" button
- Connection fails → Error toast
- Missing git URL → Error toast

## Performance Considerations

1. **Caching:**
   - Commits cached for 5 minutes
   - Reduces GitHub API calls
   - Cache key: `projectId + branch + page`

2. **Pagination:**
   - Loads 30 commits per page
   - Lazy loading with "Load More" button
   - Prevents initial load from being too large

3. **Memoization:**
   - `filteredCheckpoints` memoized
   - `groupedCheckpoints` memoized
   - `checkpointAllTags` memoized
   - Prevents unnecessary recalculations

4. **Parallel Enrichment:**
   - Commits enriched in parallel (3 concurrent)
   - Reduces total fetch time
   - Respects rate limits

5. **Conditional Rendering:**
   - Only renders visible date groups
   - Lazy loads modals
   - Efficient React rendering

## Integration Points

### With Project System
- Requires `projectId` to fetch commits/checkpoints
- Uses project's `gitUrl` and `gitBranch`
- Updates project state on git connection

### With GitHub Integration
- Uses GitHub API client from keychain
- Authenticated requests for higher rate limits
- Handles GitHub URL parsing

### With Database
- Checkpoints stored in SQLite
- Foreign key to projects table
- Cascade delete on project deletion

### With File System
- No direct file system access
- Git operations handled by backend
- Checkpoint rollback uses git checkout

## Future Enhancements

Potential improvements based on code structure:

1. **Branch Selection:**
   - Currently uses project's current branch
   - Could add branch selector in UI
   - TODO comment: `gitBranch={undefined} // TODO: Get from project`

2. **Lineage Tracking:**
   - `parentCheckpointId` field exists but not used
   - Could show checkpoint relationships
   - Phase 4 feature

3. **Checkpoint Templates:**
   - Template type exists
   - Could add template library
   - Reuse checkpoint configurations

4. **Advanced Filtering:**
   - Currently: name + tags
   - Could add: date range, type, author
   - More sophisticated search

5. **Bulk Operations:**
   - Currently: one checkpoint at a time
   - Could add: bulk pin, bulk delete
   - Batch operations

## Key Code Patterns

### State Management Pattern
```typescript
// Separate loading states for different operations
const [loading, setLoading] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
```

### Memoization Pattern
```typescript
// Expensive calculations memoized
const filteredCheckpoints = useMemo(() => {
  return checkpoints.filter(/* ... */);
}, [checkpoints, nameFilter, selectedTags]);
```

### Error Handling Pattern
```typescript
try {
  // Operation
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : "Unknown error";
  setError(errorMessage);
  toaster.create({ /* ... */ });
} finally {
  setLoading(false);
}
```

### Conditional Rendering Pattern
```typescript
// Early returns for different states
if (!gitConnected) return <EmptyState />;
if (loading) return <Spinner />;
if (error && commits.length === 0) return <ErrorState />;
// Main render
```

## Testing Considerations

Areas that would benefit from testing:

1. **Date Grouping Logic:**
   - Edge cases: timezone boundaries
   - Single commit per day
   - Many commits per day

2. **Filtering Logic:**
   - Case-insensitive matching
   - Tag intersection
   - Empty filters

3. **Pagination:**
   - Last page detection
   - Append vs replace
   - Cache invalidation

4. **Error Scenarios:**
   - Network failures
   - GitHub API rate limits
   - Database errors

5. **State Transitions:**
   - View mode switching
   - Checkpoint creation/deletion
   - Filter application

## Summary

The Git Timeline feature is a comprehensive system that:

1. **Fetches** commits from GitHub API with intelligent caching
2. **Displays** commits in a visually appealing timeline grouped by date
3. **Allows** users to pin important commits as checkpoints
4. **Manages** checkpoints with metadata (name, type, description, tags)
5. **Provides** filtering and search capabilities
6. **Integrates** with git operations (rollback, branch off)
7. **Handles** errors gracefully with user feedback
8. **Optimizes** performance with caching, pagination, and memoization

The architecture separates concerns cleanly:
- **Frontend**: React components with state management
- **IPC Layer**: Type-safe communication
- **Backend**: Tauri commands with GitHub API and database
- **Database**: SQLite with proper indexing

This design allows for maintainability, extensibility, and good user experience.
