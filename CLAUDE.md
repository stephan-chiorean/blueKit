# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BlueKit is a desktop application for organizing, discovering, and reusing code knowledge across projects. It helps developers capture reusable patterns, architectural decisions, and educational content in markdown files (called "Kits") that live in `.bluekit` directories within projects.

**Technology Stack:**
- **Frontend**: React 18 + TypeScript + Chakra UI + Vite
- **Backend**: Rust + Tauri 1.5
- **File Format**: Markdown with YAML front matter

Refer to `product.md` for complete product vision, use cases, and feature requirements.

## Common Development Commands

### Frontend Development
```bash
npm install                # Install dependencies
npm run dev                # Start Vite dev server (port 1420)
npm run build              # Build frontend for production
npm run preview            # Preview production build
```

### Tauri Development
```bash
npm run tauri dev          # Run app in development mode (compiles Rust + starts Vite)
npm run tauri build        # Build production app with installer
```

### Rust Development
```bash
cd src-tauri
cargo check                # Check for compile errors without building
cargo build                # Build in debug mode
cargo build --release      # Build in release mode
cargo test                 # Run tests
```

## Architecture Overview

### Application Structure

**Three-View System** (src/App.tsx:11-29):
1. **Welcome Screen**: Initial onboarding
2. **Home Page**: Project registry and global actions
3. **Project Detail Page**: Kit browsing and management for a selected project

**Navigation Flow**: Welcome → Home ↔ Project Detail

### IPC Communication Architecture

IPC (Inter-Process Communication) bridges the React frontend and Rust backend:

1. **Backend Commands** (`src-tauri/src/commands.rs`): Rust functions marked with `#[tauri::command]`
2. **Command Registration** (`src-tauri/src/main.rs:45`): Commands registered in `invoke_handler![]` macro
3. **Frontend Wrappers** (`src/ipc.ts`): Type-safe TypeScript functions wrapping `invoke()`
4. **Timeout Handling** (`src/utils/ipcTimeout.ts`): All IPC calls wrapped with configurable timeouts

**Adding New IPC Commands:**
1. Create function in `src-tauri/src/commands.rs` with `#[tauri::command]`
2. Add to `invoke_handler![]` in `src-tauri/src/main.rs`
3. Create typed wrapper in `src/ipc.ts` using `invokeWithTimeout()`
4. Define TypeScript interfaces matching Rust structs

### File Watching System

Production-grade file watcher (`src-tauri/src/watcher.rs`) monitors `.bluekit` directories:

**Key Features:**
- **Bounded channels** (100 buffer) prevent memory exhaustion
- **Debouncing** (300ms window) reduces event spam
- **Auto-recovery** with exponential backoff (5 retry attempts)
- **Health monitoring** via `get_watcher_health` command

**Watched Files:**
- `.md`, `.mmd`, `.mermaid` (all instances)
- `.json` (only `blueprint.json`, `clones.json`, `projectRegistry.json`)

**Watcher Lifecycle:**
- File watcher: `watch_file()` - monitors single file in parent directory
- Directory watcher: `watch_directory()` - recursive monitoring with auto-restart
- Registry: Global `WATCHER_REGISTRY` tracks active watchers for health checks

### State Management

**React Context Providers** (wrap entire app in `src/App.tsx:32-35`):

1. **ColorModeContext**: Light/dark mode
2. **FeatureFlagsContext**: Feature toggles
3. **WorkstationContext** (`src/contexts/WorkstationContext.tsx`): Currently viewed kit content
4. **SelectionContext** (`src/contexts/SelectionContext.tsx`): Multi-item selection system

**Selection System:**
- Supports selecting multiple items across different types (Kit, Template, Collection, Project)
- Used by `GlobalActionBar` for batch operations
- Persists across navigation within same view

### Frontend Component Organization

```
src/
├── components/
│   ├── agents/          # Agent-specific UI
│   ├── bases/           # Base kit management
│   ├── blueprints/      # Blueprint system (layered task execution)
│   ├── clones/          # Git clone management
│   ├── collections/     # Kit collections/grouping
│   ├── diagrams/        # Mermaid diagram viewer
│   ├── kits/            # Core kit browsing/management
│   ├── projects/        # Project registry UI
│   ├── scrapbook/       # Loose markdown files
│   ├── templates/       # Template management
│   ├── walkthroughs/    # Educational guides
│   ├── workflows/       # Workflow management
│   └── workstation/     # Kit content viewer (markdown + diagrams)
├── contexts/            # React Context providers
├── pages/               # Top-level page components
└── utils/               # Shared utilities
```

### Data Flow Patterns

**Project Registry:**
- Stored at `~/.bluekit/projectRegistry.json`
- Watched by file watcher (setup in `main.rs:65-76`)
- Emits `project-registry-changed` event on changes
- Loaded via `get_project_registry` command

**Kit Discovery:**
1. User selects project
2. Frontend calls `get_project_kits(projectPath)`
3. Backend scans `.bluekit/` directory
4. Parses YAML front matter from markdown files
5. Returns array of `KitFile` objects with metadata

