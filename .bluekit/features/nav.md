# Navigation UX: Command Palette

**Status:** Implementation Plan
**Created:** 2026-01-19

---

## The Vision

Kill the boring top drawer. Replace it with a **Command Palette** - a spotlight-style modal that feels native, fast, and delightful. Think Raycast meets Linear meets Notion.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    ┌─────────────────────────────┐                  │
│                    │  🔍 Search or jump to...    │                  │
│                    └─────────────────────────────┘                  │
│                                                                     │
│                    ┌─────────────────────────────┐                  │
│                    │                             │                  │
│                    │  ░░░░░░░░░░░░░░░░░░░░░░░░░ │                  │
│                    │  ░░ COMMAND PALETTE ░░░░░░ │                  │
│                    │  ░░░░░░░░░░░░░░░░░░░░░░░░░ │                  │
│                    │                             │                  │
│                    └─────────────────────────────┘                  │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this is better:**
- Keyboard-first (⌘K to open)
- Search-first (type to filter immediately)
- Context-aware (shows relevant actions)
- Faster than navigating menus
- Feels premium and modern

---

## UX Specification

### Opening the Palette

| Trigger | Action |
|---------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| Click hamburger menu | Open command palette |
| `Escape` | Close palette |
| Click backdrop | Close palette |

### The Palette Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│    ┌───────────────────────────────────────────────────────────┐   │
│    │ 🔍  Type a command or search...                    ⌘K     │   │
│    └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│    ┌───────────────────────────────────────────────────────────┐   │
│    │                                                           │   │
│    │  QUICK ACTIONS                                            │   │
│    │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │   │
│    │  │ ＋ New Kit      │ │ ＋ New Project  │ │ ＋ New Task │ │   │
│    │  └─────────────────┘ └─────────────────┘ └─────────────┘ │   │
│    │                                                           │   │
│    │  ─────────────────────────────────────────────────────── │   │
│    │                                                           │   │
│    │  SPACES                                                   │   │
│    │  → Home                                    ⌘1             │   │
│    │  → Library                                 ⌘2             │   │
│    │  → Marketplace                             ⌘3             │   │
│    │                                                           │   │
│    │  ─────────────────────────────────────────────────────── │   │
│    │                                                           │   │
│    │  RECENT PROJECTS                                          │   │
│    │  📁 blueKit                               2 hours ago     │   │
│    │  📁 my-app                                yesterday       │   │
│    │  📁 design-system                         3 days ago      │   │
│    │                                                           │   │
│    │  ─────────────────────────────────────────────────────── │   │
│    │                                                           │   │
│    │  TOOLS                                                    │   │
│    │  📋 Tasks                                  ⌘T             │   │
│    │  🔄 Workflows                              ⌘W             │   │
│    │  📝 Plans                                  ⌘P             │   │
│    │                                                           │   │
│    │  ─────────────────────────────────────────────────────── │   │
│    │                                                           │   │
│    │  ⚙️  Settings                              ⌘,             │   │
│    │  👤  Account                                              │   │
│    │  🗄️  Archive                                              │   │
│    │                                                           │   │
│    └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│    ↑↓ Navigate  ↵ Select  esc Close                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Search Behavior

As user types, the palette filters in real-time:

```
┌───────────────────────────────────────────────────────────────┐
│ 🔍  kit                                                       │
└───────────────────────────────────────────────────────────────┘

ACTIONS
＋ New Kit                                            Create
📝 Edit Kit Metadata                                  Edit

KITS (from current project)
📄 auth-patterns.md                                   Kit
📄 api-design.md                                      Kit
📄 react-hooks.md                                     Kit

LIBRARY
📚 jwt-authentication                                 Library Kit
📚 form-validation                                    Library Kit
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` `↓` | Move selection |
| `Enter` | Execute selected action |
| `Tab` | Jump to next section |
| `Escape` | Close palette |
| `⌘1-9` | Quick jump to numbered item |
| `⌘↵` | Execute and keep palette open |

---

## Visual Design

### Glass Morphism (Match App Style)

```css
.command-palette {
  background: rgba(20, 20, 25, 0.85);
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    0 24px 80px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(59, 130, 246, 0.1);
}

.command-palette-light {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 24px 80px rgba(0, 0, 0, 0.15);
}
```

### Animation Specs

