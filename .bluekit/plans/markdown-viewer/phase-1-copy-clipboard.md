# Phase 1: Copy to Clipboard

## Overview
Add a floating toolbar with copy functionality to the ResourceMarkdownViewer.

## Implementation Details

### Step 1: Create ViewerToolbar Component

```typescript
// src/components/workstation/ViewerToolbar.tsx
import { HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { LuCopy, LuCheck } from 'react-icons/lu';
import { useState } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';

interface ViewerToolbarProps {
  content: string;
  // Future props for other features
}

export default function ViewerToolbar({ content }: ViewerToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <HStack
      position="absolute"
      top={4}
      right={4}
      gap={1}
      p={2}
      borderRadius="lg"
      css={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Tooltip content={copied ? 'Copied!' : 'Copy markdown'}>
        <IconButton
          aria-label="Copy markdown"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
        >
          {copied ? <LuCheck /> : <LuCopy />}
        </IconButton>
      </Tooltip>
    </HStack>
  );
}
```

### Step 2: Update ResourceMarkdownViewer

```typescript
// Add to ResourceMarkdownViewer.tsx

import ViewerToolbar from './ViewerToolbar';

// In the component, wrap content in position: relative container:
<Box position="relative" h="100%">
  <ViewerToolbar content={content} />
  {/* existing content */}
</Box>
```

### Step 3: Add Tauri Permission (if not already present)

Check `src-tauri/tauri.conf.json` for clipboard permissions:
```json
{
  "tauri": {
    "allowlist": {
      "clipboard": {
        "writeText": true,
        "readText": true
      }
    }
  }
}
```

## Testing Checklist

- [ ] Copy button appears in top-right corner
- [ ] Clicking copy writes full markdown to clipboard
- [ ] Button shows checkmark briefly after copy
- [ ] Tooltip displays correct state
- [ ] Works with large markdown files
- [ ] Works with special characters and unicode

## Dependencies

None - uses existing Tauri clipboard API.
