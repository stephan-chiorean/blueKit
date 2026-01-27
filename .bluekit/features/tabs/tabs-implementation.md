# Tab-Based Navigation Implementation

## Overview

Transform BlueKit from page-based navigation to tab-based navigation where each tab maintains its own isolated context. Sidebar navigation modifies the **active tab's content** rather than replacing the entire view.

**Core Principle**: Tabs are independent workspaces. Navigating via sidebar changes what you're viewing in the current tab, not what tab you're on.

---

## Current vs. Target Architecture

### Current Architecture (Page-Based)

```
App
├── WelcomeScreen
├── HomePage
│   └── Sidebar changes entire view
└── ProjectDetailPage
    └── Sidebar changes entire view
```

**Navigation Flow**: Sidebar click → Replace entire page content

**Problem**: Can't maintain multiple contexts simultaneously. Clicking on a different project loses your place in the current one.

### Target Architecture (Tab-Based)

```
App
└── TabManager
    ├── Tab 1 (Project A - Kits view)
    │   └── Sidebar
    ├── Tab 2 (Project B - Walkthroughs view)
    │   └── Sidebar
    └── Tab 3 (Library - Home view)
        └── Sidebar
```

**Navigation Flow**: Sidebar click → Update active tab's content

**Benefit**: Multiple contexts preserved. Each tab is an independent workspace with its own navigation state.

---

## Architecture Changes Required

### 1. Introduce TabManager as Root Container

**Location**: `src/components/tabs/TabManager.tsx` (new file)

**Responsibilities**:
- Manages tab lifecycle (create, close, switch)
- Persists tab state to `.bluekit/workspace/tabs.json`
- Renders `BrowserTabs` component with content area
- Provides `TabContext` to child components

**Structure**:
```tsx
<TabManager>
  <BrowserTabs tabs={tabs} selectedId={activeTabId}>
    <TabContent tabId={activeTabId}>
      {/* Current tab's view renders here */}
      {renderTabContent(activeTab)}
    </TabContent>
  </BrowserTabs>
</TabManager>
```

### 2. Decouple Sidebar from Top-Level Navigation

**Current**: Sidebar directly changes route/page
```tsx
// Current: src/pages/ProjectDetailPage.tsx
<Sidebar onNavigate={(view) => setCurrentView(view)} />
```

**Target**: Sidebar updates active tab's resource
```tsx
// Target: All views
<Sidebar onNavigate={(resource) => updateActiveTabResource(resource)} />
```

**Key Change**: `onNavigate` receives a `TabResource` object instead of changing app-level state:

```typescript
interface TabResource {
  type: 'kit' | 'walkthrough' | 'blueprint' | 'project' | 'home';
  path?: string;  // File path for markdown/code
  projectId?: string;  // For project-specific views
  view?: string;  // For sub-views (e.g., 'tasks', 'plans')
}
```

### 3. Introduce TabContext for State Management

**Location**: `src/contexts/TabContext.tsx` (new file)

**Provides**:
```typescript
interface TabContextValue {
  tabs: Tab[];
  activeTabId: string;

  // Tab lifecycle
  createTab(resource: TabResource): void;
  closeTab(tabId: string): void;
  selectTab(tabId: string): void;
  updateTabResource(tabId: string, resource: TabResource): void;

  // Convenience
  openInNewTab(resource: TabResource): void;
  openInCurrentTab(resource: TabResource): void;

  // Persistence
  saveTabs(): Promise<void>;
  loadTabs(): Promise<void>;
}
```

**Tab State Shape** (matches `.bluekit/workspace/tabs.json` schema):
```typescript
interface Tab {
  id: string;  // "tab_a1b2"
  type: 'kit' | 'walkthrough' | 'blueprint' | 'project' | 'home';
  title: string;
  icon: string;
  resource: {
    path?: string;
    projectId?: string;
    view?: string;
  };
  view: {
    scrollTop?: number;
    cursor?: { line: number; ch: number };
  };
  pinned: boolean;
  dirty: boolean;
  closable: boolean;
  openedAt: string;
}
```

### 4. Component Hierarchy Refactor

**Before**:
```
App
├── WelcomeScreen (standalone)
├── HomePage (with sidebar)
└── ProjectDetailPage (with sidebar)
```

**After**:
```
App
└── TabManager
    └── BrowserTabs
        └── TabContent (active tab)
            ├── HomePage (when tab.type === 'home')
            ├── ProjectDetailPage (when tab.type === 'project')
            │   ├── KitsView (when tab.resource.view === 'kits')
            │   ├── WalkthroughsView (when tab.resource.view === 'walkthroughs')
            │   └── ...
            └── KitViewerPage (when tab.type === 'kit')
```

