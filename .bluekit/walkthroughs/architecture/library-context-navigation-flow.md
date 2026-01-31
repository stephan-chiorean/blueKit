---
id: context-navigation-flow
alias: Context Navigation Flow
type: walkthrough
is_base: false
version: 2
tags:
  - tab-navigation
  - context-switching
  - state-restoration
description: Step-by-step guide to how BlueKit restores tabs and active tab state when navigating between contexts (library and projects)
complexity: comprehensive
format: guide
---

# Context Navigation Flow

## Overview

This walkthrough explains exactly what happens when navigating between contexts (library ↔ projects), including how tabs are loaded from disk, which tab becomes active, and why.

**Key insight:** Each context has its own `tabs.json` file that persists its tabs and last active tab ID.

## File Locations

### Library Context (Vault Project)
- **Context key:** `project:<vault-id>` (e.g., `project:db377353-6ef9-460a-8e4a-6de077bc6983`)
- **File location:** `<vault-project-path>/.bluekit/workspace/tabs.json`
- **Example:** `/Users/stephanchiorean/Documents/projects/Vault-tec/.bluekit/workspace/tabs.json`

### Regular Project Context
- **Context key:** `project:<project-id>` (e.g., `project:1763859627143`)
- **File location:** `<project-path>/.bluekit/workspace/tabs.json`
- **Example:** `/Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/.bluekit/workspace/tabs.json`

## Scenario 1: Navigate to Library (Vault)

### Initial State: Library's tabs.json

**File:** `/Users/stephanchiorean/Documents/projects/Vault-tec/.bluekit/workspace/tabs.json`

```json
{
  "schemaVersion": "bluekit.tabs.v2",
  "updatedAt": "2026-01-31T14:40:58.749Z",
  "activeContext": "project:db377353-6ef9-460a-8e4a-6de077bc6983",
  "contexts": {
    "project:db377353-6ef9-460a-8e4a-6de077bc6983": {
      "activeTabId": "tab_b8a997e1",
      "tabs": [
        {
          "id": "tab_b8a997e1",
          "type": "project",
          "title": "Projects",
          "icon": "folder",
          "resource": {
            "projectId": "db377353-6ef9-460a-8e4a-6de077bc6983",
            "view": "projects"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T14:30:38.316Z"
        },
        {
          "id": "tab_a99ccd72",
          "type": "project",
          "title": "File Browser",
          "icon": "project",
          "resource": {
            "projectId": "db377353-6ef9-460a-8e4a-6de077bc6983",
            "path": "/Users/stephanchiorean/Documents/projects/Vault-tec",
            "view": "file"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T14:31:41.497Z"
        },
        {
          "id": "tab_b3f63989",
          "type": "project",
          "title": "Workflows",
          "icon": "workflow",
          "resource": {
            "projectId": "db377353-6ef9-460a-8e4a-6de077bc6983",
            "view": "workflows"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T14:38:16.796Z"
        }
      ]
    }
  }
}
```

**Key details:**
- Context key: `"project:db377353-6ef9-460a-8e4a-6de077bc6983"`
- **Active tab ID from disk:** `"tab_b8a997e1"` (Projects tab - index 0)
- Total tabs: 3

### User Action: Navigate to Library

User triggers navigation to library context (via back arrow, clicking Library in sidebar, etc.). The specific trigger doesn't matter - all navigation goes through the same code path:

```typescript
openInNewTab({ type: 'library', view: 'projects' }, { title: 'New Tab' })
```

Or:

```typescript
openInCurrentTab({ type: 'library', view: 'projects' }, { title: 'New Tab' })
```

Both eventually call `switchContext('library')`.

### Execution Flow

#### Step 1: openInNewTab() Called

```typescript
const targetContext = getContextKey(resource);
// targetContext = "library"
```

#### Step 2: Context Switch Needed

```typescript
if (targetContext !== activeContext) {
  const switchResult = await switchContext(targetContext);
}
```

#### Step 3: switchContext('library') - Alias Resolution

```typescript
let targetContext = contextKey;
if (contextKey === "library") {
  const vaultId = await ensureVaultId();
  // vaultId = "db377353-6ef9-460a-8e4a-6de077bc6983"

  targetContext = `project:${vaultId}`;
  // targetContext = "project:db377353-6ef9-460a-8e4a-6de077bc6983"
}
```

**Console:**
```
[TabContext] Aliasing library -> project:db377353-6ef9-460a-8e4a-6de077bc6983
```

#### Step 4: readTabsFromDisk() - The Critical Function

```typescript
let contextTabs = await readTabsFromDisk(targetContext);
```

**Inside `readTabsFromDisk`:**

