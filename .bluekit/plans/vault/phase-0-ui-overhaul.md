# Phase 0: UI Overhaul - Obsidian-Inspired Layout

## Goal
Restructure the UI to match Obsidian's layout patterns: tabs above main content, left/right split layout, cleaner header organization, and a polished empty state. This foundation is required before implementing the vault system.

---

## Key Insight: Normalize HomePage and ProjectDetailPage

Currently:
- **HomePage**: Centered tabs, different layout
- **ProjectDetailPage**: Sidebar + main content

After Phase 0:
- **Both pages**: Same Left/Right layout with consistent header structure
- **Tabs**: Above main content (like Obsidian)
- **Project switcher**: Above sidebar (not in Header)
- **Header.tsx**: Stays intact, minimal changes

---

## Visual Reference

See reference images:
- `D7AC3CA8-069F-48E0-9BCC-14DC075B961B_1_105_c.jpeg` - Obsidian's tab bar (we want this header style)
- `B20872E2-3A72-44D2-AFE6-3E80C8CB7D72_1_105_c.jpeg` - Our current kits page (remove logo/menu from project pages)
- `4D6AFBBA-B658-422A-914B-C953AE47A534.png` - Current empty state (has weird padding, needs improvement)

---

## Design Specification

### Layout Structure (NEW)

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Global - stays on all pages)                       │
│  [Logo] [blueKit] [Search] [Dark Mode] [Timer] [Profile]   │
└─────────────────────────────────────────────────────────────┘
┌─────────────┬───────────────────────────────────────────────┐
│  SIDEBAR    │  MAIN CONTENT AREA                            │
│             │                                               │
│ ┌─────────┐ │  ┌─────────────────────────────────────────┐ │
│ │ Project │ │  │ Tab Bar (above content)                 │ │
│ │Switcher │ │  │ [Tab 1][Tab 2][Tab 3][+]                │ │
│ │  & Nav  │ │  └─────────────────────────────────────────┘ │
│ └─────────┘ │                                               │
│             │  ┌─────────────────────────────────────────┐ │
│ ┌─────────┐ │  │ Content (active tab)                    │ │
│ │ Toolkit │ │  │                                         │ │
│ │  Tabs   │ │  │ - File tree + editor (file view)        │ │
│ │         │ │  │ - KitsTabContent (kits view)            │ │
│ │ Tasks   │ │  │ - TasksTabContent (tasks view)          │ │
│ │ Plans   │ │  │ - etc.                                  │ │
│ │ Kits    │ │  │                                         │ │
│ │ Walk... │ │  └─────────────────────────────────────────┘ │
│ │ etc.    │ │                                               │
│ └─────────┘ │                                               │
│             │                                               │
│ ┌─────────┐ │                                               │
│ │Notebook │ │                                               │
│ │  Tree   │ │                                               │
│ │(if file)│ │                                               │
│ └─────────┘ │                                               │
└─────────────┴───────────────────────────────────────────────┘
```

**Key Changes:**
1. **Left/Right Split**: Sidebar is full-height on left, content on right
2. **Project Switcher**: Moves above Toolkit tabs (in sidebar)
3. **Tab Bar**: Above main content area (like Obsidian)
4. **Toolkit Tabs**: Vertical list in sidebar (Tasks, Plans, Kits, etc.)
5. **Header**: Unchanged (stays global, same component)

---

## User Stories

### US-0.1: Tabs Above Content
**As a** user
**I want to** see tabs above the main content area (like Obsidian)
**So that** I can quickly switch between open files/views

**Acceptance Criteria**:
- Tab bar positioned directly above main content
- Tabs persist across navigation within same project
- Tabs stored in `.bluekit/workspace/tabs.json` (as per `Tabs.md`)
- Support for: file tabs, kit tabs, walkthrough tabs, etc.
- "+" button to create new tab
- Close button on each tab (×)
- Active tab highlighted

### US-0.2: Clean Empty State
**As a** user
**I want to** see a helpful empty state when no file is selected
**So that** I know what actions I can take

**Acceptance Criteria**:
- Centered layout (no weird padding)
- "Create new note (⌘N)" action
- "Search project (⌘P)" action
- "Close" action
- Clean, minimal design (reference Obsidian's empty state)

### US-0.3: Normalized Layout
**As a** user
**I want** HomePage and ProjectDetailPage to have the same layout structure
**So that** navigation feels consistent

**Acceptance Criteria**:
- Both pages use Left/Right split
- Both pages have sidebar on left
- Both pages have main content on right
- Header stays consistent across all pages

### US-0.4: Project Switcher in Sidebar
**As a** user in ProjectDetailPage
**I want** the project switcher and back button above the sidebar
**So that** I can switch projects without scrolling

**Acceptance Criteria**:
- Project switcher above Toolkit tabs
- Back button to return to HomePage
- Current project name visible
- Logo/menu removed from ProjectDetailPage header area

---

## Implementation Checklist

### Phase 0.1: Tab System Foundation (1 day)

#### Backend (Rust)
- [ ] Add file watching for `.bluekit/workspace/tabs.json`
- [ ] Add `get_workspace_tabs` command (read tabs.json)
- [ ] Add `save_workspace_tabs` command (write tabs.json)
- [ ] Register commands in `main.rs`

#### Frontend (TypeScript)
- [ ] Create `src/types/tabs.ts`:
  ```typescript
  export interface Tab {
    id: string;
    type: 'file' | 'kit' | 'walkthrough' | 'diagram' | 'task' | 'plan';
    title: string;
    icon: string;
    resource: {
      path: string;
      line?: number;
    };
    view: {
      mode: 'preview' | 'edit' | 'source';
      scrollTop: number;
      cursor?: { line: number; ch: number };
    };
    pinned: boolean;
    dirty: boolean;
    openedAt: string;
  }

  export interface TabGroup {
    id: string;
    direction: 'vertical' | 'horizontal';
    size: number;
    tabs: Tab[];
  }

  export interface WorkspaceTabs {
    schemaVersion: 'bluekit.tabs.v1';
    updatedAt: string;
    activeTabId: string | null;
    groups: TabGroup[];
  }
  ```

- [ ] Create `src/contexts/TabsContext.tsx`:
  ```typescript
  export const TabsProvider = ({ children, projectPath }: Props) => {
    const [tabs, setTabs] = useState<WorkspaceTabs>(emptyTabs);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Load tabs on mount
    useEffect(() => {
      loadTabs(projectPath);
    }, [projectPath]);

    // Save tabs on change (debounced)
    useEffect(() => {
      debouncedSave(tabs, projectPath);
    }, [tabs]);

    // Methods: openTab, closeTab, switchTab, pinTab, etc.
  };
  ```

- [ ] Create `src/components/tabs/TabBar.tsx`:
  ```typescript
  export default function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }: Props) {
    return (
      <HStack borderBottom="1px" p={2} gap={1}>
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => onTabClick(tab.id)}
            onClose={() => onTabClose(tab.id)}
          />
        ))}
        <IconButton icon={<LuPlus />} onClick={onNewTab} />
      </HStack>
    );
  }
  ```

---

### Phase 0.2: Layout Restructure (2 days)

#### ProjectDetailPage Changes

**BEFORE** (Header > Sidebar > Content):
```tsx
<VStack h="100vh">
  <Header />  {/* Full header with logo, menu, etc. */}
  <Splitter>
    <ProjectSidebar />
    <MainContent />
  </Splitter>
