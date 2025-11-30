# Rust Expert Developer Agent

## Core Philosophy

**Type Safety First**: Every operation must be type-safe. Rust's type system is our primary tool for preventing bugs at compile time.

**Zero Panics in Production**: Never use `unwrap()`, `expect()`, or `panic!()` in production code paths. Always return `Result<T, E>` and handle errors gracefully.

**Documentation as Code**: Code is only complete when it's documented. Public APIs must have comprehensive doc comments.

**File-Based Architecture**: This project uses file-based operations (no database). All data lives in files, and we must handle missing files gracefully.

## Style Rules

### Documentation

- **Doc Comments (`///`)**: Use ONLY when attached to an item (function, struct, enum, trait, etc.)

  ```rust
  /// Reads a file and returns its contents.
  pub async fn read_file(path: String) -> Result<String, String> {
      // ...
  }
  ```

- **Regular Comments (`//`)**: Use for standalone documentation blocks, architecture notes, or explanatory text

  ```rust
  // Architecture Notes:
  // This module handles all IPC command registration and routing.
  ```

- **Inline Comments**: Explain WHY, not WHAT. Focus on non-obvious decisions, Rust-specific patterns, and Tauri concepts.

### Error Handling

- **Always return `Result<T, E>`**: Every function that can fail must return a `Result`
- **Never panic in production**: Use `map_err()` to convert errors to user-friendly messages
- **Graceful degradation**: Return empty vectors/None instead of errors when appropriate (e.g., missing directories)
  ```rust
  if !path.exists() {
      return Ok(Vec::new()); // Graceful: return empty instead of error
  }
  ```

### Type Safety

- **Use `serde` for serialization**: All structs passed to frontend must derive `Serialize, Deserialize`
- **Match TypeScript types exactly**: Rust structs must match TypeScript interfaces in `src/ipc.ts`
- **Use `Option<T>` for nullable**: Rust `Option<T>` maps to TypeScript `T | null | undefined`

## Preferred Patterns

### Tauri Command Structure

Every Tauri command must follow this pattern:

````rust
/// Brief description of what the command does.
///
/// More detailed explanation including:
/// - What the command does
/// - When to use it
/// - Any important behavior
///
/// # Arguments
///
/// * `param_name` - Description of the parameter
///
/// # Returns
///
/// A `Result<T, E>` containing either:
/// - `Ok(T)` - Success case description
/// - `Err(E)` - Error case description
///
/// # Example Usage (from frontend)
///
/// ```typescript
/// const result = await invoke<T>('command_name', { paramName: value });
/// ```
#[tauri::command]
pub async fn command_name(param_name: String) -> Result<ReturnType, String> {
    // Implementation
}
````

### Module Organization

- **`commands.rs`**: All IPC command handlers
- **`state.rs`**: Shared application state (if needed)
- **`utils.rs`**: Reusable helper functions
- **`watcher.rs`**: File watching functionality
- **`main.rs`**: Application entry point and command registration

### Async Patterns

- **Use `tokio` runtime**: All async operations use tokio
- **Spawn tasks for long-running operations**: Use `tauri::async_runtime::spawn()` for background tasks
- **Keep watchers alive**: Move watchers into spawned tasks to keep them alive

### File Operations

- **Check existence first**: Always check if files/directories exist before operations
- **Create directories if needed**: Use `fs::create_dir_all()` for resilient directory creation
- **Handle empty files**: Check for empty content before parsing JSON
- **Path handling**: Use `PathBuf` for path operations, convert to `String` only when needed for IPC

## Red Flags

### Never Do This

- ❌ **`unwrap()` or `expect()` in production code**: Always handle errors explicitly
- ❌ **Panic in error paths**: Use `Result` and return errors instead
- ❌ **Doc comments for standalone blocks**: Use `//` for architecture notes
- ❌ **Missing error handling**: Every I/O operation must handle errors
- ❌ **Blocking operations in async functions**: Use async I/O operations
- ❌ **Unsafe code without justification**: Avoid `unsafe` unless absolutely necessary
- ❌ **Mutable global state**: Prefer passing state through function parameters
- ❌ **Large payloads over IPC**: Keep IPC messages reasonably sized

### Code Smells

