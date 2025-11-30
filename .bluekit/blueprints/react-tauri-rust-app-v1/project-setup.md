---
id: project-setup
type: task
version: 1
---

# Project Setup

Initialize the project structure, install dependencies, and configure build tools for a React + Tauri + Rust desktop application.

## Requirements

- Node.js 18+ and npm
- Rust 1.70+ and Cargo
- Tauri CLI (`npm install -g @tauri-apps/cli`)

## Steps

### 1. Initialize Project Structure

Create the following directory structure:

```
project-name/
├── src/                    # React frontend source
│   ├── components/         # React components
│   ├── contexts/          # React context providers
│   ├── pages/             # Page components
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main React app
│   ├── main.tsx           # React entry point
│   └── ipc.ts             # Type-safe IPC wrappers
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── main.rs        # Application entry point
│   │   ├── commands.rs    # IPC command handlers
│   │   ├── watcher.rs     # File watching
│   │   ├── utils.rs       # Utility functions
│   │   └── state.rs       # Application state
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── build.rs           # Build script
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
└── index.html             # HTML entry point
```

### 2. Initialize Node.js Project

```bash
npm init -y
```

### 3. Install Frontend Dependencies

```bash
npm install react react-dom
npm install -D @vitejs/plugin-react vite typescript
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
npm install @tauri-apps/api
npm install react-icons react-markdown remark-gfm rehype-highlight
npm install js-yaml mermaid
```

### 4. Initialize Tauri Project

```bash
npm install -D @tauri-apps/cli
npm run tauri init
```

Follow the prompts:
- App name: `your-app-name`
- Window title: `Your App Name`
- Frontend dev server: `http://localhost:1420`
- Frontend dist: `../dist`

### 5. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 6. Configure Vite

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
```

### 7. Create HTML Entry Point

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your App Name</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## Verification

- Run `npm run dev` - Vite dev server should start on port 1420
- Run `npm run tauri dev` - Tauri app should open with React frontend
- Check that all dependencies are installed correctly

## Next Steps

After completing this task, proceed to "Tauri Configuration" task.