</VStack>
```

**AFTER** (Left/Right Split):
```tsx
<VStack h="100vh">
  <Header />  {/* Global header (unchanged) */}

  <HStack flex="1" overflow="hidden">
    {/* LEFT: Sidebar (full height) */}
    <Box w="280px" borderRight="1px">
      {/* Project Switcher & Back */}
      <Box p={4} borderBottom="1px">
        <Button onClick={onBack}>← Back</Button>
        <Text>{project.name}</Text>
      </Box>

      {/* Toolkit Tabs */}
      <VStack align="stretch" p={2}>
        <Button onClick={() => setView('tasks')}>Tasks</Button>
        <Button onClick={() => setView('plans')}>Plans</Button>
        <Button onClick={() => setView('kits')}>Kits</Button>
        <Button onClick={() => setView('walkthroughs')}>Walkthroughs</Button>
        {/* ... etc */}
      </VStack>

      {/* Notebook Tree (if file view) */}
      {activeView === 'file' && (
        <NotebookTree onFileSelect={handleFileSelect} />
      )}
    </Box>

    {/* RIGHT: Main Content */}
    <VStack flex="1" overflow="hidden">
      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={switchTab}
        onTabClose={closeTab}
        onNewTab={createNewTab}
      />

      {/* Content Area */}
      <Box flex="1" overflow="auto">
        {renderActiveTabContent()}
      </Box>
    </VStack>
  </HStack>
