---
id: tauri-config
type: task
version: 1
---

# Tauri Configuration

Configure Tauri application settings, permissions, and build configuration.

## Requirements

- Completed "Project Setup" task
- Tauri project initialized

## Steps

### 1. Update Cargo.toml

Edit `src-tauri/Cargo.toml`:

```toml
[package]
name = "your-app-name"
version = "0.1.0"
description = "A Tauri + React + TypeScript desktop application"
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

### 2. Configure tauri.conf.json

Edit `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist",
    "withGlobalTauri": false
  },
  "package": {
    "productName": "your-app-name",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "open": true
      },
      "dialog": {
        "all": false,
        "open": true
      },
      "fs": {
        "all": false,
        "readDir": true,
        "readFile": true,
        "scope": ["$APPDATA/**", "$HOME/**"]
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.yourcompany.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "Your App Name",
        "width": 800,
        "height": 600
      }
    ]
  }
}
```

### 3. Create Build Script

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

### 4. Add Application Icons

Place icon files in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

You can use Tauri's icon generator or create custom icons.

## Key Configuration Points

1. **FS Permissions**: Configure `fs.scope` to allow access to specific directories
2. **Window Settings**: Adjust window size, title, and behavior
3. **Bundle Settings**: Set app identifier and icon paths
4. **Security**: CSP (Content Security Policy) is set to null for development

## Verification

- Run `npm run tauri dev` - App should launch with correct window title and size
- Check console for any permission errors
- Verify icons are displayed correctly

## Next Steps

After completing this task, proceed to "Rust Modules" task.