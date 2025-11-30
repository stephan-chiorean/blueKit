# BlueKit Setup Guide

This guide will help you set up the complete BlueKit ecosystem on your machine. The BlueKit system consists of three interconnected projects:

- **blueKit** - Tauri desktop application (React + TypeScript frontend, Rust backend)
- **blueKitMcp** - MCP (Model Context Protocol) server for code generation and project management
- **blueKitCLI** - Command-line interface for BlueKit operations

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Node.js** (v18 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Rust** (latest stable version)
   - Install from [rustup.rs](https://rustup.rs/)
   - Verify installation: `rustc --version`

4. **Cursor IDE** (recommended)
   - Download from [cursor.sh](https://cursor.sh/)
   - This setup assumes you're using Cursor for MCP integration

### Platform-Specific Dependencies

#### macOS
```bash
xcode-select --install
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Windows
- Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Project Structure

After cloning, your directory structure should look like this:

```
blueKitApps/
├── blueKit/          # Desktop application
├── blueKitMcp/       # MCP server
└── blueKitCLI/       # Command-line interface
```

## Installation Steps

### 1. Clone All Three Repositories

```bash
# Create a parent directory for all projects
mkdir blueKitApps
cd blueKitApps

# Clone all three repositories
git clone <blueKit-repo-url> blueKit
git clone <blueKitMcp-repo-url> blueKitMcp
git clone <blueKitCLI-repo-url> blueKitCLI
```

### 2. Set Up the MCP Server (blueKitMcp)

The MCP server is the core of the system and must be set up first.

```bash
cd blueKitMcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

Verify the build was successful by checking for the `dist/` folder:
```bash
ls dist/
# Should show: main.js and other compiled files
```

### 3. Set Up the Desktop App (blueKit)

```bash
cd ../blueKit

# Install Node.js dependencies
npm install

# Install Rust dependencies (first build may take several minutes)
cd src-tauri
cargo build
cd ..
```

### 4. Set Up the CLI (blueKitCLI)

```bash
cd ../blueKitCLI

# Install dependencies
npm install

# Build the CLI
npm run build

# Link the CLI globally so you can use the 'bluekit' command anywhere
npm link
```

Verify the CLI is installed:
```bash
bluekit --version
```

## Configuration

### Configure MCP Server for Cursor

To use the BlueKit MCP server with Cursor, you need to add it to Cursor's global MCP configuration.

#### Step 1: Locate Cursor's MCP Configuration

The configuration file is located at: `~/.cursor/mcp.json`

If the file doesn't exist, create it:
```bash
mkdir -p ~/.cursor
touch ~/.cursor/mcp.json
```

#### Step 2: Add BlueKit MCP Server

Edit `~/.cursor/mcp.json` and add the BlueKit MCP server configuration:

```json
{
  "mcpServers": {
    "bluekit": {
      "command": "node",
      "args": [
        "/absolute/path/to/blueKitApps/blueKitMcp/dist/main.js"
      ]
    }
  }
}
```

**IMPORTANT:** Replace `/absolute/path/to/blueKitApps/` with the actual absolute path to your blueKitApps directory.

To find your absolute path:
```bash
cd ~/path/to/blueKitApps/blueKitMcp
pwd
# Copy this path and use it in the config above (ending with /blueKitMcp/dist/main.js)
```

Example for macOS/Linux:
```json
{
  "mcpServers": {
    "bluekit": {
      "command": "node",
      "args": [
        "/Users/yourname/Documents/projects/blueKitApps/blueKitMcp/dist/main.js"
      ]
    }
  }
}
```

Example for Windows:
```json
{
  "mcpServers": {
    "bluekit": {
      "command": "node",
      "args": [
        "C:\\Users\\yourname\\Documents\\projects\\blueKitApps\\blueKitMcp\\dist\\main.js"
      ]
    }
  }
}
```

#### Step 3: Restart Cursor

After updating the MCP configuration, restart Cursor completely for the changes to take effect.

### Configure BlueKit CLI

The CLI needs to know where to find the MCP server. Create a global configuration file:

```bash
mkdir -p ~/.bluekit
```

Create `~/.bluekit/config.json`:

```json
{
  "mcp": {
    "command": "node",
    "args": ["/absolute/path/to/blueKitApps/blueKitMcp/dist/main.js"]
  }
}
```

Again, replace `/absolute/path/to/blueKitApps/` with your actual path.

## Running the Applications

### Running the Desktop App (Development Mode)

```bash
cd blueKit
npm run dev
```

This will:
1. Start the Vite dev server
2. Compile the Rust backend
3. Open the BlueKit desktop application

### Running the MCP Server (Standalone Testing)

The MCP server typically runs as a subprocess (launched by Cursor or the CLI), but you can test it standalone:

```bash
cd blueKitMcp
npm run dev
```

### Using the CLI

The CLI is now globally available. You can use it from any directory:

```bash
# Initialize a new BlueKit project
bluekit init

# Test the MCP connection
bluekit ping

# Generate kits
bluekit generate

# Apply instructions
bluekit apply
```

## Verification & Testing

### 1. Verify MCP Server is Accessible from Cursor

1. Open Cursor
2. Open a project
3. The BlueKit MCP server should be available in Cursor's MCP tools

### 2. Verify CLI Can Communicate with MCP Server

```bash
cd /tmp
mkdir test-bluekit-project
cd test-bluekit-project
bluekit init
```

If successful, you should see:
- `bluekit.config.json` created
- `kits/` and `values/` directories created
- Success message from the MCP server

### 3. Verify Desktop App Runs

```bash
cd ~/path/to/blueKitApps/blueKit
npm run dev
```

The BlueKit desktop window should open without errors.

## Troubleshooting

### "Command not found: cargo"
**Solution:** Install Rust from [rustup.rs](https://rustup.rs/) and restart your terminal.

### "Command not found: bluekit"
**Solution:**
```bash
cd blueKitCLI
npm run build
npm link
```

### "Cannot find module 'dist/main.js'" (MCP Server)
**Solution:**
```bash
cd blueKitMcp
npm run build
```

### "Port 1420 is already in use" (Desktop App)
**Solution:** Stop any other Vite/Tauri processes or change the port in `vite.config.ts`.

### MCP Server Not Showing in Cursor
**Solution:**
1. Verify `~/.cursor/mcp.json` has the correct absolute path
2. Ensure `blueKitMcp/dist/main.js` exists (run `npm run build` if not)
3. Restart Cursor completely
4. Check Cursor's MCP logs for errors

### CLI Can't Find MCP Server
**Solution:**
1. Verify `~/.bluekit/config.json` exists and has the correct path
2. Run `bluekit ping` to test the connection
3. Check that `blueKitMcp/dist/main.js` exists

## Development Workflow

### Making Changes to the MCP Server

After modifying code in `blueKitMcp/src/`:

```bash
cd blueKitMcp
npm run build
```

Cursor and the CLI will automatically use the updated version on the next request.

### Making Changes to the Desktop App

The Vite dev server (`npm run dev`) has hot-reload enabled. Changes to React components will reflect immediately. For Rust changes:

```bash
# Rust changes require a rebuild
cd blueKit/src-tauri
cargo build
```

Then restart the app.

### Making Changes to the CLI

After modifying code in `blueKitCLI/src/`:

```bash
cd blueKitCLI
npm run build
```

The `bluekit` command will use the updated version immediately.

## Building for Production

### Build the Desktop App

```bash
cd blueKit
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`:
- **macOS:** `.app` bundle and `.dmg` installer
- **Windows:** `.msi` installer
- **Linux:** `.deb` and `.AppImage`

### Build the MCP Server

```bash
cd blueKitMcp
npm run build
```

The built files in `dist/` can be distributed and run with Node.js.

### Build the CLI

```bash
cd blueKitCLI
npm run build
```

## Next Steps

After setup, you can:

1. **Initialize a project** - Use `bluekit init` in any project directory
2. **Create kits** - Define reusable code patterns in the `kits/` folder
3. **Generate code** - Use `bluekit generate` to create blueprints
4. **Apply instructions** - Use `bluekit apply` to generate code from blueprints
5. **Use the desktop app** - Monitor and manage your BlueKit projects visually

## Additional Resources

- **Tauri Documentation:** [tauri.app](https://tauri.app/)
- **MCP Protocol:** [Model Context Protocol Docs](https://modelcontextprotocol.io/)
- **Rust Documentation:** [rust-lang.org](https://www.rust-lang.org/)
- **React Documentation:** [react.dev](https://react.dev/)

## Getting Help

If you encounter issues not covered in this guide:

1. Check the individual README files in each project
2. Review error logs carefully
3. Ensure all paths in configuration files are absolute and correct
4. Verify all dependencies are installed (`npm install` and `cargo build`)

## Summary of Key Paths

After setup, these are the important file locations:

- **Cursor MCP Config:** `~/.cursor/mcp.json`
- **BlueKit CLI Config:** `~/.bluekit/config.json`
- **MCP Server Executable:** `~/path/to/blueKitApps/blueKitMcp/dist/main.js`
- **CLI Global Command:** `bluekit` (available anywhere after `npm link`)
- **Desktop App:** Launch with `npm run dev` from `blueKit/` directory

---

You're all set! Happy coding with BlueKit!
