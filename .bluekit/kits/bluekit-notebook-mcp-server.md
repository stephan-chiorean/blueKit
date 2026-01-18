---
id: bluekit-notebook-mcp-server
alias: BlueKit Notebook MCP Server
type: kit
version: 1
tags:
  - mcp
  - notebook
  - ai-tooling
description: A Model Context Protocol server enabling AI assistants to read, write, and manage BlueKit notebook content in the .bluekit directory
---

# BlueKit Notebook MCP Server Kit

## End State

After applying this kit, the application will have:

### Core MCP Server Infrastructure

**Server initialization:**

- MCP server using `@modelcontextprotocol/sdk` with stdio transport
- Automatic detection of project root (finds nearest `.bluekit` directory or creates one)
- Version management from package.json
- CLI with `--help` and `--version` flags
- Graceful error handling with structured error responses

**Tool registration:**

- `ListToolsRequestSchema` handler returning all available notebook tools
- `CallToolRequestSchema` handler routing to appropriate service methods
- JSON responses with configurable pretty printing for debugging

### Notebook Folder Structure

The MCP server operates on the `.bluekit` directory within a project:

```
project-root/
└── .bluekit/
    ├── bluekit.md           # Notebook overview/index
    ├── kits/                 # Reusable code pattern instructions
    │   └── *.md
    ├── walkthroughs/         # Step-by-step code explanations
    │   └── *.md
    ├── agents/               # AI agent definitions
    │   └── *.md
    ├── diagrams/             # Mermaid diagrams
    │   └── *.mmd
    ├── blueprints/           # Project scaffolding templates
    │   └── */
    │       ├── blueprint.json
    │       └── tasks/
    └── notes/                # General documentation
        └── *.md
```

### MCP Tools Available

**Note Management Tools:**

| Tool           | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `create_note`  | Create a new note in the notebook with automatic folder routing |
| `read_note`    | Read a note's content and frontmatter                           |
| `update_note`  | Update an existing note (overwrite, append, prepend modes)      |
| `patch_note`   | Efficiently replace specific strings within a note              |
| `delete_note`  | Delete a note with confirmation requirement                     |
| `move_note`    | Move/rename a note within the notebook                          |
| `list_notes`   | List notes in a folder or the entire notebook                   |
| `search_notes` | Search notes by content or frontmatter fields                   |

**Metadata Tools:**

| Tool                 | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `get_frontmatter`    | Extract YAML frontmatter from a note                             |
| `update_frontmatter` | Update frontmatter without changing content                      |
| `manage_tags`        | Add, remove, or list tags on a note                              |
| `get_note_info`      | Get metadata (size, modified date, type) without reading content |

**Folder Management Tools:**

| Tool                 | Description                                       |
| -------------------- | ------------------------------------------------- |
| `list_folders`       | List all folders in the notebook                  |
| `create_folder`      | Create a new folder (custom organization)         |
| `get_folder_summary` | Get statistics about a folder (note count, types) |

### Service Layer Architecture

**FileSystemService:**

- Orchestrates all file operations
- Path resolution within `.bluekit` boundary
- Security validation preventing path traversal
- Automatic directory creation for nested paths
- Support for `.md`, `.mmd`, and `.json` file types

**FrontmatterHandler:**

- YAML frontmatter parsing using `gray-matter`
- Validation of BlueKit metadata schema
- Preservation of original content during updates
- Type coercion and normalization

**PathFilter:**

- Blocks access to: `.git/`, `node_modules/`, system files
- Allows: `.md`, `.mmd`, `.json` within `.bluekit`
- Configurable extension whitelist
- Glob pattern matching for ignore rules

**SearchService:**

- Full-text search across note content
- Frontmatter field search (type, tags, description)
- Case-insensitive by default
- Result limiting with excerpts and line numbers

**FolderRouter:**

- Intelligent routing based on note type in frontmatter
- Maps `type: kit` → `kits/`, `type: walkthrough` → `walkthroughs/`, etc.
- Fallback to explicit path or `notes/` for untyped content

### Natural Language Command Parsing

The server enables AI assistants to interpret natural language and route to appropriate tools:

**Prompt Patterns → Tool Mapping:**

