---
id: markdown-notebook-mcp-server
alias: Markdown Notebook MCP Server
type: kit
version: 1
tags:
  - mcp
  - markdown
  - filesystem
description: A minimal Model Context Protocol server for AI assistants to read, write, search, and manage markdown notes in a directory
---

# Markdown Notebook MCP Server Kit

## End State

After applying this kit, the application will have:

### MCP Server Foundation

**Server initialization:**

- MCP server using `@modelcontextprotocol/sdk` with stdio transport
- Configurable root directory (notebook path) via CLI argument
- Version read from package.json
- CLI flags: `--help`, `--version`
- Structured JSON responses for all operations

**Request handlers:**

- `ListToolsRequestSchema` - Returns available notebook tools with input schemas
- `CallToolRequestSchema` - Routes tool calls to service methods

### Core MCP Tools

| Tool                  | Purpose                                     | Key Parameters                                                              |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `read_note`           | Read a note's content and frontmatter       | `path`, `prettyPrint?`                                                      |
| `write_note`          | Create or update a note                     | `path`, `content`, `frontmatter?`, `mode?`                                  |
| `patch_note`          | Replace specific text within a note         | `path`, `oldString`, `newString`, `replaceAll?`                             |
| `delete_note`         | Delete a note (requires confirmation)       | `path`, `confirmPath`                                                       |
| `move_note`           | Move or rename a note                       | `oldPath`, `newPath`, `overwrite?`                                          |
| `list_directory`      | List files and folders                      | `path?`, `prettyPrint?`                                                     |
| `search_notes`        | Search notes by content or frontmatter      | `query`, `limit?`, `searchContent?`, `searchFrontmatter?`, `caseSensitive?` |
| `read_multiple_notes` | Batch read notes (max 10)                   | `paths[]`, `includeContent?`, `includeFrontmatter?`                         |
| `get_frontmatter`     | Extract frontmatter only                    | `path`                                                                      |
| `update_frontmatter`  | Update frontmatter without changing content | `path`, `frontmatter`, `merge?`                                             |
| `get_notes_info`      | Get metadata without reading content        | `paths[]`                                                                   |
| `manage_tags`         | Add, remove, or list tags                   | `path`, `operation`, `tags?`                                                |

### Service Layer

**FileSystemService:**

- Central orchestrator for all file operations
- Constructor: `new FileSystemService(rootPath, pathFilter, frontmatterHandler)`
- Methods mirror tool names: `readNote()`, `writeNote()`, `patchNote()`, etc.
- Automatic parent directory creation on write
- Path resolution with security validation

**FrontmatterHandler:**

- Parse YAML frontmatter from markdown content
- Stringify frontmatter + content back to file format
- Validate frontmatter structure (reject functions, symbols, invalid types)
- Return structure: `{ frontmatter: {}, content: string, originalContent: string }`

**PathFilter:**

- Security layer filtering allowed paths and extensions
- Default ignored: `.git/**`, `node_modules/**`, `.DS_Store`, `Thumbs.db`
- Default allowed extensions: `.md`, `.markdown`, `.txt`
- Configurable via constructor options
- Methods: `isAllowed(path)`, `filterPaths(paths[])`

**SearchService:**

- Full-text search across note content
- Frontmatter field search
- Case-insensitive by default
- Configurable result limits
- Returns: `{ p: path, t: title, ex: excerpt, mc: matchCount, ln?: lineNumber }`

### Write Modes

| Mode        | Behavior                                    |
| ----------- | ------------------------------------------- |
| `overwrite` | Replace entire file content (default)       |
| `append`    | Add content to end, merge frontmatter       |
| `prepend`   | Add content to beginning, merge frontmatter |

### Patch Operation

The `patch_note` tool enables efficient partial updates:

- Finds exact string matches (including whitespace/newlines)
- `replaceAll: false` (default) - Fails if multiple matches found (prevents accidents)
- `replaceAll: true` - Replaces all occurrences
- Operates on full file content including frontmatter section

### Response Formats

**Token-optimized (default):**

```json
{
  "fm": { "title": "My Note", "tags": ["example"] },
  "content": "# My Note\n\nContent here..."
}
```

**Directory listing:**

```json
{
  "dirs": ["subfolder1", "subfolder2"],
  "files": ["note1.md", "note2.md"]
}
```

**Batch read:**