```typescript
// Get file path for vault project
const projectId = contextKey.replace("project:", "");
// projectId = "db377353-6ef9-460a-8e4a-6de077bc6983"

const projects = await invokeDbGetProjects();
const project = projects.find((p) => p.id === projectId);
// project.path = "/Users/stephanchiorean/Documents/projects/Vault-tec"

const filePath = path.join(project.path, ".bluekit", "workspace", "tabs.json");
// filePath = "/Users/stephanchiorean/Documents/projects/Vault-tec/.bluekit/workspace/tabs.json"

// Read file
const content = await invokeReadFile(filePath);
const data = JSON.parse(content);
const tabs = data.contexts?.[contextKey]?.tabs || [];

// ⚠️ CRITICAL ISSUE: activeTabId is RIGHT HERE but not extracted!
// const activeTabId = data.contexts?.[contextKey]?.activeTabId; // "tab_b8a997e1" ← IGNORED!

return tabs.map((tab: TabState) => ({
  ...tab,
  resource: tab.resource ?? {},
  view: tab.view ?? {},
}));
```

**Returns:** Array of 3 TabState objects

**Does NOT return:** `activeTabId` from the file

#### Step 5: Determine Active Tab

```typescript
// Restore last active tab
const lastActiveTab = lastActiveTabByContext[targetContext];
// lastActiveTab could be:
// - undefined (first visit this session)
// - "tab_a99ccd72" (if user clicked File Browser tab before navigating away)
// - "tab_b8a997e1" (from app startup loadTabs)

const tabToActivate =
  lastActiveTab && contextTabs.some((t) => t.id === lastActiveTab)
    ? lastActiveTab
    : contextTabs[0]?.id;
```

**Scenarios:**

**Case A:** `lastActiveTab` is undefined
- Falls back to `contextTabs[0]?.id` = `"tab_b8a997e1"` ✅ (accidentally correct)

**Case B:** `lastActiveTab` = `"tab_a99ccd72"` (user clicked File Browser earlier)
- Uses `"tab_a99ccd72"` ❌ (ignores disk, which says `"tab_b8a997e1"`)

**Case C:** `lastActiveTab` = `"tab_b8a997e1"` (from app startup)
- Uses `"tab_b8a997e1"` ✅ (correct, but stale - not from current disk read)

### Result: Library Navigation

**Active tab:** Depends on in-memory `lastActiveTabByContext`, NOT the `activeTabId` from disk

---

## Scenario 2: Navigate to Project

### Initial State: Project's tabs.json

**File:** `/Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/.bluekit/workspace/tabs.json`

```json
{
  "schemaVersion": "bluekit.tabs.v2",
  "updatedAt": "2026-01-31T15:20:10.123Z",
  "activeContext": "project:1763859627143",
  "contexts": {
    "project:1763859627143": {
      "activeTabId": "tab_c7d9e2f1",
      "tabs": [
        {
          "id": "tab_a1b2c3d4",
          "type": "project",
          "title": "Projects",
          "icon": "folder",
          "resource": {
            "projectId": "1763859627143",
            "view": "projects"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T15:10:00.000Z"
        },
        {
          "id": "tab_b5c6d7e8",
          "type": "kit",
          "title": "API Authentication",
          "icon": "file",
          "resource": {
            "projectId": "1763859627143",
            "path": "/Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/.bluekit/kits/api-auth.md"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T15:12:30.000Z"
        },
        {
          "id": "tab_c7d9e2f1",
          "type": "project",
          "title": "Walkthroughs",
          "icon": "walkthrough",
          "resource": {
            "projectId": "1763859627143",
            "view": "walkthroughs"
          },
          "view": {},
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-31T15:15:45.000Z"
        }
      ]
    }
  }
}
```

**Key details:**
- Context key: `"project:1763859627143"`
- **Active tab ID from disk:** `"tab_c7d9e2f1"` (Walkthroughs tab - **index 2**)
- Total tabs: 3

### User Action: Navigate to BlueKit Project

User clicks on blueKit project card:

```typescript
openInCurrentTab(
  { type: 'project', projectId: '1763859627143', view: 'projects' },
  { title: 'blueKit' }
)
```

### Execution Flow

#### Step 1: openInCurrentTab() Called

```typescript
const targetContext = getContextKey(resource);
// targetContext = "project:1763859627143"
```

#### Step 2: Cross-Context Navigation

```typescript
if (targetContext !== activeContext) {
  await switchContext(targetContext);
}
```

#### Step 3: switchContext('project:1763859627143')

No aliasing needed (not library):

```typescript
let targetContext = contextKey;
// targetContext = "project:1763859627143"
```

#### Step 4: readTabsFromDisk()

