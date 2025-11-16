# Tauri + React + TypeScript Desktop Application Blueprint

## 1. Purpose

This blueprint defines a **generic, reusable foundation** for building desktop applications using:

- **Tauri** (Rust backend) for native desktop functionality
- **React 18** with **TypeScript** for the frontend UI
- **Vite** as the build tool and development server

The goal is to scaffold a **clean, minimal Tauri application** with:

- Rust backend with basic IPC commands
- React + TypeScript + Vite frontend
- Basic IPC communication infrastructure
- Clean, scalable project structure
- Comprehensive documentation and inline comments
- **Zero styling** and **zero business logic** - this is a pure template

This blueprint is designed to be:
- **Framework-agnostic**: No opinionated UI frameworks or styling libraries
- **Project-agnostic**: No domain-specific logic or business rules
- **Beginner-friendly**: Extensive comments explaining Rust, React, TypeScript, and Tauri concepts
- **Reusable**: Can be used as a starting point for any desktop application

## 2. Technologies

The following technologies must be used:

- **Tauri**: Framework for building desktop applications with web frontends
- **Rust**: Systems programming language for the backend
- **React 18**: UI library for building user interfaces
- **TypeScript**: Typed superset of JavaScript
- **Vite**: Fast build tool and development server

**Explicitly excluded:**
- Tailwind CSS or any CSS framework
- Styling libraries (CSS-in-JS, styled-components, etc.)
- UI component libraries (Material-UI, Ant Design, etc.)
- State management libraries (Redux, Zustand, etc.) - basic structure only
- Routing libraries (React Router, etc.) - minimal setup if needed

## 3. Project Structure

When this blueprint is executed, Cursor should generate the following file and folder structure:

```
project-root/
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml                # Rust dependencies and project config
│   ├── tauri.conf.json           # Tauri configuration
│   ├── icons/                    # Application icons (required)
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.icns
│   │   └── icon.ico
│   ├── src/
│   │   ├── main.rs               # Entry point, Tauri app initialization
│   │   ├── commands.rs           # IPC command handlers
│   │   ├── state.rs              # Shared application state (if needed)
│   │   └── utils.rs              # Reusable helper functions
│   └── build.rs                  # Build script (if needed)
│
├── src/                          # React frontend
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root React component
│   ├── ipc.ts                    # Typed IPC wrapper functions
│   ├── pages/                    # Page components
│   │   ├── Home.tsx              # Example home page
│   │   └── About.tsx             # Example about page (optional)
│   ├── components/               # Reusable components
│   │   └── Placeholder.tsx       # Example shared component
│   └── state/                    # State management structure (optional)
│       └── README.md             # Explanation of state folder purpose
│
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Node.js dependencies
├── .gitignore                    # Git ignore rules
└── README.md                     # Comprehensive project documentation
```

### Structure Details

**Backend (`src-tauri/`):**
- `main.rs`: Initializes the Tauri application, registers commands, sets up the window
- `commands.rs`: Contains all IPC command handler functions (e.g., `ping`, `get_app_info`)
- `state.rs`: Optional module for managing shared application state across commands
- `utils.rs`: Helper functions that can be reused across backend modules

**Frontend (`src/`):**
- `main.tsx`: Renders the root React component, initializes the app
- `App.tsx`: Main application component that demonstrates IPC usage
- `ipc.ts`: Type-safe wrapper functions around Tauri's `invoke` API
- `pages/`: Folder for page-level components (minimal routing structure)
- `components/`: Folder for reusable UI components
- `state/`: Optional folder showing structure for future state management

## 4. Backend Requirements

### Rust Modules

Cursor must create a minimal set of Rust modules with the following characteristics:

1. **Clear module organization**: Each module should have a single, well-defined purpose
2. **Thorough comments**: Every function, struct, and important line should be commented to explain:
   - Basic Rust syntax and concepts
   - How Tauri commands work
   - How IPC communication is structured
   - How to extend the backend with new commands

### IPC Commands

The backend must include at least two example IPC commands that demonstrate Tauri → React communication:

1. **`ping` command:**
   - Takes no parameters
   - Returns a `String` with value `"pong"`
   - Demonstrates basic command invocation

2. **`get_app_info` command:**
   - Takes no parameters
   - Returns a struct or JSON object containing:
     - App name
     - App version
     - Platform information
   - Demonstrates returning structured data

### Code Quality Requirements

