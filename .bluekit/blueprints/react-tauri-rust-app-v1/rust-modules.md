---
id: rust-modules
type: task
version: 1
---

# Rust Module Structure

Create the Rust module structure for organizing backend code: commands, watcher, utils, and state.

## Requirements

- Completed "Tauri Configuration" task
- Basic understanding of Rust module system

## Steps

### 1. Create Module Files

Create the following files in `src-tauri/src/`:

- `commands.rs` - IPC command handlers
- `watcher.rs` - File system watching
- `utils.rs` - Utility functions
- `state.rs` - Application state management

### 2. Define Module Structure in main.rs

Edit `src-tauri/src/main.rs` to declare modules:

```rust
// Preprocessor attributes
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Module declarations
mod commands; // IPC command handlers
mod state;    // Application state management
mod utils;    // Utility functions
mod watcher;  // File watching functionality

// Main function will be added in next task
```

### 3. Create commands.rs Skeleton

Create `src-tauri/src/commands.rs`:

```rust
/// IPC command handlers module.
/// 
/// This module contains all the functions that handle IPC (Inter-Process Communication)
/// requests from the frontend. In Tauri, these are called "commands".

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

// Add command handlers here in next task
```

### 4. Create watcher.rs Skeleton

Create `src-tauri/src/watcher.rs`:

```rust
/// File watching module for monitoring file system changes.
/// 
/// This module provides functionality to watch files and emit Tauri events
/// when changes are detected.

use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Manager};
use std::env;
use std::fs;

// File watching functions will be added in later task
```

### 5. Create utils.rs Skeleton

Create `src-tauri/src/utils.rs`:

```rust
/// Utility functions that can be reused across backend modules.
/// 
/// This module contains helper functions that don't belong to any specific
/// domain but are useful throughout the application.

// Utility functions will be added as needed
```

### 6. Create state.rs Skeleton

Create `src-tauri/src/state.rs`:

```rust
/// Application state management module.
/// 
/// This module contains shared application state that can be accessed
/// across different command handlers.

use serde::{Deserialize, Serialize};

// State structures will be added as needed
```

## Module Organization Principles

1. **commands.rs**: All IPC command handlers (functions with `#[tauri::command]`)
2. **watcher.rs**: File system watching logic using the `notify` crate
3. **utils.rs**: Reusable helper functions
4. **state.rs**: Shared application state (if needed)

## Verification

- Run `cargo check` in `src-tauri/` directory - should compile without errors
- Verify all module files exist and are properly declared

## Next Steps

After completing this task, proceed to "Main Entry Point" task.