| User Intent                       | Detected Pattern        | Tool Called                              |
| --------------------------------- | ----------------------- | ---------------------------------------- | ----------------------------------- | ------------------------------- |
| "Add to my notebook"              | `add                    | create                                   | write.\*notebook`                   | `create_note` with auto-routing |
| "Add to the kits folder"          | `add.*kits?\s*folder`   | `create_note` with `folder: "kits"`      |
| "Make a bluekit note about X"     | `make                   | create.*note.*about`                     | `create_note` with inferred content |
| "Save this as a walkthrough"      | `save.*as.*walkthrough` | `create_note` with `type: "walkthrough"` |
| "Show me all kits"                | `show                   | list.\*kits`                             | `list_notes` with `folder: "kits"`  |
| "Find notes about authentication" | `find                   | search.\*about`                          | `search_notes` with query           |
| "Update the API patterns kit"     | `update.*kit`           | `update_note`                            |
| "Delete the old diagram"          | `delete                 | remove.\*diagram`                        | `delete_note` with confirmation     |

**Routing Logic:**

- Frontmatter `type` field determines target folder
- Explicit folder mention overrides type-based routing
- Missing type defaults to `notes/` folder
- File extension inferred from type (`.mmd` for diagrams, `.md` otherwise)

### Tool Input Schemas

**create_note:**

```typescript
{
  name: string;           // Note filename (without extension)
  content: string;        // Markdown body content
  folder?: string;        // Target folder (kits, walkthroughs, agents, diagrams, notes)
  frontmatter?: {
    type?: 'kit' | 'walkthrough' | 'agent' | 'diagram' | 'blueprint' | 'note';
    tags?: string[];
    description?: string;
    // Type-specific fields...
  };
}
```

**search_notes:**

```typescript
{
  query: string;          // Search text
  folder?: string;        // Limit to specific folder
  searchContent?: boolean; // Search in body (default: true)
  searchFrontmatter?: boolean; // Search in frontmatter (default: true)
  type?: string;          // Filter by note type
  tags?: string[];        // Filter by tags
  limit?: number;         // Max results (default: 10, max: 50)
}
```

### Response Formats

**Token-optimized (default):**

```json
{
  "fm": { "type": "kit", "tags": ["auth"] },
  "content": "# Authentication Kit\n..."
}
```

**Pretty-printed (debug mode):**

```json
{
  "frontmatter": {
    "type": "kit",
    "tags": ["auth"]
  },
  "content": "# Authentication Kit\n..."
}
```

### Error Handling

**Structured error responses:**

```typescript
{
  content: [{ type: "text", text: "Error: File not found: kits/auth.md" }],
  isError: true
}
```

**Error categories:**

- Path traversal attempts → "Access denied"
- File not found → "File not found: {path}"
- Permission denied → "Permission denied: {path}"
- Invalid frontmatter → "Invalid frontmatter: {details}"
- Confirmation mismatch → "Deletion cancelled: confirmation path does not match"

### Security Guarantees

- All paths resolved relative to `.bluekit` directory
- Path traversal (`../`) blocked at resolution layer
- No access to files outside `.bluekit` boundary
- Destructive operations require explicit confirmation
- System files and hidden directories automatically filtered

---

## Implementation Principles

### Architecture

- **Service-layer separation**: Each service (FileSystem, Frontmatter, PathFilter, Search) has single responsibility
- **Dependency injection**: Services injected into server for testability
- **Stateless operations**: Each tool call is independent; no session state
- **Fail-fast validation**: Validate inputs before any filesystem operations

### Path Handling

- Normalize all paths to forward slashes (cross-platform)
- Strip leading slashes from relative paths
- Trim whitespace from all path inputs
- Resolve paths against `.bluekit` root, never project root

### Frontmatter Management

- Use `gray-matter` or equivalent for reliable YAML parsing
- Validate frontmatter before writing (block functions, symbols, circular refs)
- Preserve original content during frontmatter-only updates
- Empty frontmatter results in no YAML block (clean files)

### Natural Language Integration

- Tool descriptions written for AI comprehension
- Input schemas include semantic descriptions
- Response format consistent and predictable
- Error messages actionable and specific

### Performance

- Lazy directory creation (only when writing)
- Streaming for large file reads (if supported)
- Result pagination for search
- Minimal JSON responses by default

### Testing

- Test services independently with mocked dependencies
- Test path security (traversal attempts)
- Test frontmatter edge cases (empty, malformed, nested)
- Integration tests with actual filesystem

