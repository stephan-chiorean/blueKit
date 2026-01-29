# Phase 4: Tab Navigation Refinement

## ⚠️ CRITICAL: Tab Navigation Behavior

**Current Problem**: Everything opens in a new tab automatically, creating tab proliferation.

**Correct Behavior**:
- **Navigation = Same Tab**: Clicking items in sidebar, opening files, etc. should navigate within the current tab
- **Explicit New Tab**: Only create new tabs when user explicitly requests via:
  - "New Tab" button (+ icon) → Opens scope selection popover
  - Cmd+Click on item
  - Right-click → "Open in New Tab"

## 🎯 Updated Approach: Spotlight Popover Scope Selection

**New Tab Flow** (replaces direct tab creation):
1. User clicks "+" button or presses Cmd+T
2. **Spotlight popover opens** (following `.bluekit/kits/spotlight-popover-flow.md` pattern):
   - Full-screen blur backdrop dims the app
   - "+ button" is cloned and portaled above blur (remains sharp/spotlighted)
   - Floating popover appears below the button
3. **Stage 1: Scope Selection**
   - User chooses between "Library" or a specific Project (dropdown/list)
4. **Stage 2: Context Actions**
   - Based on selected scope, shows relevant action buttons:
     - Library: Search library, Browse projects
     - Project: New note, Find file, Browse resources
5. **Tab creation** happens after action button is clicked

**Benefits**:
- User explicitly chooses context before tab creation (no ambiguity)
- Reduces accidental empty tabs
- Follows existing project selector pattern (familiar UX)
- Premium visual polish with spotlight effect
- Smooth two-stage flow guides user to their goal

---

## Goal

Refine tab navigation to match professional IDE behavior (VS Code, Cursor, Obsidian):
- **Default navigation**: Use current tab (`openInCurrentTab`)
- **Explicit tab creation**: Provide UI controls and keyboard shortcuts
- **Empty tab state**: Show helpful empty state when tab has no content

---

## Implementation Steps

### Step 1: Add "New Tab" Button to BrowserTabs ✅ PARTIALLY COMPLETE

**Status**: Visual implementation complete, handler needs spotlight popover implementation

**Estimated Usage to Complete**: 80-120k tokens (Sonnet)
- Reading spotlight-popover-flow.md kit and related components: ~40k tokens
- Creating NewTabScopePopover component: ~40-50k tokens
- Wiring up handlers and testing: ~20-30k tokens
- Should take 2-3 prompts to complete

**Completed**:
- ✅ Added + button to `src/tabs/BrowserTabs.tsx`
- ✅ Added `onAddTab` prop to BrowserTabsProps interface
- ✅ Added divider before + button (visual polish)
- ✅ Wired placeholder handler in `src/views/project/ProjectView.tsx`
- ✅ Button shows after tabs with proper styling

**Still TODO**:
- ⚠️ Create `NewTabScopePopover` component following spotlight-popover-flow pattern
- ⚠️ Implement two-stage popover: Scope Selection → Action Buttons
- ⚠️ Add keyboard shortcut Cmd+T (global handler to open popover)

---

**File**: `src/tabs/BrowserTabs.tsx`

**Location**: After the last tab, before the overflow area

**Button Specs**:
- Icon: `LuPlus` from `react-icons/lu`
- Size: Small, matches tab height
- Behavior: Creates new empty tab in current context
- Keyboard shortcut: Cmd+T (handled globally)

**Visual**:
```
[Tab 1] [Tab 2] [Tab 3] | [+]
```
Note: Divider added before + button for visual separation

**Implementation** (DONE):
```tsx
{/* Add Tab Button */}
{onAddTab && (
  <>
    <TabDivider colorMode={colorMode} />
    <Box
      h="100%"
      display="flex"
      alignItems="center"
      borderBottom={`1px solid ${colors.borderColor}`}
      px={1}
    >
      <IconButton
        aria-label="New tab"
        size="xs"
        variant="ghost"
        onClick={onAddTab}
        color={colors.unselectedText}
        _hover={{ bg: colors.hoverBg, color: colors.selectedText }}
        w={TAB_SPECS.addButtonSize}
        h={TAB_SPECS.addButtonSize}
        minW={TAB_SPECS.addButtonSize}
      >
        <Icon fontSize="14px">
          <LuPlus />
        </Icon>
      </IconButton>
    </Box>
  </>
)}
```