**Opening:**
```
- Backdrop: fade in 150ms ease-out
- Palette: scale from 0.96 → 1, opacity 0 → 1, 200ms spring(1, 80, 10)
- Content sections: stagger in 30ms each, translateY(8px) → 0
```

**Closing:**
```
- Palette: scale 1 → 0.98, opacity 1 → 0, 150ms ease-in
- Backdrop: fade out 100ms
```

**Selection highlight:**
```
- Background slides to selected item
- 120ms spring animation
- Subtle glow on selected item
```

### Color Palette

```
Primary actions:    #3B82F6 (blue-500)
Hover state:        rgba(59, 130, 246, 0.15)
Selected state:     rgba(59, 130, 246, 0.2)
Section headers:    #6B7280 (gray-500)
Keyboard hints:     #9CA3AF (gray-400)
Borders:            rgba(255, 255, 255, 0.1)
```

### Typography

```
Search input:       16px, regular
Section headers:    11px, semibold, uppercase, letter-spacing: 0.05em
Item labels:        14px, medium
Item hints:         12px, regular, muted
Keyboard shortcuts: 12px, mono, muted
```

---

## Sections Breakdown

### 1. Quick Actions (Horizontal Pills)

Always visible at top. Context-aware based on current view.

**On Home:**
```
[＋ New Kit] [＋ New Project] [＋ New Task]
```

**On Project Detail:**
```
[＋ New Kit] [＋ New Walkthrough] [＋ New Agent] [＋ New Task]
```

**On Library:**
```
[＋ New Collection] [＋ Import] [↗ Publish]
```

### 2. Spaces (Main Navigation)

```tsx
const spaces = [
  { id: 'home', label: 'Home', icon: LuHome, shortcut: '⌘1' },
  { id: 'library', label: 'Library', icon: LuLibrary, shortcut: '⌘2' },
  { id: 'marketplace', label: 'Marketplace', icon: LuStore, shortcut: '⌘3', badge: 'Coming Soon' },
];
```

### 3. Recent Projects

Show last 5 opened projects with relative timestamps.

```tsx
interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpened: Date;
  icon?: string; // Custom project icon/emoji
}
```

Click → Navigate to project detail page.

### 4. Tools

```tsx
const tools = [
  { id: 'tasks', label: 'Tasks', icon: LuListTodo, shortcut: '⌘T', description: 'Manage your tasks' },
  { id: 'workflows', label: 'Workflows', icon: LuWorkflow, shortcut: '⌘W', description: 'Automation flows' },
  { id: 'plans', label: 'Plans', icon: LuMap, shortcut: '⌘P', description: 'Claude & Cursor plans' },
  { id: 'timeline', label: 'Timeline', icon: LuGitBranch, description: 'Git history & checkpoints' },
];
```

### 5. Settings & Account

```tsx
const bottomActions = [
  { id: 'settings', label: 'Settings', icon: LuSettings, shortcut: '⌘,' },
  { id: 'account', label: 'Account', icon: LuUser },
  { id: 'archive', label: 'Archive', icon: LuArchive },
  { id: 'help', label: 'Help & Feedback', icon: LuHelpCircle },
];
```

---

## Search Implementation

### Search Sources

When user types, search across:

1. **Actions** (fuzzy match against action labels)
2. **Projects** (name, path)
3. **Kits in current project** (name, alias, tags)
4. **Library artifacts** (name, description, tags)
5. **Tasks** (title)
6. **Settings pages** (keywords)

### Search Algorithm

```typescript
interface SearchResult {
  type: 'action' | 'project' | 'kit' | 'library' | 'task' | 'setting';
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType;
  onSelect: () => void;
  keywords: string[];
  score: number;
}

function search(query: string, sources: SearchSource[]): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return getDefaultResults(); // Show default sections
  }

  const results: SearchResult[] = [];

  for (const source of sources) {
    const sourceResults = source.search(normalizedQuery);
    results.push(...sourceResults);
  }

  // Sort by score (higher = better match)
  results.sort((a, b) => b.score - a.score);

  // Group by type
  return groupAndLimit(results, 5); // Max 5 per type
}
```

### Scoring