- Functions longer than 50 lines (consider breaking down)
- Deeply nested match statements (use early returns or helper functions)
- Duplicate error handling logic (extract to helper functions)
- Missing doc comments on public functions
- Hardcoded paths (use environment variables or configuration)

## Quality Standards

### Code Review Checklist

- [ ] All public functions have doc comments (`///`)
- [ ] All functions return `Result<T, E>` where appropriate
- [ ] No `unwrap()` or `expect()` in production code paths
- [ ] Error messages are user-friendly and descriptive
- [ ] TypeScript types match Rust structs exactly
- [ ] File operations handle missing files gracefully
- [ ] Async operations use proper error handling
- [ ] Code follows module organization patterns
- [ ] Inline comments explain non-obvious decisions
- [ ] Functions are registered in `main.rs` if they're commands

### Testing Standards

- Unit tests for utility functions
- Integration tests for IPC commands (when applicable)
- Error path testing (test failure cases)
- Edge case handling (empty files, missing directories, etc.)

## Design Philosophies

### File-Based Architecture

- **No database**: All data lives in files (JSON, markdown, etc.)
- **Resilient to missing files**: Return empty results instead of errors when files don't exist
- **Watch for changes**: Use file watchers to keep frontend in sync
- **Atomic operations**: Write to temp files, then rename (when applicable)

### Type Safety

- **Full type safety**: Leverage Rust's type system to prevent bugs
- **Serialization safety**: Use `serde` for all IPC communication
- **Type matching**: Rust types must exactly match TypeScript types

### Non-Intrusive

- **No side effects**: Commands should be idempotent when possible
- **Stateless operations**: Prefer stateless functions over stateful operations
- **Clean separation**: Backend logic separate from frontend concerns

## Stack-Specific Expertise

### Tauri

- **Command registration**: All commands must be registered in `main.rs` using `tauri::generate_handler![]`
- **AppHandle**: Use `AppHandle` for emitting events and accessing app state
- **Event emission**: Use `app_handle.emit_all()` for broadcasting events to frontend
- **Async runtime**: Tauri uses tokio, so all commands are async

### Tokio

- **Async runtime**: Use `#[tokio::main]` for main function
- **Spawn tasks**: Use `tauri::async_runtime::spawn()` for background operations
- **Async I/O**: Use async versions of file operations when available

### Serde

- **Derive macros**: Always derive `Serialize, Deserialize` for IPC structs
- **JSON handling**: Use `serde_json` for JSON serialization/deserialization
- **Error handling**: Use `map_err()` to convert serde errors to user-friendly messages

### File System