**Current Handler** (in `src/views/project/ProjectView.tsx`):
```tsx
onAddTab={() => console.log('Add tab clicked - not implemented yet')}
```

**Target Handler** (TODO - replace placeholder):
```tsx
const handleNewTab = () => {
  // Opens NewTabScopePopover for user to select scope (Library or Project)
  setShowNewTabPopover(true);
};
```

**Popover State** (add to ProjectView.tsx):
```tsx
const [showNewTabPopover, setShowNewTabPopover] = useState(false);
const [newTabButtonRect, setNewTabButtonRect] = useState<DOMRect | null>(null);
```

---

### Step 1.5: Create NewTabScopePopover Component - **NEW COMPONENT**

**File**: `src/shared/components/NewTabScopePopover.tsx`

**Pattern**: Follows `spotlight-popover-flow.md` kit specifications

**Purpose**: Two-stage popover for selecting tab scope before creation

#### Stage 1: Scope Selection

**Visual Design**:
- Floating popover positioned near the "+" button (using measured bounding rect)
- Glass morphism background matching app aesthetic
- Blur backdrop (Z-Index 1300) dims entire application
- "+ button" cloned and portaled above blur (Z-Index 1401) to remain sharp
- Popover content (Z-Index 1410) floats above everything

**Scope Options**:
1. **Library** - Opens a new Library tab
   - Icon: `LuLibrary`
   - Label: "Library"
   - Description: "Browse all projects and global resources"

2. **Project Selector** - Dropdown/List of available projects
   - Uses same pattern as `ProjectSidebar.tsx` project selector (lines 100-272)
   - Shows project list with folder icons
   - Searchable if >5 projects
   - On selection → transitions to Stage 2

**Component Structure**:
```tsx
interface NewTabScopePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRect: DOMRect | null;  // Bounding rect of "+" button
  allProjects: Project[];
  onScopeSelected: (scope: TabScope) => void;
}

type TabScope =
  | { type: 'library' }
  | { type: 'project', projectId: string, projectPath: string, projectName: string };
```

**Layout**:
```tsx
<SpotlightBackdrop isOpen={isOpen} onClick={onClose} zIndex={1300} />

{/* Cloned + button (spotlighted above blur) */}
<Portal>
  <Box
    position="absolute"
    top={triggerRect.top}
    left={triggerRect.left}
    width={triggerRect.width}
    height={triggerRect.height}
    zIndex={1401}
    pointerEvents="none"
  >
    {/* Exact visual clone of + button with active state */}
  </Box>
</Portal>

{/* Popover Content */}
<Portal>
  <MotionBox
    position="absolute"
    top={triggerRect.bottom + 8}  // Position below button
    left={triggerRect.left}
    zIndex={1410}
    css={glassomorphismStyles}
  >
    {stage === 1 ? <ScopeSelection /> : <ActionButtons />}
  </MotionBox>
</Portal>
```

#### Stage 2: Context Actions (Post-Selection)

**Triggers**: After user selects Library or Project in Stage 1

**Visual Transition**:
- Popover content smoothly transitions (framer-motion) from scope selection to action buttons
- Same position, same glass styling
- Blur backdrop remains active

**Action Buttons** (mirroring EmptyProjectState pattern):

**For Library Scope**:
```tsx
const libraryActions = [
  {
    icon: LuSearch,
    label: 'Search library',
    shortcut: '⌘ K',
    onClick: () => {
      createTabAndNavigate({ type: 'library' });
      // Future: Open search modal
      showToast('Search coming soon');
    },
  },
  {
    icon: LuFolderOpen,
    label: 'Browse projects',
    shortcut: '⌘ P',
    onClick: () => {
      createTabAndNavigate({ type: 'library' });
      // Opens library with projects view
    },
  },
];
```

**For Project Scope**:
```tsx
const projectActions = [
  {
    icon: LuFileText,
    label: 'New note',
    shortcut: '⌘ N',
    onClick: () => {
      createTabAndNavigate({ type: 'project', projectId, projectPath });
      // Triggers new file creation in selected project
    },
  },
  {
    icon: LuSearch,
    label: 'Find file',
    shortcut: '⌘ O',
    onClick: () => {
      createTabAndNavigate({ type: 'project', projectId, projectPath });
      showToast('File search coming soon');
    },
  },
  {
    icon: LuPackage,
    label: 'Browse resources',
    shortcut: '',
    onClick: () => {
      createTabAndNavigate({ type: 'project', projectId, projectPath, view: 'kits' });
    },
  },
];
```

