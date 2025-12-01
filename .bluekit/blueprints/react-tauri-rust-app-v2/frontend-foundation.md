---
id: frontend-foundation
type: task
version: 1
blueprint: react-tauri-rust-app-v2
blueprint_name: React + Tauri + Rust Desktop App
layer: 3
layer_name: Frontend Foundation
---

# Task: Frontend Foundation

## Blueprint Context

**Blueprint Goal:** Build a fully functional React/Tauri/Rust desktop application with type-safe IPC, Chakra UI v3, file operations, and real-time file watching

**This Task:** Complete React frontend setup with Chakra UI v3 theme system, routing, context providers, and main application structure (Layer 3/6, Task 1/1)

**Task Position:** Third layer - builds on project setup, provides frontend foundation for IPC and UI components

## Execution Instructions

When implementing this task:
1. Read all steps before making changes
2. Execute steps sequentially and completely
3. Run verification commands to ensure success
4. Report errors immediately
5. Only proceed after verification passes

## Requirements

- Project setup completed (Layer 1)
- Node.js and npm installed
- Understanding of React, TypeScript, and Chakra UI v3

## Steps

### 1. Create Theme System

Create `src/theme.ts` with Chakra UI v3 theme configuration using `createSystem` and `defaultConfig`. Include:
- Primary color palette
- Semantic tokens for colors
- Background colors (subtle, header, main)
- Text colors (primary, secondary, fg, fg.muted)

### 2. Create Context Providers

Create context providers in `src/contexts/`:

- `ColorModeContext.tsx` - Theme mode management (light/dark)
- `FeatureFlagsContext.tsx` - Feature flag management
- `WorkstationContext.tsx` - Workstation/kit selection state
- `SelectionContext.tsx` - Multi-select state management

Each context should:
- Use React Context API
- Provide custom hooks (e.g., `useColorMode`)
- Handle localStorage persistence where appropriate
- Include TypeScript types

### 3. Create Main Entry Point

Update `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme';
import App from './App';
import { Toaster } from './components/ui/toaster';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ChakraProvider value={system}>
      <App />
      <Toaster />
    </ChakraProvider>
  </React.StrictMode>
);
```

### 4. Create App Component

Create `src/App.tsx` with:
- View state management (welcome, home, project-detail)
- Context provider wrapping
- Routing logic between views
- Project selection handling

### 5. Create Utility Functions

Create utility functions as needed:
- `src/utils/parseFrontMatter.ts` - Parse YAML front matter from markdown files

## Verification

Run these commands to verify:

```bash
# Check TypeScript compilation
npm run build

# Start dev server (should start without errors)
npm run dev

# Verify Chakra UI is working (check browser console)
```

## Completion Criteria

- [ ] Theme system created and configured
- [ ] Context providers created and working
- [ ] Main entry point configured with ChakraProvider
- [ ] App component with routing structure
- [ ] All TypeScript compiles without errors
- [ ] Frontend runs in dev mode

## Next Steps

After verification passes, proceed to: `ipc-system.md` in Layer 4.