</VStack>
```

**Files to modify:**
- [ ] `src/pages/ProjectDetailPage.tsx` - Complete restructure
- [ ] `src/components/sidebar/ProjectSidebar.tsx` - Move to left layout
- [ ] `src/components/Header.tsx` - MINIMAL changes (keep intact)

#### HomePage Changes

**Apply same Left/Right layout:**
```tsx
<VStack h="100vh">
  <Header />

  <HStack flex="1">
    {/* LEFT: Sidebar */}
    <Box w="280px">
      <VStack>
        <Button onClick={() => setTab('projects')}>Projects</Button>
        <Button onClick={() => setTab('library')}>Library</Button>
        <Button onClick={() => setTab('workflows')}>Workflows</Button>
        <Button onClick={() => setTab('tasks')}>Tasks</Button>
      </VStack>
    </Box>

    {/* RIGHT: Content */}
    <VStack flex="1">
      <TabBar />
      <Box flex="1">
        {activeTab === 'projects' && <ProjectsTabContent />}
        {activeTab === 'library' && <LibraryTabContent />}
        {/* ... */}
      </Box>
    </VStack>
  </HStack>
</VStack>
```

**Files to modify:**
- [ ] `src/pages/HomePage.tsx` - Add Left/Right layout
- [ ] Keep existing tab content components unchanged

---

### Phase 0.3: Empty State (1 day)

- [ ] Create `src/components/shared/EmptyTabState.tsx`:
  ```tsx
  export default function EmptyTabState({ onCreateNote, onSearch, onClose }: Props) {
    return (
      <VStack align="center" justify="center" h="100%" gap={6} p={8}>
        <Icon as={LuFileText} boxSize={16} color="gray.400" />

        <VStack gap={4}>
          <Button size="lg" onClick={onCreateNote}>
            Create new note (⌘N)
          </Button>
          <Button size="lg" variant="ghost" onClick={onSearch}>
            Search project (⌘P)
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </VStack>

        <Text color="gray.500" fontSize="sm">
          Select a file from the sidebar or create a new note to get started
        </Text>
      </VStack>
    );
  }
  ```

- [ ] Replace current `EmptyProjectState` usage with `EmptyTabState`
- [ ] Add keyboard shortcuts:
  - `⌘N` → Create new note
  - `⌘P` → Open search (Phase 2 feature, just show placeholder)

---

### Phase 0.4: Keyboard Shortcuts (1 day)

- [ ] Create `src/hooks/useKeyboardShortcuts.ts`:
  ```typescript
  export function useKeyboardShortcuts(handlers: {
    onNewNote?: () => void;
    onSearch?: () => void;
    onCloseTab?: () => void;
    onNextTab?: () => void;
    onPrevTab?: () => void;
  }) {
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
          e.preventDefault();
          handlers.onNewNote?.();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
          e.preventDefault();
          handlers.onSearch?.();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
          e.preventDefault();
          handlers.onCloseTab?.();
        }
        // ... more shortcuts
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers]);
  }
  ```

- [ ] Add to ProjectDetailPage and HomePage

---

## Testing Strategy

### Visual Regression Testing
- [ ] Compare new layout to Obsidian screenshots
- [ ] Verify tab bar aligns with content
- [ ] Verify no weird padding in empty state
- [ ] Test both light and dark modes

### Functional Testing
- [ ] Open file → Creates new tab
- [ ] Switch between tabs → Content updates
- [ ] Close tab → Removed from UI and tabs.json
- [ ] Pin tab → Stays on left side
- [ ] Restart app → Tabs restored from tabs.json
- [ ] Navigate HomePage ↔ ProjectDetailPage → Layout consistent

### Keyboard Shortcuts
- [ ] ⌘N creates new note
- [ ] ⌘P shows search (placeholder)
- [ ] ⌘W closes active tab
- [ ] ⌘1-9 switches to tab by index (nice-to-have)

---

## Timeline

### Day 1: Tab System Backend + Frontend
- Add Rust commands for tabs.json
- Create TabsContext, TabBar component
- Basic tab open/close/switch logic

### Day 2-3: Layout Restructure
- Refactor ProjectDetailPage to Left/Right layout
- Move project switcher above sidebar
- Update HomePage to match layout

### Day 4: Empty State + Keyboard Shortcuts
- Build EmptyTabState component
- Add keyboard shortcut hook
- Wire up ⌘N, ⌘P, ⌘W

### Day 5: Polish & Testing
- Fix visual bugs
- Test tab persistence
- Test navigation flows
- Dark mode adjustments

**Total: 1 week**

---

## Success Criteria

- [ ] Tabs appear above main content (like Obsidian)
- [ ] HomePage and ProjectDetailPage use same Left/Right layout
- [ ] Project switcher above sidebar (not in Header)
- [ ] Empty state shows "Create new note (⌘N)", "Search project", "Close"
- [ ] Tabs persist to `.bluekit/workspace/tabs.json`
- [ ] Keyboard shortcuts work (⌘N, ⌘P, ⌘W)
- [ ] Header.tsx mostly unchanged (minimal modifications)
- [ ] No visual regressions in existing features

---

## Why This Comes First

**Phase 0 must complete before Phase 1 (Vault)** because:

1. **Layout Normalization**: Vault will use the same Left/Right layout, so HomePage and ProjectDetailPage need to match first
2. **Tab System**: Vault notebook will use tabs, so the tab infrastructure needs to exist
3. **Reduced Scope**: Building vault on OLD layout would require rework later
4. **User Testing**: Get feedback on new layout before adding vault complexity

---

## Visual Comparison

### Before (Current)
```
ProjectDetailPage:
┌────────────────────────────────────┐
│ Header (logo, menu, search, etc.)  │
├──────────┬─────────────────────────┤
│ Sidebar  │  Main Content           │
│ (glass)  │  (tabs inside content)  │
└──────────┴─────────────────────────┘

