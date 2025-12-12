# BlueKit Tauri Backend Structure

This directory contains the Rust backend for BlueKit, organized into logical modules for better maintainability and extensibility.

## Directory Structure

```
src/
├── main.rs              # Application entry point
├── commands.rs          # IPC command handlers (Tauri commands)
│
├── core/                # Core application functionality
│   ├── mod.rs
│   ├── cache.rs         # File content caching
│   ├── state.rs         # Application state management
│   ├── utils.rs         # Utility functions
│   └── watcher.rs       # File watching functionality
│
├── db/                  # Database layer (SeaORM + SQLite)
│   ├── mod.rs
│   ├── migrations.rs
│   ├── task_operations.rs
│   └── entities/        # Database entity definitions
│       ├── mod.rs
│       ├── task.rs
│       ├── task_project.rs
│       ├── library_workspace.rs
│       └── library_artifact.rs
│
├── integrations/        # External service integrations
│   ├── mod.rs
│   ├── github/          # GitHub integration
│   │   ├── mod.rs
│   │   ├── auth.rs      # OAuth authentication (PKCE flow)
│   │   ├── github.rs    # GitHub API client
│   │   ├── keychain.rs  # Secure token storage
│   │   └── oauth_server.rs # Local OAuth callback server
│   └── git/             # Git operations (future)
│       └── mod.rs       # Placeholder for libgit2 integration
│
└── library/             # Library workspace management
    ├── mod.rs
    └── library.rs       # Library workspace operations
```

## Module Organization

### Core (`core/`)
Core functionality used throughout the application:
- **cache**: File content caching for performance
- **state**: Application state management
- **utils**: Reusable utility functions
- **watcher**: File system watching for real-time updates

### Database (`db/`)
Database layer using SeaORM and SQLite:
- **entities**: Database table definitions
- **migrations**: Database schema migrations
- **task_operations**: Task-related database operations

### Integrations (`integrations/`)
External service integrations organized by service:

#### GitHub (`integrations/github/`)
- **auth**: OAuth authentication with PKCE
- **github**: GitHub REST API client
- **keychain**: Secure token storage (OS keychain)
- **oauth_server**: Local HTTP server for OAuth callbacks

#### Git (`integrations/git/`)
- Placeholder for future libgit2 integration
- Will contain git operations (push, pull, commit, etc.)

### Library (`library/`)
Library workspace management:
- GitHub-backed workspace system
- Publishing and syncing artifacts
- Workspace CRUD operations

## Adding New Modules

### Adding a New Integration

1. Create directory: `integrations/your_service/`
2. Create `mod.rs` with module declarations
3. Add to `integrations/mod.rs`: `pub mod your_service;`
4. Update imports in `commands.rs` and `main.rs`

### Adding a New Core Module

1. Create file: `core/your_module.rs`
2. Add to `core/mod.rs`: `pub mod your_module;`
3. Re-export if needed: `pub use your_module::YourType;`

### Adding a New Command

1. Add function to `commands.rs` with `#[tauri::command]`
2. Add to `invoke_handler![]` in `main.rs`
3. Create TypeScript wrapper in `src/ipc.ts`

## Import Patterns

### Within the same module
```rust
use super::sibling_module;
```

### From root
```rust
use crate::core::cache::ArtifactCache;
use crate::integrations::github::auth::AuthStatus;
use crate::library::library::LibraryWorkspace;
```

### Re-exports (preferred)
```rust
// In mod.rs
pub use auth::AuthStatus;

// In commands.rs
use crate::integrations::github::AuthStatus;
```

## Benefits of This Structure

1. **Clear Separation**: Each integration is self-contained
2. **Easy to Extend**: Adding new services is straightforward
3. **Better Organization**: Related code is grouped together
4. **Maintainable**: Easy to find and modify code
5. **Scalable**: Structure supports growth
