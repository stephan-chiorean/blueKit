# Phase 2: View as Markdown Toggle

## Overview
Allow users to toggle between the rendered preview and raw markdown source.

## Implementation Details

### Step 1: Define View Mode Type

```typescript
// src/components/workstation/types.ts (or inline)
export type ViewMode = 'preview' | 'source';
```

### Step 2: Create MarkdownSource Component

```typescript
// src/components/workstation/MarkdownSource.tsx
import { Box } from '@chakra-ui/react';
import ShikiCodeBlock from './ShikiCodeBlock';

interface MarkdownSourceProps {
  content: string;
}

export default function MarkdownSource({ content }: MarkdownSourceProps) {
  return (
    <Box h="100%" overflow="auto" p={4}>
      <ShikiCodeBlock code={content} language="markdown" />
    </Box>
  );
}
```

### Step 3: Update ViewerToolbar

```typescript
// src/components/workstation/ViewerToolbar.tsx
import { LuCopy, LuCheck, LuEye, LuCode } from 'react-icons/lu';
import { ViewMode } from './types';

interface ViewerToolbarProps {
  content: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewerToolbar({
  content,
  viewMode,
  onViewModeChange
}: ViewerToolbarProps) {
  // ... existing copy logic

  return (
    <HStack /* existing styles */>
      {/* Copy button */}

      {/* View Mode Toggle */}
      <Tooltip content={viewMode === 'preview' ? 'View source' : 'View preview'}>
        <IconButton
          aria-label="Toggle view mode"
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange(viewMode === 'preview' ? 'source' : 'preview')}
        >
          {viewMode === 'preview' ? <LuCode /> : <LuEye />}
        </IconButton>
      </Tooltip>
    </HStack>
  );
}
```

### Step 4: Update ResourceMarkdownViewer

```typescript
// src/components/workstation/ResourceMarkdownViewer.tsx

import { useState, useEffect } from 'react';
import MarkdownSource from './MarkdownSource';
import ViewerToolbar from './ViewerToolbar';
import { ViewMode } from './types';

export default function ResourceMarkdownViewer({ resource, content }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');

  // Keyboard shortcut: Cmd/Ctrl + Shift + M
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        setViewMode(prev => prev === 'preview' ? 'source' : 'preview');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box position="relative" h="100%">
      <ViewerToolbar
        content={content}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'preview' ? (
        // Existing ReactMarkdown preview content
        <Box p={6} /* existing styles */>
          {/* ... existing preview rendering ... */}
        </Box>
      ) : (
        <MarkdownSource content={content} />
      )}
    </Box>
  );
}
```

### Step 5: Preserve Scroll Position (Optional Enhancement)

```typescript
// Track scroll position when switching modes
const previewScrollRef = useRef(0);
const sourceScrollRef = useRef(0);

const handleViewModeChange = (newMode: ViewMode) => {
  // Save current scroll position
  const scrollContainer = document.querySelector('[data-scroll-container]');
  if (scrollContainer) {
    if (viewMode === 'preview') {
      previewScrollRef.current = scrollContainer.scrollTop;
    } else {
      sourceScrollRef.current = scrollContainer.scrollTop;
    }
  }

  setViewMode(newMode);

  // Restore scroll position after render
  requestAnimationFrame(() => {
    const newContainer = document.querySelector('[data-scroll-container]');
    if (newContainer) {
      newContainer.scrollTop = newMode === 'preview'
        ? previewScrollRef.current
        : sourceScrollRef.current;
    }
  });
};
```

## Testing Checklist

- [ ] Toggle button appears in toolbar
- [ ] Clicking toggle switches between preview and source
- [ ] Source view shows raw markdown with syntax highlighting
- [ ] Keyboard shortcut Cmd/Ctrl+Shift+M works
- [ ] View mode persists during component lifecycle
- [ ] Front matter visible in source view
- [ ] Line numbers display in source view
- [ ] Large files render efficiently in source view

## Dependencies

None - uses existing ShikiCodeBlock component.
