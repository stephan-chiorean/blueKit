# Phase 3: Tab Infrastructure Implementation

## ⚠️ CRITICAL: No Visual/Styling Changes

**This implementation is ONLY about state management. All existing UI and styling must remain unchanged.**

### What DOES Change
- **State management**: Tab state moves from component-local to global context
- **Sidebar context binding**: Sidebar dynamically reflects the active tab's context

### What DOES NOT Change
- **Visual appearance**: ProjectSidebar styling, colors, spacing, layout - all stay identical
- **Tab UI**: BrowserTabs component appearance stays the same
- **Layout**: Tabs appear above content exactly as they do now
- **Component structure**: ProjectSidebar component structure remains the same

### Sidebar Context Behavior Examples

**Before (broken):**
- Switch from Project A tab → Library tab → back to Project A tab
- Result: Sidebar state is lost, shows wrong context

**After (correct):**
- **Tab A: Project A, Kits view**
  - Sidebar shows: Project A name, Kits section expanded, Project A's notebook structure
- **Tab B: Library (vault project)**
  - Sidebar shows: Library name, Library-level sections (kits, walkthroughs, etc.)
- **Tab C: Project B, Diagrams view**
  - Sidebar shows: Project B name, Diagrams section expanded, Project B's notebook structure
- **Switch back to Tab A**
  - Sidebar automatically shows: Project A context again (exactly as it was)

**Key principle**: The sidebar is a "window" into the active tab's context. When you switch tabs, the sidebar immediately reflects that tab's project, view, and state - but its appearance and styling never change.

---

## Before you begin

Ensure that the projectSidebar.tsx is ready for migration, right now we house logic for this component
When we switch tabs back and forth and then come back to other tabs that are in other contexts, does the sidebar basically adjust to the context of what tab we're on?

## Goal

Implement persistent tab state management to enable multi-context workflows where tabs persist across navigation between HomeView and ProjectView.

**Success Criteria**:
- ✅ Tab state persists when navigating between views
- ✅ Multiple projects can have tabs open simultaneously
- ✅ Tab state saved to `.bluekit/workspace/tabs.json`
- ✅ App restores tab state on reload
- ✅ No breaking changes to existing functionality

### Explicit behavior requirement: Sidebar follows active tab context

**The ProjectSidebar component itself doesn't change - only where it gets its data from.**

**Current (broken):**
```tsx
// In ProjectView.tsx
const [activeView, setActiveView] = useState<ViewType>('kits');

<ProjectSidebar
  project={project}              // Local prop
  activeView={activeView}        // Local state ❌ - lost on unmount
  onViewChange={setActiveView}   // Updates local state
  isVault={isVault}             // Local prop
  // ... other props
/>
```

**After (fixed):**
```tsx
// In TabContent.tsx / TabManager
const activeTab = tabs.find(t => t.id === activeTabId);

<ProjectSidebar
  project={getProjectById(activeTab.resource.projectId)}   // From tab state
  activeView={activeTab.resource.view}                     // From tab state ✅ - persists!
  onViewChange={(view) => updateTabResource(activeTab.id, { view })}  // Updates tab state
  isVault={activeTab.resource.isVault}                    // From tab state
  // ... other props
/>
```

**State storage requirements:**
- **Active view must be stored in tab state** (e.g., `tab.resource.view`) and **not** remain as local `ProjectView` state.
- **Project/vault context must be stored in tab state** (e.g., `tab.resource.projectId`, with `isVault` derived from that project or a tab flag).
- **Tab switches must drive sidebar changes**: when `activeTabId` changes, `ProjectView`/`ProjectSidebar` read from that tab's resource to determine sidebar menu + active view.

**Library behavior** can be implemented as either:
  - `tab.type === 'home'` → `HomeView` renders vault project sidebar, or
  - `tab.type === 'project'` with the vault project id + `isVault` true.