---

## Verification Criteria

After generation, verify:

### Core Operations

- ✓ `create_note` creates file in correct folder based on type
- ✓ `read_note` returns parsed frontmatter and content separately
- ✓ `update_note` preserves frontmatter when appending/prepending
- ✓ `patch_note` fails safely when multiple matches found (without replaceAll)
- ✓ `delete_note` requires exact path confirmation
- ✓ `move_note` creates target directories if needed

### Routing Logic

- ✓ Note with `type: kit` automatically routes to `kits/` folder
- ✓ Note with `type: diagram` saves as `.mmd` extension
- ✓ Explicit folder parameter overrides type-based routing
- ✓ Untyped notes default to `notes/` folder

### Security

- ✓ Paths containing `../` are rejected
- ✓ Paths outside `.bluekit` are inaccessible
- ✓ `.git` and `node_modules` patterns blocked
- ✓ Only allowed extensions permitted

### Search

- ✓ Content search finds matches in note body
- ✓ Frontmatter search finds matches in metadata fields
- ✓ Tag filtering returns only matching notes
- ✓ Results limited to configured maximum

### Frontmatter

- ✓ YAML frontmatter parsed correctly
- ✓ Notes without frontmatter handled gracefully
- ✓ Frontmatter updates preserve note content
- ✓ Invalid frontmatter rejected with specific error

---

## Interface Contracts

### Provides

**MCP Tools:**

- Full CRUD operations for notebook notes
- Search with filtering by type, tags, folder
- Frontmatter and tag management
- Folder listing and statistics

**Response Types:**

```typescript
interface NoteResponse {
  fm: Record<string, any>; // Parsed frontmatter
  content: string; // Markdown body
}

interface SearchResult {
  p: string; // path
  t: string; // title
  ex: string; // excerpt
  mc: number; // matchCount
  ln?: number; // lineNumber
}

interface OperationResult {
  success: boolean;
  message: string;
  path?: string;
}
```

### Requires

**Runtime:**

- Node.js 18+ (ES modules, native fetch)
- `@modelcontextprotocol/sdk` for MCP protocol
- `gray-matter` for frontmatter parsing

**Filesystem:**

- Read/write access to project directory
- Ability to create `.bluekit` directory if not exists

### Compatible With

**AI Assistants:**

- Claude (via Claude Code or Claude Desktop)
- ChatGPT (via MCP bridge)
- Any MCP-compatible client

**BlueKit Ecosystem:**

- Kit generation tools
- Walkthrough generators
- Diagram creators
- Blueprint scaffolding

---

## Potential Optimizations

### Caching Layer

**In-memory note cache:**

- Cache recently read notes with LRU eviction
- Invalidate on write operations
- Configurable cache size and TTL

**Frontmatter index:**

- Background indexing of all note metadata
- Fast tag/type queries without reading files
- Rebuild on startup and file changes

### Batch Operations

**Multi-note reads:**

- `read_multiple_notes` tool for batch retrieval
- Parallel file reads with Promise.allSettled
- Partial success handling (return successful + failed)

**Bulk tag operations:**

- Apply tags to multiple notes at once
- Remove tags across folder
- Tag rename/merge operations

### Watch Mode

**File system watcher:**

- Detect external changes to `.bluekit`
- Invalidate caches on file changes
- Optional real-time sync notifications

### Template System

**Note templates:**

- Pre-defined templates for each note type
- Frontmatter scaffolding based on type
- Custom templates in `.bluekit/templates/`

---

## Custom Commands and Workflows

### Slash Commands (for AI integration)

| Command                   | Description                              | Implementation          |
| ------------------------- | ---------------------------------------- | ----------------------- |
| `/bluekit init`           | Initialize `.bluekit` in current project | Create folder structure |
| `/bluekit list [folder]`  | List notes, optionally filtered          | `list_notes` tool       |
| `/bluekit search <query>` | Search notebook                          | `search_notes` tool     |
| `/bluekit add <type>`     | Create new note of type                  | `create_note` with type |
| `/bluekit sync`           | Refresh cache/index                      | Internal cache rebuild  |

### Workflow: Capture Knowledge from Code

