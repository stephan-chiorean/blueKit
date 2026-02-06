# Phase 2: Integration Adapter

**Status:** Not Started
**Duration:** 2-3 days
**Dependencies:** Phase 1 complete

## Overview

Create an adapter component that wraps the new HybridMarkdownEditor with all existing features: auto-save, file watching, search, links, and backlinks. This adapter makes the new editor API-compatible with the old one, enabling easy replacement.

## Goals

- Wire up existing hooks without modification
- Preserve all current functionality
- Make adapter drop-in compatible with old editor
- No changes to parent components yet
- Test integrations individually

## Components to Build

### 1. HybridEditorWithFeatures.tsx

**Location:** `src/shared/components/hybridEditor/HybridEditorWithFeatures.tsx`

**Purpose:** Adapter that combines HybridMarkdownEditor with existing features.

**API:**
```typescript
interface HybridEditorWithFeaturesProps {
  resource: ResourceFile;           // Existing type from codebase
  onSave?: () => void;             // Optional save callback
  showSearch?: boolean;             // Show search UI
  showBacklinks?: boolean;          // Show backlinks panel
}

export function HybridEditorWithFeatures(props: HybridEditorWithFeaturesProps): JSX.Element;
```

**Implementation:**
```tsx
import { useState, useEffect } from 'react';
import { VStack, Box } from '@chakra-ui/react';
import { HybridMarkdownEditor } from './HybridMarkdownEditor';
import { useAutoSave } from '@/shared/hooks/useAutoSave';
import { useFileWatcher } from '@/shared/hooks/useFileWatcher';
import { SearchInMarkdown } from '@/features/search/components/SearchInMarkdown';
import { BacklinksPanel } from '@/features/workstation/components/BacklinksPanel';

export function HybridEditorWithFeatures({
  resource,
  onSave,
  showSearch = false,
  showBacklinks = true,
}: HybridEditorWithFeaturesProps) {
  const [content, setContent] = useState(resource.content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save hook (existing)
  useAutoSave({
    content,
    filePath: resource.path,
    onSave: () => {
      setHasUnsavedChanges(false);
      onSave?.();
    },
  });

  // File watcher hook (existing)
  useFileWatcher({
    filePath: resource.path,
    onFileChange: (newContent) => {
      setContent(newContent);
      setHasUnsavedChanges(false);
    },
  });

  // Track changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);
  };

  return (
    <VStack align="stretch" gap={4} w="100%" h="100%">
      {/* Search UI (if enabled) */}
      {showSearch && (
        <SearchInMarkdown
          content={content}
          onNavigate={(index) => {
            // Scroll to search result
            // TODO: Implement scroll-to-match
          }}
        />
      )}

      {/* Main editor */}
      <Box flex={1} overflowY="auto">
        <HybridMarkdownEditor
          value={content}
          onChange={handleContentChange}
        />
      </Box>

      {/* Backlinks panel (if enabled) */}
      {showBacklinks && (
        <BacklinksPanel
          resourcePath={resource.path}
          projectPath={resource.projectPath}
        />
      )}

      {/* Save indicator */}
      {hasUnsavedChanges && (
        <Box
          position="absolute"
          top={4}
          right={4}
          fontSize="xs"
          color="text.tertiary"
        >
          Unsaved changes...
        </Box>
      )}
    </VStack>
  );
}
```

---

### 2. useAutoSave Hook (Verify Existing)

**Location:** `src/shared/hooks/useAutoSave.ts` (already exists)

**Purpose:** Debounced auto-save with manual save shortcut.

**Expected API:**
```typescript
interface UseAutoSaveOptions {
  content: string;
  filePath: string;
  onSave?: () => void;
  delay?: number;  // Default: 1500ms
}

function useAutoSave(options: UseAutoSaveOptions): void;
```

**Integration:**
- Hook should already work with new editor
- Verify debounce timing (1.5s)
- Test manual save (Cmd+S)
- Ensure no duplicate saves

**If hook doesn't exist or needs changes:**
```tsx
import { useEffect, useRef } from 'react';
import { invokeWriteFile } from '@/ipc';
import { useHotkeys } from '@/shared/hooks/useHotkeys';

export function useAutoSave({
  content,
  filePath,
  onSave,
  delay = 1500,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(content);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (content === lastSavedContentRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      await invokeWriteFile(filePath, content);
      lastSavedContentRef.current = content;
      onSave?.();
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [content, filePath, delay, onSave]);

  // Manual save (Cmd+S)
  useHotkeys('mod+s', async (e) => {
    e.preventDefault();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await invokeWriteFile(filePath, content);
    lastSavedContentRef.current = content;
    onSave?.();
  });
}
```

---

### 3. useFileWatcher Hook (Verify Existing)

**Location:** `src/shared/hooks/useFileWatcher.ts` (already exists)

**Purpose:** Listen for external file changes and update content.

**Expected API:**
```typescript
interface UseFileWatcherOptions {
  filePath: string;
  onFileChange: (newContent: string) => void;
}

function useFileWatcher(options: UseFileWatcherOptions): void;
```

**Integration:**
- Hook listens to Tauri file change events
- Calls `onFileChange` when external edit detected
- Should work without changes

**If hook doesn't exist:**
```tsx
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invokeReadFile } from '@/ipc';

export function useFileWatcher({
  filePath,
  onFileChange,
}: UseFileWatcherOptions) {
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      // Listen for file change events
      const unlistenFn = await listen<string[]>('file-changed', async (event) => {
        const changedPaths = event.payload;
        if (changedPaths.includes(filePath)) {
          const newContent = await invokeReadFile(filePath);
          onFileChange(newContent);
        }
      });
      unlisten = unlistenFn;
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [filePath, onFileChange]);
}
```