**Action Button Layout**:
```tsx
<VStack gap={2} w="300px" p={4}>
  <Text fontSize="xs" color="text.tertiary" alignSelf="start" mb={1}>
    {selectedScope.type === 'library' ? 'Library Actions' : selectedScope.projectName}
  </Text>
  {actions.map((action, idx) => (
    <Button
      key={idx}
      onClick={action.onClick}
      variant="ghost"
      size="md"
      w="100%"
      justifyContent="space-between"
      _hover={{ bg: 'whiteAlpha.100' }}
    >
      <HStack gap={3}>
        <Icon boxSize={4}><action.icon /></Icon>
        <Text fontSize="sm">{action.label}</Text>
      </HStack>
      {action.shortcut && (
        <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
          {action.shortcut}
        </Text>
      )}
    </Button>
  ))}
</VStack>
```

#### Implementation Checklist

- [ ] Create `SpotlightBackdrop` component (reusable blur overlay)
- [ ] Create `NewTabScopePopover` with two-stage state machine
- [ ] Implement "+ button" cloning and portal logic
- [ ] Wire project list from tab context/props
- [ ] Add framer-motion transitions between stages
- [ ] Handle keyboard navigation (Arrow keys, Enter, Escape)
- [ ] Test with 0 projects, 1 project, many projects
- [ ] Verify blur backdrop closes popover on click
- [ ] Ensure Escape key closes popover

#### Z-Index Hierarchy

```
1410 - NewTabScopePopover content
1401 - Cloned + button (spotlighted)
1300 - SpotlightBackdrop (blur overlay)
```

---

### Step 2: Create EmptyTabState Component

**File**: `src/shared/components/EmptyTabState.tsx`

**Design** (from screenshot reference):
- 3 centered action rows
- Each row: Icon + Text + Keyboard Shortcut
- Glass morphism background (matches EmptyProjectState)
- Responsive to context (project vs library)

**Actions**:

**For Project Context**:
1. **Create new note** (⌘ N)
   - Creates new file in current project's notebook
   - Opens in edit mode with title sync
2. **Go to file** (⌘ O)
   - Opens fuzzy file search (future implementation)
   - For now: Shows message "Search coming soon"
3. **Close tab** (⌘ W)
   - Closes current tab

**For Library Context**:
1. **Search library** (⌘ K)
   - Global search across all projects (future)
   - For now: Shows message "Search coming soon"
2. **Go to project** (⌘ P)
   - Opens project picker (future)
   - For now: Shows message "Project picker coming soon"
3. **Close tab** (⌘ W)
   - Closes current tab

**Component Structure**:
```tsx
interface EmptyTabStateProps {
  context: 'project' | 'library';
  projectPath?: string;
  onCreateNote?: () => void;
  onSearchFiles?: () => void;
  onCloseTab?: () => void;
}

export default function EmptyTabState({
  context,
  projectPath,
  onCreateNote,
  onSearchFiles,
  onCloseTab,
}: EmptyTabStateProps) {
  const { colorMode } = useColorMode();

  const actions = context === 'project' ? [
    {
      icon: LuFileText,
      label: 'Create new note',
      shortcut: '⌘ N',
      onClick: onCreateNote,
    },
    {
      icon: LuSearch,
      label: 'Go to file',
      shortcut: '⌘ O',
      onClick: onSearchFiles || (() => {
        toaster.create({
          title: 'Coming soon',
          description: 'File search will be available in the next update',
          type: 'info',
        });
      }),
    },
    {
      icon: LuX,
      label: 'Close tab',
      shortcut: '⌘ W',
      onClick: onCloseTab,
    },
  ] : [
    {
      icon: LuSearch,
      label: 'Search library',
      shortcut: '⌘ K',
      onClick: () => {
        toaster.create({
          title: 'Coming soon',
          description: 'Library search will be available soon',
          type: 'info',
        });
      },
    },
    {
      icon: LuFolderOpen,
      label: 'Go to project',
      shortcut: '⌘ P',
      onClick: () => {
        toaster.create({
          title: 'Coming soon',
          description: 'Project picker will be available soon',
          type: 'info',
        });
      },
    },
    {
      icon: LuX,
      label: 'Close tab',
      shortcut: '⌘ W',
      onClick: onCloseTab,
    },
  ];

  return (
    <MotionFlex
      h="100%"
      w="100%"
      align="center"
      justify="center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: colorMode === 'light'
          ? 'rgba(255, 255, 255, 0.45)'
          : 'rgba(20, 20, 25, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <VStack gap={2} maxW="400px">
        {actions.map((action, index) => (
          <Button
            key={index}
            onClick={action.onClick}
            variant="ghost"
            size="lg"
            w="100%"
            justifyContent="space-between"
            px={6}
            py={6}
            h="auto"
            _hover={{
              bg: colorMode === 'light'
                ? 'rgba(0, 0, 0, 0.04)'
                : 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <HStack gap={3}>
              <Icon boxSize={5} color="text.secondary">
                <action.icon />
              </Icon>
              <Text fontSize="md" color="text.primary">
                {action.label}
              </Text>
            </HStack>
            <Text fontSize="sm" color="text.tertiary" fontFamily="mono">
              {action.shortcut}
            </Text>
          </Button>
        ))}
      </VStack>
    </MotionFlex>
  );
}
```