**Result:**
- Tab A showing "Project A > Kits" → sidebar shows Project A's notebook with Kits section active
- Switch to Tab B showing "Library > Walkthroughs" → sidebar shows Library sections with Walkthroughs active
- Switch back to Tab A → sidebar instantly shows Project A > Kits again (state preserved)

---

## Current Problem

Tab state in `ProjectView.tsx` (lines 64-127) is **component-local**:

```typescript
// Component-level state - lost on unmount
const [openTabs, setOpenTabs] = useState<Tab[]>([]);
const [activeTabId, setActiveTabId] = useState<string | null>(null);
```

**Result**: Navigating from ProjectView → HomeView → back to ProjectView **loses all tabs**.

---

## Target Architecture

### Before (Current)
```
App.tsx
├── HomeView (local tabs ❌)
│   └── ProjectView as vault (local tabs ❌)
└── ProjectView (different instance, local tabs ❌)
```

### After (Phase 3)
```
App.tsx
└── TabManager (ONE global tab state ✅)
    └── TabContent (renders based on active tab.type)
        ├── tab.type === 'home' → HomeView
        ├── tab.type === 'project' → ProjectView
        ├── tab.type === 'kit' → ResourceViewPage
        ├── tab.type === 'walkthrough' → ResourceViewPage
        └── tab.type === 'plan' → ResourceViewPage
```

All views share **the same persistent tab state** from TabManager.

---

## Implementation Steps

### Step 1: Create TabContext (Global State)

**File**: `src/app/TabContext.tsx`

**Interface** (from tabs-implementation.md lines 96-120):

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

**Implementation Notes**:
- Use React Context + useState for state management
- Debounce `saveTabs()` calls (500ms) to avoid excessive file writes
- Handle errors gracefully (failed saves should log, not crash)

---

### Step 2: Create TabManager Component

**File**: `src/app/TabManager.tsx`

**Responsibilities**:
- Wraps entire app below App.tsx
- Provides TabContext to all children
- Manages tab persistence (load on mount, save on changes)
- Renders BrowserTabs + TabContent

**⚠️ IMPORTANT: BrowserTabs component styling stays identical - just moved from ProjectView to app level**

**Structure**:

```tsx
function TabManager({ children }: { children?: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Load tabs from .bluekit/workspace/tabs.json on mount
  useEffect(() => {
    loadTabs();
  }, []);

  // Auto-save tabs when they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveTabs();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [tabs, activeTabId]);

  // Implement TabContextValue methods...

  return (
    <TabContext.Provider value={{ tabs, activeTabId, createTab, closeTab, ... }}>
      {/* BrowserTabs: Same component, same styling, just rendered here instead of in ProjectView */}
      <BrowserTabs tabs={tabs} selectedId={activeTabId} onSelect={selectTab} onClose={closeTab}>
        <TabContent />
      </BrowserTabs>
    </TabContext.Provider>
  );
}
```

**Visual result**: Tabs still appear above content exactly as they do now - the only difference is they're managed globally.

**Note**: The `children` prop may not be used if TabContent handles all rendering internally.

---

### Step 3: Create TabContent Renderer

**File**: `src/app/TabContent.tsx`

**Responsibilities**:
- Reads `activeTabId` from TabContext
- Renders appropriate view based on `tab.type` and `tab.resource`

**Structure**:

```tsx
function TabContent() {
  const { tabs, activeTabId } = useTabContext();
  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!activeTab) {
    return <DefaultHomeView />; // Fallback
  }

  switch (activeTab.type) {
    case 'home':
      return <HomeView onProjectSelect={handleProjectSelect} />;

    case 'project':
      return (
        <ProjectView
          project={getProjectById(activeTab.resource.projectId)}
          onBack={handleBack}
          // ... other props from tab.resource
        />
      );

    case 'kit':
    case 'walkthrough':
    case 'plan':
      return (
        <ResourceViewPage
          resource={getResourceByPath(activeTab.resource.path)}
          resourceType={activeTab.type}
          // ... other props
        />
      );

    default:
      return <div>Unknown tab type: {activeTab.type}</div>;
  }
}
```