---

### 4. SearchInMarkdown Component (Verify Existing)

**Location:** `src/features/search/components/SearchInMarkdown.tsx` (already exists)

**Expected Functionality:**
- Search input field
- Highlight matches in content
- Navigate between matches
- Keyboard shortcut (Cmd+F)

**Integration:**
- Pass content to component
- Component highlights matches
- New editor doesn't need special search support

---

### 5. BacklinksPanel Component (Verify Existing)

**Location:** `src/features/workstation/components/BacklinksPanel.tsx` (already exists)

**Expected Functionality:**
- Show files that link to current resource
- Clickable links to navigate
- Real-time updates

**Integration:**
- Pass `resourcePath` and `projectPath`
- Component queries backlinks independently
- No changes needed

---

## Testing Strategy

### Test 1: Auto-Save Integration

**Setup:**
1. Create test file in demo project
2. Render `HybridEditorWithFeatures` with file path
3. Edit content

**Expected:**
- Changes auto-save after 1.5s
- Manual Cmd+S triggers immediate save
- File watcher detects external changes
- Content updates without losing edit state

**Test Cases:**
- [ ] Edit → Wait 1.5s → File updated
- [ ] Edit → Press Cmd+S → Immediate save
- [ ] External edit → Content updates in editor
- [ ] Rapid edits → Only last version saved (debounced)

---

### Test 2: File Watcher Integration

**Setup:**
1. Open file in HybridEditorWithFeatures
2. Edit file externally (VSCode, terminal)

**Expected:**
- Editor content updates automatically
- No conflicts with auto-save
- User warned if unsaved changes exist

**Test Cases:**
- [ ] External edit → Content refreshes
- [ ] Edit in app → External edit → Conflict detected
- [ ] Multiple rapid external edits → Debounced correctly

---

### Test 3: Search Integration

**Setup:**
1. Enable search UI
2. Enter search term

**Expected:**
- Matches highlighted in preview blocks
- Navigate between matches with arrows
- Cmd+F opens search
- Escape closes search

**Test Cases:**
- [ ] Search term → Matches highlighted
- [ ] Multiple matches → Navigate works
- [ ] Search during edit → Edit mode preserved
- [ ] Clear search → Highlights removed

---

### Test 4: Backlinks Integration

**Setup:**
1. Create file A with link to file B
2. Open file B with backlinks enabled

**Expected:**
- Backlinks panel shows file A
- Click link → Navigates to file A
- Real-time updates when links added/removed

**Test Cases:**
- [ ] File with backlinks → Panel populated
- [ ] No backlinks → Panel shows empty state
- [ ] Add backlink externally → Panel updates
- [ ] Remove backlink → Panel updates

---

## Integration Checklist

- [ ] `useAutoSave` hook works with new editor
- [ ] `useFileWatcher` hook works with new editor
- [ ] `SearchInMarkdown` component renders correctly
- [ ] `BacklinksPanel` component renders correctly
- [ ] Keyboard shortcuts work (Cmd+S, Cmd+F)
- [ ] No prop type mismatches
- [ ] No console errors or warnings

---

## Demo Page Update

**Update:** `src/pages/HybridEditorDemo.tsx`

**Add feature testing:**
```tsx
export default function HybridEditorDemo() {
  const [testMode, setTestMode] = useState<'basic' | 'features'>('basic');

  const mockResource: ResourceFile = {
    path: '/path/to/test.md',
    projectPath: '/path/to/project',
    content: SAMPLE_MARKDOWN,
    // ... other required fields
  };

  return (
    <Box minH="100vh" p={8}>
      <VStack gap={4} maxW="800px" mx="auto">
        <HStack>
          <Button onClick={() => setTestMode('basic')}>
            Basic Editor
          </Button>
          <Button onClick={() => setTestMode('features')}>
            With Features
          </Button>
        </HStack>

        {testMode === 'basic' ? (
          <HybridMarkdownEditor
            value={mockResource.content}
            onChange={(v) => console.log('Changed:', v)}
          />
        ) : (
          <HybridEditorWithFeatures
            resource={mockResource}
            showSearch={true}
            showBacklinks={true}
          />
        )}
      </VStack>
    </Box>
  );
}
```

---

## Acceptance Criteria

- [ ] `HybridEditorWithFeatures` component built
- [ ] Auto-save integration tested
- [ ] File watcher integration tested
- [ ] Search integration verified
- [ ] Backlinks integration verified
- [ ] Demo page updated with feature testing
- [ ] All existing hooks work without modification
- [ ] No regressions in existing features
- [ ] Code reviewed and approved

---

## Next Steps

After Phase 2 completion:
- Tag commit: `hybrid-editor-phase-2-complete`
- Move to Phase 3: Feature Flag
- Begin setting up toggle infrastructure

---

**Files Modified:**
- `src/pages/HybridEditorDemo.tsx` (updated)

**Files Created:**
- `src/shared/components/hybridEditor/HybridEditorWithFeatures.tsx`

**Files Verified (no changes needed):**
- `src/shared/hooks/useAutoSave.ts`
- `src/shared/hooks/useFileWatcher.ts`
- `src/features/search/components/SearchInMarkdown.tsx`
- `src/features/workstation/components/BacklinksPanel.tsx`