---

### Step 3: Update ProjectView Navigation to Use openInCurrentTab

**File**: `src/views/project/ProjectView.tsx`

**Changes**:

```diff
  const handleViewKit = useCallback((artifact: ArtifactFile) => {
    const resourceType = (artifact.frontMatter?.type as ResourceType) || 'kit';
    const label = artifact.frontMatter?.alias || artifact.name;
-   openInNewTab(
+   openInCurrentTab(
      {
        type: resourceType,
        path: artifact.path,
        projectId: project.id,
        view: getViewForTabType(resourceType),
      },
      { title: label }
    );
- }, [getViewForTabType, openInNewTab, project.id]);
+ }, [getViewForTabType, openInCurrentTab, project.id]);
```

**Apply same change to**:
- `handleViewDiagram` (line 891-902)
- `handleViewTask` (line 904-917)
- `handleViewPlan` (line 919-930)
- `handleViewWalkthrough` (line 932-952)
- `handleFileSelect` (line 1030-1054)

**Keep `openInNewTab` ONLY for**:
- Cmd+Click modifier
- "Open in New Tab" context menu option (future)

---

### Step 4: Update Sidebar Navigation

**File**: `src/views/project/components/SidebarMenuItem.tsx`

**Add Cmd+Click Detection**:

```tsx
const handleClick = (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    // Cmd+Click = Open in new tab
    onOpenInNewTab?.(view);
  } else {
    // Regular click = Navigate in current tab
    onViewChange(view);
  }
};
```

**Update Props**:
```tsx
interface SidebarMenuItemProps {
  // ... existing props
  onOpenInNewTab?: (view: ViewType) => void;
}
```

---

### Step 5: Show EmptyTabState in ProjectView

**File**: `src/views/project/ProjectView.tsx`

**Add state for empty tab detection**:
```tsx
const isEmptyTab = useMemo(() => {
  // Tab is empty if it's a project tab with 'file' view but no file selected
  return activeTab?.type === 'project' &&
         activeView === 'file' &&
         !notebookFile &&
         !viewingResource;
}, [activeTab, activeView, notebookFile, viewingResource]);
```

**Update renderContent()**:
```diff
  if (activeView === 'file') {
+   if (isEmptyTab) {
+     return (
+       <EmptyTabState
+         context="project"
+         projectPath={project.path}
+         onCreateNote={() => {
+           if (notebookHandlers) {
+             notebookHandlers.onNewFile(project.path);
+           }
+         }}
+         onCloseTab={() => closeTab(activeTabId)}
+       />
+     );
+   }
    return (
      <EmptyProjectState
        onCreateNote={() => {
          if (notebookHandlers) {
            notebookHandlers.onNewFile(project.path);
          }
        }}
      />
    );
  }
```

---

### Step 6: Add Keyboard Shortcuts

**File**: `src/app/App.tsx` or `src/app/TabManager.tsx`

