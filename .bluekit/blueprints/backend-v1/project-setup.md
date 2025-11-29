---
id: project-setup
type: task
version: 1
---

# Project Setup

Initialize the Rust backend project with Tauri and all required dependencies.

## Requirements

- Rust toolchain (stable)
- Cargo package manager
- Tauri CLI (optional, for development)

## Steps

### 1. Create Cargo.toml

Create `src-tauri/Cargo.toml` with the following structure:

```toml
[package]
name = "bluekit-app"
version = "0.1.0"
description = "A Tauri + React + TypeScript desktop application"
authors = ["you"]
license = ""
repository = ""
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["shell-open", "dialog-open", "fs-read-dir", "fs-read-file"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
notify = "6.1"

[features]
custom-protocol = ["tauri/custom-protocol"]
```

### 2. Create build.rs

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

### 3. Create src/ Directory Structure

Create the following module files:
- `src/main.rs` - Application entry point
- `src/commands.rs` - IPC command handlers
- `src/state.rs` - Application state management
- `src/utils.rs` - Utility functions
- `src/watcher.rs` - File watching functionality

## Dependencies Explained

- **tauri**: Core Tauri framework for desktop app
- **serde/serde_json**: JSON serialization for IPC communication
- **tokio**: Async runtime for async/await support
- **notify**: File system watching capabilities

## Verification

Run `cargo check` to verify the project setup compiles correctly.