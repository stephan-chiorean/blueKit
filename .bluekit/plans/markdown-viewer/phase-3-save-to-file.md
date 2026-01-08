# Phase 3: Save to File

## Overview
Enable saving edited content back to the source file via Tauri IPC.

## Implementation Details

### Step 1: Create Rust IPC Command

```rust
// src-tauri/src/commands.rs

/// Write content to a resource file (kit, walkthrough, etc.)
#[tauri::command]
pub async fn write_resource_file(path: String, content: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let file_path = Path::new(&path);

    // Validate the path exists and is a file
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    // Validate it's a markdown file in a .bluekit directory
    let path_str = path.to_lowercase();
    if !path_str.contains(".bluekit") {
        return Err("Can only write to files within .bluekit directories".to_string());
    }

    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    if !["md", "mmd", "mermaid"].contains(&extension) {
        return Err(format!("Unsupported file type: {}", extension));
    }

    // Write the file
    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))?;

    tracing::info!("Wrote resource file: {}", path);
    Ok(())
}
```

### Step 2: Register Command in main.rs

```rust
// src-tauri/src/main.rs

// Add to invoke_handler![]
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::write_resource_file,
])
```

### Step 3: Create TypeScript IPC Wrapper

```typescript
// src/ipc.ts

/**
 * Write content to a resource file.
 * Only works for files within .bluekit directories.
 */
export async function writeResourceFile(
  path: string,
  content: string
): Promise<void> {
  return invokeWithTimeout('write_resource_file', { path, content }, 5000);
}
```

### Step 4: Add Dirty State Tracking

```typescript
// src/components/workstation/ResourceMarkdownViewer.tsx

interface ResourceMarkdownViewerProps {
  resource: ResourceFile;
  content: string;
  onContentChange?: (content: string) => void; // Notify parent of changes
}

export default function ResourceMarkdownViewer({
  resource,
  content: originalContent,
  onContentChange
}: ResourceMarkdownViewerProps) {
  const [content, setContent] = useState(originalContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);

  // Track if content has changed from original
  const isDirty = content !== originalContent;

  // Reset content when resource changes
  useEffect(() => {
    setContent(originalContent);
    setLastSaveError(null);
  }, [originalContent, resource.path]);

  // Warn before navigation if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ... rest of component
}
```

### Step 5: Implement Save Logic

```typescript
// src/components/workstation/ResourceMarkdownViewer.tsx

import { writeResourceFile } from '../../ipc';

const handleSave = async () => {
  if (!isDirty || isSaving) return;

  setIsSaving(true);
  setLastSaveError(null);

  try {
    await writeResourceFile(resource.path, content);
    // Content is now saved, notify parent if callback provided
    onContentChange?.(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    setLastSaveError(message);
    console.error('Failed to save:', error);
  } finally {
    setIsSaving(false);
  }
};

// Keyboard shortcut: Cmd/Ctrl + S
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [content, isDirty, isSaving]);
```

### Step 6: Update ViewerToolbar

```typescript
// src/components/workstation/ViewerToolbar.tsx

import { LuSave, LuLoader } from 'react-icons/lu';

interface ViewerToolbarProps {
  content: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  saveError?: string | null;
}

export default function ViewerToolbar({
  content,
  viewMode,
  onViewModeChange,
  isDirty,
  isSaving,
  onSave,
  saveError,
}: ViewerToolbarProps) {
  return (
    <HStack /* existing styles */>
      {/* Dirty indicator */}
      {isDirty && (
        <Box w={2} h={2} borderRadius="full" bg="orange.400" />
      )}

      {/* Save button - only visible when dirty */}
      {isDirty && (
        <Tooltip content={saveError || 'Save (Cmd+S)'}>
          <IconButton
            aria-label="Save"
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            colorPalette={saveError ? 'red' : undefined}
          >
            {isSaving ? <LuLoader className="animate-spin" /> : <LuSave />}
          </IconButton>
        </Tooltip>
      )}

      {/* Copy button */}
      {/* View mode toggle */}
    </HStack>
  );
}
```

### Step 7: Handle Front Matter Preservation

When content is edited (in Phase 4), ensure front matter is preserved:

```typescript
// src/components/workstation/utils/frontMatterUtils.ts

/**
 * Extract front matter and body from markdown content
 */
export function parseFrontMatter(content: string): {
  frontMatter: string | null;
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

  if (match) {
    return {
      frontMatter: match[1],
      body: match[2],
    };
  }

  return {
    frontMatter: null,
    body: content,
  };
}

/**
 * Reconstruct markdown with front matter
 */
export function reconstructContent(frontMatter: string | null, body: string): string {
  if (frontMatter) {
    return `---\n${frontMatter}\n---\n${body}`;
  }
  return body;
}
```

## Testing Checklist

- [ ] Rust command compiles without errors
- [ ] Command is properly registered in main.rs
- [ ] TypeScript wrapper has correct types
- [ ] Save button appears only when content is dirty
- [ ] Save button shows loading state during save
- [ ] Keyboard shortcut Cmd/Ctrl+S works
- [ ] Error state displays when save fails
- [ ] Front matter is preserved after save
- [ ] File watcher picks up saved changes
- [ ] Warning appears when navigating with unsaved changes
- [ ] Only .bluekit files can be saved (security check)

## Security Considerations

1. **Path Validation**: Only allow writes to `.bluekit` directories
2. **Extension Check**: Only allow `.md`, `.mmd`, `.mermaid` files
3. **Existence Check**: File must already exist (no arbitrary file creation)
4. **Content Validation**: Consider validating YAML front matter before save

## Error Handling

| Error | User Message |
|-------|--------------|
| File not found | "File no longer exists. It may have been moved or deleted." |
| Permission denied | "Unable to save. Check file permissions." |
| Invalid path | "Cannot save to this location." |
| Network/IPC error | "Save failed. Please try again." |

## Dependencies

None - uses existing Tauri IPC infrastructure.