**Global Keyboard Handler**:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+T: Open new tab scope popover
    if ((e.metaKey || e.ctrlKey) && e.key === 't') {
      e.preventDefault();
      setShowNewTabPopover(true); // Opens NewTabScopePopover
    }

    // Cmd+W: Close tab
    if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
      e.preventDefault();
      if (activeTabId) {
        closeTab(activeTabId);
      }
    }

    // Cmd+N: New note (in project context)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab?.type === 'project' && activeTab.resource.projectId) {
        e.preventDefault();
        // Trigger new file creation
        // This will depend on how NotebookTree handlers are exposed
      }
    }

    // Cmd+1 through Cmd+9: Switch to tab by index
    if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      if (tabs[index]) {
        selectTab(tabs[index].id);
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [tabs, activeTabId, closeTab, selectTab]);
```

---

### Step 7: Create Keyboard Shortcuts Modal

**File**: `src/shared/components/KeyboardShortcutsModal.tsx` - **NEW FILE**

**Trigger**: Settings icon in ProjectSidebar

**Design**:
- Clean modal with glass morphism background
- Organized by category (Navigation, Tabs, Files, etc.)
- Each shortcut row: Action name + Keyboard combination
- Responsive to platform (⌘ on Mac, Ctrl on Windows)

**Shortcut Categories**:

**Tabs**:
- `⌘ T` - New tab
- `⌘ W` - Close tab
- `⌘ 1-9` - Switch to tab by number
- `⌘ ⇧ [` - Previous tab
- `⌘ ⇧ ]` - Next tab

**Files**:
- `⌘ N` - New note
- `⌘ O` - Go to file (search)
- `⌘ S` - Save file
- `⌘ ⇧ S` - Save all

**Navigation**:
- `⌘ K` - Search library
- `⌘ P` - Go to project
- `⌘ B` - Toggle sidebar
- `⌘ \` - Toggle sidebar (alternative)

**View**:
- `⌘ ,` - Open settings
- `⌘ /` - Toggle keyboard shortcuts
- `⌘ ⇧ P` - Command palette (future)

**Editor**:
- `⌘ E` - Toggle edit/preview mode
- `⌘ ⇧ V` - Paste as plain text

**Component Structure**:
```tsx
import { Dialog, VStack, HStack, Text, Kbd, Box, Grid, GridItem } from '@chakra-ui/react';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { motion } from 'framer-motion';

const MotionBox = motion.create(Box);