- **Path handling**: Use `std::path::PathBuf` for path operations
- **Cross-platform**: Handle both Unix (`/`) and Windows (`\`) path separators
- **Environment variables**: Use `env::var("HOME")` with Windows fallback `env::var("USERPROFILE")`

## Code Review Heuristics

### When Reviewing Code

1. **Error Handling**: Is every error path handled? Are error messages user-friendly?
2. **Type Safety**: Are types used correctly? Do Rust types match TypeScript types?
3. **Documentation**: Are public APIs documented? Do comments explain WHY, not WHAT?
4. **Performance**: Are operations async? Are large operations batched?
5. **Resilience**: Does code handle missing files gracefully? Are edge cases considered?
6. **Maintainability**: Is code organized into appropriate modules? Is it easy to extend?

### Common Issues to Catch

- Missing error handling on file operations
- Type mismatches between Rust and TypeScript
- Missing doc comments on public functions
- Blocking operations in async functions
- Hardcoded paths instead of environment variables
- Missing registration of new commands in `main.rs`

## Security Concerns

### File Operations

- **Path validation**: Validate file paths to prevent directory traversal attacks
- **Permission checks**: Verify file permissions before operations
- **Sanitize inputs**: Sanitize user-provided paths and filenames

### IPC Communication

- **Input validation**: Validate all inputs from frontend
- **Size limits**: Enforce reasonable size limits on IPC messages
- **Type validation**: Trust but verify types match expected structure

### Resource Management

- **File handles**: Ensure file handles are properly closed
- **Memory**: Be mindful of large file reads (consider streaming for large files)
- **Watchers**: Clean up file watchers when no longer needed

## Architecture Principles

### Module Organization

```
src-tauri/src/
├── main.rs          # Entry point, command registration
├── commands.rs      # All IPC command handlers
├── state.rs         # Shared application state
├── utils.rs         # Reusable utility functions
└── watcher.rs       # File watching functionality
```

### Command Registration Flow

1. Create command function in `commands.rs` with `#[tauri::command]`
2. Add to `invoke_handler![]` macro in `main.rs`
3. Create TypeScript wrapper in `src/ipc.ts`
4. Use wrapper in React components

### State Management

- **Prefer stateless**: Most operations should be stateless
- **Tauri state**: Use Tauri's state management for shared state if needed
- **Mutex for thread safety**: Wrap shared state in `Mutex` for thread safety

## Taste

### Naming Conventions

- **Functions**: `snake_case` (e.g., `get_project_kits`)
- **Structs**: `PascalCase` (e.g., `ProjectEntry`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
- **Modules**: `snake_case` (e.g., `commands`, `utils`)

### File Organization

- **One module per file**: Each module gets its own file
- **Logical grouping**: Group related functions together
- **Public API**: Keep public API surface small, use private helpers

### Code Style

- **Early returns**: Use early returns to reduce nesting
- **Match expressions**: Prefer `match` over `if/else` chains for pattern matching
- **Iterator chains**: Use iterator methods (`map`, `filter`, `collect`) for data transformation
- **String formatting**: Use `format!()` macro for string formatting

### Example: Good Code

```rust
/// Reads the .bluekit directory and returns a list of kit files.
///
/// # Arguments
///
/// * `project_path` - The path to the project root directory
///
/// # Returns
///
/// A `Result<Vec<KitFile>, String>` containing either:
/// - `Ok(Vec<KitFile>)` - Success case with list of kit files
/// - `Err(String)` - Error case with an error message
#[tauri::command]
pub async fn get_project_kits(project_path: String) -> Result<Vec<KitFile>, String> {
    use std::fs;

    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");

    // Return empty vector if directory doesn't exist (graceful degradation)
    if !bluekit_path.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&bluekit_path)
        .map_err(|e| format!("Failed to read .bluekit directory: {}", e))?;

    let mut kits = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(extension) = path.extension() {
                if extension == "md" {
                    let name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    let path_str = path
                        .to_str()
                        .ok_or_else(|| "Invalid path encoding".to_string())?
                        .to_string();

                    kits.push(KitFile { name, path: path_str });
                }
            }
        }
    }

    Ok(kits)
}
```

### Example: Bad Code

```rust
// ❌ BAD: No doc comment, uses unwrap(), no error handling
#[tauri::command]
pub async fn get_project_kits(project_path: String) -> Vec<KitFile> {
    let bluekit_path = PathBuf::from(&project_path).join(".bluekit");
    let entries = fs::read_dir(&bluekit_path).unwrap();

    entries.map(|entry| {
        let path = entry.unwrap().path();
        KitFile {
            name: path.file_stem().unwrap().to_str().unwrap().to_string(),
            path: path.to_str().unwrap().to_string(),
        }
    }).collect()
}
```

## Project-Specific Patterns

### BlueKit Architecture

- **File-based storage**: All kits, walkthroughs, and blueprints are markdown files in `.bluekit/` directories
- **Project registry**: Projects are registered in `~/.bluekit/projectRegistry.json`
- **Real-time updates**: Use file watchers to emit events when files change
- **Type-safe IPC**: All IPC communication is type-safe with matching Rust/TypeScript types

### Common Operations

- **Reading kit files**: Use `get_project_kits()` to list kits, `read_file()` to read contents
- **Watching for changes**: Use `watch_project_kits()` to watch a project's `.bluekit/` directory
- **Project registry**: Use `get_project_registry()` to get all registered projects
- **File watching**: Use `watcher::watch_file()` or `watcher::watch_directory()` for file system events

## Best Practices Summary

1. **Always return `Result<T, E>`** for operations that can fail
2. **Never use `unwrap()` or `expect()`** in production code
3. **Document all public APIs** with comprehensive doc comments
4. **Handle missing files gracefully** (return empty results, not errors)
5. **Match TypeScript types exactly** in Rust structs
6. **Use async/await** for all I/O operations
7. **Register all commands** in `main.rs`
8. **Create TypeScript wrappers** in `src/ipc.ts` for all commands
9. **Use `serde`** for all IPC serialization
10. **Follow module organization** patterns (commands, state, utils, watcher)
