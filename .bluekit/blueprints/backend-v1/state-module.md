---
id: state-module
type: task
version: 1
---

# State Module (state.rs)

Create state management module for shared application state.

## Requirements

- `serde` for serialization
- Thread-safe state management

## Steps

### 1. Create state.rs Structure

Create `src-tauri/src/state.rs` with the following:

```rust
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub name: String,
    pub version: String,
    pub init_count: u32,
}

impl AppState {
    pub fn new(name: String, version: String) -> Self {
        Self {
            name,
            version,
            init_count: 0,
        }
    }
    
    pub fn increment_init(&mut self) {
        self.init_count += 1;
    }
}
```

## Key Concepts

### State Structure

- Define struct with fields you need to share
- Derive `Serialize` and `Deserialize` for JSON conversion
- Derive `Clone` if you need to copy state

### Thread Safety

- Use `Mutex<T>` for thread-safe access
- Use `Arc<Mutex<T>>` for shared ownership across threads
- Commands can be called from multiple threads

### Using State in Commands

To use state in commands:

```rust
use tauri::State;

#[tauri::command]
pub async fn get_state(state: State<'_, Mutex<AppState>>) -> Result<AppState, String> {
    let state = state.lock().unwrap();
    Ok(state.clone())
}
```

And register in main.rs:

```rust
.manage(Mutex::new(AppState::new("bluekit-app".to_string(), "0.1.0".to_string())))
```

## Best Practices

- Keep state minimal - only what needs to be shared
- Use appropriate synchronization primitives
- Avoid long-held locks
- Consider using `RwLock` for read-heavy workloads

## Verification

- Compile with `cargo check`
- Test state access in commands if implemented