interface KeyboardShortcut {
  action: string;
  keys: string[];
  description?: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: KeyboardShortcut[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { colorMode } = useColorMode();

  const categories: ShortcutCategory[] = [
    {
      title: 'Tabs',
      shortcuts: [
        { action: 'New tab', keys: ['⌘', 'T'] },
        { action: 'Close tab', keys: ['⌘', 'W'] },
        { action: 'Switch to tab 1-9', keys: ['⌘', '1-9'] },
        { action: 'Previous tab', keys: ['⌘', '⇧', '['] },
        { action: 'Next tab', keys: ['⌘', '⇧', ']'] },
      ],
    },
    {
      title: 'Files',
      shortcuts: [
        { action: 'New note', keys: ['⌘', 'N'] },
        { action: 'Go to file', keys: ['⌘', 'O'], description: 'Coming soon' },
        { action: 'Save file', keys: ['⌘', 'S'] },
        { action: 'Save all', keys: ['⌘', '⇧', 'S'] },
      ],
    },
    {
      title: 'Navigation',
      shortcuts: [
        { action: 'Search library', keys: ['⌘', 'K'], description: 'Coming soon' },
        { action: 'Go to project', keys: ['⌘', 'P'], description: 'Coming soon' },
        { action: 'Toggle sidebar', keys: ['⌘', 'B'] },
        { action: 'Toggle sidebar', keys: ['⌘', '\\'] },
      ],
    },
    {
      title: 'View',
      shortcuts: [
        { action: 'Keyboard shortcuts', keys: ['⌘', '/'] },
        { action: 'Command palette', keys: ['⌘', '⇧', 'P'], description: 'Coming soon' },
      ],
    },
    {
      title: 'Editor',
      shortcuts: [
        { action: 'Toggle edit/preview', keys: ['⌘', 'E'] },
        { action: 'Paste as plain text', keys: ['⌘', '⇧', 'V'] },
      ],
    },
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <Dialog.Backdrop
        bg={colorMode === 'light' ? 'blackAlpha.300' : 'blackAlpha.600'}
        backdropFilter="blur(8px)"
      />
      <Dialog.Positioner>
        <Dialog.Content
          asChild
          bg={colorMode === 'light' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 20, 25, 0.85)'}
          backdropFilter="blur(20px) saturate(180%)"
          borderWidth="1px"
          borderColor={colorMode === 'light' ? 'blackAlpha.100' : 'whiteAlpha.200'}
          boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        >
          <MotionBox
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Dialog.Header>
              <Dialog.Title fontSize="xl" fontWeight="semibold">
                Keyboard Shortcuts
              </Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" gap={6}>
                {categories.map((category, idx) => (
                  <Box key={idx}>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      color="text.secondary"
                      mb={3}
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      {category.title}
                    </Text>
                    <VStack align="stretch" gap={2}>
                      {category.shortcuts.map((shortcut, shortcutIdx) => (
                        <HStack
                          key={shortcutIdx}
                          justify="space-between"
                          px={3}
                          py={2}
                          borderRadius="md"
                          _hover={{
                            bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50',
                          }}
                        >
                          <VStack align="start" gap={0}>
                            <Text fontSize="sm" color="text.primary">
                              {shortcut.action}
                            </Text>
                            {shortcut.description && (
                              <Text fontSize="xs" color="text.tertiary" fontStyle="italic">
                                {shortcut.description}
                              </Text>
                            )}
                          </VStack>
                          <HStack gap={1}>
                            {shortcut.keys.map((key, keyIdx) => (
                              <Kbd
                                key={keyIdx}
                                fontSize="xs"
                                px={2}
                                py={1}
                                borderRadius="md"
                                bg={colorMode === 'light' ? 'blackAlpha.100' : 'whiteAlpha.200'}
                                color="text.primary"
                                fontWeight="medium"
                              >
                                {key}
                              </Kbd>
                            ))}
                          </HStack>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </Dialog.Body>

            <Dialog.CloseTrigger />
          </MotionBox>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
```

**Integration with ProjectSidebar**:

**File**: `src/views/project/ProjectSidebar.tsx`

**Add state for modal**:
```tsx
const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
```

**Update settings icon onClick** (find the LuSettings IconButton):
```tsx
<IconButton
  variant="ghost"
  size="xs"
  aria-label="Keyboard Shortcuts"
  onClick={() => setShowKeyboardShortcuts(true)}
>
  <LuSettings />
</IconButton>
```

**Render modal at end of component**:
```tsx
<KeyboardShortcutsModal
  isOpen={showKeyboardShortcuts}
  onClose={() => setShowKeyboardShortcuts(false)}
/>
```

**Add keyboard shortcut to toggle modal** (Cmd+/):
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      setShowKeyboardShortcuts(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## Testing Checklist

### Navigation Behavior
- [ ] Click kit in sidebar → opens in **current tab** (not new tab)
- [ ] Click walkthrough → opens in **current tab**
- [ ] Click diagram → opens in **current tab**
- [ ] Click file in NotebookTree → opens in **current tab**
- [ ] Cmd+Click kit → opens in **new tab** (future enhancement)

### New Tab Creation (via Scope Popover)
- [ ] Click "+" button → opens NewTabScopePopover
- [ ] Cmd+T → opens NewTabScopePopover
- [ ] Popover shows blur backdrop with spotlighted "+" button
- [ ] Clicking blur backdrop closes popover
- [ ] Escape key closes popover

### Scope Selection (Stage 1)
- [ ] Popover shows "Library" option with icon and description
- [ ] Popover shows list of available projects
- [ ] Project list matches projects from tab context
- [ ] Clicking "Library" → transitions to Stage 2 with library actions
- [ ] Clicking a project → transitions to Stage 2 with project actions

### Action Buttons (Stage 2)
- [ ] Library scope shows: Search library, Browse projects
- [ ] Project scope shows: New note, Find file, Browse resources
- [ ] "New note" → creates tab and triggers file creation
- [ ] "Browse projects" (library) → creates library tab
- [ ] "Browse resources" (project) → creates project tab with kits view
- [ ] Keyboard shortcuts displayed correctly
- [ ] Stage transition is smooth (framer-motion)

### Empty Tab Actions
- [ ] "Create new note (⌘ N)" → creates file, opens in edit mode
- [ ] "Go to file (⌘ O)" → shows "coming soon" toast (search not implemented)
- [ ] "Close tab (⌘ W)" → closes current tab

### Keyboard Shortcuts
- [ ] Cmd+W → closes active tab
- [ ] Cmd+T → creates new tab
- [ ] Cmd+1 through Cmd+9 → switches to tab by index
- [ ] Cmd+N → creates new note (in project context)
- [ ] Cmd+/ → opens keyboard shortcuts modal
- [ ] Cmd+B or Cmd+\ → toggles sidebar

### Keyboard Shortcuts Modal
- [ ] Settings icon in sidebar → opens modal
- [ ] Modal shows all shortcuts organized by category
- [ ] Modal has glass morphism styling matching app design
- [ ] Close button works
- [ ] Cmd+/ toggles modal
- [ ] ESC closes modal

### Edge Cases
- [ ] Close all tabs → creates default home tab
- [ ] Close last project tab → switches to home tab
- [ ] Create new tab in library context → shows library-specific EmptyTabState

---

## Visual Changes

**Before**:
- Every click creates a new tab
- No way to create empty tabs
- Empty state only shows "EmptyProjectState" with generic message
- No scope selection for new tabs

**After**:
- Clicks navigate within current tab
- "+" button opens spotlight popover for scope selection
- Two-stage flow: Choose scope (Library/Project) → See context actions
- Blur backdrop with spotlighted trigger (matches premium IDE aesthetic)
- Context-aware actions based on selected scope
- Smooth transitions between stages
- Matches professional IDE feel (VS Code, Cursor, Obsidian) with elevated UX

---

## Files to Modify

1. `src/tabs/BrowserTabs.tsx` - ✅ Add "+" button (DONE)
2. `src/shared/components/SpotlightBackdrop.tsx` - **NEW FILE** - Reusable blur backdrop for spotlight pattern
3. `src/shared/components/NewTabScopePopover.tsx` - **NEW FILE** - Two-stage popover for tab scope selection
4. `src/shared/components/EmptyTabState.tsx` - **NEW FILE** - Empty tab state component (may be superseded by popover)
5. `src/shared/components/KeyboardShortcutsModal.tsx` - **NEW FILE** - Keyboard shortcuts modal
6. `src/views/project/ProjectView.tsx` - Wire "+" button handler to open popover + Change `openInNewTab` → `openInCurrentTab`
7. `src/views/project/ProjectSidebar.tsx` - Wire settings icon to keyboard shortcuts modal
8. `src/views/project/components/SidebarMenuItem.tsx` - Add Cmd+Click detection
9. `src/app/TabManager.tsx` - Add global keyboard shortcuts (Cmd+T opens popover)

---

## Success Criteria

- ✅ Navigation happens in current tab by default
- ✅ New tabs created via scope selection popover (+ button, Cmd+T)
- ✅ Spotlight popover follows `.bluekit/kits/spotlight-popover-flow.md` pattern
- ✅ Blur backdrop with cloned trigger element (+ button) remains sharp
- ✅ Two-stage popover flow works smoothly (Scope → Actions)
- ✅ Library and Project scopes show appropriate action buttons
- ✅ Tab creation is context-aware based on selected scope
- ✅ Keyboard shortcuts work (Cmd+T, Cmd+W, Cmd+1-9, Cmd+/, etc.)
- ✅ Keyboard shortcuts modal accessible via settings icon and Cmd+/
- ✅ All shortcuts documented and discoverable
- ✅ No tab proliferation - user maintains control over tab count
- ✅ Matches professional IDE behavior with elevated UX polish

---

## Next Steps

After Phase 4:
- **Phase 5**: Implement file search (Cmd+O)
- **Phase 6**: Implement project picker (Cmd+P)
- **Phase 7**: Add "Open in New Tab" context menu
- **Phase 8**: Tab groups and split views (future)

---

## Notes

**Why this matters**:
- Tab proliferation is a major UX issue in many apps
- Users expect IDE-like tab behavior (VS Code, Cursor)
- Explicit tab creation gives users control
- Empty state guides users to available actions

**Design Philosophy**:
- **Default = Safe**: Navigation in current tab (doesn't clutter workspace)
- **Explicit = Powerful**: New tabs when user requests (maintains focus)
- **Discoverable = Helpful**: Empty state shows available actions + shortcuts