**Key Decision**: How to pass props to views from tab.resource?
- Option A: Store serializable data in tab.resource
- Option B: Store IDs only, fetch full data in each view
- **Recommendation**: Option B (more robust, handles external changes)

---

### Step 4: Integrate TabManager into App.tsx

**File**: `src/app/App.tsx`

**Changes**:

```diff
  function App() {
    return (
      <ColorModeProvider>
        <FeatureFlagsProvider>
          <ProjectArtifactsProvider>
            <WorkstationProvider>
-             {/* Current: Direct view rendering */}
-             {view === 'home' && <HomeView />}
-             {view === 'project' && <ProjectView />}
+             {/* New: TabManager handles all rendering */}
+             <TabManager />
            </WorkstationProvider>
          </ProjectArtifactsProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }
```

**Note**: App.tsx may currently use routing or conditional rendering. Replace with single `<TabManager />` component.

---

### Step 5: Update ProjectView to Use TabContext

**File**: `src/views/project/ProjectView.tsx`

**⚠️ IMPORTANT: ProjectView layout and styling stay the same - only state source changes**

**Changes**:

```diff
  function ProjectView({ project, onBack, ... }) {
-   // Remove local tab state
-   const [openTabs, setOpenTabs] = useState<Tab[]>([]);
-   const [activeTabId, setActiveTabId] = useState<string | null>(null);
-   const openTab = useCallback(...);
-   const closeTab = useCallback(...);

+   // Use global tab context instead
+   const { openInCurrentTab, openInNewTab, closeTab } = useTabContext();

    const handleViewKit = async (artifact: ArtifactFile) => {
-     await handleViewResource(artifact, 'kit');
-     openTab(artifact.path, artifact.name, 'kit');
+     openInCurrentTab({
+       type: 'kit',
+       path: artifact.path,
+       projectId: project.id,
+     });
    };

    // ... similar updates for walkthroughs, plans, etc.
  }
```

**Visual changes:**
- **REMOVE**: `<BrowserTabs>` component from ProjectView (now rendered by TabManager at app level)
- **KEEP**: All other ProjectView styling, layout, sidebar positioning - everything stays identical
- **RESULT**: User sees tabs above content exactly as before, but now tabs persist across navigation

**State source changes:**
- `activeView` now comes from props (derived from `activeTab.resource.view`) instead of local `useState`
- ProjectView becomes a "view" of the active tab's state rather than managing its own state
- All styling and component structure remains unchanged

---

### Step 6: Implement Tab Persistence

**File**: `src/app/TabContext.tsx` (within context implementation)

**Persistence Schema** (from tabs-implementation.md lines 408-441):

```json
{
  "schemaVersion": "bluekit.tabs.v1",
  "updatedAt": "2026-01-27T10:30:00Z",
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
          "openedAt": "2026-01-27T10:15:00Z"
        }
      ]
    }
  ]
}
```

**Implementation**:

```typescript
async function saveTabs() {
  const tabsData = {
    schemaVersion: 'bluekit.tabs.v1',
    updatedAt: new Date().toISOString(),
    activeTabId,
    groups: [{
      id: 'group_main',
      direction: 'vertical',
      size: 1,
      tabs
    }]
  };

  try {
    await invokeWriteFile(
      '.bluekit/workspace/tabs.json',
      JSON.stringify(tabsData, null, 2)
    );
  } catch (error) {
    console.warn('Failed to save tabs:', error);
    // Don't block UI on save failures
  }
}

async function loadTabs() {
  try {
    const content = await invokeReadFile('.bluekit/workspace/tabs.json');
    const data = JSON.parse(content);

    if (data.schemaVersion !== 'bluekit.tabs.v1') {
      console.warn('Unsupported tabs schema, creating default tab');
      createDefaultTab();
      return;
    }

    setTabs(data.groups[0].tabs);
    setActiveTabId(data.activeTabId);
  } catch {
    // File missing or corrupt - create default tab
    createDefaultTab();
  }
}

function createDefaultTab() {
  const defaultTab: Tab = {
    id: 'tab_home',
    type: 'home',
    title: 'Home',
    icon: 'home',
    resource: {},
    view: {},
    pinned: true,
    dirty: false,
    closable: false,
    openedAt: new Date().toISOString(),
  };
  setTabs([defaultTab]);
  setActiveTabId(defaultTab.id);
}
```

