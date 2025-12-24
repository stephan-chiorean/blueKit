# Enterprise-Grade Collaboration & Project Management in BlueKit

**Status:** Conceptual / Vision
**Created:** 2025-12-21
**Context:** Exploring how BlueKit can evolve from static markdown viewers to a full-fledged enterprise collaboration platform with native project management capabilities

## Overview

BlueKit currently excels at organizing code knowledge through markdown files stored locally. To become enterprise-ready, we need to add real-time collaboration, inline commenting, live editing, and deep task management integration. This document explores how BlueKit can become a complete alternative to tools like Jira while maintaining its file-based philosophy.

**Key Question:** Should BlueKit integrate with existing tools (GitHub, Jira) or build its own native collaboration layer?

**Recommendation:** Build native, offer integrations as opt-in.

---

## Table of Contents

1. [Current State & Limitations](#1-current-state--limitations)
2. [Enterprise Collaboration Requirements](#2-enterprise-collaboration-requirements)
3. [Architecture: Local Files vs Cloud Sync](#3-architecture-local-files-vs-cloud-sync)
4. [Feature 1: Collaborative Editing](#4-feature-1-collaborative-editing)
5. [Feature 2: Comments & Annotations](#5-feature-2-comments--annotations)
6. [Feature 3: Task Management System](#6-feature-3-task-management-system)
7. [Feature 4: Milestone-Task Linking](#7-feature-4-milestone-task-linking)
8. [Feature 5: Activity Feeds & Notifications](#8-feature-5-activity-feeds--notifications)
9. [Integration Strategy](#9-integration-strategy)
10. [File Format & Data Model](#10-file-format--data-model)
11. [Real-Time Sync Architecture](#11-real-time-sync-architecture)
12. [Permission & Access Control](#12-permission--access-control)
13. [Offline-First Strategy](#13-offline-first-strategy)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Cost Analysis & Pricing Model](#15-cost-analysis--pricing-model)

---

## 1. Current State & Limitations

### What Works Today

✅ **File-based storage** - Markdown files in `.bluekit` directories
✅ **Local-first** - No internet required, works offline
✅ **Version controlled** - Git tracks all changes
✅ **Static viewing** - Read-only markdown rendering
✅ **Basic organization** - Kits, walkthroughs, agents, blueprints
✅ **Static milestones** - Basic milestone tracking in plans

### What's Missing for Enterprise

❌ **No collaboration** - Single-user only, no sharing
❌ **No commenting** - Can't annotate or discuss content inline
❌ **No editing UI** - Must edit in external editor
❌ **No task management** - Milestones not linked to actionable tasks
❌ **No notifications** - No awareness of changes by others
❌ **No conflict resolution** - Git merge conflicts are manual
❌ **No activity tracking** - Can't see who changed what when
❌ **No permissions** - All-or-nothing file access

### Impact on Enterprise Adoption

**Blocker:** Teams can't work together on plans in real-time
**Blocker:** No way to discuss or review content without external tools
**Friction:** Editing requires switching to external editor
**Friction:** Task tracking requires separate tool (Jira, GitHub Issues)

---

## 2. Enterprise Collaboration Requirements

### Must-Have Features (P0)

1. **Multi-user editing** - Multiple people editing same plan simultaneously
2. **Inline comments** - Discuss specific sections without chat tools
3. **Task management** - Create, assign, track tasks linked to plans
4. **Activity feed** - See what changed, who changed it, when
5. **Notifications** - Get alerted to mentions, assignments, changes
6. **Conflict resolution** - Handle concurrent edits gracefully

### Should-Have Features (P1)

7. **Mentions** - @username to notify collaborators
8. **Reactions** - 👍 emoji reactions on comments
9. **File history** - Visual timeline of all changes
10. **Search** - Full-text search across plans, comments, tasks
11. **Filtering** - Filter by author, date, status, tags
12. **Export** - Generate reports, PDFs from plans

### Nice-to-Have Features (P2)

13. **Voice comments** - Audio annotations on plans
14. **Video recordings** - Loom-style video walkthroughs
15. **AI summaries** - Auto-generate summaries of discussions
16. **Templates** - Reusable plan templates for common workflows
17. **Analytics** - Team velocity, burndown charts, insights

---

## 3. Architecture: Local Files vs Cloud Sync

### The Core Dilemma

**Current:** Everything is local files in git
**Challenge:** Real-time collaboration requires shared state
**Question:** Do we keep files local or move to cloud?

### Option A: Pure Local with Git Sync

**How it works:**
- Files stay local in `.bluekit` directories
- Git is the sync mechanism
- Collaboration happens through commits/PRs
- Comments stored in `.bluekit/comments.json`
- Tasks stored in `.bluekit/tasks.json`

**Pros:**
- ✅ Maintains file-based philosophy
- ✅ Works offline perfectly
- ✅ Git version control built-in
- ✅ No server costs

**Cons:**
- ❌ Slow sync (must pull/push)
- ❌ Merge conflicts with concurrent edits
- ❌ No real-time updates
- ❌ Git learning curve for non-technical users

**Verdict:** Good for async collaboration, terrible for real-time

---

### Option B: Hybrid - Local Files + Cloud Metadata

**How it works:**
- Markdown content stays in local files
- Metadata (comments, tasks, reactions) in cloud DB
- File watcher detects local changes, syncs content to cloud
- Cloud broadcasts changes to all connected clients
- Git still tracks file changes

**Pros:**
- ✅ Real-time collaboration on metadata
- ✅ Files remain local and version-controlled
- ✅ Fast sync for comments/tasks
- ✅ Offline viewing (cached metadata)

**Cons:**
- ❌ Split architecture complexity
- ❌ Requires cloud infrastructure
- ❌ Metadata not in git (comments, tasks separate)
- ❌ Potential inconsistency if cloud unavailable

**Verdict:** Best balance of local-first + real-time features

---

### Option C: Full Cloud with Local Cache

**How it works:**
- Single source of truth: cloud database
- Local `.bluekit` files are cache/snapshots
- Desktop app syncs to cloud via WebSocket
- Git integration via cloud → git export
- Operational Transform (OT) for concurrent editing

**Pros:**
- ✅ True real-time collaboration
- ✅ Conflict-free concurrent editing
- ✅ Instant sync across devices
- ✅ Centralized permissions & access control
- ✅ Better search/analytics (centralized data)

**Cons:**
- ❌ Requires internet connection
- ❌ Monthly cloud costs ($$$)
- ❌ Loses file-based simplicity
- ❌ Git becomes secondary (export-only)
- ❌ Vendor lock-in risk

**Verdict:** Maximum features, maximum deviation from current model

---

### Recommended Approach: **Option B (Hybrid)**

**Why Hybrid Wins:**

1. **Preserves core value prop** - Files stay local, work offline
2. **Enables collaboration** - Real-time comments/tasks via cloud
3. **Incremental migration** - Can start small, scale up
4. **Git compatibility** - Still works with version control
5. **Lower cost** - Only metadata in cloud, not full documents

**Architecture Overview:**

```
┌─────────────────────────────────────────────────────────────┐
│                    BlueKit Desktop App                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Local Files (.bluekit/)        Cloud Metadata (PostgreSQL) │
│  ├─ plan.md                     ├─ comments                 │
│  ├─ walkthrough.md              ├─ tasks                    │
│  └─ blueprint.json              ├─ reactions                │
│                                 └─ activity_log             │
│                                                              │
│  File Watcher (Rust)            WebSocket Client            │
│  └─ Detects changes             └─ Real-time updates        │
│     └─ Syncs to cloud                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          ↕
                     [Internet]
                          ↕
┌─────────────────────────────────────────────────────────────┐
│                   BlueKit Cloud Backend                      │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Server (Axum)        PostgreSQL Database         │
│  ├─ Broadcast changes           ├─ plan_metadata            │
│  ├─ Conflict resolution         ├─ comments                 │
│  └─ Authentication              ├─ tasks                    │
│                                 ├─ milestones               │
│  REST API (Axum)                └─ activity_log             │
│  └─ CRUD for metadata                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**

1. **Content stays local** - Markdown files never leave your machine unless you push to git
2. **Metadata syncs instantly** - Comments, tasks, reactions update in real-time
3. **Offline graceful** - App works fully offline, syncs when reconnected
4. **Git as backup** - All file changes tracked in git, metadata exported to `.bluekit/metadata.json`

---

## 4. Feature 1: Collaborative Editing

### Problem Statement

**Today:** Only one person can edit a file at a time. If two people edit, last save wins (data loss risk).

**Goal:** Multiple people editing the same plan simultaneously without conflicts.

### Solution: Operational Transform (OT)

**Technology:** Use CRDT (Conflict-free Replicated Data Types) or OT algorithms

**Popular Libraries:**
- **Yjs** - Mature CRDT library for collaborative editing
- **Automerge** - CRDT with git-like semantics
- **ShareDB** - OT library used by Google Docs

**Recommended:** **Yjs** (best for markdown, integrates with CodeMirror/Monaco)

### Architecture

```
User A types → Yjs Doc → WebSocket → Server → Broadcast → Yjs Doc → User B sees change
                 ↓
              Local File (.md)
              (debounced save)
```

### Implementation Plan

#### Phase 1: Read-Only Multiplayer Cursors

**What:** See where others are viewing (no editing yet)

```typescript
// Desktop app sends cursor position
socket.emit('cursor-move', {
  planId: 'github/collaborator-management',
  userId: 'user123',
  position: { line: 42, column: 10 },
});

// Other clients receive and show avatars
socket.on('cursor-update', (data) => {
  showUserCursor(data.userId, data.position);
});
```

**Benefits:**
- ✅ No data conflicts (read-only)
- ✅ Awareness of team activity
- ✅ Simple to implement

#### Phase 2: Live Editing with Yjs

**Step 1: Add Yjs to Frontend**

```typescript
// src/components/plans/CollaborativeEditor.tsx
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { CodeMirror6 as CodeMirror } from '@uiw/react-codemirror';
import { yCollab } from 'y-codemirror.next';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  'wss://api.bluekit.dev/collaboration',
  `plan-${planId}`,
  ydoc
);

const ytext = ydoc.getText('content');

// CodeMirror with Yjs plugin
<CodeMirror
  value={ytext.toString()}
  extensions={[yCollab(ytext, provider.awareness)]}
  onChange={(value) => {
    // Yjs handles sync automatically
    // Save to local file every 5 seconds
    debouncedSaveToFile(value);
  }}
/>
```

**Step 2: WebSocket Server (Rust + Axum)**

```rust
// src-cloud/src/collaboration.rs
use axum::extract::ws::{WebSocket, WebSocketUpgrade};
use yrs::{Doc, Text, Transact};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    // Load Yjs doc from DB or create new
    let doc = state.get_or_create_doc(&plan_id).await;

    // Sync initial state to client
    send_sync_message(&socket, &doc).await;

    // Listen for updates from client
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Binary(update)) => {
                // Apply update to Yjs doc
                doc.transact_mut(|txn| {
                    yrs::updates::decoder::Decode::decode(update, txn);
                });

                // Broadcast to all other clients
                broadcast_update(&state, &plan_id, &update).await;

                // Persist to DB
                save_snapshot(&state.db, &plan_id, &doc).await;
            }
            _ => {}
        }
    }
}
```

**Step 3: Save to Local File**

```typescript
// Debounced file save (5 second delay)
const debouncedSaveToFile = useCallback(
  debounce(async (content: string) => {
    await invoke('save_plan_file', {
      planPath: '/path/to/plan.md',
      content: content,
    });
  }, 5000),
  []
);
```

### Conflict Resolution

**Yjs automatically resolves conflicts:**
- Character-by-character merging
- Preserves intent of all users
- No "merge conflict" errors

**Example:**

```
Initial:    "Hello World"

User A:     "Hello Beautiful World"  (adds "Beautiful")
User B:     "Hello Wonderful World"  (adds "Wonderful")

Merged:     "Hello Beautiful Wonderful World"
            ✅ Both edits preserved!
```

### Offline Behavior

**When offline:**
1. Yjs continues tracking local edits
2. File saves normally to disk
3. Git commits work as usual

**When reconnected:**
4. Yjs syncs all offline changes
5. Conflicts auto-resolved
6. Other users see your changes appear

---

## 5. Feature 2: Comments & Annotations

### Problem Statement

**Today:** No way to discuss plans without external tools (Slack, email, GitHub PR comments).

**Goal:** Inline comments directly on plan sections, like Google Docs.

### UI/UX Design

#### Comment Anchors

**Visual:** Highlighted text with comment icon in margin

```markdown
## Implementation Plan

We should use Yjs for real-time sync. ← [💬 3 comments]
```

**On click:** Side panel opens with thread

```
┌─────────────────────────────────────────┐
│ Comments                                │
├─────────────────────────────────────────┤
│ alice @bob: Why Yjs over Automerge?    │
│   ↳ bob: Yjs has better docs           │
│   ↳ alice: Fair point 👍               │
│                                         │
│ [Write a comment...]                    │
└─────────────────────────────────────────┘
```

### Data Model

**PostgreSQL Schema:**

```sql
CREATE TABLE plan_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL,               -- e.g., "github/collaborator-management"
    workspace_id UUID NOT NULL,          -- Which workspace this belongs to

    -- Comment content
    author_id UUID NOT NULL,             -- Who wrote it
    content TEXT NOT NULL,               -- Markdown-formatted comment
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Thread structure
    parent_comment_id UUID,              -- NULL for top-level, UUID for replies
    thread_id UUID NOT NULL,             -- Groups replies together

    -- Anchor to document
    anchor_type TEXT NOT NULL,           -- "selection", "line", "heading"
    anchor_data JSONB NOT NULL,          -- { "startLine": 42, "endLine": 45, "text": "..." }

    -- Status
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES plan_comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_plan_comments_plan ON plan_comments(plan_id, workspace_id);
CREATE INDEX idx_plan_comments_thread ON plan_comments(thread_id);
CREATE INDEX idx_plan_comments_author ON plan_comments(author_id);
```

### Anchor Types

#### Type 1: Selection Anchor

**Anchored to specific text range:**

```json
{
  "type": "selection",
  "startLine": 42,
  "endLine": 45,
  "startOffset": 0,
  "endOffset": 25,
  "textSnapshot": "We should use Yjs for real-time sync",
  "checksum": "abc123def456"
}
```

**Challenge:** Text changes → anchor becomes invalid

**Solution:** Use Yjs positions (stays valid as text changes)

```typescript
// Yjs relative position (survives edits)
const ytext = ydoc.getText('content');
const relativePos = Y.createRelativePositionFromTypeIndex(ytext, 100);

// Later, resolve to current position
const absolutePos = Y.createAbsolutePositionFromRelativePosition(relativePos, ydoc);
```

#### Type 2: Line Anchor

**Anchored to line number (less precise, more stable):**

```json
{
  "type": "line",
  "line": 42,
  "textSnapshot": "We should use Yjs for real-time sync"
}
```

**Behavior:** If line content changes significantly, show warning "Text has changed"

#### Type 3: Heading Anchor

**Anchored to markdown heading (most stable):**

```json
{
  "type": "heading",
  "headingText": "Implementation Plan",
  "sectionLine": 38
}
```

**Behavior:** Follows heading even if moved

### IPC Commands

```rust
// src-tauri/src/commands.rs

#[tauri::command]
pub async fn create_comment(
    workspace_id: String,
    plan_id: String,
    content: String,
    anchor: CommentAnchor,
    parent_comment_id: Option<String>,
) -> Result<Comment, String> {
    let cloud_client = CloudClient::from_session()?;
    cloud_client.create_comment(workspace_id, plan_id, content, anchor, parent_comment_id).await
}

#[tauri::command]
pub async fn get_plan_comments(
    workspace_id: String,
    plan_id: String,
) -> Result<Vec<CommentThread>, String> {
    let cloud_client = CloudClient::from_session()?;
    cloud_client.get_plan_comments(workspace_id, plan_id).await
}

#[tauri::command]
pub async fn resolve_comment(
    comment_id: String,
) -> Result<(), String> {
    let cloud_client = CloudClient::from_session()?;
    cloud_client.resolve_comment(comment_id).await
}
```

### Frontend Components

```typescript
// src/components/comments/CommentThread.tsx

interface CommentThreadProps {
  thread: CommentThread;
  onReply: (content: string) => void;
  onResolve: () => void;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  thread,
  onReply,
  onResolve,
}) => {
  return (
    <Box borderWidth={1} borderRadius="md" p={4}>
      {/* Top-level comment */}
      <HStack spacing={3}>
        <Avatar size="sm" src={thread.author.avatar_url} />
        <VStack align="start" spacing={0} flex={1}>
          <Text fontWeight="medium">{thread.author.name}</Text>
          <Text fontSize="sm" color="gray.600">
            {formatTimestamp(thread.created_at)}
          </Text>
        </VStack>
        {!thread.resolved && (
          <Button size="xs" onClick={onResolve}>
            Resolve
          </Button>
        )}
      </HStack>

      <Box mt={2}>
        <MarkdownRenderer content={thread.content} />
      </Box>

      {/* Replies */}
      {thread.replies.map((reply) => (
        <Box key={reply.id} ml={8} mt={3} borderLeftWidth={2} pl={3}>
          <HStack spacing={2}>
            <Avatar size="xs" src={reply.author.avatar_url} />
            <Text fontWeight="medium" fontSize="sm">
              {reply.author.name}
            </Text>
          </HStack>
          <Box mt={1}>
            <MarkdownRenderer content={reply.content} />
          </Box>
        </Box>
      ))}

      {/* Reply input */}
      {!thread.resolved && (
        <Box mt={3}>
          <Textarea
            placeholder="Write a reply..."
            size="sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                onReply(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};
```

### Mentions (@username)

**Feature:** Tag collaborators in comments

```typescript
// Parse mentions from comment content
const parseMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
};

// When creating comment
const mentions = parseMentions(commentContent);
for (const username of mentions) {
  await createNotification({
    userId: getUserIdByUsername(username),
    type: 'mention',
    content: `${author} mentioned you in a comment`,
    link: `/plans/${planId}#comment-${commentId}`,
  });
}
```

### Export to Git

**Challenge:** Comments aren't in git—how to preserve them?

**Solution:** Export comments to `.bluekit/metadata/comments.json`

```json
{
  "plan_id": "github/collaborator-management",
  "comments": [
    {
      "id": "uuid-1",
      "author": "alice",
      "content": "Why Yjs over Automerge?",
      "anchor": {
        "type": "selection",
        "startLine": 42,
        "text": "We should use Yjs for real-time sync"
      },
      "created_at": "2025-12-21T10:30:00Z",
      "replies": [
        {
          "id": "uuid-2",
          "author": "bob",
          "content": "Yjs has better docs",
          "created_at": "2025-12-21T10:35:00Z"
        }
      ]
    }
  ]
}
```

**Commit this file to git alongside plan.md**

---

## 6. Feature 3: Task Management System

### Problem Statement

**Today:** Milestones exist but have no actionable tasks. Teams use Jira/GitHub Issues separately.

**Goal:** Native task system deeply integrated with plans, replacing Jira for most teams.

### Design Principles

1. **Tasks live in plans** - Create tasks directly from plan sections
2. **Two-way sync** - Update plan → tasks update, update task → plan updates
3. **Rich metadata** - Assignees, due dates, labels, priorities, estimates
4. **Automation** - Auto-create tasks from plan sections using AI

### Data Model

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,

    -- Task content
    title TEXT NOT NULL,
    description TEXT,                    -- Markdown
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Assignment
    assignee_id UUID,                    -- Who's working on it
    reporter_id UUID,                    -- Who created it

    -- Scheduling
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    estimate_hours DECIMAL(5,2),         -- Time estimate
    actual_hours DECIMAL(5,2),           -- Time tracked

    -- Status
    status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, review, done, blocked
    priority TEXT DEFAULT 'medium',      -- low, medium, high, urgent

    -- Organization
    milestone_id UUID,                   -- Link to milestone
    parent_task_id UUID,                 -- Subtasks
    tags TEXT[],

    -- Plan integration
    plan_id TEXT,                        -- Which plan created this task
    plan_section TEXT,                   -- Which section (heading text)
    plan_anchor JSONB,                   -- Exact position in plan

    -- Completion
    completed_at TIMESTAMPTZ,
    completed_by UUID,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX idx_tasks_plan ON tasks(plan_id);
```

### Milestones Schema (Enhanced)

```sql
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,

    title TEXT NOT NULL,
    description TEXT,

    -- Timeline
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Progress (computed from tasks)
    total_tasks INT DEFAULT 0,
    completed_tasks INT DEFAULT 0,
    progress_percent DECIMAL(5,2) DEFAULT 0,

    -- Organization
    status TEXT DEFAULT 'active',        -- active, completed, cancelled
    color TEXT DEFAULT '#3182ce',        -- For UI

    -- Plan integration
    plan_id TEXT,                        -- Which plan defines this milestone

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```

### Creating Tasks from Plans

#### Method 1: Manual Creation

**UI:** Highlight text in plan, right-click → "Create Task"

```typescript
// src/components/plans/PlanViewer.tsx

const handleCreateTask = async (selectedText: string, anchor: TextAnchor) => {
  const task = await invoke('create_task', {
    workspaceId: workspace.id,
    title: selectedText.substring(0, 100), // First 100 chars
    description: selectedText,
    planId: plan.id,
    planSection: getCurrentHeading(),
    planAnchor: anchor,
  });

  toast({
    title: 'Task created',
    description: `Created task: ${task.title}`,
  });
};
```

#### Method 2: AI Auto-Generation

**Feature:** Parse plan markdown and generate tasks automatically

```typescript
// When user clicks "Generate Tasks from Plan"
const tasks = await invoke('ai_generate_tasks_from_plan', {
  planId: 'github/collaborator-management',
  sections: ['Phase 1: Backend', 'Phase 2: Frontend'],
});

// AI reads headings and creates tasks:
// ✅ Extend GitHubClient with collaborator methods
// ✅ Create Tauri commands
// ✅ Add TypeScript types
// etc.
```

**Backend (Rust + Claude API):**

```rust
#[tauri::command]
pub async fn ai_generate_tasks_from_plan(
    plan_id: String,
    sections: Vec<String>,
) -> Result<Vec<Task>, String> {
    // Read plan file
    let plan_content = std::fs::read_to_string(get_plan_path(&plan_id))?;

    // Extract specified sections
    let sections_content = extract_sections(&plan_content, &sections)?;

    // Call Claude API to generate tasks
    let prompt = format!(
        "Extract actionable tasks from this implementation plan. \
         Return JSON array of tasks with title, description, estimate_hours.\n\n{}",
        sections_content
    );

    let response = claude_client.generate(prompt).await?;
    let tasks: Vec<TaskSpec> = serde_json::from_str(&response)?;

    // Create tasks in database
    let mut created_tasks = Vec::new();
    for task_spec in tasks {
        let task = cloud_client.create_task(workspace_id, task_spec).await?;
        created_tasks.push(task);
    }

    Ok(created_tasks)
}
```

### Task UI Components

#### Kanban Board

```typescript
// src/components/tasks/TaskBoard.tsx

export const TaskBoard: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadTasks();
  }, [workspaceId]);

  const loadTasks = async () => {
    const data = await invoke('get_workspace_tasks', { workspaceId });
    setTasks(data);
  };

  const columns = [
    { id: 'todo', title: 'To Do' },
    { id: 'in_progress', title: 'In Progress' },
    { id: 'review', title: 'Review' },
    { id: 'done', title: 'Done' },
  ];

  return (
    <HStack spacing={4} align="start">
      {columns.map((column) => (
        <Box key={column.id} minW="300px">
          <Heading size="sm" mb={3}>{column.title}</Heading>
          <VStack spacing={2}>
            {tasks
              .filter((t) => t.status === column.id)
              .map((task) => (
                <TaskCard key={task.id} task={task} onUpdate={loadTasks} />
              ))}
          </VStack>
        </Box>
      ))}
    </HStack>
  );
};
```

#### Task Card

```typescript
interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate }) => {
  const handleStatusChange = async (newStatus: string) => {
    await invoke('update_task_status', {
      taskId: task.id,
      status: newStatus,
    });
    onUpdate();
  };

  return (
    <Box
      borderWidth={1}
      borderRadius="md"
      p={3}
      bg="white"
      _dark={{ bg: 'gray.800' }}
      cursor="pointer"
      onClick={() => openTaskDetail(task)}
    >
      <HStack justify="space-between" mb={2}>
        <Badge colorScheme={getPriorityColor(task.priority)}>
          {task.priority}
        </Badge>
        {task.assignee && (
          <Avatar size="xs" src={task.assignee.avatar_url} />
        )}
      </HStack>

      <Text fontWeight="medium" fontSize="sm" mb={1}>
        {task.title}
      </Text>

      {task.due_date && (
        <Text fontSize="xs" color="gray.600">
          Due {formatDate(task.due_date)}
        </Text>
      )}

      {task.tags && task.tags.length > 0 && (
        <HStack spacing={1} mt={2}>
          {task.tags.map((tag) => (
            <Badge key={tag} size="sm" variant="subtle">
              {tag}
            </Badge>
          ))}
        </HStack>
      )}
    </Box>
  );
};
```

### Syncing Tasks ↔ Plans

**Challenge:** Keep tasks in sync with plan content

**Solution:** Two-way binding

#### Direction 1: Plan Changes → Update Tasks

**Trigger:** User edits plan section that has linked tasks

```typescript
// Detect plan edits
fileWatcher.on('change', async (planPath) => {
  const planId = getPlanIdFromPath(planPath);
  const linkedTasks = await invoke('get_tasks_by_plan', { planId });

  if (linkedTasks.length > 0) {
    // Show notification
    toast({
      title: 'Plan updated',
      description: `${linkedTasks.length} linked tasks may be affected`,
      action: 'Review Tasks',
    });
  }
});
```

#### Direction 2: Task Updates → Annotate Plan

**Feature:** Show task status in plan as badges

```markdown
## Phase 1: Backend

- [✅ Done] Extend GitHubClient with collaborator methods
- [🚧 In Progress] Create Tauri commands
- [📝 To Do] Add TypeScript types
```

**Implementation:** Inject task status into rendered markdown

```typescript
// src/components/plans/PlanRenderer.tsx

const enrichWithTaskStatus = (markdown: string, tasks: Task[]): string => {
  for (const task of tasks) {
    if (!task.plan_anchor) continue;

    // Find task's anchor position in markdown
    const { line, text } = task.plan_anchor;

    // Inject status badge
    const statusEmoji = getStatusEmoji(task.status);
    const statusText = `[${statusEmoji} ${task.status}]`;

    markdown = markdown.replace(
      text,
      `${statusText} ${text}`
    );
  }

  return markdown;
};
```

---

## 7. Feature 4: Milestone-Task Linking

### Problem Statement

**Today:** Milestones are just dates with titles. No connection to actual work (tasks).

**Goal:** Milestones automatically track progress based on linked tasks.

### Enhanced Milestone Model

```typescript
interface Milestone {
  id: string;
  title: string;
  description: string;

  // Timeline
  start_date: string;
  due_date: string;
  completed_at: string | null;

  // Progress (computed)
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  progress_percent: number;

  // Estimates
  total_estimate_hours: number;
  total_actual_hours: number;

  // Health metrics
  is_at_risk: boolean;              // Due soon with low progress
  days_until_due: number;
  velocity: number;                 // Tasks completed per day
  projected_completion_date: string;
}
```

### Auto-Calculating Progress

**Trigger:** When task status changes

```rust
// src-cloud/src/milestones.rs

pub async fn recalculate_milestone_progress(
    db: &PgPool,
    milestone_id: Uuid,
) -> Result<Milestone, Error> {
    // Get all tasks for milestone
    let tasks = sqlx::query_as!(
        Task,
        "SELECT * FROM tasks WHERE milestone_id = $1",
        milestone_id
    )
    .fetch_all(db)
    .await?;

    // Calculate metrics
    let total_tasks = tasks.len() as i32;
    let completed_tasks = tasks.iter().filter(|t| t.status == "done").count() as i32;
    let in_progress_tasks = tasks.iter().filter(|t| t.status == "in_progress").count() as i32;
    let blocked_tasks = tasks.iter().filter(|t| t.status == "blocked").count() as i32;

    let progress_percent = if total_tasks > 0 {
        (completed_tasks as f64 / total_tasks as f64) * 100.0
    } else {
        0.0
    };

    let total_estimate_hours: f64 = tasks.iter()
        .filter_map(|t| t.estimate_hours)
        .sum();

    let total_actual_hours: f64 = tasks.iter()
        .filter_map(|t| t.actual_hours)
        .sum();

    // Update milestone
    sqlx::query!(
        "UPDATE milestones
         SET total_tasks = $1,
             completed_tasks = $2,
             progress_percent = $3,
             updated_at = NOW()
         WHERE id = $4",
        total_tasks,
        completed_tasks,
        progress_percent,
        milestone_id
    )
    .execute(db)
    .await?;

    Ok(get_milestone(db, milestone_id).await?)
}
```

### Milestone Health Indicators

**At-Risk Detection:**

```rust
pub fn is_milestone_at_risk(milestone: &Milestone) -> bool {
    let days_until_due = milestone.days_until_due();
    let progress = milestone.progress_percent;

    // If less than 7 days left and less than 70% done
    if days_until_due < 7 && progress < 70.0 {
        return true;
    }

    // If overdue
    if days_until_due < 0 {
        return true;
    }

    // If velocity suggests won't finish on time
    let tasks_remaining = milestone.total_tasks - milestone.completed_tasks;
    let estimated_days_to_complete = tasks_remaining as f64 / milestone.velocity;

    if estimated_days_to_complete > days_until_due as f64 {
        return true;
    }

    false
}
```

### Milestone UI

```typescript
// src/components/milestones/MilestoneCard.tsx

export const MilestoneCard: React.FC<{ milestone: Milestone }> = ({ milestone }) => {
  return (
    <Box borderWidth={1} borderRadius="md" p={4}>
      <HStack justify="space-between" mb={2}>
        <Heading size="md">{milestone.title}</Heading>
        {milestone.is_at_risk && (
          <Badge colorScheme="red">At Risk</Badge>
        )}
      </HStack>

      <Progress
        value={milestone.progress_percent}
        colorScheme={milestone.progress_percent >= 70 ? 'green' : 'yellow'}
        mb={3}
      />

      <HStack spacing={6} fontSize="sm" color="gray.600">
        <Text>
          {milestone.completed_tasks} / {milestone.total_tasks} tasks
        </Text>
        <Text>
          Due {formatDate(milestone.due_date)} ({milestone.days_until_due} days)
        </Text>
        {milestone.velocity > 0 && (
          <Text>
            Velocity: {milestone.velocity.toFixed(1)} tasks/day
          </Text>
        )}
      </HStack>

      {milestone.projected_completion_date && (
        <Text fontSize="sm" mt={2} color="orange.600">
          Projected finish: {formatDate(milestone.projected_completion_date)}
        </Text>
      )}
    </Box>
  );
};
```

---

## 8. Feature 5: Activity Feeds & Notifications

### Activity Log

**Track all changes across workspace:**

```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,

    -- Who did it
    actor_id UUID NOT NULL,
    actor_username TEXT NOT NULL,
    actor_avatar_url TEXT,

    -- What happened
    action_type TEXT NOT NULL,           -- "task_created", "comment_added", "plan_edited", etc.
    entity_type TEXT NOT NULL,           -- "task", "comment", "plan", "milestone"
    entity_id TEXT NOT NULL,

    -- Details
    summary TEXT NOT NULL,               -- Human-readable description
    metadata JSONB,                      -- Action-specific data

    -- When
    created_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_workspace ON activity_log(workspace_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
```

**Example entries:**

```json
[
  {
    "actor": "alice",
    "action_type": "task_created",
    "entity_type": "task",
    "entity_id": "uuid-123",
    "summary": "alice created task: Extend GitHubClient with collaborator methods",
    "metadata": {
      "task_title": "Extend GitHubClient with collaborator methods",
      "assignee": "bob",
      "milestone": "Phase 1: Backend"
    },
    "created_at": "2025-12-21T10:30:00Z"
  },
  {
    "actor": "bob",
    "action_type": "plan_edited",
    "entity_type": "plan",
    "entity_id": "github/collaborator-management",
    "summary": "bob edited plan: GitHub Collaborator Management",
    "metadata": {
      "lines_added": 15,
      "lines_removed": 3,
      "sections_changed": ["Implementation Plan"]
    },
    "created_at": "2025-12-21T11:15:00Z"
  }
]
```

### Notifications

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- What happened
    type TEXT NOT NULL,                  -- "mention", "task_assigned", "comment_reply", etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT,                           -- Deep link to entity

    -- Status
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    -- Origin
    activity_log_id UUID,                -- Link to activity that triggered this

    created_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (activity_log_id) REFERENCES activity_log(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
```

### Real-Time Push via WebSocket

```rust
// When activity happens, broadcast notification
pub async fn notify_users(
    ws_state: &WebSocketState,
    user_ids: Vec<Uuid>,
    notification: Notification,
) {
    for user_id in user_ids {
        if let Some(connection) = ws_state.get_user_connection(&user_id) {
            let msg = serde_json::to_string(&notification).unwrap();
            let _ = connection.send(Message::Text(msg)).await;
        }
    }
}
```

### Desktop Notifications

```rust
// src-tauri/src/notifications.rs
use tauri::api::notification::Notification as TauriNotification;

#[tauri::command]
pub fn show_desktop_notification(title: String, body: String) {
    TauriNotification::new("com.bluekit.app")
        .title(&title)
        .body(&body)
        .show()
        .ok();
}
```

**Frontend:**

```typescript
// Listen for notifications via WebSocket
socket.on('notification', (notification: Notification) => {
  // Show in-app notification
  toast({
    title: notification.title,
    description: notification.content,
    duration: 5000,
  });

  // Show desktop notification (if enabled)
  invoke('show_desktop_notification', {
    title: notification.title,
    body: notification.content,
  });
});
```

---

## 9. Integration Strategy

### Should BlueKit Integrate or Build Native?

**Decision Matrix:**

| Feature | Build Native | Integrate | Rationale |
|---------|--------------|-----------|-----------|
| **Collaboration** | ✅ Build | ❌ | Core differentiator, must be seamless |
| **Comments** | ✅ Build | ❌ | Deeply tied to plans, needs real-time |
| **Tasks** | ✅ Build | 🤔 Optional | Most teams can use native, power users want Jira |
| **Milestones** | ✅ Build | ❌ | Simple enough to build, tight integration needed |
| **Git sync** | ❌ | ✅ Integrate | Git is proven, don't reinvent |
| **CI/CD** | ❌ | ✅ Integrate | GitHub Actions, CircleCI already great |

### Integration Options

#### Option 1: GitHub Issues/Projects Integration

**Use case:** Team already uses GitHub, wants tasks synced

**Implementation:**

```rust
// Two-way sync: BlueKit tasks ↔ GitHub issues

#[tauri::command]
pub async fn sync_tasks_with_github(
    workspace_id: String,
    github_repo: String,
) -> Result<SyncReport, String> {
    let cloud_client = CloudClient::from_session()?;
    let github_client = GitHubClient::from_keychain()?;

    // Get BlueKit tasks
    let bluekit_tasks = cloud_client.get_workspace_tasks(&workspace_id).await?;

    // Get GitHub issues
    let (owner, repo) = parse_repo(&github_repo)?;
    let github_issues = github_client.list_issues(&owner, &repo).await?;

    let mut created = 0;
    let mut updated = 0;

    for task in bluekit_tasks {
        // Check if task has GitHub issue ID
        if let Some(github_issue_id) = task.github_issue_id {
            // Update existing issue
            github_client.update_issue(&owner, &repo, github_issue_id, &task).await?;
            updated += 1;
        } else {
            // Create new issue
            let issue = github_client.create_issue(&owner, &repo, &task).await?;

            // Save issue ID in BlueKit task
            cloud_client.update_task_metadata(&task.id, json!({
                "github_issue_id": issue.number,
                "github_url": issue.html_url,
            })).await?;
            created += 1;
        }
    }

    Ok(SyncReport { created, updated })
}
```

**Pros:**
- ✅ Leverages existing GitHub investment
- ✅ Engineers already know GitHub Issues
- ✅ No migration needed

**Cons:**
- ❌ GitHub Issues UI is clunky
- ❌ Sync delays/conflicts
- ❌ Requires internet

#### Option 2: Jira Integration

**Use case:** Enterprise team with existing Jira workflows

```rust
// Similar to GitHub integration
#[tauri::command]
pub async fn sync_tasks_with_jira(
    workspace_id: String,
    jira_project_key: String,
) -> Result<SyncReport, String> {
    let jira_client = JiraClient::from_credentials()?;
    // Similar sync logic
}
```

**Pros:**
- ✅ Jira is enterprise standard
- ✅ Advanced workflow automation
- ✅ Rich reporting

**Cons:**
- ❌ Expensive ($7-14/user/month)
- ❌ Slow, heavyweight UI
- ❌ Sync complexity

#### Option 3: Native Only (Recommended)

**Build BlueKit's own task system, offer exports:**

```rust
// One-way export to GitHub/Jira
#[tauri::command]
pub async fn export_tasks_to_github(
    workspace_id: String,
    github_repo: String,
) -> Result<ExportReport, String> {
    // Creates issues in GitHub but doesn't sync back
    // BlueKit remains source of truth
}
```

**Pros:**
- ✅ Full control over UX
- ✅ No sync conflicts
- ✅ Works offline
- ✅ Simple architecture

**Cons:**
- ❌ Teams can't use existing Jira workflows
- ❌ Requires migration for existing users

**Recommended Strategy:**

1. **Phase 1:** Build native task system (80% use case)
2. **Phase 2:** Add one-way exports (GitHub/Jira)
3. **Phase 3:** Add two-way sync for enterprise (if demand exists)

---

## 10. File Format & Data Model

### Hybrid Storage Strategy

**Local files (`.bluekit/`):**
- `plan.md` - Markdown content
- `metadata.json` - Comments, tasks (exported snapshot)

**Cloud database:**
- Real-time comments, tasks, activity log
- Synced to local `metadata.json` every 5 minutes

### metadata.json Format

```json
{
  "version": "1.0",
  "plan_id": "github/collaborator-management",
  "last_synced_at": "2025-12-21T10:30:00Z",

  "comments": [
    {
      "id": "uuid-1",
      "author": "alice",
      "content": "Why Yjs over Automerge?",
      "anchor": {
        "type": "selection",
        "startLine": 42,
        "text": "We should use Yjs"
      },
      "created_at": "2025-12-21T09:00:00Z",
      "replies": [
        {
          "id": "uuid-2",
          "author": "bob",
          "content": "Yjs has better docs",
          "created_at": "2025-12-21T09:05:00Z"
        }
      ]
    }
  ],

  "tasks": [
    {
      "id": "uuid-3",
      "title": "Extend GitHubClient with collaborator methods",
      "status": "in_progress",
      "assignee": "bob",
      "due_date": "2025-12-28",
      "created_at": "2025-12-20T10:00:00Z"
    }
  ],

  "milestones": [
    {
      "id": "uuid-4",
      "title": "Phase 1: Backend",
      "progress_percent": 45.0,
      "total_tasks": 20,
      "completed_tasks": 9,
      "due_date": "2026-01-15"
    }
  ]
}
```

**This file is committed to git for backup/portability**

---

## 11. Real-Time Sync Architecture

### Cloud Infrastructure

**Tech Stack:**

- **Backend:** Rust + Axum (HTTP + WebSocket)
- **Database:** PostgreSQL (primary data)
- **Cache:** Redis (real-time state, presence)
- **File Storage:** S3 (plan snapshots)
- **Search:** Meilisearch (full-text search)

### WebSocket Protocol

**Connection Flow:**

```
1. Desktop app connects: ws://api.bluekit.dev/ws?token=jwt_token
2. Server authenticates JWT
3. Server sends initial state (workspaces, plans, tasks)
4. Client subscribes to workspace: { "type": "subscribe", "workspace_id": "uuid" }
5. Server broadcasts all updates to subscribed clients
```

**Message Types:**

```typescript
// Client → Server
type ClientMessage =
  | { type: 'subscribe'; workspace_id: string }
  | { type: 'unsubscribe'; workspace_id: string }
  | { type: 'ping' }
  | { type: 'cursor_move'; plan_id: string; position: Position }

// Server → Client
type ServerMessage =
  | { type: 'plan_updated'; plan_id: string; content: string }
  | { type: 'comment_added'; comment: Comment }
  | { type: 'task_updated'; task: Task }
  | { type: 'notification'; notification: Notification }
  | { type: 'presence_update'; users: User[] }
```

### Handling Reconnects

```rust
// src-tauri/src/sync/websocket.rs

pub struct WebSocketClient {
    url: String,
    connection: Option<WebSocket>,
    reconnect_attempts: u32,
}

impl WebSocketClient {
    pub async fn connect_with_retry(&mut self) -> Result<(), String> {
        let mut backoff = 1000; // Start with 1 second

        loop {
            match self.try_connect().await {
                Ok(_) => {
                    self.reconnect_attempts = 0;
                    return Ok(());
                }
                Err(e) if self.reconnect_attempts < 5 => {
                    tracing::warn!("Connection failed, retrying in {}ms: {}", backoff, e);
                    tokio::time::sleep(Duration::from_millis(backoff)).await;

                    self.reconnect_attempts += 1;
                    backoff *= 2; // Exponential backoff
                }
                Err(e) => {
                    return Err(format!("Failed to connect after 5 attempts: {}", e));
                }
            }
        }
    }
}
```

---

## 12. Permission & Access Control

### Role-Based Access (RBAC)

```sql
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL,                  -- owner, admin, member, viewer
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, user_id)
);
```

**Permission Matrix:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View plans | ✅ | ✅ | ✅ | ✅ |
| Edit plans | ✅ | ✅ | ✅ | ❌ |
| Create tasks | ✅ | ✅ | ✅ | ❌ |
| Assign tasks | ✅ | ✅ | ✅ | ❌ |
| Delete tasks | ✅ | ✅ | ✅ (own) | ❌ |
| Add members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |

---

## 13. Offline-First Strategy

### Core Principle

**"App must work 100% offline, sync when online"**

### Implementation

#### 1. Local SQLite Cache

```rust
// src-tauri/src/cache/mod.rs

pub struct LocalCache {
    db: SqliteConnection,
}

impl LocalCache {
    pub async fn cache_workspace(&self, workspace: &Workspace) -> Result<(), Error> {
        sqlx::query!(
            "INSERT OR REPLACE INTO cached_workspaces (id, data, cached_at)
             VALUES (?, ?, ?)",
            workspace.id,
            serde_json::to_string(workspace)?,
            Utc::now()
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn get_workspace(&self, id: &str) -> Result<Option<Workspace>, Error> {
        let row = sqlx::query!(
            "SELECT data FROM cached_workspaces WHERE id = ?",
            id
        )
        .fetch_optional(&self.db)
        .await?;

        match row {
            Some(r) => Ok(serde_json::from_str(&r.data)?),
            None => Ok(None),
        }
    }
}
```

#### 2. Pending Changes Queue

```sql
CREATE TABLE pending_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,           -- "task", "comment", "plan"
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,             -- "create", "update", "delete"
    data TEXT NOT NULL,                  -- JSON payload
    created_at INTEGER NOT NULL,
    synced BOOLEAN DEFAULT 0
);
```

**When offline:**
- User creates task → saved to local SQLite + added to pending_changes
- User edits plan → saved to local file + added to pending_changes

**When reconnected:**
```rust
pub async fn sync_pending_changes(&self) -> Result<SyncReport, Error> {
    let changes = self.get_unsynced_changes().await?;

    for change in changes {
        match self.apply_change_to_cloud(&change).await {
            Ok(_) => {
                // Mark as synced
                self.mark_synced(change.id).await?;
            }
            Err(e) => {
                tracing::error!("Failed to sync change {}: {}", change.id, e);
                // Will retry next time
            }
        }
    }

    Ok(SyncReport { synced: changes.len() })
}
```

#### 3. Conflict Resolution

**Last-Write-Wins (LWW) for simple data:**
- Task assignments, status changes
- Comment edits

**Operational Transform for rich text:**
- Plan content (using Yjs)

---

## 14. Implementation Roadmap

### Phase 1: Foundation (3 months)

**Milestone:** Multi-user awareness (no editing)

- [ ] Cloud backend setup (Axum + PostgreSQL + WebSocket)
- [ ] User authentication (JWT tokens)
- [ ] Workspace membership system
- [ ] WebSocket connection from desktop app
- [ ] Presence indicators (who's viewing)
- [ ] Activity feed (read-only)

**Deliverable:** See who else is viewing plans in real-time

---

### Phase 2: Collaboration (3 months)

**Milestone:** Comments & discussions

- [ ] Comment data model & API
- [ ] Comment UI components
- [ ] Thread/reply system
- [ ] Mentions (@username)
- [ ] Reactions (emoji)
- [ ] Notifications (in-app + desktop)
- [ ] Export comments to metadata.json

**Deliverable:** Teams can discuss plans inline without Slack

---

### Phase 3: Editing (4 months)

**Milestone:** Real-time collaborative editing

- [ ] Integrate Yjs for CRDT
- [ ] Build collaborative markdown editor
- [ ] Cursor presence
- [ ] Conflict-free merging
- [ ] File save debouncing
- [ ] Git auto-commit on saves

**Deliverable:** Google Docs-style editing for plans

---

### Phase 4: Task Management (4 months)

**Milestone:** Native task system

- [ ] Task data model & API
- [ ] Task creation UI
- [ ] Kanban board view
- [ ] Task assignment & status
- [ ] AI task generation from plans
- [ ] Task-plan linking
- [ ] Export to GitHub Issues/Jira

**Deliverable:** Teams can manage projects without Jira

---

### Phase 5: Milestones (2 months)

**Milestone:** Progress tracking

- [ ] Enhanced milestone model
- [ ] Milestone-task linking
- [ ] Progress auto-calculation
- [ ] At-risk detection
- [ ] Burndown charts
- [ ] Velocity tracking

**Deliverable:** Full project visibility

---

### Phase 6: Offline & Scaling (3 months)

**Milestone:** Production-ready

- [ ] Offline-first architecture
- [ ] Local SQLite cache
- [ ] Pending changes queue
- [ ] Auto-sync on reconnect
- [ ] Conflict resolution UI
- [ ] Performance optimization
- [ ] Load testing (1000+ concurrent users)

**Deliverable:** Enterprise-grade reliability

---

## 15. Cost Analysis & Pricing Model

### Infrastructure Costs

**Estimated monthly costs (AWS):**

| Service | Cost | Notes |
|---------|------|-------|
| EC2 (t3.large) | $60 | App server |
| RDS PostgreSQL (db.t3.medium) | $100 | Database |
| ElastiCache Redis (t3.micro) | $15 | Real-time state |
| S3 | $5 | File snapshots |
| CloudFront (CDN) | $10 | Asset delivery |
| Route53 | $1 | DNS |
| **Total** | **$191/mo** | ~1000 users |

**At scale (10,000 users):**
- Load balancer: +$30
- Larger instances: +$300
- Monitoring (DataDog): +$100
- **Total:** ~$621/mo

**Per-user cost:** $0.06/user/month at scale

---

### Pricing Model

**Freemium with Team Plans:**

#### Free Tier
- ✅ 1 personal workspace
- ✅ Unlimited local plans
- ✅ Basic markdown viewing
- ❌ No collaboration features

#### Team Plan: $10/user/month
- ✅ Unlimited workspaces
- ✅ Real-time collaboration
- ✅ Comments & discussions
- ✅ Task management (unlimited)
- ✅ Milestones & progress tracking
- ✅ Activity feed
- ✅ Up to 50 users per workspace

#### Enterprise Plan: $25/user/month
- ✅ Everything in Team
- ✅ Advanced permissions (RBAC)
- ✅ SSO (SAML, OAuth)
- ✅ Audit logs
- ✅ Priority support
- ✅ Custom integrations
- ✅ Dedicated account manager
- ✅ SLA guarantee (99.9% uptime)

**Target:** 1,000 paying users = $10,000 MRR = $120k ARR

---

## Summary

### What This Enables

✅ **Real-time collaboration** - Multiple people editing plans simultaneously
✅ **Inline discussions** - Comments, mentions, threads without Slack
✅ **Native task management** - Jira alternative for most teams
✅ **Milestone tracking** - Auto-calculated progress from tasks
✅ **Activity awareness** - See who's doing what in real-time
✅ **Offline-first** - Works without internet, syncs when available
✅ **File-based backup** - Everything exportable to git

### Build vs Buy Decision

| Feature | Build Native | Integrate | Decision |
|---------|--------------|-----------|----------|
| Collaboration (editing) | ✅ | ❌ | **Build** |
| Comments | ✅ | ❌ | **Build** |
| Tasks | ✅ | 🤔 | **Build + Export** |
| Git sync | ❌ | ✅ | **Integrate** |
| CI/CD | ❌ | ✅ | **Integrate** |

### Success Metrics

**Phase 1-2 (6 months):**
- 100 beta users trying collaboration features
- 10 teams actively using comments
- 80% positive feedback on UX

**Phase 3-4 (12 months):**
- 500 paying users ($5k MRR)
- 50 teams using native task management
- 5 teams migrated from Jira to BlueKit

**Phase 5-6 (18 months):**
- 1,000 paying users ($10k MRR)
- 99.9% uptime SLA achieved
- Enterprise customers (100+ users)

---

## Next Steps

1. **Validate hypothesis:** Survey 50 potential users about collaboration needs
2. **Build prototype:** Phase 1 (presence + activity feed) in 3 months
3. **Iterate:** Weekly user testing, adjust based on feedback
4. **Scale:** Once product-market fit confirmed, invest in infrastructure

**The vision:** BlueKit becomes the default way developer teams plan, collaborate, and track work—without leaving their desktop app or losing the file-based simplicity they love.