- **Beginner-friendly**: Comments should explain Rust concepts for developers new to Rust
- **Type safety**: Use Rust's type system effectively
- **Error handling**: Demonstrate proper error handling with `Result<T, E>`
- **Documentation**: Include doc comments (`///`) for all public functions
- **Extensibility**: Structure code so new commands can be easily added
- **Warning suppression**: Use `#[allow(dead_code)]` for example/template code that isn't immediately used (e.g., in `state.rs`, `utils.rs`)
- **Doc comment rules**: Doc comments (`///`) MUST be attached to an item (function, struct, etc.). Use regular comments (`//`) for standalone documentation blocks
- **Dependencies**: Explicitly include `tokio` in `Cargo.toml` with `features = ["full"]` for async runtime support

### Example Command Structure

Each command should:
- Be a public async function
- Use `#[tauri::command]` attribute
- Return a `Result<T, E>` for error handling
- Include comprehensive inline comments explaining the code

### Rust-Specific Requirements

1. **Doc Comments vs Regular Comments**:
   - Use `///` (doc comments) ONLY when attached to an item (function, struct, enum, etc.)
   - Use `//` (regular comments) for standalone documentation blocks or explanatory text
   - Example: Architecture notes at the end of a file should use `//`, not `///`

2. **Dead Code Warnings**:
   - Template/example code that isn't immediately used should include `#[allow(dead_code)]`
   - Apply to: example structs in `state.rs`, utility functions in `utils.rs`, etc.
   - This prevents compiler warnings for code that's meant to be used later

3. **Conditional Compilation**:
   - When using `#[cfg(...)]` attributes with early returns, wrap return statements in blocks `{ }` to avoid unreachable code warnings
   - Use `#[allow(unreachable_code)]` on fallback code paths if needed

4. **Icon Files**:
   - Create placeholder icon files in `src-tauri/icons/` directory
   - Required files: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`
   - Can be minimal 1x1 transparent PNGs for development (proper icons needed for production)
   - Create using base64-encoded minimal PNG or image generation tools

## 5. Frontend Requirements

### React Application

Cursor must create a minimal React application with TypeScript that:

1. **Uses React 18 features**: Functional components, hooks (if needed)
2. **No styling**: Use only default browser styles, no CSS files, no inline styles beyond minimal layout
3. **TypeScript throughout**: All files must use TypeScript with proper types
4. **Clean structure**: Organized folders that can scale as the project grows

### App Component

The `App.tsx` component must:
- Call at least one IPC command (e.g., `ping` or `get_app_info`)
- Display the result of the IPC call
- Demonstrate how to handle async IPC calls
- Include comments explaining React and TypeScript concepts

### Component Structure

- **Pages**: Placeholder page components showing where page-level logic would go
- **Components**: A simple shared component demonstrating component composition
- **State folder**: Optional structure showing where state management would be added later

### Code Quality Requirements

- **Beginner-friendly**: Comments should explain:
  - React hooks and functional components
  - TypeScript types and interfaces
  - How to call Tauri IPC commands
  - How to handle async operations
  - How to extend the project with new features
- **Type safety**: Use TypeScript effectively with proper types for IPC calls
- **Clean code**: Follow React best practices (functional components, proper hooks usage)

### JSX/React-Specific Requirements

1. **JSX Comments**:
   - JSX comments use `{/* comment */}` syntax
   - **CRITICAL**: Do NOT nest `/* */` inside JSX comments (e.g., `{/* comment with /* */ */}` will cause parsing errors)
   - Use simple text in JSX comments, or use regular JavaScript comments (`//`) outside JSX

2. **Component Structure**:
   - Use functional components with hooks
   - Properly handle async operations with `useEffect` and `async/await`
   - Include error handling for IPC calls

## 6. IPC Infrastructure

### IPC Wrapper (`ipc.ts`)

The `src/ipc.ts` file must provide a typed wrapper around Tauri's `invoke` API. This file should:

1. **Type-safe functions**: Each IPC command should have a corresponding typed function
   - Example: `invokePing(): Promise<string>`
   - Example: `invokeGetAppInfo(): Promise<AppInfo>`

2. **Type definitions**: Define TypeScript interfaces/types for all IPC command parameters and return values
   - Example: `interface AppInfo { name: string; version: string; platform: string; }`

3. **Error handling**: Show how to handle errors from IPC calls

4. **Documentation**: Include JSDoc comments explaining:
   - How to use each function
   - What parameters are expected
   - What the return type is
   - How to add new IPC commands

### Extensibility

The IPC infrastructure must be structured so that:
- New commands can be easily added by:
  1. Adding the command handler in Rust (`commands.rs`)
  2. Adding the typed wrapper function in `ipc.ts`
  3. Using the function in React components

