---
id: tauri-config
type: task
version: 1
---

# Tauri Configuration

Configure Tauri application settings, permissions, and build options.

## Requirements

- `tauri.conf.json` file in `src-tauri/` directory

## Steps

### 1. Create tauri.conf.json

Create `src-tauri/tauri.conf.json` with the following configuration:

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
    "productName": "bluekit-app",
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
      "identifier": "com.bluekit.app",
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
        "title": "bluekit-app",
        "width": 800,
        "height": 600
      }
    ]
  }
}
```

## Configuration Details

### Build Settings

- **beforeDevCommand**: Command to run before development server starts
- **beforeBuildCommand**: Command to run before production build
- **devPath**: URL for development server
- **distDir**: Directory containing built frontend files

### Permissions (allowlist)

- **shell.open**: Allow opening external applications
- **dialog.open**: Allow file/directory dialogs
- **fs.readDir/readFile**: Allow reading files and directories
- **scope**: Restrict file access to specific paths

### Bundle Settings

- **identifier**: Unique app identifier (reverse domain notation)
- **icon**: Paths to application icons for different platforms
- **targets**: Build targets (all platforms)

## Security Considerations

- Set `"all": false` to explicitly enable only needed permissions
- Use `scope` to restrict file system access
- Set CSP (Content Security Policy) as needed

## Verification

Configuration is validated when running `tauri dev` or `tauri build`.