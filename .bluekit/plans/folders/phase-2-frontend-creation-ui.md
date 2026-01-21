---
id: folders-phase-2-frontend-creation-ui
alias: "Phase 2: Frontend Folder Creation UI"
type: plan
tags: [frontend, react, folders, ui]
description: "Update CreateFolderPopover to collect description and tags when creating folders"
status: pending
---

# Phase 2: Frontend Folder Creation UI

## Overview
Enhance the folder creation modal to collect metadata (description, tags) and pass it to the backend via the now-functional `config` parameter.

## Prerequisites
- ✅ Phase 1 complete (backend supports config.json)

## Goals
- ✅ Update `CreateFolderPopover` to have description + tags fields
- ✅ Generate proper `FolderConfig` with timestamps
- ✅ Update IPC call documentation
- ✅ Remove "ignored config" comments from `folders.ts`

## Files to Modify

### 1. `src/components/shared/CreateFolderPopover.tsx`

**Current:** Only collects folder name

**New:** Multi-step form or expanded single form

#### Option A: Single Form (Recommended)
```tsx
interface FormData {
  name: string;
  description: string;
  tags: string;  // Comma-separated, parsed on submit
}

// Form layout:
<VStack gap={3}>
  {/* Name Field (required) */}
  <Field.Root required>
    <Field.Label>Folder Name</Field.Label>
    <Input
      value={formData.name}
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      placeholder="e.g., UI Components"
    />
  </Field.Root>

  {/* Description Field (optional) */}
  <Field.Root>
    <Field.Label>Description</Field.Label>
    <Textarea
      value={formData.description}
      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      placeholder="What's this folder for?"
      rows={2}
    />
  </Field.Root>

  {/* Tags Field (optional) */}
  <Field.Root>
    <Field.Label>Tags</Field.Label>
    <Input
      value={formData.tags}
      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
      placeholder="react, components, ui (comma-separated)"
    />
    <Field.HelperText>
      Separate tags with commas
    </Field.HelperText>
  </Field.Root>

  {/* Buttons */}
  <Flex justify="flex-end" gap={2} w="100%">
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button
      colorPalette="primary"
      onClick={handleCreate}
      disabled={!formData.name.trim()}
    >
      Create Folder
    </Button>
  </Flex>
</VStack>
```

#### Option B: Two-Step Form (More Elegant)
Step 1: Name
Step 2: Description + Tags (optional, can skip)

#### Handle Submit
```tsx
const handleCreate = async () => {
  const folderName = formData.name.trim();

  // Parse tags
  const tags = formData.tags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // Build FolderConfig
  const config: Partial<FolderConfig> = {
    id: `${folderName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name: folderName,
    description: formData.description.trim() || undefined,
    tags: tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Call parent handler
  await onConfirm(folderName, config);

  // Reset and close
  setFormData({ name: '', description: '', tags: '' });
  onClose();
};
```

### 2. `src/ipc/folders.ts`

**Update documentation and remove "ignored" warnings:**

```typescript
/**
 * Creates a new folder in an artifact directory with metadata.
 *
 * Creates a folder at the root level of the artifact type directory
 * and writes a config.json file with the provided metadata.
 *
 * @param projectPath - Path to the project root
 * @param artifactType - Type directory ('kits', 'walkthroughs', 'diagrams')
 * @param parentPath - Reserved for future use (pass null)
 * @param folderName - Name of the new folder (used as directory name)
 * @param config - Folder configuration (name, description, tags, etc.)
 * @returns Promise resolving to the path of the created folder
 *
 * @example
 * ```typescript
 * const config: FolderConfig = {
 *   id: 'ui-components-1234567890',
 *   name: 'UI Components',
 *   description: 'Reusable React components',
 *   tags: ['react', 'ui', 'components'],
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString(),
 * };
 * const path = await invokeCreateArtifactFolder(
 *   '/path/to/project',
 *   'kits',
 *   null,
 *   'ui-components',
 *   config
 * );
 * ```
 */
export async function invokeCreateArtifactFolder(
  projectPath: string,
  artifactType: string,
  parentPath: string | null,
  folderName: string,
  config: FolderConfig
): Promise<string> {
  // ... existing implementation
}
```

**Undeprecate `invokeUpdateFolderConfig`:**
```typescript
/**
 * Updates a folder's config.json file.
 *
 * Overwrites the existing config.json with new metadata.
 * Used for editing folder details after creation.
 *
 * @param folderPath - Full path to the folder
 * @param config - Updated folder configuration
 * @returns Promise resolving when update is complete
 *
 * @example
 * ```typescript
 * await invokeUpdateFolderConfig(
 *   '/path/to/project/.bluekit/kits/ui-components',
 *   { ...existingConfig, description: 'Updated description' }
 * );
 * ```
 */