```typescript
function calculateScore(query: string, item: Searchable): number {
  let score = 0;

  // Exact match in label = highest
  if (item.label.toLowerCase() === query) score += 100;

  // Starts with query = high
  if (item.label.toLowerCase().startsWith(query)) score += 50;

  // Contains query = medium
  if (item.label.toLowerCase().includes(query)) score += 25;

  // Tag match = medium
  if (item.tags?.some(t => t.toLowerCase().includes(query))) score += 20;

  // Fuzzy match = low
  if (fuzzyMatch(item.label, query)) score += 10;

  // Recency boost for projects
  if (item.lastOpened) {
    const hoursSinceOpened = (Date.now() - item.lastOpened) / (1000 * 60 * 60);
    score += Math.max(0, 10 - hoursSinceOpened / 24); // +10 if opened today, decays
  }

  return score;
}
```

---

## Component Architecture

```
src/components/command-palette/
├── CommandPalette.tsx          # Main component
├── CommandPaletteProvider.tsx  # Context for open/close state
├── SearchInput.tsx             # Search input with icon
├── QuickActions.tsx            # Horizontal action pills
├── SectionGroup.tsx            # Section with header and items
├── CommandItem.tsx             # Individual command row
├── KeyboardHint.tsx            # Keyboard shortcut display
├── useCommandPalette.ts        # Hook for palette state
├── useSearch.ts                # Search logic hook
├── useKeyboardNavigation.ts    # Arrow key navigation
├── types.ts                    # TypeScript interfaces
└── animations.ts               # Framer motion variants
```

---

## Implementation Plan

### Phase 1: Core Palette (Day 1)

**Files to create:**
- `CommandPaletteProvider.tsx` - Context for global state
- `CommandPalette.tsx` - Main modal component
- `useCommandPalette.ts` - Hook for open/close

**Tasks:**
1. Create context provider with open/close state
2. Add `⌘K` global keyboard listener
3. Build basic modal with backdrop
4. Implement open/close animations
5. Wire up hamburger menu to open palette
6. Remove old NavigationDrawer

**Code sketch:**

```tsx
// CommandPaletteProvider.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  // Global ⌘K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return context;
}
```

```tsx
// CommandPalette.tsx
import { Portal, Box } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommandPalette } from './CommandPaletteProvider';

const MotionBox = motion(Box);

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const { colorMode } = useColorMode();

  const bgColor = colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.9)'
    : 'rgba(20, 20, 25, 0.9)';

  return (
    <AnimatePresence>
      {isOpen && (
        <Portal>
          {/* Backdrop */}
          <MotionBox
            position="fixed"
            inset={0}
            bg="blackAlpha.600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            style={{ backdropFilter: 'blur(4px)' }}
            zIndex={1000}
          />

          {/* Palette */}
          <MotionBox
            position="fixed"
            top="15%"
            left="50%"
            width="640px"
            maxHeight="70vh"
            overflow="hidden"
            borderRadius="16px"
            initial={{ opacity: 0, scale: 0.96, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.98, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              background: bgColor,
              backdropFilter: 'blur(40px) saturate(180%)',
              border: colorMode === 'light'
                ? '1px solid rgba(0, 0, 0, 0.08)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: colorMode === 'light'
                ? '0 24px 80px rgba(0, 0, 0, 0.15)'
                : '0 24px 80px rgba(0, 0, 0, 0.5)',
            }}
            zIndex={1001}
          >
            {/* Content goes here */}
          </MotionBox>
        </Portal>
      )}
    </AnimatePresence>
  );
}
```

---

### Phase 2: Search & Navigation (Day 2)

**Files to create:**
- `SearchInput.tsx`
- `useSearch.ts`
- `useKeyboardNavigation.ts`

**Tasks:**
1. Build search input with autofocus
2. Implement search across actions
3. Add keyboard navigation (↑↓ arrows)
4. Highlight selected item
5. Execute action on Enter

**Code sketch:**

```tsx
// useKeyboardNavigation.ts
import { useState, useCallback, useEffect } from 'react';

export function useKeyboardNavigation<T>(items: T[], onSelect: (item: T) => void) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selectedIndex]) {
          onSelect(items[selectedIndex]);
        }
        break;
    }
  }, [items, selectedIndex, onSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { selectedIndex, setSelectedIndex };
}
```

---

### Phase 3: Content Sections (Day 3)

**Files to create:**
- `QuickActions.tsx`
- `SectionGroup.tsx`
- `CommandItem.tsx`

**Tasks:**
1. Build quick action pills
2. Build section groups with headers
3. Build command items with icons/shortcuts
4. Wire up all actions to actual navigation