```typescript
const projectId = contextKey.replace("project:", "");
// projectId = "1763859627143"

const filePath = path.join(project.path, ".bluekit", "workspace", "tabs.json");
// filePath = "/Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/.bluekit/workspace/tabs.json"

const content = await invokeReadFile(filePath);
const data = JSON.parse(content);
const tabs = data.contexts?.[contextKey]?.tabs || [];

// ⚠️ CRITICAL: activeTabId is in the file but NOT extracted!
// const activeTabId = data.contexts?.[contextKey]?.activeTabId; // "tab_c7d9e2f1" ← IGNORED!

return tabs.map((tab: TabState) => ...);
```

#### Step 5: Determine Active Tab

```typescript
const lastActiveTab = lastActiveTabByContext[targetContext];
// If this is first visit this session: undefined

const tabToActivate =
  lastActiveTab && contextTabs.some((t) => t.id === lastActiveTab)
    ? lastActiveTab
    : contextTabs[0]?.id;
```

**First visit scenario:**
- `lastActiveTab` = `undefined`
- Falls back to `contextTabs[0]?.id` = `"tab_a1b2c3d4"` (Projects tab)
- **Expected from disk:** `"tab_c7d9e2f1"` (Walkthroughs tab) ❌

### Result: Project Navigation

**What happens:**
- File says: activate `"tab_c7d9e2f1"` (Walkthroughs - index 2)
- Code activates: `"tab_a1b2c3d4"` (Projects - index 0) ❌

**Why it SEEMS to work:**
- Most projects have their first tab as active in the file
- Fallback to `contextTabs[0]` accidentally matches the file
- Bug is masked!

---

## The Root Cause

### The Problem

`readTabsFromDisk()` reads the file but only extracts the `tabs` array, ignoring the `activeTabId` that's right next to it:

```typescript
// Current implementation
const tabs = data.contexts?.[contextKey]?.tabs || [];
// Missing line:
// const activeTabId = data.contexts?.[contextKey]?.activeTabId;

return tabs.map(...);
```

### Why lastActiveTabByContext is Unreliable

`lastActiveTabByContext` is **in-memory React state** that gets updated when:

1. **App startup** (`loadTabs`): Reads activeTabId from disk ✅
2. **User clicks a tab** (`setActiveTab`): Updates with clicked tab ⚠️
3. **Navigating back** (`switchContext`): Uses stale value ❌

**The flow:**
```
1. App starts → lastActiveTabByContext['project:vault-id'] = "tab_b8a997e1" (from disk)
2. User clicks tab 2 → lastActiveTabByContext['project:vault-id'] = "tab_a99ccd72" (overwritten!)
3. User navigates away
4. User navigates back → Uses "tab_a99ccd72" (stale in-memory value, not disk!)
```

### Why Projects Sometimes Work

1. First visit to a project this session
2. `lastActiveTabByContext['project:xyz']` = `undefined`
3. Falls back to `contextTabs[0]?.id`
4. If the project's file happens to have the first tab active → accidentally correct ✅
5. If the project's file has a different tab active → wrong tab activated ❌

---

## The Fix (Not Yet Implemented)

### Change `readTabsFromDisk` Return Type

```typescript
const readTabsFromDisk = useCallback(
  async (contextKey: string): Promise<{ tabs: TabState[]; activeTabId?: string }> => {
    // ... file reading logic ...

    const contextData = data.contexts?.[contextKey];
    const tabs = contextData?.tabs || [];
    const activeTabId = contextData?.activeTabId; // ← EXTRACT THIS

    return {
      tabs: tabs.map((tab: TabState) => ({
        ...tab,
        resource: tab.resource ?? {},
        view: tab.view ?? {},
      })),
      activeTabId, // ← RETURN THIS
    };
  }
);
```

### Update `switchContext` to Use It

```typescript
const { tabs: contextTabs, activeTabId: persistedActiveTabId } = await readTabsFromDisk(targetContext);

if (contextTabs.length > 0) {
  setTabsByContext((prev) => ({ ...prev, [targetContext]: contextTabs }));

  // Update lastActiveTabByContext with the value from disk
  if (persistedActiveTabId) {
    setLastActiveTabByContext((prev) => ({
      ...prev,
      [targetContext]: persistedActiveTabId,
    }));
  }
}

// ... rest of the function
```

---

## Summary: File Locations

| Context | File Location | Example |
|---------|--------------|---------|
| **Library (Vault)** | `<vault-project-path>/.bluekit/workspace/tabs.json` | `/Users/you/Documents/Vault-tec/.bluekit/workspace/tabs.json` |
| **Regular Project** | `<project-path>/.bluekit/workspace/tabs.json` | `/Users/you/Documents/projects/myApp/.bluekit/workspace/tabs.json` |

**Key takeaway:** Each context saves its tabs in its own project directory, NOT in a global location. The bug affects ALL contexts equally - it's just more noticeable in certain scenarios.
