---
id: global-action-bar
alias: Global Action Bar
type: kit
is_base: false
version: 2
tags: [ui-component, selection, bulk-actions]
description: 'Context-aware floating action bar for bulk operations on selected artifacts (kits, walkthroughs, agents, diagrams)'
---

# Global Action Bar Component

## Overview

A context-aware floating action bar that appears when artifacts are selected, providing bulk operations like delete, publish to library, and add to project. The component features:

- **Selection Summary**: Visual breakdown of selected items by type with icons
- **Type-Aware Operations**: Handles kits, walkthroughs, agents, and diagrams uniformly
- **Priority Handling**: Hides automatically when tasks are selected (TasksActionBar takes priority)
- **Portal Rendering**: Renders globally above all content using Chakra UI's Portal
- **Async Operations**: Handles IPC calls with loading states and toast notifications

## Prerequisites

### 1. Enhanced Selection Context

The component uses an enhanced selection context (`SelectionContext.tsx`) that provides:

- `selectedItems`: Array of selected items with id, name, type, and path
- `hasArtifactSelection`: Boolean indicating if any artifacts are selected
- `hasTaskSelection`: Boolean indicating if any tasks are selected
- `clearSelection()`: Clears all selections
- `getItemsByType(type)`: Filters items by type ('Kit', 'Walkthrough', 'Agent', 'Diagram')

**Selection Types:**
```typescript
export type SelectionType =
  | 'Kit'
  | 'Walkthrough'
  | 'Agent'
  | 'Diagram'
  | 'Task'
  | 'Template'
  | 'Collection'
  | 'Project';
```

### 2. IPC Commands

The component requires backend IPC commands for artifact operations:

- `invokeCopyKitToProject(kitPath, projectPath)`
- `invokeCopyWalkthroughToProject(walkthroughPath, projectPath)`
- `invokeCopyDiagramToProject(diagramPath, projectPath)`
- Future: `invokeCopyAgentToProject`, delete commands

### 3. UI Dependencies

**Chakra UI v3:**
- ActionBar component for floating bar
- Portal for global rendering
- Toast/Toaster for notifications
- Button, HStack, VStack, Box, Text, Icon

**Icons (react-icons):**
```bash
npm install react-icons
```

Icons used: `LuTrash2`, `LuFolderPlus`, `LuBookOpen`, `LuPackage`, `LuBot`, `LuNetwork`

## Implementation Steps

### Step 1: Import Dependencies

```typescript
import { useState, useEffect } from "react";
import { Button, HStack, Text, ActionBar, Portal, Box, VStack, Icon } from "@chakra-ui/react";
import { LuTrash2, LuFolderPlus, LuBookOpen, LuPackage, LuBot, LuNetwork } from "react-icons/lu";
import { toaster } from "../ui/toaster";
import { useSelection } from "../../contexts/SelectionContext";
import { ProjectEntry, invokeCopyKitToProject, invokeCopyWalkthroughToProject, invokeCopyDiagramToProject } from "../../ipc";
import AddToProjectPopover from "./AddToProjectPopover";
```

**Key Dependencies:**
- **React hooks**: `useState` for loading state, `useEffect` for syncing visibility
- **Chakra UI**: ActionBar, Portal, layout components (HStack, VStack, Box)
- **Icons**: Type-specific icons (LuPackage for kits, LuBookOpen for walkthroughs, etc.)
- **IPC**: Backend command wrappers for copying artifacts
- **AddToProjectPopover**: Reusable project selection popover component

### Step 2: Component State and Selection Logic

```typescript
export default function GlobalActionBar() {
  const { selectedItems, hasArtifactSelection, hasTaskSelection, clearSelection, getItemsByType } = useSelection();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Sync visibility with selection state
  // Hide when tasks are selected (TasksActionBar takes priority)
  useEffect(() => {
    if (hasArtifactSelection && !hasTaskSelection) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [hasArtifactSelection, hasTaskSelection]);

  // Don't render if no artifacts selected or tasks are selected
  if (!hasArtifactSelection || hasTaskSelection || !isOpen) {
    return null;
  }

  // Group selected items by type
  const kits = getItemsByType('Kit');
  const walkthroughs = getItemsByType('Walkthrough');
  const agents = getItemsByType('Agent');
  const diagrams = getItemsByType('Diagram');
  const totalCount = selectedItems.length;
```

**Key State Management:**
- **loading**: Tracks async operation state (disables buttons during operations)
- **isOpen**: Controls ActionBar visibility (synced with selection state)
- **Priority system**: Hides when tasks are selected (allows TasksActionBar to take over)
- **Type filtering**: Groups items by type for type-specific operations

### Step 3: Build Selection Summary

Create a visual breakdown showing counts per artifact type with icons:

