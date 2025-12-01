---
id: project-setup
type: task
version: 1
blueprint: react-tauri-rust-app-v2
blueprint_name: React + Tauri + Rust Desktop App
layer: 1
layer_name: Project Initialization
---

# Task: Project Setup

## Blueprint Context

**Blueprint Goal:** Build a fully functional React/Tauri/Rust desktop application with type-safe IPC, Chakra UI v3, file operations, and real-time file watching

**This Task:** Complete project initialization with all build tools, configurations, and dependencies (Layer 1/6, Task 1/1)

**Task Position:** Foundation layer - must complete before any development can begin

## Execution Instructions

When implementing this task:
1. Read all steps before making changes
2. Execute steps sequentially and completely
3. Run verification commands to ensure success
4. Report errors immediately
5. Only proceed after verification passes

## Requirements

- Node.js 18+ installed
- Rust and Cargo installed (latest stable)
- Tauri CLI installed globally or via npm

## Steps

### 1. Initialize Tauri Project

```bash
# Install Tauri CLI if not already installed
npm install -g @tauri-apps/cli

# Create new Tauri project with React template
npm create tauri-app@latest
# Choose:
# - Project name: (your-app-name)
# - Package manager: npm
# - UI template: react-ts
# - UI flavor: React + TypeScript
```

### 2. Configure package.json

Update `package.json` with required dependencies:

```json
{
  "name": "your-app-name",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@chakra-ui/react": "^3.30.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@tauri-apps/api": "^1.5.0",
    "framer-motion": "^12.23.24",
    "js-yaml": "^4.1.1",
    "mermaid": "^11.12.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-icons": "^5.5.0",
    "react-markdown": "^10.1.0",
    "rehype-highlight": "^7.0.2",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0",
    "@types/js-yaml": "^4.0.9",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.2.0",
    "vite": "^5.0.0"
  }
}
```

### 3. Configure Cargo.toml

Update `src-tauri/Cargo.toml` with required dependencies:

```toml
[package]
name = "your-app-name"
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

### 4. Configure Vite

Create/update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
})
```

### 5. Configure Tauri

Update `src-tauri/tauri.conf.json`:

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
      "identifier": "com.yourapp.app",
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
        "title": "your-app-name",
        "width": 800,
        "height": 600
      }
    ]
  }
}
```

### 6. Install Dependencies

```bash
npm install
```

## Verification

Run these commands to verify setup:

```bash
# Verify Node.js dependencies
npm list --depth=0

# Verify Rust dependencies
cd src-tauri && cargo check

# Verify Tauri CLI
tauri --version

# Test build (should compile without errors)
npm run build
```

## Completion Criteria

- [ ] Tauri project initialized
- [ ] package.json configured with all dependencies
- [ ] Cargo.toml configured with Rust dependencies
- [ ] vite.config.ts created and configured
- [ ] tauri.conf.json configured with proper permissions
- [ ] All dependencies installed successfully
- [ ] Project builds without errors

## Next Steps

After verification passes, proceed to: `backend-foundation.md` in Layer 2.

