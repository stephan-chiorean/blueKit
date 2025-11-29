---
id: utils-module
type: task
version: 1
---

# Utils Module (utils.rs)

Implement utility functions for cross-module use.

## Requirements

- No external dependencies beyond standard library

## Steps

### 1. Create utils.rs Structure

Create `src-tauri/src/utils.rs` with utility functions:

```rust
/// Example utility function that formats a message.
pub fn format_message(message: &str) -> String {
    format!("Formatted: {}", message)
}

/// Gets the current platform information.
pub fn get_platform() -> String {
    #[cfg(target_os = "windows")]
    {
        return "windows".to_string();
    }
    
    #[cfg(target_os = "macos")]
    {
        return "macos".to_string();
    }
    
    #[cfg(target_os = "linux")]
    {
        return "linux".to_string();
    }
    
    "unknown".to_string()
}
```

## Key Concepts

### Platform-Specific Code

- Use `#[cfg(target_os = "...")]` for conditional compilation
- Allows platform-specific implementations
- Compiler only includes relevant code for target platform

### String Handling

- `&str` - string slice (borrowed)
- `String` - owned string
- Use `.to_string()` to convert slices to owned strings

## Common Utility Patterns

### Path Manipulation

```rust
use std::path::PathBuf;

pub fn join_paths(base: &str, parts: &[&str]) -> PathBuf {
    let mut path = PathBuf::from(base);
    for part in parts {
        path.push(part);
    }
    path
}
```

### Error Formatting

```rust
pub fn format_error(context: &str, error: &dyn std::error::Error) -> String {
    format!("{}: {}", context, error)
}
```

## Best Practices

- Keep utilities pure (no side effects)
- Make functions generic when possible
- Document with doc comments (`///`)
- Use appropriate return types

## Verification

- Compile with `cargo check`
- Test utility functions if needed