**Key Point**: Each tab renders the appropriate view based on its `type` and `resource` properties.

---

## Implementation Phases

### Phase 1: Core Tab Infrastructure (No Breaking Changes)

**Goal**: Add tab system without disrupting current navigation.

**Tasks**:
1. Create `TabManager.tsx` component
2. Create `TabContext.tsx` with state management
3. Create `TabContent.tsx` renderer component
4. Integrate with existing `BrowserTabs.tsx` component
5. Add `.bluekit/workspace/tabs.json` persistence layer
6. Create initial tab on app load (shows current view)

**Verification**: App works exactly as before, but now renders inside a single tab.

### Phase 2: Sidebar Integration

**Goal**: Make sidebar update tab content instead of app-level state.

**Tasks**:
1. Refactor `ProjectSidebar` to use `updateActiveTabResource()`
2. Refactor `Sidebar` (home view) to use `updateActiveTabResource()`
3. Add "Open in New Tab" context menu to sidebar items (Cmd+Click or right-click)
4. Update all navigation handlers in components to use TabContext

**Verification**:
- Clicking sidebar items updates active tab's content
- Cmd+clicking sidebar items opens new tab
- Tab titles update when navigating

### Phase 3: Multi-Project Tab Support

**Goal**: Allow tabs from different projects simultaneously.

**Tasks**:
1. Store `projectId` in tab resource
2. Update `ProjectDetailPage` to read project from tab context, not route
3. Remove project selection from HomePage (or make it open new tab)
4. Update project watcher to emit events with `projectId`
5. Ensure watchers run for all open projects

**Verification**:
- Can have Project A kit in Tab 1
- Can have Project B walkthrough in Tab 2
- Both projects' file watchers active
- Switching tabs shows correct project context

### Phase 4: Tab Persistence & Recovery

**Goal**: Restore tab state across app restarts.

**Tasks**:
1. Implement `saveTabs()` - write to `.bluekit/workspace/tabs.json`
2. Implement `loadTabs()` - read from file on startup
3. Add debounced auto-save on tab changes
4. Handle missing files gracefully (show error state in tab)
5. Add "Restore Last Session" option in welcome screen

**Verification**:
- Close app with 3 tabs open
- Reopen app → 3 tabs restored with correct content
- If file deleted, tab shows "Not Found" instead of crashing

### Phase 5: Advanced Tab Features

**Goal**: Polish tab UX.