HomePage:
┌────────────────────────────────────┐
│ Header                             │
├────────────────────────────────────┤
│     [Centered Tabs]                │
│  Projects | Library | Workflows    │
│                                    │
│  Content (grid/list)               │
└────────────────────────────────────┘
```

### After (Phase 0)
```
Both Pages:
┌────────────────────────────────────┐
│ Header (global, unchanged)         │
├──────────┬─────────────────────────┤
│ Sidebar  │ ┌─────────────────────┐ │
│ (full-  │ │ Tab Bar             │ │
│ height) │ └─────────────────────┘ │
│         │                         │
│ Project │  Main Content           │
│Switcher │  (active tab)           │
│         │                         │
│ Toolkit │                         │
│  Tabs   │                         │
│         │                         │
│Notebook │                         │
│  Tree   │                         │
└──────────┴─────────────────────────┘
```

---

## Open Questions

- [ ] Should tabs be **per-project** or **global**?
  - **Proposal**: Per-project (`.bluekit/workspace/tabs.json` per project)
  - **Rationale**: Each project has different context

- [ ] Should HomePage have tabs at all?
  - **Proposal**: Yes, for consistency (e.g., "Projects Overview" tab)
  - **Rationale**: Uniform UX, easier to understand

- [ ] How to handle tab overflow (20+ tabs)?
  - **Proposal**: Horizontal scroll + visual indicator
  - **Rationale**: Match browser behavior (familiar UX)

---

## Dependencies

**Phase 0 depends on:**
- ✅ Existing `Header.tsx` component
- ✅ Existing `NotebookTree`, `NoteViewPage` components
- ✅ Existing file watcher infrastructure

**Phase 1 (Vault) depends on:**
- ⏳ Phase 0 completion (tab system, layout normalization)

---

## Next Steps After Phase 0

1. **Ship Phase 0** → Get user feedback on new layout
2. **Begin Phase 1** → Implement vault (reuses Phase 0 tab system)
3. **Phase 2** → Add search, linking (benefits from tab system)

---

## References

- **Tabs Spec**: `.bluekit/features/Tabs.md`
- **Obsidian Layout**: `D7AC3CA8-069F-48E0-9BCC-14DC075B961B_1_105_c.jpeg`
- **Current Kits Page**: `B20872E2-3A72-44D2-AFE6-3E80C8CB7D72_1_105_c.jpeg`
- **Current Empty State**: `4D6AFBBA-B658-422A-914B-C953AE47A534.png`

---

**Last Updated**: 2026-01-24
**Status**: 📝 Ready to implement (blocks Phase 1)