```json
{
  "ok": [{ "path": "note1.md", "frontmatter": {}, "content": "..." }],
  "err": [{ "path": "missing.md", "error": "File not found" }]
}
```

**Search results:**

```json
[
  {
    "p": "notes/auth.md",
    "t": "Authentication",
    "ex": "...matching text...",
    "mc": 3,
    "ln": 42
  }
]
```

**Operation results:**

```json
{
  "success": true,
  "path": "notes/example.md",
  "message": "Successfully wrote note: notes/example.md (mode: overwrite)"
}
```

### Path Handling

- All paths relative to notebook root
- Leading slashes stripped automatically
- Whitespace trimmed from all path arguments
- Path traversal (`../`) blocked at resolution layer
- Paths resolved and validated against notebook boundary

### Security Model

**Path traversal prevention:**

```typescript
const relativeToRoot = relative(this.rootPath, fullPath);
if (relativeToRoot.startsWith("..")) {
  throw new Error(`Path traversal not allowed: ${path}`);
}
```

**Destructive operation confirmation:**

- `delete_note` requires `confirmPath` to exactly match `path`
- Prevents accidental deletions from AI hallucinations

**Filtered paths:**

- System directories (`.git`, `node_modules`) automatically hidden
- Only allowed file extensions accessible
- Dot files filtered by default

### Error Handling

**Error response structure:**

```typescript
{
  content: [{ type: "text", text: "Error: {message}" }],
  isError: true
}
```

**Error categories:**
| Error | Message Pattern |
|-------|-----------------|
| File not found | `File not found: {path}` |
| Access denied | `Access denied: {path}` |
| Path traversal | `Path traversal not allowed: {path}` |
| Permission denied | `Permission denied: {path}` |
| Invalid frontmatter | `Invalid frontmatter: {details}` |
| Confirmation mismatch | `Deletion cancelled: confirmation path does not match` |
| Multiple matches | `Found {n} occurrences... Use replaceAll=true` |

### TypeScript Interfaces

```typescript
interface ParsedNote {
  frontmatter: Record<string, any>;
  content: string;
  originalContent: string;
}

interface NoteWriteParams {
  path: string;
  content: string;
  frontmatter?: Record<string, any>;
  mode?: "overwrite" | "append" | "prepend";
}

interface PatchNoteParams {
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

interface DeleteNoteParams {
  path: string;
  confirmPath: string;
}

interface SearchParams {
  query: string;
  limit?: number;
  searchContent?: boolean;
  searchFrontmatter?: boolean;
  caseSensitive?: boolean;
}

interface SearchResult {
  p: string; // path
  t: string; // title
  ex: string; // excerpt
  mc: number; // matchCount
  ln?: number; // lineNumber
}

interface DirectoryListing {
  files: string[];
  directories: string[];
}

interface NoteInfo {
  path: string;
  size: number;
  modified: number; // timestamp
  hasFrontmatter: boolean;
}
```

---

## Implementation Principles

### Architecture

- **Single responsibility**: Each service handles one concern (files, frontmatter, filtering, search)
- **Dependency injection**: Services passed to FileSystemService for testability
- **Stateless tools**: Each MCP tool call is independent, no session state
- **Fail-fast**: Validate all inputs before filesystem operations

### Path Security

- Always resolve paths against notebook root
- Check resolved path is within notebook boundary
- Never expose absolute paths in responses
- Filter system directories regardless of user request

### Frontmatter Handling

- Use `gray-matter` library for reliable YAML parsing
- Preserve `originalContent` for patch operations
- Validate before writing (block executable types)
- Handle notes without frontmatter gracefully
- Empty frontmatter object results in no YAML block

### Response Design

- Minified field names by default for token efficiency
- Optional `prettyPrint` parameter for debugging
- Consistent structure across all tools
- `isError: true` flag on error responses

### File Operations

- Create parent directories automatically on write
- Use atomic write patterns where possible
- Handle concurrent access gracefully
- Normalize line endings consistently

---

## Verification Criteria

After generation, verify:

### Read Operations

- ✓ `read_note` returns parsed frontmatter and content separately
- ✓ Notes without frontmatter return empty object for `frontmatter`
- ✓ `read_multiple_notes` returns partial results (successful + failed arrays)
- ✓ `get_frontmatter` returns only metadata, not content
- ✓ `get_notes_info` returns size and modified timestamp

### Write Operations

