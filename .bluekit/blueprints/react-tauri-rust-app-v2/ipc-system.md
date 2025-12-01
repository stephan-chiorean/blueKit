---
id: ipc-system
type: task
version: 1
blueprint: react-tauri-rust-app-v2
blueprint_name: React + Tauri + Rust Desktop App
layer: 4
layer_name: IPC Communication
---

# Task: IPC System

## Blueprint Context

**Blueprint Goal:** Build a fully functional React/Tauri/Rust desktop application with type-safe IPC, Chakra UI v3, file operations, and real-time file watching

**This Task:** Type-safe IPC communication layer with TypeScript wrapper functions matching all Rust command signatures (Layer 4/6, Task 1/1)

**Task Position:** Fourth layer - requires both backend (Layer 2) and frontend (Layer 3) to be complete

## Execution Instructions

When implementing this task:
1. Read all steps before making changes
2. Execute steps sequentially and completely
3. Run verification commands to ensure success
4. Report errors immediately
5. Only proceed after verification passes

## Requirements

- Backend foundation completed (Layer 2)
- Frontend foundation completed (Layer 3)
- All Rust commands implemented and registered

## Steps

### 1. Create IPC Type Definitions

Create `src/ipc.ts` with TypeScript interfaces matching Rust structs:

- `AppInfo` - Application information structure
- `KitFile` - Kit file information
- `KitFrontMatter` - YAML front matter structure
- `ProjectEntry` - Project registry entry
- `ScrapbookItem` - Scrapbook item (folder or file)
- `BlueprintTask` - Blueprint task structure
- `BlueprintLayer` - Blueprint layer structure
- `BlueprintMetadata` - Blueprint metadata
- `Blueprint` - Complete blueprint structure

Each interface must exactly match the corresponding Rust struct.

### 2. Create IPC Wrapper Functions

Add typed wrapper functions for each Rust command:

- `invokePing()` - Simple ping test
- `invokeGetAppInfo()` - Get application info
- `invokeExampleError()` - Error handling example
- `invokeGetProjectKits()` - Get project kits
- `invokeGetProjectRegistry()` - Get project registry
- `invokeWatchProjectKits()` - Start watching project kits
- `invokeReadFile()` - Read file contents
- `invokeCopyKitToProject()` - Copy kit to project
- `invokeCopyBlueprintToProject()` - Copy blueprint to project
- `invokeGetScrapbookItems()` - Get scrapbook items
- `invokeGetFolderMarkdownFiles()` - Get markdown files from folder
- `invokeGetBlueprints()` - Get all blueprints
- `invokeGetBlueprintTaskFile()` - Get blueprint task file
- `invokeGetProjectDiagrams()` - Get project diagrams

Each function should:
- Use TypeScript generics for type safety
- Match Rust command signature exactly
- Include JSDoc documentation
- Handle parameters correctly

### 3. Add Documentation

Each function should include:
- JSDoc comments explaining what it does
- Parameter descriptions
- Return type descriptions
- Example usage
- Notes about matching Rust signatures

### 4. Export All Functions

Ensure all IPC functions are exported from `src/ipc.ts` so they can be imported in components.

## Verification

Test IPC communication:

```typescript
// In a React component, test IPC communication:
import { invokePing, invokeGetAppInfo } from './ipc';

// Test ping
const pong = await invokePing();
console.log(pong); // Should log "pong"

// Test app info
const info = await invokeGetAppInfo();
console.log(info); // Should log AppInfo object
```

## Completion Criteria

- [ ] All TypeScript interfaces match Rust structs
- [ ] Wrapper functions created for all Rust commands
- [ ] All functions properly typed with TypeScript generics
- [ ] JSDoc documentation added to all functions
- [ ] IPC communication tested and working
- [ ] No TypeScript compilation errors

## Next Steps

After verification passes, proceed to: `file-watching.md` in Layer 5.

