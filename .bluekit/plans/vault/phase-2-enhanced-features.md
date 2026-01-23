# Phase 2: Enhanced Local Vault Features

## Goal
Transform the local vault into a powerful knowledge management system with advanced organization, search, and linking capabilities.

---

## Prerequisites
- Phase 1 completed: Local vault foundation working
- Users actively using vault for note-taking
- File tree, basic editing, and file watching stable

---

## User Stories

### US-6: Full-Text Search
**As a** user with hundreds of notes
**I want to** search across all my vault content
**So that** I can quickly find relevant information

**Acceptance Criteria**:
- Global search box in header/sidebar
- Search returns results in <100ms
- Highlights matching text in results
- Can filter by project, tag, date range
- Search-as-you-type with debouncing

### US-7: Wiki-Style Linking
**As a** user connecting ideas
**I want to** link notes together using `[[Note Title]]` syntax
**So that** I can build a knowledge graph

**Acceptance Criteria**:
- Typing `[[` triggers autocomplete
- Autocomplete suggests existing note titles
- Links are clickable (navigate to note)
- Backlinks panel shows notes linking to current note
- Broken links highlighted in red

### US-8: Note Templates
**As a** user with recurring note patterns
**I want to** create notes from templates
**So that** I can capture information consistently

**Acceptance Criteria**:
- Can create template notes (stored in `.bluekit/templates/`)
- Template selector when creating new note
- Templates support variables (e.g., `{{date}}`, `{{project}}`)
- Can edit templates in-app

### US-9: Daily Notes
**As a** user who journals daily
**I want to** automatically create/open today's note
**So that** I can quickly capture thoughts

**Acceptance Criteria**:
- Hotkey (Cmd+D) opens today's note
- Creates note if doesn't exist (format: `YYYY-MM-DD.md`)
- Stored in `Daily Notes/` folder
- Can customize daily note template

### US-10: Smart Folders
**As a** user organizing content
**I want to** create auto-filtering folders
**So that** I can group notes by criteria without manual sorting

**Acceptance Criteria**:
- Can create "smart folder" with filter rules
- Rules: tag=react, project=bluekit, modified<7d, etc.
- Smart folders update automatically
- Saved in `.bluekit/smart-folders.json`

---

## Implementation Checklist

### Search System

#### Option A: SQLite FTS5 (Recommended for Phase 2)
**Pros**:
- Already using SQLite
- Fast for <100K documents
- Built-in ranking
- No external dependencies

**Implementation**:
```sql
-- New table for search index
CREATE VIRTUAL TABLE notes_fts USING fts5(
  path UNINDEXED,
  title,
  content,
  tags,
  tokenize = 'porter unicode61'
);

-- Populate index
INSERT INTO notes_fts (path, title, content, tags)
SELECT path, title, content, tags FROM notes;
```

**Rust Command**:
```rust
#[tauri::command]
async fn search_vault(
    vault_id: String,
    query: String,
    filters: SearchFilters
) -> Result<Vec<SearchResult>, String> {
    // Query FTS5 table
    // Apply filters (project, tags, date)
    // Return ranked results
}
```

#### Option B: Tantivy (Future-Proof)
**Pros**:
- Full-text search engine (like Lucene)
- Better for >100K documents
- Advanced features (fuzzy search, synonyms)

**Cons**:
- Additional dependency
- More complex setup
- Overkill for Phase 2

**Decision**: Use SQLite FTS5 for Phase 2, migrate to Tantivy in Phase 4 if needed.

#### Frontend: Search Component
- [ ] `VaultSearchBar.tsx`
  - Debounced input (300ms)
  - Show results dropdown
  - Keyboard navigation (up/down, enter)
- [ ] `SearchResultsPanel.tsx`
  - List of results with snippets
  - Highlight matching terms
  - Filter sidebar (project, tags, date)

---

### Linking System

#### Wiki-Link Parser
```typescript
// src/utils/wikiLinkParser.ts

interface WikiLink {
  text: string;        // Display text
  target: string;      // Target note title
  alias?: string;      // Optional alias
}

export function parseWikiLinks(content: string): WikiLink[] {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: WikiLink[] = [];

  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({
      text: match[2] || match[1],
      target: match[1],
      alias: match[2],
    });
  }

  return links;
}

export function resolveWikiLink(
  linkTarget: string,
  allNotes: ResourceFile[]
): ResourceFile | null {
  // Find note by title (case-insensitive)
  return allNotes.find(
    note => note.name.toLowerCase() === linkTarget.toLowerCase()
  ) || null;
}
```

#### Backlinks System
- [ ] New Rust command: `get_backlinks(note_path: String) -> Vec<Backlink>`
  - Scans all vault notes for `[[note_title]]`
  - Returns list of notes that link to current note
- [ ] `BacklinksPanel.tsx`
  - Shows in sidebar when note is open
  - List of linking notes with context snippet
  - Click to navigate

#### Autocomplete
- [ ] `WikiLinkAutocomplete.tsx`
  - Triggered by typing `[[`
  - Fuzzy search note titles
  - Shows preview on hover
  - Enter to insert link

---

### Templates System

#### Template Structure
```markdown
---
template: true
name: Project Kickoff
description: Template for starting new projects
---

# {{project_name}}

## Overview
{{description}}

## Goals
- [ ] Goal 1
- [ ] Goal 2

## Resources
- [[Related Note]]

---
Created: {{date}}
Project: {{project}}
```

#### Implementation
- [ ] Store templates in `.bluekit/templates/`
- [ ] Rust command: `get_templates(vault_id) -> Vec<Template>`
- [ ] Rust command: `create_note_from_template(template_id, variables)`
  - Replace `{{variable}}` placeholders
  - Create note with processed content