- ✓ `write_note` creates parent directories if needed
- ✓ `write_note` with mode `append` preserves existing content
- ✓ `write_note` with mode `prepend` adds content before existing
- ✓ Frontmatter merges correctly in append/prepend modes
- ✓ Invalid frontmatter rejected with specific error message

### Patch Operations

- ✓ `patch_note` with single match succeeds
- ✓ `patch_note` with multiple matches fails (without replaceAll)
- ✓ `patch_note` with `replaceAll: true` replaces all occurrences
- ✓ `patch_note` with no matches returns error with context

### Delete Operations

- ✓ `delete_note` with matching confirmation succeeds
- ✓ `delete_note` with mismatched confirmation fails safely
- ✓ Cannot delete directories with `delete_note`

### Move Operations

- ✓ `move_note` creates target directories if needed
- ✓ `move_note` without overwrite fails if target exists
- ✓ `move_note` with overwrite replaces existing file

### Security

- ✓ Paths with `../` are rejected
- ✓ Paths outside notebook root inaccessible
- ✓ `.git` directory contents filtered from listings
- ✓ Only allowed extensions accessible

### Search

- ✓ Content search finds matches in note body
- ✓ Frontmatter search finds matches in metadata
- ✓ Case-insensitive search works correctly
- ✓ Results respect limit parameter

### Directory Operations

- ✓ `list_directory` returns sorted files and directories
- ✓ Hidden/system files filtered from results
- ✓ Non-allowed extensions filtered from results

---

## Interface Contracts

### Provides

**MCP Server:**

- Stdio transport connection
- Tool listing with JSON schemas
- Tool execution with structured responses

**File Operations:**

- CRUD for markdown notes
- Batch read capabilities
- Search with filtering

**Metadata Operations:**

- Frontmatter parsing and updates
- Tag management
- File info retrieval

### Requires

**Runtime:**

- Node.js 18+ (ES modules support)
- `@modelcontextprotocol/sdk` package
- `gray-matter` for frontmatter parsing

**Filesystem:**

- Read/write access to notebook directory
- Sufficient permissions for file operations

### Compatible With

**MCP Clients:**

- Claude Desktop
- Claude Code CLI
- Any MCP-compatible AI assistant

**Notebook Formats:**

- Obsidian vaults
- Any markdown-based note system
- Static site generators (Hugo, Jekyll, etc.)

---

## Usage Examples

### CLI Invocation

```bash
# Start server with notebook path
npx my-notebook-mcp /path/to/notes

# Show help
npx my-notebook-mcp --help

# Show version
npx my-notebook-mcp --version
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "notebook": {
      "command": "npx",
      "args": ["my-notebook-mcp", "/path/to/notes"]
    }
  }
}
```

### Tool Call Examples

**Read a note:**

```json
{
  "name": "read_note",
  "arguments": { "path": "projects/my-project.md" }
}
```

**Write a note:**

```json
{
  "name": "write_note",
  "arguments": {
    "path": "daily/2024-01-15.md",
    "content": "# Daily Note\n\nToday I learned...",
    "frontmatter": { "date": "2024-01-15", "tags": ["daily"] }
  }
}
```

**Search notes:**

```json
{
  "name": "search_notes",
  "arguments": {
    "query": "authentication",
    "searchContent": true,
    "searchFrontmatter": true,
    "limit": 10
  }
}
```

**Patch a note:**

```json
{
  "name": "patch_note",
  "arguments": {
    "path": "projects/api.md",
    "oldString": "status: draft",
    "newString": "status: published"
  }
}
```

**Delete a note:**

```json
{
  "name": "delete_note",
  "arguments": {
    "path": "archive/old-note.md",
    "confirmPath": "archive/old-note.md"
  }
}
```

---

## Extension Points

### Custom Path Filtering

```typescript
const pathFilter = new PathFilter({
  ignoredPatterns: [".git/**", "node_modules/**", "drafts/**"],
  allowedExtensions: [".md", ".markdown"],
});
```

### Additional File Types

Extend `allowedExtensions` to support:

- `.txt` for plain text notes
- `.json` for structured data
- `.yaml` for configuration

### Custom Frontmatter Validation

Add project-specific validation rules:

- Required fields for certain note types
- Value constraints (dates, enums)
- Cross-field validation

### Search Enhancements

Potential additions:

- Fuzzy matching
- Regex search
- Date range filtering
- Sort options (relevance, date, name)