**Code sketch:**

```tsx
// CommandItem.tsx
interface CommandItemProps {
  icon: React.ComponentType;
  label: string;
  description?: string;
  shortcut?: string;
  isSelected: boolean;
  onClick: () => void;
}

export function CommandItem({
  icon: Icon,
  label,
  description,
  shortcut,
  isSelected,
  onClick
}: CommandItemProps) {
  const { colorMode } = useColorMode();

  return (
    <Box
      as="button"
      w="100%"
      px={4}
      py={3}
      display="flex"
      alignItems="center"
      gap={3}
      borderRadius="lg"
      cursor="pointer"
      transition="all 0.1s"
      onClick={onClick}
      bg={isSelected
        ? colorMode === 'light' ? 'blue.50' : 'rgba(59, 130, 246, 0.15)'
        : 'transparent'
      }
      _hover={{
        bg: colorMode === 'light' ? 'gray.50' : 'whiteAlpha.100',
      }}
    >
      <Icon size={18} />

      <Box flex={1} textAlign="left">
        <Text fontSize="sm" fontWeight="medium">{label}</Text>
        {description && (
          <Text fontSize="xs" color="gray.500">{description}</Text>
        )}
      </Box>

      {shortcut && (
        <Text
          fontSize="xs"
          fontFamily="mono"
          color="gray.400"
          bg={colorMode === 'light' ? 'gray.100' : 'whiteAlpha.100'}
          px={2}
          py={0.5}
          borderRadius="md"
        >
          {shortcut}
        </Text>
      )}
    </Box>
  );
}
```

---

### Phase 4: Full Search Integration (Day 4)

**Tasks:**
1. Index all searchable content
2. Implement fuzzy search with Fuse.js
3. Show search results grouped by type
4. Handle empty states
5. Add loading states for async searches

**Search Configuration:**

```tsx
// searchSources.ts
import Fuse from 'fuse.js';

export function createProjectSearchSource(projects: Project[]) {
  const fuse = new Fuse(projects, {
    keys: ['name', 'path', 'description'],
    threshold: 0.4,
    includeScore: true,
  });

  return {
    id: 'projects',
    label: 'Projects',
    search: (query: string) => {
      return fuse.search(query).map(result => ({
        type: 'project' as const,
        id: result.item.id,
        label: result.item.name,
        description: result.item.path,
        icon: LuFolder,
        score: 1 - (result.score || 0),
        onSelect: () => navigateToProject(result.item),
      }));
    },
  };
}
```

---

### Phase 5: Polish & Shortcuts (Day 5)

**Tasks:**
1. Add all global shortcuts (⌘1-9, ⌘T, etc.)
2. Add footer with keyboard hints
3. Smooth scroll to selected item
4. Add subtle hover sounds (optional)
5. Test all navigation paths
6. Performance optimization (virtualize long lists)
7. Accessibility audit

---

## Global Keyboard Shortcuts

Register these globally in `CommandPaletteProvider`:

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command palette |
| `⌘1` | Go to Home |
| `⌘2` | Go to Library |
| `⌘3` | Go to Marketplace |
| `⌘T` | Open Tasks |
| `⌘P` | Open Plans |
| `⌘,` | Open Settings |
| `⌘N` | New Kit (context-aware) |
| `⌘⇧N` | New Project |

**Implementation:**

```tsx
// In CommandPaletteProvider
useEffect(() => {
  const handleGlobalShortcuts = (e: KeyboardEvent) => {
    // Only handle if palette is closed (palette handles its own shortcuts)
    if (isOpen) return;

    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.key === '1') {
      e.preventDefault();
      navigateTo('home');
    }
    if (isMod && e.key === '2') {
      e.preventDefault();
      navigateTo('library');
    }
    if (isMod && e.key === 't') {
      e.preventDefault();
      navigateTo('tasks');
    }
    // ... etc
  };

  window.addEventListener('keydown', handleGlobalShortcuts);
  return () => window.removeEventListener('keydown', handleGlobalShortcuts);
}, [isOpen, navigateTo]);
```

---

## Migration Plan

### Step 1: Delete Old Navigation

```bash
rm src/components/NavigationDrawer.tsx
```

### Step 2: Update Header

