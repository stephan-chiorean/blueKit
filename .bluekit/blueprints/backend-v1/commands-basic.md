---
id: commands-basic
type: task
version: 1
---

# Basic IPC Commands

Implement basic IPC commands for testing and app information.

## Requirements

- `serde` for serialization
- Tauri command attribute support

## Steps

### 1. Create Commands Module Structure

Create `src-tauri/src/commands.rs` with basic commands:

```rust
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
}

/// Simple ping command to test IPC communication.
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

/// Gets application information.
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    let app_info = AppInfo {
        name: "bluekit-app".to_string(),
        version: "0.1.0".to_string(),
        platform: std::env::consts::OS.to_string(),
    };
    
    Ok(app_info)
}

/// Example command that demonstrates error handling.
#[tauri::command]
pub async fn example_error(should_fail: bool) -> Result<String, String> {
    if should_fail {
        Err("This is an example error message".to_string())
    } else {
        Ok("Success!".to_string())
    }
}
```

## Key Concepts

### Command Attributes

- `#[tauri::command]` - Marks function as callable from frontend
- Commands must be async
- Return `Result<T, E>` for error handling

### Serialization

- Use `Serialize`/`Deserialize` for structs passed to/from frontend
- Tauri automatically converts to/from JSON

### Error Handling

- Return `Ok(value)` for success
- Return `Err(message)` for errors
- Frontend receives errors as exceptions

## Frontend Integration

Create typed wrapper in `src/ipc.ts`:

```typescript
import { invoke } from "@tauri-apps/api/tauri";

export async function ping(): Promise<string> {
  return await invoke<string>("ping");
}

export async function getAppInfo(): Promise<AppInfo> {
  return await invoke<AppInfo>("get_app_info");
}
```

## Testing

- Test with `tauri dev`
- Call from frontend React components
- Verify error handling works correctly

## Verification

- Commands compile without errors
- Can be called from frontend
- Return values are correctly serialized