```typescript
const getSelectionSummary = () => {
  const parts: { count: number; label: string; icon: React.ReactNode }[] = [];

  if (kits.length > 0) {
    parts.push({
      count: kits.length,
      label: kits.length === 1 ? 'kit' : 'kits',
      icon: <LuPackage />
    });
  }
  if (walkthroughs.length > 0) {
    parts.push({
      count: walkthroughs.length,
      label: walkthroughs.length === 1 ? 'walkthrough' : 'walkthroughs',
      icon: <LuBookOpen />
    });
  }
  if (agents.length > 0) {
    parts.push({
      count: agents.length,
      label: agents.length === 1 ? 'agent' : 'agents',
      icon: <LuBot />
    });
  }
  if (diagrams.length > 0) {
    parts.push({
      count: diagrams.length,
      label: diagrams.length === 1 ? 'diagram' : 'diagrams',
      icon: <LuNetwork />
    });
  }

  return parts;
};

const selectionSummary = getSelectionSummary();
```

**Display Format**: "3 📦 • 2 📖 • 1 🤖 selected"

### Step 4: Implement Action Handlers

#### Delete Handler (Placeholder)
```typescript
const handleDelete = async () => {
  try {
    setLoading(true);
    // TODO: Implement actual delete IPC calls
    // await Promise.all([
    //   ...kits.map(kit => invokeDeleteKit(kit.path)),
    //   ...walkthroughs.map(wt => invokeDeleteWalkthrough(wt.path)),
    //   ...agents.map(agent => invokeDeleteAgent(agent.path)),
    //   ...diagrams.map(diagram => invokeDeleteDiagram(diagram.path)),
    // ]);

    toaster.create({
      type: "success",
      title: "Artifacts deleted",
      description: `${totalCount} artifact${totalCount !== 1 ? "s" : ""} deleted`,
    });

    clearSelection();
  } catch (error) {
    toaster.create({
      type: "error",
      title: "Error",
      description: `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  } finally {
    setLoading(false);
  }
};
```

#### Add to Project Handler
```typescript
const handleConfirmAddToProject = async (selectedProjects: ProjectEntry[]) => {
  try {
    setLoading(true);
    const copyPromises: Promise<void>[] = [];

    // Copy each artifact type to each selected project
    for (const kit of kits) {
      for (const project of selectedProjects) {
        if (kit.path) {
          copyPromises.push(invokeCopyKitToProject(kit.path, project.path));
        }
      }
    }

    for (const walkthrough of walkthroughs) {
      for (const project of selectedProjects) {
        if (walkthrough.path) {
          copyPromises.push(invokeCopyWalkthroughToProject(walkthrough.path, project.path));
        }
      }
    }

    for (const diagram of diagrams) {
      for (const project of selectedProjects) {
        if (diagram.path) {
          copyPromises.push(invokeCopyDiagramToProject(diagram.path, project.path));
        }
      }
    }

    await Promise.all(copyPromises);

    toaster.create({
      type: "success",
      title: "Artifacts added",
      description: `Added ${totalCount} artifact${totalCount !== 1 ? "s" : ""} to ${selectedProjects.length} project${selectedProjects.length !== 1 ? "s" : ""}`,
    });

    clearSelection();
  } catch (error) {
    toaster.create({
      type: "error",
      title: "Error",
      description: `Failed to add: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    throw error;
  } finally {
    setLoading(false);
  }
};
```

### Step 5: Render the UI

```typescript
return (
  <ActionBar.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} closeOnInteractOutside={false}>
    <Portal>
      <ActionBar.Positioner>
        <ActionBar.Content>
          <VStack align="stretch" gap={0}>
            {/* Selection Summary Header */}
            <Box pb={1} mt={-0.5}>
              <HStack gap={1.5} justify="center" wrap="wrap">
                {selectionSummary.map((part, index) => (
                  <HStack key={index} gap={1}>
                    {index > 0 && (
                      <Text fontSize="xs" color="text.secondary">•</Text>
                    )}
                    <Text fontSize="xs" color="text.secondary">{part.count}</Text>
                    <Icon fontSize="xs" color="text.secondary">{part.icon}</Icon>
                  </HStack>
                ))}
                <Text fontSize="xs" color="text.secondary">selected</Text>
              </HStack>
            </Box>

            {/* Action Buttons */}
            <HStack gap={2}>
              <Button
                variant="surface"
                colorPalette="red"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                <HStack gap={2}>
                  <LuTrash2 />
                  <Text>Delete</Text>
                </HStack>
              </Button>

              <ActionBar.Separator />

              <Button variant="outline" size="sm" onClick={handlePublishToLibrary} disabled={loading}>
                <HStack gap={2}>
                  <LuBookOpen />
                  <Text>Publish to Library</Text>
                </HStack>
              </Button>

              <AddToProjectPopover
                onConfirm={handleConfirmAddToProject}
                itemCount={totalCount}
                sourceFiles={selectedItems.map(item => ({
                  path: item.path || '',
                  name: item.name,
                  type: item.type.toLowerCase() as 'kit' | 'walkthrough' | 'diagram' | 'agent'
                }))}
                trigger={
                  <Button variant="outline" size="sm" disabled={loading}>
                    <HStack gap={2}>
                      <LuFolderPlus />
                      <Text>Add to Project</Text>
                    </HStack>
                  </Button>
                }
              />
            </HStack>
          </VStack>
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
```

**UI Structure:**
- **VStack wrapper**: Vertically stacks summary header and action buttons
- **Selection summary**: Shows counts with type icons (e.g., "3 📦 • 2 📖 selected")
- **Delete button**: Red surface variant for destructive action
- **Publish button**: Outline variant (feature not yet implemented)
- **Add to Project**: Uses `AddToProjectPopover` component with trigger button

## Integration

### Add to App Root

Import and render the component at the root level, inside your `SelectionProvider`:

```typescript
import GlobalActionBar from './components/GlobalActionBar';
import { SelectionProvider } from './contexts/SelectionContext';

function App() {
  return (
    <SelectionProvider>
      {/* Your app content */}
      <GlobalActionBar />
    </SelectionProvider>
  );
}
```

## Key Architectural Patterns

### 1. Priority-Based Rendering

The component conditionally renders based on selection state hierarchy:

```typescript
// Priority: TasksActionBar > GlobalActionBar
if (!hasArtifactSelection || hasTaskSelection || !isOpen) {
  return null;
}
```

**Why**: Prevents UI conflicts when multiple action bars could appear simultaneously.

### 2. Type-Aware Bulk Operations

Operations are grouped by artifact type for type-specific IPC calls:

```typescript
const kits = getItemsByType('Kit');
const walkthroughs = getItemsByType('Walkthrough');

// Then process each type separately
for (const kit of kits) {
  copyPromises.push(invokeCopyKitToProject(kit.path, project.path));
}
```

**Why**: Different artifact types require different backend commands.

### 3. Async Operation Handling

Standard pattern for all async operations:

```typescript
const handleAction = async () => {
  try {
    setLoading(true);
    // Perform operation
    await Promise.all(promises);

    // Success feedback
    toaster.create({ type: "success", ... });
    clearSelection();
  } catch (error) {
    // Error feedback
    toaster.create({ type: "error", ... });
  } finally {
    setLoading(false);
  }
};
```

**Features:**
- Loading state disables buttons during operation
- Toast notifications for user feedback
- Clears selection on success
- Error handling with user-friendly messages

### 4. Portal Rendering

```typescript
<Portal>
  <ActionBar.Positioner>
    <ActionBar.Content>
      {/* Content */}
    </ActionBar.Content>
  </ActionBar.Positioner>
</Portal>
```

**Why**: Renders outside normal DOM hierarchy for proper z-index layering and global positioning.

### 5. Selection Summary Pattern

Dynamically builds type-specific breakdown with icons:

```typescript
const parts = [];
if (kits.length > 0) {
  parts.push({ count: kits.length, label: 'kit', icon: <LuPackage /> });
}
// Renders as: "3 📦 • 2 📖 selected"
```

**Why**: Provides at-a-glance understanding of what's selected without opening details.

## Current Limitations & Future Work

### Incomplete Features

1. **Delete Functionality**:
   - Backend IPC commands not yet implemented (`invokeDeleteKit`, etc.)
   - Currently shows success toast but doesn't actually delete files
   - See planning doc: `.bluekit/plan/resource-edit-delete.md`

2. **Agent Copying**:
   - `invokeCopyAgentToProject` not yet implemented
   - Agents are skipped during "Add to Project" operations

3. **Publish to Library**:
   - Placeholder handler with no implementation
   - Intended for sharing artifacts globally

### Known Issues

- **Loading state**: Buttons disabled during operations, but no visual loading indicator
- **Error recovery**: Failed operations don't provide retry mechanism
- **Partial failures**: If some copies succeed and others fail, no rollback mechanism

## Extension Points

### Adding New Actions

1. Create async handler following the standard pattern
2. Add button to the `<HStack gap={2}>` section
3. Use appropriate icon and variant

```typescript
const handleCustomAction = async () => {
  try {
    setLoading(true);
    // Implementation
    toaster.create({ type: "success", ... });
    clearSelection();
  } catch (error) {
    toaster.create({ type: "error", ... });
  } finally {
    setLoading(false);
  }
};
```

### Supporting New Artifact Types

1. Add type to `SelectionType` in `SelectionContext`
2. Add to `getSelectionSummary()` with appropriate icon
3. Implement type-specific IPC commands
4. Add to bulk operation handlers

## Best Practices

1. **Always clear selection on success**: Prevents confusion after operations complete
2. **Use loading state**: Prevents duplicate operations from rapid clicking
3. **Provide specific error messages**: Include operation type and item count in messages
4. **Type-specific icons**: Makes selection summary immediately scannable
5. **Batch IPC calls**: Use `Promise.all()` for parallel operations on multiple items

## Related Components

- **SelectionContext** (`src/contexts/SelectionContext.tsx`): State management for selections
- **TasksActionBar** (`src/components/tasks/TasksActionBar.tsx`): Priority action bar for task selections
- **AddToProjectPopover** (`src/components/shared/AddToProjectPopover.tsx`): Project selection dialog
- Tab content components: Kits, Walkthroughs, Agents, Diagrams (handle item selection)
