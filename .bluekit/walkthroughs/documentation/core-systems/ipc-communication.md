---
id: ipc-communication
alias: IPC Communication
type: walkthrough
is_base: false
version: 3
tags: [ipc, tauri, typescript, rust, communication, frontend, backend]
description: "Comprehensive technical reference for IPC communication in BlueKit, covering frontend TypeScript layer, Rust backend handlers, type safety, error handling, and how to add new commands"
complexity: comprehensive
format: documentation
---

# IPC Communication in BlueKit

This walkthrough provides a comprehensive technical reference for how Inter-Process Communication (IPC) works in this Tauri application. For a beginner-friendly guide with Express.js metaphors, see the [Understanding Tauri IPC guide](../guide/understanding-tauri-ipc.md).

## Table of Contents

1. [Introduction to IPC in Tauri](#introduction-to-ipc-in-tauri)
2. [The Frontend Layer: TypeScript IPC Wrappers](#the-frontend-layer-typescript-ipc-wrappers)
3. [The Backend Layer: Rust Command Handlers](#the-backend-layer-rust-command-handlers)
4. [The Connection: Command Registration](#the-connection-command-registration)
5. [Type Safety and Serialization](#type-safety-and-serialization)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Real-World Examples](#real-world-examples)
8. [Adding New IPC Commands](#adding-new-ipc-commands)
9. [Best Practices](#best-practices)


### Introduction to IPC in Tauri

#### What is IPC?

Inter-Process Communication (IPC) is the mechanism that allows the frontend (React/TypeScript) and backend (Rust) to communicate in a Tauri application. Unlike traditional web apps where everything runs in the browser, Tauri apps have a native backend that can access system resources, file systems, and perform operations that JavaScript cannot.

#### Why IPC is Needed

- **Security**: The frontend runs in a sandboxed webview and cannot directly access the file system or system APIs
- **Performance**: Rust can perform heavy operations more efficiently than JavaScript
- **Native Integration**: Access to OS features like file watching, system notifications, etc.
- **Type Safety**: TypeScript and Rust types work together to catch errors at compile time

#### The IPC Flow

```
┌─────────────────┐
│  React Component │
│  (TypeScript)    │
└────────┬────────┘
         │ 1. Calls invokePing()
         ▼
┌─────────────────┐
│  src/ipc/index.ts│
│  (TypeScript)   │
└────────┬────────┘
         │ 2. invoke('ping')
         ▼
┌─────────────────┐
│   Tauri Bridge  │
│  (Serialization)│
└────────┬────────┘
         │ 3. JSON over IPC
         ▼
┌─────────────────┐
│  commands.rs    │
│    (Rust)       │
└────────┬────────┘
         │ 4. Returns Result
         ▼
┌─────────────────┐
│   Tauri Bridge  │
│  (Deserialization)
└────────┬────────┘
         │ 5. Promise resolves
         ▼
┌─────────────────┐
│  React Component │
│  Receives result│
└─────────────────┘
```

### The Frontend Layer: TypeScript IPC Wrappers

#### Location: `src/ipc/` (Modular Directory Structure)

The frontend IPC layer is organized as a modular directory structure that serves as a type-safe bridge between React components and Tauri's `invoke` API. Instead of calling `invoke` directly with string command names, we create typed wrapper functions organized by domain.

#### Directory Structure

The IPC layer is split into domain-specific modules for better organization and maintainability:

```
src/ipc/
├── index.ts              # Main entry point - re-exports everything
├── types.ts              # All TypeScript interfaces/types
├── core.ts               # Basic commands (ping, app_info, example_error)
├── projects.ts           # Project registry, artifacts, watchers, project creation
├── files.ts              # File operations (read, write)
├── artifacts.ts          # Artifact operations (kits, walkthroughs, diagrams, blueprints, etc.)
├── folders.ts            # Folder operations
├── tasks.ts              # Database-backed task operations
├── keychain.ts           # Keychain operations
├── auth.ts               # Authentication operations
├── github.ts             # GitHub API operations
└── library.ts            # Library operations
```

**Key Benefits:**
- **Organization**: Related commands are grouped together
- **Maintainability**: Easier to find and modify specific functionality
- **Scalability**: New commands can be added to appropriate modules
- **Backward Compatibility**: `index.ts` re-exports everything, so existing imports continue to work

#### Module Organization

Each module is self-contained and imports only what it needs:

```typescript
// src/ipc/projects.ts
import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { ProjectEntry, ArtifactFile } from './types';

// Module-level state (e.g., cache)
let projectRegistryCache: ProjectEntry[] | null = null;

// Functions exported from this module
export async function invokeGetProjectRegistry(): Promise<ProjectEntry[]> {
  // Implementation...
}

export function invalidateProjectRegistryCache(): void {
  // Implementation...
}
```

The `index.ts` file re-exports everything:

```typescript
// src/ipc/index.ts
export * from './types';      // Re-export all types
export * from './core';       // Re-export core commands
export * from './projects';   // Re-export project commands
// ... etc
```

This means components can still import from `'../ipc'` and get everything:

```typescript
import { 
  invokePing,              // from core.ts
  invokeGetProjectRegistry, // from projects.ts
  ArtifactFile             // from types.ts
} from '../ipc';
```

#### Why Use Wrapper Functions?

1. **Type Safety**: TypeScript knows the exact return type
2. **IDE Autocomplete**: Better developer experience
3. **Centralized Error Handling**: Consistent error handling patterns
4. **Documentation**: JSDoc comments explain usage
5. **Refactoring Safety**: Renaming commands updates all call sites

#### Basic Structure

Each module uses `invokeWithTimeout` (a wrapper around Tauri's `invoke`) for consistent timeout handling:

```typescript
// src/ipc/core.ts
import { invokeWithTimeout } from '../utils/ipcTimeout';

export async function invokePing(): Promise<string> {
  return await invokeWithTimeout<string>('ping', {}, 5000);
}
```

**Breaking it down:**
- `invokeWithTimeout<T>` is a wrapper around Tauri's `invoke` that adds timeout handling
- `<string>` is the TypeScript generic type parameter (the return type)
- `'ping'` is the command name (must match the Rust function name)
- The second argument contains parameters: `{ param: value }` (empty object `{}` if no params)
- The third argument is the timeout in milliseconds (optional, defaults to 30s)

#### Type Definitions

All TypeScript interfaces are centralized in `src/ipc/types.ts`:

```typescript
// src/ipc/types.ts
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}
```

This interface corresponds to the `AppInfo` struct in Rust. The types must match because Tauri serializes Rust structs to JSON, which TypeScript then deserializes.

**Type Organization:**
- All shared types are in `src/ipc/types.ts`
- Domain-specific types (like `GitHubToken`) are imported from their respective type files
- All types are re-exported from `src/ipc/index.ts` for convenience

#### Example: Simple Command (No Parameters)

```typescript
// src/ipc/core.ts
import { invokeWithTimeout } from '../utils/ipcTimeout';

/**
 * Simple ping command to test IPC communication.
 * 
 * @returns A promise that resolves to "pong"
 */
export async function invokePing(): Promise<string> {
  return await invokeWithTimeout<string>('ping', {}, 5000);
}
```

**Usage in React:**
```typescript
import { invokePing } from '../ipc';  // Imports from src/ipc/index.ts

const result = await invokePing();
console.log(result); // "pong"
```

**Note:** Even though the function is defined in `src/ipc/core.ts`, it's imported from `'../ipc'` because `index.ts` re-exports everything. This maintains backward compatibility with existing code.

#### Example: Command with Parameters

```typescript
// src/ipc/projects.ts
import { invokeWithTimeout } from '../utils/ipcTimeout';
import type { ArtifactFile } from './types';

/**
 * Gets all artifact files from a project's .bluekit directory.
 * 
 * @param projectPath - The path to the project root directory
 * @returns A promise that resolves to an array of ArtifactFile objects
 */
export async function invokeGetProjectArtifacts(
  projectPath: string
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_project_artifacts', { projectPath });
}
```

**Key points:**
- Parameters are passed as an object: `{ projectPath }`
- The keys must match the parameter names in the Rust function
- TypeScript infers the parameter types from the function signature
- Functions are organized by domain (this one is in `projects.ts`)

**Usage in React:**
```typescript
import { invokeGetProjectArtifacts } from '../ipc';  // Still imports from index.ts

const artifacts = await invokeGetProjectArtifacts('/path/to/project');
artifacts.forEach(artifact => {
  console.log(artifact.name);
  console.log(artifact.path);
});
```

#### Example: Complex Return Types

```typescript
// src/ipc/types.ts
export interface ArtifactFile {
  name: string;
  path: string;
  content?: string;
  frontMatter?: KitFrontMatter;
}

// src/ipc/projects.ts
import type { ArtifactFile } from './types';

export async function invokeGetProjectArtifacts(
  projectPath: string
): Promise<ArtifactFile[]> {
  return await invokeWithTimeout<ArtifactFile[]>('get_project_artifacts', { projectPath });
}
```

The return type `Promise<ArtifactFile[]>` tells TypeScript that this function returns an array of `ArtifactFile` objects, providing full type checking and autocomplete. Types are imported from `./types` to maintain separation of concerns.

### The Backend Layer: Rust Command Handlers

#### Location: `src-tauri/src/commands.rs`

The backend layer contains all the Rust functions that handle IPC requests. Each function is marked with `#[tauri::command]` and follows a specific pattern.

#### Command Function Requirements

1. **Attribute**: Must have `#[tauri::command]` attribute
2. **Async**: Must be `async fn` (Tauri uses async/await)
3. **Return Type**: Must return `Result<T, E>` for error handling
4. **Serialization**: Parameters and return values must be serializable

#### Basic Command Structure

```rust
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}
```

**Breaking it down:**
- `#[tauri::command]` - Makes this function callable from the frontend
- `pub async fn` - Public async function
- `-> Result<String, String>` - Returns either success (`Ok`) or error (`Err`)
- `Ok("pong".to_string())` - Wraps the success value

#### The Result Type

Rust's `Result<T, E>` is the standard way to handle operations that can fail:

- `Ok(T)` - Success case, contains the value
- `Err(E)` - Error case, contains the error

Tauri automatically converts:
- `Ok(value)` → Promise resolves with the value
- `Err(message)` → Promise rejects with the error

#### Example: Command with Parameters

```rust
#[tauri::command]
pub async fn get_project_kits(
    project_path: String
) -> Result<Vec<KitFile>, String> {
    use std::fs;
    
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    
    // ... file system operations ...
    
    Ok(kits) // Return success
}
```

**Key points:**
- Parameter names use snake_case (Rust convention)
- TypeScript uses camelCase, but Tauri handles the conversion
- The parameter type must be serializable (String, numbers, structs, etc.)

#### Struct Definitions

Structs that are sent to/from the frontend must derive `Serialize` and `Deserialize`:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
}
```

**Breaking it down:**
- `Serialize` - Converts Rust struct → JSON
- `Deserialize` - Converts JSON → Rust struct
- `Debug` - Allows printing for debugging
- All fields must be `pub` (public) to be serialized

#### Example: Complex Command with File Operations

```rust
#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    use std::fs;
    
    let path = PathBuf::from(&file_path);
    
    // Check if file exists
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    // Read the file
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
    
    Ok(contents)
}
```

**Error handling pattern:**
- `map_err()` converts Rust errors to strings
- The `?` operator propagates errors (short for `return Err(...)`)
- Early return with `Err()` for validation failures

#### Example: Command with AppHandle

Some commands need access to the Tauri application handle (for events, state, etc.):

```rust
#[tauri::command]
pub async fn watch_project_kits(
    app_handle: AppHandle,  // Automatically provided by Tauri
    project_path: String,
) -> Result<(), String> {
    // Use app_handle to emit events, access state, etc.
    Ok(())
}
```

Tauri automatically injects `AppHandle` when it's in the function signature.

### The Connection: Command Registration

#### Location: `src-tauri/src/main.rs`

Commands must be registered in the main application setup for the frontend to call them.

#### Registration Process

```rust
#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_app_info,
            commands::get_project_kits,
            commands::read_file,
            // ... more commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Breaking it down:**
- `tauri::generate_handler![]` - Macro that generates handler code
- Each command is listed as `commands::function_name`
- The macro automatically creates the routing logic
- Commands not listed here cannot be called from the frontend

#### The Complete Flow

1. **Frontend calls**: `invokePing()` imported from `src/ipc` (resolves to `index.ts`)
2. **Index re-exports**: `index.ts` re-exports from `core.ts`
3. **IPC wrapper calls**: `invokeWithTimeout<string>('ping', {}, 5000)` in `core.ts`
4. **Tauri routes**: Based on the command name, finds the registered handler
5. **Rust executes**: The `ping()` function in `commands.rs`
6. **Result serialized**: Rust `Result` → JSON
7. **Frontend receives**: Promise resolves/rejects with the result

### Type Safety and Serialization

#### How Types Flow Across the Boundary

```
TypeScript Interface          Rust Struct
───────────────────          ───────────
interface AppInfo {    ←→    struct AppInfo {
  name: string;              pub name: String,
  version: string;           pub version: String,
  platform: string;          pub platform: String,
}                           }
         │                          │
         └──────────┬───────────────┘
                    ▼
            JSON Serialization
            {
              "name": "...",
              "version": "...",
              "platform": "..."
            }
```

#### Type Matching Rules

1. **Field names**: Must match exactly (case-sensitive)
2. **Field types**: Must be compatible
   - `string` ↔ `String`
   - `number` ↔ `i32`, `i64`, `f64`, etc.
   - `boolean` ↔ `bool`
   - `object` ↔ struct with `Serialize`/`Deserialize`
   - `array` ↔ `Vec<T>`
   - `null` ↔ `Option<T>`

#### Optional Fields

TypeScript optional fields map to Rust `Option`:

```typescript
export interface KitFile {
  name: string;
  path: string;
  frontMatter?: KitFrontMatter;  // Optional
}
```

```rust
#[derive(Serialize, Deserialize)]
pub struct KitFile {
    pub name: String,
    pub path: String,
    pub front_matter: Option<KitFrontMatter>,  // Optional
}
```

#### Serialization Process

1. **Rust → JSON**: `serde` serializes the struct to JSON
2. **JSON → TypeScript**: Tauri sends JSON over IPC
3. **TypeScript deserializes**: JSON becomes a TypeScript object
4. **Type checking**: TypeScript validates against the interface

### Error Handling Patterns

#### Frontend Error Handling

IPC calls return Promises that can reject:

```typescript
try {
  const kits = await invokeGetProjectKits('/path/to/project');
  console.log('Success:', kits);
} catch (error) {
  console.error('Error:', error);
  // Handle the error (show toast, update UI, etc.)
}
```

#### Backend Error Handling

Rust commands return `Result<T, E>`:

```rust
#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        // Return error - frontend Promise will reject
        return Err(format!("File does not exist: {}", file_path));
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read: {}", e))?;
    
    // Return success - frontend Promise will resolve
    Ok(contents)
}
```

#### Error Propagation

The `?` operator in Rust is shorthand for error propagation:

```rust
// This:
let contents = fs::read_to_string(&path)
    .map_err(|e| format!("Failed: {}", e))?;

// Is equivalent to:
let contents = match fs::read_to_string(&path) {
    Ok(c) => c,
    Err(e) => return Err(format!("Failed: {}", e)),
};
```

#### Error Message Best Practices

- **Be descriptive**: Include context about what failed
- **Include parameters**: Mention which file/path/input caused the error
- **User-friendly**: Avoid raw Rust error messages
- **Actionable**: Tell the user what they can do

### Real-World Examples

#### Example 1: Reading Project Registry

**Frontend (`src/pages/HomePage.tsx`):**
```typescript
const loadProjects = async () => {
  try {
    const registryProjects = await invokeGetProjectRegistry();
    setProjects(registryProjects);
  } catch (error) {
    console.error('Error loading project registry:', error);
    setError('Failed to load projects');
  }
};
```

**Backend (`src-tauri/src/commands.rs`):**
```rust
#[tauri::command]
pub async fn get_project_registry() -> Result<Vec<ProjectEntry>, String> {
    use std::fs;
    
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;
    
    let registry_path = PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json");
    
    if !registry_path.exists() {
        return Ok(Vec::new()); // Return empty, not an error
    }
    
    let contents = fs::read_to_string(&registry_path)
        .map_err(|e| format!("Failed to read project registry: {}", e))?;
    
    let projects: Vec<ProjectEntry> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    Ok(projects)
}
```

**Key observations:**
- Frontend handles errors gracefully with try/catch
- Backend uses `?` for error propagation
- Missing file returns empty array (not an error) - design decision
- JSON parsing errors are converted to user-friendly strings

#### Example 2: File Watching with Events

**Frontend:**
```typescript
import { listen } from '@tauri-apps/api/event';

// Start watching
await invokeWatchProjectKits(projectPath);

// Listen for changes
const unlisten = await listen('project-kits-changed', (event) => {
  console.log('Kits changed:', event.payload);
  // Reload kits
  loadKits();
});
```

**Backend:**
```rust
#[tauri::command]
pub async fn watch_project_kits(
    app_handle: AppHandle,
    project_path: String,
) -> Result<(), String> {
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    let event_name = format!("project-kits-changed-{}", sanitized_path);
    
    watcher::watch_directory(
        app_handle,
        bluekit_path,
        event_name,
    )?;
    
    Ok(())
}
```

**Key observations:**
- `AppHandle` is automatically injected by Tauri
- Events are emitted from the watcher module
- Frontend uses Tauri's `listen` API to receive events
- This enables real-time updates without polling

#### Example 3: Reading File Contents

**Frontend (`src/components/walkthroughs/WalkthroughsTabContent.tsx`):**
```typescript
const handleViewWalkthrough = async (walkthrough: KitFile) => {
  try {
    const content = await invokeReadFile(walkthrough.path);
    setSelectedKit(walkthrough, content);
  } catch (error) {
    console.error('Failed to load walkthrough content:', error);
  }
};
```

**Backend:**
```rust
#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
    
    Ok(contents)
}
```

### Adding New IPC Commands

#### Step-by-Step Guide

##### Step 1: Create the Rust Command Handler

In `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub async fn my_new_command(
    param1: String,
    param2: i32,
) -> Result<String, String> {
    // Your logic here
    Ok(format!("Received: {} and {}", param1, param2))
}
```

##### Step 2: Register the Command

In `src-tauri/src/main.rs`, add to the handler list:

```rust
.invoke_handler(tauri::generate_handler![
    commands::ping,
    commands::my_new_command,  // Add here
    // ... other commands
])
```

##### Step 3: Create TypeScript Wrapper

Choose the appropriate module based on the command's domain. For example, if it's a project-related command, add it to `src/ipc/projects.ts`:

```typescript
// src/ipc/projects.ts (or appropriate domain file)
import { invokeWithTimeout } from '../utils/ipcTimeout';

/**
 * My new command description.
 * 
 * @param param1 - Description of param1
 * @param param2 - Description of param2
 * @returns A promise that resolves to a string
 */
export async function invokeMyNewCommand(
  param1: string,
  param2: number
): Promise<string> {
  return await invokeWithTimeout<string>('my_new_command', { param1, param2 }, 10000);
}
```

**Module Selection Guide:**
- **Core commands**: `core.ts` (ping, app_info, example_error)
- **Project operations**: `projects.ts` (registry, artifacts, watchers, project creation)
- **File operations**: `files.ts` (read, write)
- **Artifact operations**: `artifacts.ts` (kits, walkthroughs, diagrams, blueprints, scrapbook, plans, clones)
- **Folder operations**: `folders.ts` (create, update, delete, move folders)
- **Task operations**: `tasks.ts` (database-backed tasks)
- **Keychain operations**: `keychain.ts` (token storage)
- **Authentication**: `auth.ts` (OAuth flow)
- **GitHub API**: `github.ts` (GitHub API calls)
- **Library operations**: `library.ts` (workspace management)

**Note:** The function is automatically available through `index.ts` re-exports, so no changes needed there.

##### Step 4: Use in React Components

```typescript
import { invokeMyNewCommand } from '../ipc';  // Imports from src/ipc/index.ts

const handleClick = async () => {
  try {
    const result = await invokeMyNewCommand('Hello', 42);
    console.log(result);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

**Import Path:** Always import from `'../ipc'` (or `'./ipc'` depending on your location). The `index.ts` file automatically re-exports all functions from all modules, maintaining backward compatibility.

#### Checklist

- [ ] Rust function has `#[tauri::command]` attribute
- [ ] Rust function returns `Result<T, E>`
- [ ] Command registered in `main.rs`
- [ ] TypeScript wrapper function created in appropriate domain module
- [ ] TypeScript types defined in `types.ts` (if returning structs)
- [ ] Function uses `invokeWithTimeout` for consistent timeout handling
- [ ] Error handling implemented
- [ ] JSDoc comments added
- [ ] Function is automatically available via `index.ts` re-exports (no manual export needed)
- [ ] Tested in the application

### Best Practices

#### Frontend Best Practices

1. **Always use wrapper functions**: Never call `invoke` directly
2. **Handle errors**: Always wrap IPC calls in try/catch
3. **Type everything**: Use TypeScript interfaces for all return types
4. **Document functions**: Add JSDoc comments explaining usage
5. **Loading states**: Show loading indicators during async IPC calls

#### Backend Best Practices

1. **Descriptive errors**: Return user-friendly error messages
2. **Validate input**: Check parameters before processing
3. **Use Result**: Always return `Result<T, E>`, never panic
4. **Document commands**: Add rustdoc comments explaining behavior
5. **Handle edge cases**: Consider missing files, empty directories, etc.

#### Type Safety Best Practices

1. **Match types exactly**: TypeScript interfaces must match Rust structs
2. **Use Option for nullable**: Use `Option<T>` in Rust, `T?` in TypeScript
3. **Test serialization**: Verify complex types serialize correctly
4. **Version types**: Consider versioning if types change over time

#### Performance Best Practices

1. **Batch operations**: Combine multiple operations when possible
2. **Async operations**: Use async/await for I/O operations
3. **Cache results**: Cache expensive operations when appropriate
4. **Avoid large payloads**: Keep IPC messages reasonably sized

---

## Summary

The IPC system in this Tauri application provides a type-safe, well-structured way for the React frontend to communicate with the Rust backend. Key takeaways:

1. **Frontend layer** (`src/ipc/`) provides typed wrapper functions organized by domain:
   - `index.ts` - Main entry point that re-exports everything
   - `types.ts` - All shared TypeScript interfaces
   - Domain modules (`core.ts`, `projects.ts`, `files.ts`, etc.) - Grouped by functionality
2. **Backend layer** (`src-tauri/src/commands.rs`) contains command handlers
3. **Registration** (`src-tauri/src/main.rs`) connects the two layers
4. **Type safety** is maintained through matching TypeScript interfaces and Rust structs
5. **Error handling** uses Rust's `Result` type and JavaScript Promises, with timeout support via `invokeWithTimeout`
6. **Adding commands** follows a clear 4-step process, with functions placed in appropriate domain modules
7. **Backward compatibility** is maintained through `index.ts` re-exports, so existing imports continue to work

This modular architecture ensures type safety, good developer experience, maintainable code, and scalability as the application grows. The domain-based organization makes it easy to find related functionality and add new commands in the appropriate location.