export async function invokeUpdateFolderConfig(
  folderPath: string,
  config: FolderConfig
): Promise<void> {
  return await invokeWithTimeout<void>(
    'update_folder_config',
    { folderPath, config },
    5000
  );
}
```

### 3. `src/ipc/types.ts`

**Update `ArtifactFolder` documentation:**
```typescript
/**
 * Folder information for artifact organization.
 *
 * Represents a folder within an artifact type directory (kits, walkthroughs, diagrams).
 * Folders are flat (no nesting) and may contain a config.json with metadata.
 *
 * This interface must match the `ArtifactFolder` struct in `src-tauri/src/commands.rs`.
 */
export interface ArtifactFolder {
  /** Folder name (directory name) */
  name: string;
  /** Full path to the folder */
  path: string;
  /** Always undefined - flat folder structure (no nesting) */
  parentPath?: string;
  /** Parsed config.json if exists, undefined otherwise */
  config?: FolderConfig;
  /** Number of direct child artifacts */
  artifactCount: number;
  /** Always 0 - flat folder structure */
  folderCount: number;
}
```

### 4. Update Usage in Tab Components

**KitsTabContent.tsx (line ~182):**
```tsx
const handleCreateFolder = async (name: string, config: Partial<FolderConfig>) => {
  const fullConfig: FolderConfig = {
    id: config.id || `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name: config.name || name,
    description: config.description,
    tags: config.tags || [],
    createdAt: config.createdAt || new Date().toISOString(),
    updatedAt: config.updatedAt || new Date().toISOString(),
  };

  try {
    await invokeCreateArtifactFolder(projectPath, 'kits', null, name, fullConfig);
    const newFolders = await invokeGetArtifactFolders(projectPath, 'kits');
    setFolders(newFolders);
    toaster.create({
      type: 'success',
      title: 'Folder created',
      description: `Created "${fullConfig.name}"`,
    });
  } catch (err) {
    console.error('Failed to create folder:', err);
    toaster.create({
      type: 'error',
      title: 'Failed to create folder',
      description: err instanceof Error ? err.message : 'Unknown error',
    });
    throw err;
  }
};
```

**WalkthroughsTabContent.tsx (line ~162):**
Same pattern as above, just change `'kits'` to `'walkthroughs'`

## Testing Checklist

### Manual Testing
- [ ] Create folder with name only → has config.json with name
- [ ] Create folder with description → config.json includes description
- [ ] Create folder with tags → config.json has tags array
- [ ] Create folder with all fields → config.json is complete
- [ ] Validation: empty name shows error
- [ ] Validation: duplicate name shows error
- [ ] Cancel button resets form
- [ ] Tag parsing handles: "react, typescript, ui"
- [ ] Tag parsing handles: "react,typescript,ui" (no spaces)
- [ ] Tag parsing handles: "react,,ui" (empty entries ignored)

### Integration Testing
- [ ] Created folder appears in list immediately
- [ ] Folder card displays description (if provided)
- [ ] Folder card displays tags (if provided)
- [ ] Reload app → folder config persists
- [ ] File watcher updates when config.json changes externally

## UI/UX Considerations

### Field Ordering
1. Name (required, focus on open)
2. Description (optional, clearly marked)
3. Tags (optional, with helper text)

### Placeholder Examples
- Name: "UI Components", "Authentication Flows", "Database Patterns"
- Description: "Reusable React components for the design system"
- Tags: "react, components, ui" or "auth, security, jwt"

### Validation Messages
- Empty name: "Folder name is required"
- Duplicate name: "A folder with this name already exists"
- Invalid characters: "Folder name contains invalid characters" (if backend validates)

### Success Feedback
Toast notification: "Folder 'UI Components' created with 3 tags"

## Acceptance Criteria
- ✅ Modal collects name, description, and tags
- ✅ Form has clear labels and placeholders
- ✅ Validation prevents empty/duplicate names
- ✅ Tags are parsed correctly from comma-separated input
- ✅ Created folders have config.json with all metadata
- ✅ Success/error feedback via toasts
- ✅ Form resets after creation
- ✅ Documentation updated (no more "ignored" warnings)

## Dependencies
**Before:** Phase 1 (backend config support)
**After:** Phase 3 (folder display + animations)

## Design Reference
Look at `CreatePlanDialog` for form patterns and validation strategies.