**File Location**: `.bluekit/workspace/tabs.json` (global, not per-project)

---

### Step 7: Update Sidebar Navigation

**File**: `src/views/project/ProjectSidebar.tsx` (and other navigation components)

**⚠️ IMPORTANT: NO styling changes - only update where state is sourced from**

**Changes**:

Instead of directly calling `setActiveView()` or navigating, sidebar items should update the active tab's resource:

```diff
  function handleSidebarItemClick(viewType: ViewType) {
-   setActiveView(viewType);
+   const { updateTabResource, activeTabId } = useTabContext();
+   updateTabResource(activeTabId, {
+     type: 'project',
+     projectId: project.id,
+     view: viewType,
+   });
  }
```

**What this achieves:**
- Clicking "Kits" in the sidebar for Tab A (Project A) → updates Tab A's resource to show Kits view
- Switching to Tab B (Library) → sidebar automatically shows Library sections
- Switching back to Tab A → sidebar shows Project A's Kits view (preserved state)

**Sidebar receives context from props (same as before):**
```tsx
<ProjectSidebar
  project={activeTab.resource.projectId} // Comes from active tab
  activeView={activeTab.resource.view}   // Comes from active tab
  isVault={activeTab.resource.isVault}   // Comes from active tab
  // ... all other props stay the same
/>
```

The sidebar component itself doesn't change - it just receives its props from the active tab's state instead of local component state.

**Context Menu**: Add "Open in New Tab" option (Cmd+Click or right-click):

```tsx
<SidebarItem
  onClick={() => openInCurrentTab({ type: 'project', view: 'kits', projectId })}
  onContextMenu={(e) => {
    e.preventDefault();
    showContextMenu([
      { label: 'Open in New Tab', onClick: () => openInNewTab({ type: 'project', view: 'kits', projectId }) }
    ]);
  }}
>
  Kits
</SidebarItem>
```

---

## Testing Checklist

### Core Functionality
- [ ] App starts with default "Home" tab
- [ ] Opening a kit creates/switches to a tab
- [ ] Closing a tab works (switches to previous tab)
- [ ] Opening multiple kits creates multiple tabs
- [ ] Switching between tabs shows correct content
- [ ] Tab titles update when resource changes

### Navigation Persistence
- [ ] Navigate: HomeView → ProjectView → tabs persist
- [ ] Navigate: ProjectView → resource view → back → tabs persist
- [ ] Open kit in Project A, switch to Project B, tabs for both exist
- [ ] Tabs from different projects don't interfere

### Sidebar Context Switching
- [ ] **Tab A (Project A, Kits view)**: Sidebar shows Project A name + Kits section expanded
- [ ] **Switch to Tab B (Library)**: Sidebar immediately shows Library sections
- [ ] **Switch back to Tab A**: Sidebar shows Project A > Kits again (exact state preserved)
- [ ] **Tab C (Project B, Diagrams view)**: Sidebar shows Project B name + Diagrams section
- [ ] **Sidebar styling never changes** - only content/context updates
- [ ] Clicking sidebar items updates the current tab's resource (not local state)

### Persistence
- [ ] Close app with 3 tabs open
- [ ] Reopen app → 3 tabs restored with correct content
- [ ] If `.bluekit/workspace/tabs.json` is deleted, app creates default tab
- [ ] If a tab's file is deleted, tab shows error state (doesn't crash)