**Tasks**:
1. Tab reordering (drag & drop)
2. Tab pinning (pinned tabs can't be closed)
3. "Close All Tabs" / "Close Other Tabs" actions
4. Tab groups/splits (for side-by-side viewing)
5. Tab search/switcher (Cmd+P to search open tabs)
6. Dirty state indicator (unsaved changes)

---

## Key Design Decisions

### 1. Sidebar Always Updates Active Tab

**Rule**: Sidebar navigation never changes which tab is active, only what's inside it.

**Exception**: Explicitly requesting "Open in New Tab" via Cmd+Click or context menu.

**Rationale**: Predictable behavior. Users know where content will appear.

### 2. Tabs Are View State, Not Content

**Tabs contain**:
- References to content (file paths, project IDs)
- UI state (scroll position, cursor)
- Metadata (title, icon, open timestamp)

**Tabs do NOT contain**:
- Actual file contents
- Execution state
- Semantic meaning

**Rationale**: Aligns with Tabs.md philosophy - tabs are "disposable memory."

### 3. Each Tab Has Independent Sidebar

**Not This** (shared sidebar):
```
┌─────────┬────────────────┐
│         │ Tab 1 │ Tab 2  │
│ Sidebar │                │
│         │    Content     │
└─────────┴────────────────┘
```

**This** (tab-scoped sidebar):
```
┌─ Tab 1 ─────────┬─ Tab 2 ─────────┐
│ Sidebar │ Content │ Sidebar │ Content │
```

**Why**: Each tab may be viewing different projects with different sidebar states.

**Implementation**: Sidebar state stored per-tab in `tab.resource`.

### 4. Default Tab Behavior

**On App Start**:
- If `tabs.json` exists → Restore tabs
- If `tabs.json` missing → Create default "Home" tab

**On "Close All Tabs"**:
- Cannot close last tab
- Last tab resets to "Home" view

**Why**: App always has at least one tab. Prevents "blank screen" state.

---

## Integration with Existing Components

### BrowserTabs Component

**Current Usage** (from `src/components/tabs/BrowserTabs.tsx`):
```tsx
<BrowserTabs
  tabs={tabs}
  selectedId={activeTabId}
  onSelect={(id) => selectTab(id)}
  onClose={(id) => closeTab(id)}
  colorMode={colorMode}
>
  {/* Content area */}
</BrowserTabs>
```

**Integration**:
- TabManager provides `tabs`, `selectedId`, handlers
- BrowserTabs renders UI + children (content area)
- No changes needed to BrowserTabs component itself ✓

### ProjectDetailPage

**Current**: Standalone page with internal navigation state

**Target**: Pure view component that reads from TabContext

**Changes**:
```tsx
// Before
function ProjectDetailPage() {
  const { projectId } = useParams();
  const [currentView, setCurrentView] = useState('kits');
  // ...
}

// After
function ProjectDetailPage() {
  const { activeTab } = useTabContext();
  const projectId = activeTab.resource.projectId;
  const currentView = activeTab.resource.view || 'kits';
  // No local state - reads from tab
}
```

### Sidebar Components

**Current**: Calls `setCurrentView()` or `navigate()`

**Target**: Calls `updateActiveTabResource()`

**Changes**:
```tsx
// Before
<SidebarItem onClick={() => setCurrentView('kits')}>
  Kits
</SidebarItem>

// After
<SidebarItem onClick={() => updateActiveTabResource({
  type: 'project',
  projectId: project.id,
  view: 'kits'
})}>
  Kits
</SidebarItem>
```

**New Feature**: Context menu for "Open in New Tab"
```tsx
<SidebarItem
  onClick={() => updateActiveTabResource(...)}
  onContextMenu={(e) => {
    e.preventDefault();
    showContextMenu([
      { label: 'Open in New Tab', onClick: () => openInNewTab(...) }
    ]);
  }}
>
```

---

## Persistence Implementation

### File Location

```
.bluekit/
  workspace/
    tabs.json        # Main tab state
    tabs.mobile.json # Optional: mobile-specific tabs
```

**Why `.bluekit/workspace/`**: Separates ephemeral UI state from durable content (kits, blueprints).

### Schema (from Tabs.md)

```json
{
  "schemaVersion": "bluekit.tabs.v1",
  "updatedAt": "2026-01-26T10:30:00Z",
  "activeTabId": "tab_a1b2",
  "groups": [
    {
      "id": "group_main",
      "direction": "vertical",
      "size": 1,
      "tabs": [
        {
          "id": "tab_a1b2",
          "type": "kit",
          "title": "useProjectKits Hook",
          "icon": "file",
          "resource": {
            "path": ".bluekit/kits/use-project-kits.md",
            "projectId": "bluekit-main"
          },
          "view": {
            "scrollTop": 240
          },
          "pinned": false,
          "dirty": false,
          "closable": true,
          "openedAt": "2026-01-26T10:15:00Z"
        }
      ]
    }
  ]
}
```

### Save Strategy

**Triggers** (debounced 500ms):
- Tab created
- Tab closed
- Tab selected
- Tab resource updated
- Tab reordered

**Implementation**:
```typescript
const saveTabs = debounce(async () => {
  const tabsData = {
    schemaVersion: 'bluekit.tabs.v1',
    updatedAt: new Date().toISOString(),
    activeTabId,
    groups: [{ id: 'group_main', direction: 'vertical', size: 1, tabs }]
  };

  await fs.writeFile(
    '.bluekit/workspace/tabs.json',
    JSON.stringify(tabsData, null, 2)
  );
}, 500);
```

**Never Block UI**: Save happens async, failures logged but not shown to user.

### Load Strategy

**On App Start**:
```typescript
async function loadTabs() {
  try {
    const content = await fs.readFile('.bluekit/workspace/tabs.json');
    const data = JSON.parse(content);

    if (data.schemaVersion !== 'bluekit.tabs.v1') {
      console.warn('Unsupported schema, resetting tabs');
      return createDefaultTab();
    }

    // Validate resources exist
    const validTabs = await validateTabs(data.groups[0].tabs);
    setTabs(validTabs);
    setActiveTabId(data.activeTabId);
  } catch {
    // File missing or corrupt → create default tab
    createDefaultTab();
  }
}
```

**Resource Validation**:
- Check if `resource.path` exists on disk
- If missing → mark tab with error state, don't crash
- User can close broken tab or navigate elsewhere

---

## Migration Path for Users

### Phase 1: Invisible Transition

**User Experience**: No visible changes. App works exactly as before.

**Behind the Scenes**: All views now render in a single "hidden" tab.

**Benefit**: Safe rollout. Can revert if issues found.

### Phase 2: Soft Launch

**User Experience**: Tab bar appears with single tab (current view).

**New Capability**: Can open new tabs via Cmd+Click on sidebar items.

**Benefit**: Users discover feature organically. Not forced to use it.

### Phase 3: Full Launch

**User Experience**: Multi-tab workflow encouraged in onboarding.

**New Capability**: Tab persistence across sessions.

**Benefit**: Power users adopt immediately. Casual users use single tab.

---

## Open Questions / Decisions Needed

### 1. How to Handle Route-Based Navigation?

**Option A**: Remove routes entirely, use only tabs
- **Pro**: Simpler architecture
- **Con**: Breaks browser back/forward

**Option B**: Keep routes, sync with active tab
- **Pro**: Back/forward button works
- **Con**: More complex state management

**Recommendation**: Start with Option A (no routes), add route sync later if requested.

### 2. Should Tabs Be Per-Workspace or Global?

**Per-Workspace**: `.bluekit/workspace/tabs.json` per project
- **Pro**: Tabs tied to project context
- **Con**: Can't have tabs from multiple projects

**Global**: `~/.bluekit/workspace/tabs.json` across all projects
- **Pro**: Multi-project tabs possible
- **Con**: Not versioned with project

**Recommendation**: **Global** to enable multi-project workflow (user's stated goal).

### 3. Should Tab State Be Committed to Git?

**Yes**:
- **Pro**: Team shares workspace layout
- **Con**: Merge conflicts, personal preferences forced on team

**No**:
- **Pro**: Personal, no conflicts
- **Con**: Can't share "interesting workspace" with colleagues

**Recommendation**: **No** by default (add to `.gitignore`), but document that users CAN commit if desired.

### 4. How to Handle Modified File State?

When a kit file is modified externally (via editor), should the tab:
- **Option A**: Auto-reload content (may lose scroll position)
- **Option B**: Show "File changed" indicator, require manual reload
- **Option C**: Show diff/merge UI

**Recommendation**: **Option B** for safety. BlueKit is a viewer, not an editor.

---

## Success Metrics

### Quantitative

1. **Tab Adoption**: % of sessions using 2+ tabs
2. **Multi-Project Usage**: % of sessions with tabs from different projects
3. **Session Restoration**: % of sessions restoring previous tabs
4. **Tab Lifespan**: Average time a tab stays open

### Qualitative

1. **Cognitive Clarity**: Does tab system reduce "where am I?" confusion?
2. **Workflow Speed**: Do users navigate faster with tabs?
3. **Persistence Value**: Do users rely on tab restoration?

---

## Implementation Checklist

### Core Infrastructure
- [ ] Create `TabManager.tsx` component
- [ ] Create `TabContext.tsx` with state management
- [ ] Create `TabContent.tsx` renderer
- [ ] Add tab persistence layer (save/load JSON)
- [ ] Integrate with `BrowserTabs` component

### Sidebar Integration
- [ ] Refactor `ProjectSidebar` to update tab resource
- [ ] Refactor `Sidebar` (home) to update tab resource
- [ ] Add "Open in New Tab" context menu
- [ ] Add Cmd+Click handler for new tabs
- [ ] Update all navigation handlers

### Multi-Project Support
- [ ] Store `projectId` in tab resource
- [ ] Remove project selection from route
- [ ] Update file watchers to track all open projects
- [ ] Test switching between project tabs

### Persistence & Recovery
- [ ] Implement debounced auto-save
- [ ] Implement load on startup
- [ ] Handle missing resources gracefully
- [ ] Add "Restore Last Session" option
- [ ] Test recovery after crash

### Polish
- [ ] Tab reordering (drag & drop)
- [ ] Tab pinning
- [ ] Close all/close others actions
- [ ] Tab search/switcher (Cmd+P)
- [ ] Dirty state indicators
- [ ] Tab tooltips (full path on hover)

### Testing
- [ ] Unit tests for TabContext
- [ ] Integration tests for sidebar → tab updates
- [ ] E2E tests for tab persistence
- [ ] Performance tests (10+ tabs open)
- [ ] Memory leak tests (tab churn)

### Documentation
- [ ] Update CLAUDE.md with tab architecture
- [ ] Add user guide for tabs
- [ ] Document keyboard shortcuts
- [ ] Add troubleshooting guide

---

## Conclusion

This tab system transforms BlueKit from a single-context tool to a multi-context workspace while maintaining architectural simplicity. The phased rollout ensures stability, and the design aligns with the "tabs as disposable memory" philosophy from Tabs.md.

**Key Insight**: By severing the coupling between sidebar and top-level navigation, each tab becomes an independent lens into the codebase. Users can maintain multiple trains of thought simultaneously without losing context.

**Next Steps**:
1. Review this implementation plan
2. Decide on open questions (especially global vs. per-workspace)
3. Begin Phase 1 implementation
4. Iterate based on user feedback
