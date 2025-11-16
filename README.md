# Tauri + React + TypeScript Desktop Application

A clean, minimal template for building desktop applications using Tauri (Rust backend) and React + TypeScript (frontend).

## Introduction

### What is Tauri?

[Tauri](https://tauri.app/) is a framework for building desktop applications with web frontends. Unlike Electron, Tauri uses a Rust backend, which results in:

- **Smaller bundle sizes** - Applications are typically 10-20MB instead of 100MB+
- **Better performance** - Rust is a systems programming language optimized for speed
- **Enhanced security** - Rust's memory safety prevents many common vulnerabilities
- **Native look and feel** - Uses the system's native webview instead of bundling Chromium

### What does Rust do in this context?

The Rust backend (`src-tauri/`) handles:

- **IPC Commands** - Functions that the frontend can call to perform operations
- **System Integration** - Access to file system, native APIs, and OS features
- **Business Logic** - Complex computations and data processing
- **Security** - Sandboxed operations with controlled permissions

### What does the frontend (React + TypeScript) do?

The React + TypeScript frontend (`src/`) provides:

- **User Interface** - The visual components users interact with
- **State Management** - Managing UI state and user interactions
- **IPC Communication** - Calling backend commands and displaying results
- **Type Safety** - TypeScript ensures type correctness across the frontend

### Project Structure Overview

```
project-root/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── main.rs     # Tauri app initialization
│   │   ├── commands.rs # IPC command handlers
│   │   ├── state.rs    # Application state (optional)
│   │   └── utils.rs    # Helper functions
│   └── Cargo.toml      # Rust dependencies
│
├── src/                # React frontend
│   ├── main.tsx        # React entry point
│   ├── App.tsx       # Root component
│   ├── ipc.ts         # Typed IPC wrappers
│   ├── pages/         # Page components
│   ├── components/    # Reusable components
│   └── state/         # State management (optional)
│
└── Configuration files (package.json, vite.config.ts, etc.)
```

## IPC Communication

### How IPC Works in Tauri

IPC (Inter-Process Communication) allows the frontend (JavaScript/TypeScript) to communicate with the backend (Rust). Here's how it works:

1. **Frontend calls a command**: The React app calls a function in `src/ipc.ts`
2. **Tauri bridges the call**: Tauri sends the request to the Rust backend
3. **Rust processes the request**: A command handler in `src-tauri/src/commands.rs` executes
4. **Response is sent back**: The Rust function returns data, which Tauri sends back to the frontend
5. **Frontend receives the result**: The promise resolves with the data

### Example: Calling an IPC Command

**Backend (Rust)** - `src-tauri/src/commands.rs`:
```rust
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}
```

**Frontend Wrapper** - `src/ipc.ts`:
```typescript
export async function invokePing(): Promise<string> {
  return await invoke<string>('ping');
}
```

**Using in React** - `src/App.tsx`:
```typescript
import { invokePing } from './ipc';

const result = await invokePing();
console.log(result); // "pong"
```

### Available Commands

This template includes three example commands:

1. **`ping`** - Simple test command that returns "pong"
2. **`get_app_info`** - Returns app metadata (name, version, platform)
3. **`example_error`** - Demonstrates error handling

See `src/ipc.ts` for all available commands and their usage.

## Development Setup

### Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **Rust** (latest stable version)
   - Install from [rustup.rs](https://rustup.rs/)
   - Verify: `rustc --version`

3. **System Dependencies**
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
   - **Windows**: Microsoft C++ Build Tools and WebView2

### Installation

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Install Rust dependencies** (automatically done on first build):
   ```bash
   cd src-tauri
   cargo build
   cd ..
   ```

### Running in Development Mode

Start the development server:

```bash
npm run dev
```

Or use Tauri's dev command:

```bash
npm run tauri dev
```

This will:
1. Start the Vite dev server on `http://localhost:1420`
2. Compile the Rust backend
3. Open a desktop window with your app

### Building for Production

Create a production build:

```bash
npm run tauri build
```

This will:
1. Build the React frontend (optimized production bundle)
2. Compile the Rust backend (release mode)
3. Create an installer in `src-tauri/target/release/bundle/`

The output format depends on your platform:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` disk image and `.app` bundle
- **Linux**: `.deb` and `.AppImage`

## Project Structure

### Backend (`src-tauri/`)

- **`src/main.rs`** - Entry point, initializes Tauri and registers commands
- **`src/commands.rs`** - All IPC command handlers
- **`src/state.rs`** - Shared application state (optional, for future use)
- **`src/utils.rs`** - Reusable helper functions
- **`Cargo.toml`** - Rust dependencies and project configuration
- **`tauri.conf.json`** - Tauri-specific configuration (window settings, permissions, etc.)

### Frontend (`src/`)

- **`main.tsx`** - React entry point, renders the root component
- **`App.tsx`** - Main application component, demonstrates IPC usage
- **`ipc.ts`** - Type-safe wrappers around Tauri's `invoke` API
- **`pages/`** - Page-level components (Home, About, etc.)
- **`components/`** - Reusable UI components
- **`state/`** - State management structure (for future state libraries)

### Configuration Files

- **`package.json`** - Node.js dependencies and scripts
- **`vite.config.ts`** - Vite build tool configuration
- **`tsconfig.json`** - TypeScript compiler configuration
- **`index.html`** - HTML entry point for the React app

## Extending the Project

### Adding a New IPC Command

1. **Create the command handler** in `src-tauri/src/commands.rs`:
   ```rust
   #[tauri::command]
   pub async fn my_new_command(param: String) -> Result<String, String> {
       Ok(format!("Received: {}", param))
   }
   ```

2. **Register it** in `src-tauri/src/main.rs`:
   ```rust
   .invoke_handler(tauri::generate_handler![
       commands::ping,
       commands::get_app_info,
       commands::my_new_command,  // Add this line
   ])
   ```

3. **Create a typed wrapper** in `src/ipc.ts`:
   ```typescript
   export async function invokeMyNewCommand(param: string): Promise<string> {
     return await invoke<string>('my_new_command', { param });
   }
   ```

4. **Use it in a React component**:
   ```typescript
   import { invokeMyNewCommand } from './ipc';
   
   const result = await invokeMyNewCommand('Hello');
   ```

### Adding a New React Component

1. **Create the component file** in `src/components/`:
   ```typescript
   interface MyComponentProps {
     title: string;
   }
   
   function MyComponent({ title }: MyComponentProps) {
     return <div>{title}</div>;
   }
   
   export default MyComponent;
   ```

2. **Import and use it**:
   ```typescript
   import MyComponent from './components/MyComponent';
   
   function App() {
     return <MyComponent title="Hello" />;
   }
   ```

### Adding a New Page

1. **Create the page component** in `src/pages/`:
   ```typescript
   function MyPage() {
     return <div>My Page Content</div>;
   }
   
   export default MyPage;
   ```

2. **Import and use it** in `App.tsx` or set up routing if needed.

### Extending Backend Modules

- **Add utility functions**: Add them to `src-tauri/src/utils.rs`
- **Add shared state**: Extend `src-tauri/src/state.rs` or use Tauri's state management
- **Add new modules**: Create new `.rs` files in `src-tauri/src/` and declare them in `main.rs`

## Troubleshooting

### Common Issues

#### "Command not found: cargo"

**Solution**: Install Rust from [rustup.rs](https://rustup.rs/)

#### "Failed to compile Rust code"

**Solution**: 
- Ensure you have the latest Rust toolchain: `rustup update`
- Check that all system dependencies are installed (see Prerequisites)

#### "Port 1420 is already in use"

**Solution**: 
- Change the port in `vite.config.ts`
- Update `tauri.conf.json` to match the new port

#### "Module not found" errors in TypeScript

**Solution**:
- Run `npm install` to ensure all dependencies are installed
- Check that file paths in imports are correct (case-sensitive on Linux/macOS)

#### "Tauri command not found"

**Solution**:
- Ensure the command is registered in `src-tauri/src/main.rs`
- Check that the command name in `invoke()` matches the function name in Rust
- Rebuild the Rust backend: `cd src-tauri && cargo build`

### Getting Help

- **Tauri Documentation**: [tauri.app](https://tauri.app/)
- **Rust Documentation**: [rust-lang.org](https://www.rust-lang.org/)
- **React Documentation**: [react.dev](https://react.dev/)
- **TypeScript Documentation**: [typescriptlang.org](https://www.typescriptlang.org/)
- **Vite Documentation**: [vitejs.dev](https://vitejs.dev/)

## Architecture Notes

### Why This Structure?

- **Separation of Concerns**: Backend (Rust) and frontend (React) are clearly separated
- **Type Safety**: TypeScript on frontend, Rust on backend, both provide compile-time safety
- **Scalability**: The folder structure can grow as your application grows
- **Maintainability**: Clear organization makes it easy to find and modify code

### Design Decisions

- **No Styling**: This template intentionally has no CSS/styling to keep it generic
- **Minimal Dependencies**: Only essential dependencies are included
- **Extensive Comments**: Code is heavily commented to help beginners understand
- **Type Safety**: Full TypeScript and Rust type safety throughout

## Next Steps

1. **Add Styling**: Choose a CSS framework or write custom CSS
2. **Add Routing**: Use React Router or similar for multi-page navigation
3. **Add State Management**: Implement Zustand, Redux, or React Context as needed
4. **Add More IPC Commands**: Extend the backend with your application's functionality
5. **Customize the UI**: Build out your application's user interface
6. **Add Tests**: Set up testing frameworks for both frontend and backend

## License

This is a template project. Use it as a starting point for your own applications.

---

**Happy coding!** 🚀