- The pattern is clear and consistent across all commands

## 7. Documentation Requirements

### README.md

Cursor must generate a comprehensive `README.md` that includes:

1. **Introduction**:
   - What Tauri is and why it's used
   - What Rust does in this context
   - What the frontend (React + TypeScript) does
   - Overview of the project structure

2. **IPC Communication**:
   - Explanation of how IPC works in Tauri
   - How the backend and frontend communicate
   - Examples of calling IPC commands

3. **Development Setup**:
   - Prerequisites (Node.js, Rust, etc.)
   - Installation instructions
   - How to run the app in development mode
   - How to build for production

4. **Project Structure**:
   - Explanation of each folder and file
   - Where to add new features
   - How the architecture is organized

5. **Extending the Project**:
   - How to add new IPC commands
   - How to add new React components
   - How to add new pages
   - How to extend the backend modules

6. **Troubleshooting**:
   - Common issues and solutions
   - Links to relevant documentation
   - Rust/Cargo installation issues
   - Icon file requirements
   - Compilation errors and warnings

### Inline Comments

Both backend and frontend code must include extensive inline comments explaining:

- **Architecture decisions**: Why code is structured a certain way
- **Tauri concepts**: How Tauri-specific features work
- **Rust concepts**: Basic Rust syntax and patterns for beginners
- **React/TypeScript concepts**: How React and TypeScript features are used
- **Extension points**: Where and how to add new functionality

## 8. Output Rules

When Cursor executes this blueprint, it must:

### DO:
- ✅ Generate all files and folders described in Section 3 (including `src-tauri/icons/` directory)
- ✅ Create working, runnable code that demonstrates IPC communication
- ✅ Include comprehensive documentation (README.md and inline comments)
- ✅ Use TypeScript throughout the frontend
- ✅ Use proper Rust patterns and type safety
- ✅ Make code beginner-friendly with extensive comments
- ✅ Structure code for easy extension
- ✅ Keep everything generic and reusable
- ✅ Create placeholder icon files (minimal valid PNGs are acceptable for development)
- ✅ Include `tokio` dependency in `Cargo.toml` with `features = ["full"]`
- ✅ Use `#[allow(dead_code)]` for example/template code
- ✅ Use proper comment syntax (doc comments `///` only for items, regular `//` for standalone docs)
- ✅ Avoid nested comment syntax in JSX comments

### DO NOT:
- ❌ Generate any styling code (CSS, Tailwind, styled-components, etc.)
- ❌ Include any business logic or domain-specific code
- ❌ Add UI component libraries or styling frameworks
- ❌ Create complex state management solutions
- ❌ Add routing libraries (minimal routing structure is acceptable)
- ❌ Include any visual design or UI polish
- ❌ Generate code that is specific to a particular use case
- ❌ Use doc comments (`///`) for standalone documentation blocks
- ❌ Nest `/* */` syntax inside JSX comments
- ❌ Leave dead code warnings for template/example code

### Blueprint Execution

This blueprint document itself:
- **Does NOT generate code** - it only describes what should be generated
- **Does NOT scaffold files** - it provides instructions for scaffolding
- **Describes architecture** - focuses on structure, patterns, and organization
- **Remains generic** - applicable to any desktop application project

When this blueprint is used, Cursor should read this document and generate the complete project structure, code, and documentation as specified in all sections above.

---

## 9. Critical Implementation Notes

### Must-Have Dependencies

**Cargo.toml must include:**
```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }  # REQUIRED for async runtime
```

### Icon Files Creation

Icon files are **required** by Tauri. Create them using one of these methods:

1. **Base64-encoded minimal PNG** (1x1 transparent):
   ```bash
   # Minimal valid PNG base64: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
   # Decode and save to all required icon files
   ```

2. **Script-based creation**:
   ```bash
   mkdir -p src-tauri/icons
   # Create placeholder icons (can be minimal for development)
   ```

Required icon files:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

### Common Pitfalls to Avoid

1. **Rust Doc Comments**: Never use `///` for standalone documentation blocks. Use `//` instead.
2. **JSX Comments**: Never nest `/* */` inside JSX comments like `{/* comment with /* */ */}`.
3. **Dead Code Warnings**: Always add `#[allow(dead_code)]` to example/template code.
4. **Missing Tokio**: Always include `tokio` in dependencies for async support.
5. **Missing Icons**: Always create icon files or the build will fail.

---

**Note**: This blueprint is designed to be executed by Cursor's scaffolding system. The generated project should be immediately runnable and serve as a clean foundation for building any desktop application with Tauri, React, and TypeScript.