```tsx
// Header.tsx
import { useCommandPalette } from './command-palette/CommandPaletteProvider';

// In component:
const { open: openPalette } = useCommandPalette();

// Replace NavigationMenu with simple button:
<IconButton
  variant="ghost"
  size="md"
  aria-label="Open command palette (⌘K)"
  onClick={openPalette}
  _hover={{ bg: 'transparent' }}
>
  <LuMenu />
</IconButton>
```

### Step 3: Update App.tsx

```tsx
import { CommandPaletteProvider } from './components/command-palette/CommandPaletteProvider';
import { CommandPalette } from './components/command-palette/CommandPalette';

function App() {
  return (
    <GitHubAuthProvider>
      <NotepadProvider>
        <TimerProvider>
          <WorkstationProvider>
            <CommandPaletteProvider>
              <AppContent />
              <CommandPalette />
            </CommandPaletteProvider>
          </WorkstationProvider>
        </TimerProvider>
      </NotepadProvider>
    </GitHubAuthProvider>
  );
}
```

---

## File Structure After Implementation

```
src/
├── components/
│   ├── command-palette/
│   │   ├── index.ts                    # Barrel exports
│   │   ├── CommandPalette.tsx          # Main component
│   │   ├── CommandPaletteProvider.tsx  # Context + global shortcuts
│   │   ├── SearchInput.tsx             # Search input with icon
│   │   ├── QuickActions.tsx            # Horizontal action pills
│   │   ├── SectionGroup.tsx            # Section with header
│   │   ├── CommandItem.tsx             # Individual row
│   │   ├── RecentProjects.tsx          # Recent projects section
│   │   ├── KeyboardHint.tsx            # Shortcut display
│   │   ├── PaletteFooter.tsx           # Navigation hints footer
│   │   ├── hooks/
│   │   │   ├── useSearch.ts
│   │   │   └── useKeyboardNavigation.ts
│   │   ├── search/
│   │   │   ├── searchSources.ts
│   │   │   ├── projectSearch.ts
│   │   │   ├── kitSearch.ts
│   │   │   └── actionSearch.ts
│   │   ├── types.ts
│   │   └── animations.ts
│   ├── Header.tsx                      # Updated - uses useCommandPalette
│   └── NavigationDrawer.tsx            # DELETED
├── App.tsx                             # Updated - wraps with provider
└── ...
```

---

## Success Criteria

- [ ] `⌘K` opens palette instantly (<50ms perceived)
- [ ] Search filters results as user types (<100ms)
- [ ] Arrow keys navigate smoothly between items
- [ ] Enter executes selected action and closes
- [ ] Escape closes palette from any state
- [ ] All global shortcuts work (⌘1, ⌘T, etc.)
- [ ] Animation feels buttery smooth (60fps)
- [ ] Works flawlessly in light and dark mode
- [ ] Accessible (ARIA labels, focus management)
- [ ] No layout shifts or visual glitches
- [ ] Recent projects actually track recency

---

## Future Enhancements

### V2: AI Actions
```
"Create a kit about authentication"
"Find all tasks related to API"
"Summarize what I worked on today"
```

### V3: Slash Commands
```
/new kit → Create kit flow
/search auth → Jump to search with query
/go library → Navigate to library
```

### V4: Command History
Track and show recently executed commands for quick repeat.

### V5: Custom Commands
Let users define their own shortcuts and actions.

---

## Dependencies

Add to `package.json`:
```json
{
  "framer-motion": "^11.0.0",
  "fuse.js": "^7.0.0"
}
```

Check if framer-motion is already installed:
```bash
npm list framer-motion
```

---

## Time Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: Core Palette | 4-6 hours |
| Phase 2: Search & Navigation | 4-6 hours |
| Phase 3: Content Sections | 3-4 hours |
| Phase 4: Full Search | 4-6 hours |
| Phase 5: Polish & Shortcuts | 3-4 hours |
| **Total** | **~3 days** |

---

## Quick Start Tomorrow

1. Check if framer-motion is installed: `npm list framer-motion`
2. If not: `npm install framer-motion fuse.js`
3. Create `src/components/command-palette/` directory
4. Start with `CommandPaletteProvider.tsx` (the context)
5. Build `CommandPalette.tsx` (basic modal)
6. Wire up hamburger menu in `Header.tsx`
7. Test `⌘K` opens the empty palette
8. Then fill in sections one by one

---

## Let's Build Something Beautiful 🚀