- [ ] `TemplateSelector.tsx`
  - Shows when clicking "New Note"
  - Preview template
  - Fill in variables via form

#### Built-in Templates
1. **Daily Note**:
   ```markdown
   # {{date}}

   ## Today's Focus

   ## Notes

   ## Tasks
   - [ ]
   ```

2. **Meeting Note**:
   ```markdown
   # {{meeting_title}}

   Date: {{date}}
   Attendees:

   ## Agenda

   ## Discussion

   ## Action Items
   - [ ]
   ```

3. **Code Review**:
   ```markdown
   # Review: {{pr_title}}

   PR: {{pr_url}}
   Author: {{author}}
   Date: {{date}}

   ## Summary

   ## Feedback

   ## Approved: [ ] Yes [ ] No
   ```

---

### Daily Notes

#### Implementation
- [ ] Rust command: `get_or_create_daily_note(vault_id, date) -> Note`
  - Check if `Daily Notes/YYYY-MM-DD.md` exists
  - Create from daily note template if missing
  - Return note path
- [ ] Hotkey handler in App.tsx:
  ```typescript
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        openDailyNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  ```
- [ ] Calendar widget in sidebar (optional)
  - Shows month view
  - Highlights days with notes
  - Click to open that day's note

---

### Smart Folders

#### Definition
```typescript
interface SmartFolder {
  id: string;
  name: string;
  icon: string;
  rules: FilterRule[];
}

interface FilterRule {
  field: 'tag' | 'project' | 'modified' | 'created' | 'type';
  operator: 'equals' | 'contains' | 'before' | 'after';
  value: string | number;
}

// Example: "Recent React Notes"
const smartFolder: SmartFolder = {
  id: 'recent-react',
  name: 'Recent React Notes',
  icon: 'LuReact',
  rules: [
    { field: 'tag', operator: 'contains', value: 'react' },
    { field: 'modified', operator: 'after', value: Date.now() - 7 * 86400000 }
  ]
};
```

#### Implementation
- [ ] Store in `.bluekit/smart-folders.json`
- [ ] Rust command: `get_smart_folder_notes(vault_id, rules) -> Vec<Note>`
  - Apply filters to all notes
  - Return matching notes
- [ ] `SmartFolderEditor.tsx`
  - UI to create/edit smart folders
  - Rule builder (add/remove rules)
  - Preview results
- [ ] Show in sidebar under "Smart Folders" section

---

## Advanced File Organization

### Favorites/Starred
- [ ] Add `starred: boolean` to note metadata
- [ ] Rust command: `toggle_starred(note_path)`
- [ ] Show starred notes in sidebar section
- [ ] Star icon in note editor header

### Nested Folders
- Already supported via file system
- [ ] Enhance file tree to show full depth
- [ ] Drag-and-drop to move between folders
- [ ] Breadcrumb navigation in editor

### Recent Files
- [ ] Track recently opened files (last 10)
- [ ] Store in `~/.bluekit/recent-files.json`
- [ ] Show in sidebar section
- [ ] Cmd+E to open recent files picker

---

## Performance Optimizations

### Search Indexing
- Index notes incrementally (on save)
- Background indexing on app start
- Limit to 10,000 notes initially

### File Tree Virtualization
- Use `react-window` for large trees (>1000 items)
- Lazy-load folder contents
- Cache expanded state

### Link Resolution
- Cache note title → path mapping
- Rebuild cache on file watcher events
- Use trie for fast autocomplete

---

## UI/UX Enhancements

### Command Palette (like VS Code)
- Hotkey: Cmd+K or Cmd+P
- Actions:
  - Search notes
  - Create note
  - Open daily note
  - Switch vault
  - Run smart folder
- Fuzzy search actions

### Keyboard Shortcuts
- `Cmd+N` - New note
- `Cmd+D` - Daily note
- `Cmd+F` - Search in current note
- `Cmd+Shift+F` - Global search
- `Cmd+K` - Command palette
- `Cmd+E` - Recent files
- `Cmd+\` - Toggle sidebar (already exists)

### Visual Indicators
- Badge on sidebar items (note count)
- Color coding for note types
- Icons for file types (kit, walkthrough, etc.)

---

## Testing Strategy

### Search Tests
- [ ] Search 10,000 notes in <100ms
- [ ] Fuzzy search handles typos
- [ ] Filters work correctly
- [ ] Ranking is relevant

### Linking Tests
- [ ] Wiki links resolve correctly
- [ ] Backlinks are accurate
- [ ] Autocomplete suggests correct notes
- [ ] Broken links highlighted

### Template Tests
- [ ] Variables replaced correctly
- [ ] Templates can be edited
- [ ] Creating note from template works

---

## Performance Targets

- Search: <100ms for 10,000 notes
- Autocomplete: <50ms for 1,000 notes
- Backlinks: <200ms calculation
- Smart folder: <300ms for 1,000 notes
- Index rebuild: <5 seconds for 10,000 notes

---

## Success Criteria (Phase 2 Complete)

- [ ] Search returns relevant results instantly
- [ ] Users create average of 5 internal links per note
- [ ] 50% of notes created from templates
- [ ] Daily notes used by 70% of active users
- [ ] Smart folders reduce manual organization time by 40%
- [ ] Command palette used in 80% of sessions
- [ ] Zero performance degradation with 5,000+ notes

**Definition of Done**: A power user can manage 5,000 notes, find any note in <5 seconds, navigate via links, and create consistent notes via templates without thinking about organization.