### Edge Cases
- [ ] Closing last tab doesn't crash (creates default home tab)
- [ ] Opening same resource twice doesn't create duplicate tabs
- [ ] Tab state survives hot reload (if possible with Vite)

---

## Rollback Plan

### If Implementation Fails

1. **Revert commits**: Use git to revert TabManager/TabContext commits
2. **Restore ProjectView tabs**: Uncomment local tab state in ProjectView.tsx
3. **Remove TabManager**: Remove from App.tsx, restore direct view rendering

### Safe Implementation Strategy

**Option A: Feature Flag**
- Add `tabs` feature flag to FeatureFlagsContext
- Conditionally use TabManager vs. old direct rendering
- Allows testing in production without breaking existing flow

**Option B: Parallel Implementation**
- Keep old navigation working alongside new tabs
- Gradually migrate views to use TabContext
- Remove old code once stable

**Recommendation**: Option A (feature flag) for safer rollout.

---

## Open Questions

### 1. Where should `.bluekit/workspace/tabs.json` live?

**Option A**: Global (`~/.bluekit/workspace/tabs.json`)
- Tabs persist across all projects
- Multi-project tabs possible

**Option B**: Per-project (`.bluekit/workspace/tabs.json` in each project)
- Tabs tied to project context
- Can't mix tabs from different projects

**Recommendation**: Global (matches user's goal of multi-project workflow)

### 2. Should tabs be in .gitignore?

**Yes** (recommended):
- Personal workspace state, not project configuration
- Avoids merge conflicts
- Different developers have different workflows

**Unless**: Team wants to share "interesting workspace layouts"

### 3. How to handle route-based navigation?

Currently, app may use React Router or conditional rendering based on state.

**Option A**: Remove routes entirely, use only tabs
- Simpler architecture
- Breaks browser back/forward

**Option B**: Keep routes, sync with active tab
- Back/forward button works
- More complex state management

**Recommendation**: Start with Option A, add route sync later if requested.

---

## Timeline Estimate

| Task | Effort | Risk |
|------|--------|------|
| Step 1: Create TabContext | 2 hours | Low |
| Step 2: Create TabManager | 2 hours | Medium |
| Step 3: Create TabContent | 1 hour | Low |
| Step 4: Integrate into App.tsx | 1 hour | Medium |
| Step 5: Update ProjectView | 2 hours | Medium |
| Step 6: Implement Persistence | 2 hours | Low |
| Step 7: Update Sidebar | 1 hour | Low |
| Testing & Bug Fixes | 3 hours | High |
| **Total** | **~14 hours** | **Medium** |

---

## Success Metrics

### Quantitative
- Zero TypeScript errors after implementation
- App builds successfully
- All existing tests pass
- No console errors during tab operations

### Qualitative
- Tabs persist when navigating between views
- User can work in multiple projects simultaneously
- Tab state survives app restart
- **No visual regressions whatsoever**:
  - ProjectSidebar looks identical (colors, spacing, layout, fonts, etc.)
  - BrowserTabs component looks identical (just rendered at app level)
  - All transitions and animations work the same
  - Layout structure remains unchanged
  - Only difference: sidebar now reflects active tab's context correctly

---

## References

- Full specification: `.bluekit/features/tabs/tabs-implementation.md`
- Architecture plan: `.bluekit/features/tabs/architecture-restructure-plan.md`
- Current tab UI: `src/tabs/BrowserTabs.tsx` (presentational only)
- Current local tabs: `src/views/project/ProjectView.tsx:64-127`

---

## Next Steps

1. Review this plan with team/user
2. Decide on open questions (global vs. per-project, gitignore, routes)
3. Create feature branch: `feat/phase3-tabs-implementation`
4. Implement Step 1 (TabContext)
5. Iterate through steps, testing after each
6. Merge when all tests pass and tabs persist across navigation
