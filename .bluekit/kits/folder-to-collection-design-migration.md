---
id: folder-to-collection-design-migration
alias: Folder to Collection Design Migration
type: kit
is_base: false
version: 1
tags:
  - migration
  - ui-design
  - react
description: Migrate folder system to match library collection design pattern with simplified config-free folders and modal-based navigation
---
# Folder to Collection Design Migration Kit

## End State

After applying this kit, the folder system in KitsTabContent and WalkthroughsTabContent will have:

**Simplified Folder Data Model:**
- Folders no longer read from config.json files
- Folder metadata is derived from filesystem only: name, path, parentPath
- ArtifactFolder interface contains only: name, path, parentPath, artifactCount, folderCount
- No FolderConfig, groups, color, or description stored in filesystem

**New SimpleFolderCard Component:**
- Visual design matching LibraryCollectionCard exactly
- MdFolder icon positioned above card (top: -8px, left: 12px)
- Icon color transitions from secondary.solid to primary.solid on hover
- GlassCard with "medium" intensity
- Centered content with folder name (2-line clamp)
- Inventory band showing item counts with type-specific icons
- Menu button (top-right) with Edit and Delete options
- Minimum height: 100px

**New FolderView Component:**
- Full-screen view when clicking a folder (like CollectionView)
- Sticky header with back button (LuArrowLeft) and MdFolder icon
- "Folder" label + folder name in header
- SimpleGrid of artifact cards (base: 1, md: 2, lg: 3 columns)
- Empty state: "No items in this folder"
- Selection bar integration for bulk operations

**Tab Component Updates:**
- KitsTabContent has viewingFolder state for modal navigation
- WalkthroughsTabContent has same viewingFolder state
- Conditional rendering: show FolderView when folder selected, otherwise show folder grid
- Folder grid uses SimpleGrid with responsive columns (base: 2, md: 3, lg: 4, xl: 5)

**Simplified Dialogs:**
- CreateFolderDialog only accepts folder name (no description, tags, color)
- EditFolderDialog becomes RenameFolder dialog (name only)
- DeleteFolderDialog unchanged

**Backend Changes:**
- get_artifact_folders() no longer reads config.json
- create_artifact_folder() just creates empty folder
- update_folder_config() removed or deprecated
- delete_artifact_folder() and move operations unchanged

## Implementation Principles

- Match LibraryCollectionCard visual design exactly for consistency
- Use MdFolder icon from react-icons/md for folder representation
- Follow CollectionView pattern for FolderView navigation
- Maintain GlassCard component for glassmorphism styling
- Keep selection system intact for bulk operations
- Preserve file watcher integration for real-time updates
- Use conditional rendering for folder drill-down (no route changes)
- Simple state management: viewingFolder holds current folder or null

## Verification Criteria

After generation, verify:
- ✓ Folder cards display only name and inventory count (no description, tags)
- ✓ MdFolder icon appears above each folder card
- ✓ Clicking folder card opens FolderView with back navigation
- ✓ Back button in FolderView returns to folder grid
- ✓ Create folder dialog only asks for name
- ✓ Folders can be renamed via edit dialog
- ✓ Folders can be deleted (moves contents to root)
- ✓ Artifacts can be moved to/from folders
- ✓ Selection system works inside FolderView
- ✓ No config.json files created when making new folders
- ✓ File watcher updates work correctly

## Interface Contracts

**Provides:**
- SimpleFolderCard component with props: folder, artifacts, onOpenFolder, onDeleteFolder, onEditFolder
- FolderView component with props: folder, artifacts, selectedItems, onBack, onViewArtifact
- Simplified ArtifactFolder type: name, path, parentPath, artifactCount, folderCount

**Requires:**
- GlassCard component for glassmorphism styling
- Selection context for item selection state
- File watcher integration for real-time updates
- react-icons/md for MdFolder icon
- react-icons/lu for LuArrowLeft and item type icons

**Compatible With:**
- LibraryTabContent: Shares design patterns (CollectionView, GlassCard)
- SelectionContext: Uses same selection system
- File watcher system: Responds to filesystem changes