```
User: "Capture this authentication pattern as a kit"
       ↓
AI: Analyzes current code context
       ↓
AI: Extracts pattern, generates kit content
       ↓
AI: Calls create_note with:
    - name: "auth-pattern"
    - folder: "kits"
    - frontmatter: { type: "kit", tags: ["auth", "security"] }
    - content: [generated kit markdown]
       ↓
Server: Routes to .bluekit/kits/auth-pattern.md
       ↓
AI: "Created kit at kits/auth-pattern.md"
```

### Workflow: Cross-Project Knowledge Transfer

```
User: "Copy the API patterns kit to my other project"
       ↓
AI: Reads kit from current notebook
       ↓
AI: User provides target project path
       ↓
AI: Writes kit to target project's .bluekit/kits/
       ↓
AI: "Transferred kit to /path/to/other-project/.bluekit/kits/api-patterns.md"
```

### Workflow: Generate Documentation Index

```
User: "Create an index of all my kits"
       ↓
AI: Calls list_notes with folder: "kits"
       ↓
AI: For each kit, calls get_frontmatter
       ↓
AI: Generates index markdown with links and descriptions
       ↓
AI: Calls create_note to save index
       ↓
Server: Saves to .bluekit/kits/index.md
```

### Workflow: Tag-Based Organization

```
User: "Show me all notes tagged 'react'"
       ↓
AI: Calls search_notes with tags: ["react"]
       ↓
Server: Returns all notes where frontmatter.tags includes "react"
       ↓
AI: Formats and displays results
```

### Workflow: Refactoring Kits

```
User: "Split the large utils kit into smaller focused kits"
       ↓
AI: Reads the original kit
       ↓
AI: Analyzes content, identifies distinct concerns
       ↓
AI: Creates multiple new kits:
    - create_note("string-utils", ...)
    - create_note("date-utils", ...)
    - create_note("array-utils", ...)
       ↓
AI: Optionally deletes or archives original
       ↓
AI: "Created 3 focused kits from utils kit"
```

---

## Example Implementation Flow

### Server Startup

```
1. Parse CLI arguments (--help, --version, project path)
2. Resolve .bluekit directory (create if --init flag)
3. Initialize services:
   - PathFilter (with BlueKit-specific rules)
   - FrontmatterHandler
   - FileSystemService (with .bluekit as root)
   - SearchService
   - FolderRouter
4. Create MCP Server instance
5. Register tool handlers
6. Connect stdio transport
7. Ready for requests
```

### Tool Execution: create_note

```
1. Receive CallToolRequest with name: "create_note"
2. Extract arguments: { name, content, folder?, frontmatter? }
3. Determine target folder:
   - If folder specified → use folder
   - Else if frontmatter.type → map type to folder
   - Else → "notes"
4. Determine extension:
   - If type === "diagram" → ".mmd"
   - Else → ".md"
5. Build path: `${folder}/${name}${extension}`
6. Validate frontmatter (if provided)
7. Stringify content with frontmatter
8. Create parent directories
9. Write file
10. Return success response with path
```

### Tool Execution: search_notes

```
1. Receive CallToolRequest with name: "search_notes"
2. Extract arguments: { query, folder?, type?, tags?, limit? }
3. Build file list:
   - If folder specified → list only that folder
   - Else → list all note folders recursively
4. For each file:
   - Read content and frontmatter
   - Check type filter (if specified)
   - Check tag filter (if specified)
   - Search content (if searchContent)
   - Search frontmatter (if searchFrontmatter)
   - Score and collect matches
5. Sort by relevance, limit results
6. Format response with excerpts
7. Return search results
```

---

## Configuration Options

**Environment variables:**

- `BLUEKIT_ROOT` - Override .bluekit location
- `BLUEKIT_CACHE_SIZE` - LRU cache size (default: 100)
- `BLUEKIT_SEARCH_LIMIT` - Max search results (default: 50)

**CLI flags:**

- `--init` - Create .bluekit if not exists
- `--watch` - Enable file system watching
- `--verbose` - Detailed logging

**Runtime configuration (.bluekit/config.json):**

```json
{
  "ignoredPatterns": ["drafts/**"],
  "allowedExtensions": [".md", ".mmd", ".json"],
  "defaultTags": ["project-name"],
  "templates": {
    "kit": "templates/kit.md",
    "walkthrough": "templates/walkthrough.md"
  }
}
```