**Real-Time Updates:**
1. `watch_project_kits(projectPath)` starts watcher
2. File changes trigger debounced events
3. Frontend listens via Tauri event system
4. UI automatically refreshes kit list

### Blueprint System

Blueprints are multi-layer task execution systems for project scaffolding:

**Structure:**
- `blueprint.json`: Metadata with layers and tasks
- `*.md` task files: Individual task instructions
- Stored in `.bluekit/blueprints/<blueprint-name>/`

**Layer Parallelization:**
- Tasks within a layer can execute in parallel
- Layers execute sequentially (layer N+1 waits for layer N)
- Used for complex project setup workflows

### Clone System

Snapshots of git repositories at specific commits:

**Metadata** (`.bluekit/clones.json`):
- `id`: Unique identifier (slugified-name-YYYYMMDD)
- `gitUrl`, `gitCommit`, `gitBranch`, `gitTag`: Git metadata
- `name`, `description`, `tags`: Human-readable info

**Create Project from Clone** (`create_project_from_clone`):
1. Clones git repo to temp directory
2. Checks out specific commit
3. Copies files to target (excludes `.git`)
4. Optionally registers in project registry
5. Cleans up temp directory

Timeout: 60 seconds (git operations can be slow)

## Rust-Specific Notes

### Error Handling Pattern

Commands return `Result<T, String>` where:
- `Ok(value)` = success (auto-serialized to JSON)
- `Err(message)` = error (sent to frontend as rejection)

### Key Dependencies

- `tauri`: Desktop app framework
- `notify`: File system watcher (production-grade)
- `serde`: JSON serialization/deserialization
- `tokio`: Async runtime (used by Tauri)
- `tracing`: Structured logging

### Tauri Permissions

Configured in `src-tauri/tauri.conf.json:14-28`:
- `shell.open`: Open files/URLs in default app
- `dialog.open`: File/folder picker dialogs
- `fs.readDir`, `fs.readFile`: File system access (scoped to `$APPDATA` and `$HOME`)

## TypeScript-Specific Notes

### Type Safety

- All IPC calls have matching TypeScript interfaces
- Interfaces must match Rust struct definitions exactly
- Use `invokeWithTimeout<T>()` for all IPC calls (never raw `invoke()`)

### Chakra UI Usage

- Version 3.x (latest)
- Uses `@emotion/react` and `@emotion/styled` for styling
- Theme customization via `ColorModeContext`

## Development Guidelines

### When Adding Features

1. Check `product.md` for product vision alignment
2. Update YAML front matter schema if adding kit metadata
3. Maintain type safety across Rust ↔ TypeScript boundary
4. Add IPC timeouts appropriate to operation (5s for quick ops, 60s for git)
5. Consider real-time updates (do changes need file watcher events?)

### File Structure Conventions

- Kits: `.bluekit/*.md` (top-level)
- Agents: `.bluekit/agents/*.md`
- Walkthroughs: `.bluekit/walkthroughs/*.md`
- Blueprints: `.bluekit/blueprints/<name>/` (contains `blueprint.json` + task files)
- Diagrams: `.bluekit/diagrams/*.mmd` or `.mermaid`
- Clones: `.bluekit/clones.json`

### YAML Front Matter Schema

```yaml
---
id: unique-identifier              # Required: Unique ID
alias: Display Name                # Optional: Human-readable name
type: kit|walkthrough|agent        # Optional: Kit type
is_base: false                     # Optional: Is this a base template?
version: 1                         # Optional: Version number
tags: [tag1, tag2]                 # Optional: Categorization
description: "Brief description"   # Optional: One-line summary
capabilities: [...]                # Optional (agents only): List of capabilities
---
```

## Debugging

### Rust Logs

Logs output to console (configured in `main.rs:30-33`):
```rust
tracing_subscriber::fmt()
    .with_max_level(tracing::Level::INFO)
```

Use `tracing` macros: `info!()`, `warn!()`, `error!()`, `debug!()`

### Frontend Debugging

- Console logs visible in DevTools
- IPC timeout errors include stack traces
- Watcher errors emitted as `<event-name>-error` events

### Common Issues

**"Watcher channel full"**: Too many file changes too quickly → increase `CHANNEL_BUFFER_SIZE` in `watcher.rs:25`

**IPC timeout**: Operation exceeded timeout → adjust timeout in corresponding `src/ipc.ts` function

**Port 1420 in use**: Vite uses strict port checking → change in `vite.config.ts:10` and `tauri.conf.json:5`

## Key Architectural Decisions

1. **File-based storage**: No database, kits are markdown files versioned with code
2. **Event-driven updates**: File watchers emit events for real-time UI updates
3. **Context-based state**: React Context over Redux/Zustand for simplicity
4. **Bounded resources**: Channels and retries prevent runaway resource consumption
5. **Type-safe IPC**: Matching interfaces on both sides prevent runtime errors
