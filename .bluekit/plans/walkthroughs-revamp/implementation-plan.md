# Walkthroughs Revamp: Structured Single-File Experience

This plan outlines a **single-file walkthrough architecture** that uses rich YAML front matter to enable progressive disclosure, section navigation, and a unique reading experience—without requiring folder-based organization.

## Vision

Walkthroughs remain as single `.md` files, but their YAML front matter gains a new `sections` array that describes the document structure. The UI renders sections as collapsible, navigable cards with summaries, icons, and reading progress tracking. This creates an immersive, book-like reading experience that surpasses traditional linear markdown.

**Key Insight**: The structure lives in the metadata, not the file system. A walkthrough is still one file, but it *feels* like a curated journey.

---

## YAML Front Matter Schema

### Current Schema (unchanged)

```yaml
id: string              # Unique identifier
alias: string           # Display name
type: walkthrough       # Artifact type
is_base: boolean        # Template flag
version: number         # Version number
tags: string[]          # Categorization
description: string     # One-line summary
complexity: simple | moderate | comprehensive
format: reference | guide | review | architecture | documentation
```

### New Additions

```yaml
# Section structure for progressive disclosure
sections:
  - id: string                    # Matches heading anchor (e.g., "overview" for "## Overview")
    title: string                 # Display title (can differ from heading)
    summary: string               # 1-2 sentence TLDR shown when collapsed
    icon: string                  # Optional emoji/icon (e.g., "🎯", "🔐", "⚡")
    collapsed: boolean            # Default collapsed state (default: false)
    estimatedMinutes: number      # Optional reading time estimate
    type: string                  # Section type: overview | deep-dive | reference | example | summary | callout

# Reading experience settings
reading:
  showProgress: boolean           # Show reading progress bar (default: true)
  showOutline: boolean            # Show floating section outline (default: true)
  expandAllByDefault: boolean     # Start with all sections expanded (default: false)
  highlightCurrentSection: boolean # Highlight section in outline on scroll (default: true)

# Author/meta info
author: string                    # Optional author name
lastReviewed: string              # ISO date of last review
```

### Section Types

| Type | Description | Visual Treatment |
|------|-------------|------------------|
| `overview` | High-level introduction | Large card, prominent |
| `deep-dive` | Detailed technical content | Standard card, expandable code blocks |
| `reference` | Quick lookup (tables, specs) | Compact card, table-optimized |
| `example` | Code examples, demos | Code-focused card with copy buttons |
| `summary` | Key takeaways, conclusions | Highlighted card, callout style |
| `callout` | Important notes, warnings | Alert-style card |

---

## UI Architecture

### 1. Walkthrough Reader Component

**Location**: `src/components/walkthroughs/WalkthroughReader.tsx`

A new component that replaces the standard markdown viewer when displaying walkthroughs with sections defined.

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ Walkthrough Header                                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🎯 GitHub Auth Flow & Integration                                │ │
│ │ comprehensive · architecture · 15 min read                       │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 40% complete              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────┬────────────────────────┤
│ Section Cards (scrollable)                 │ Outline (sticky)       │
│ ┌────────────────────────────────────────┐ │ ┌────────────────────┐ │
│ │ 🔑 Part 1: Current Auth Flow           │ │ │ • Overview         │ │
│ │ ────────────────────────────────────── │ │ │ ● Part 1 ← current │ │
│ │ Complete OAuth implementation with     │ │ │ ○ Part 2           │ │
│ │ PKCE, token storage, and security.     │ │ │ ○ Part 3           │ │
│ │                                  [▼]   │ │ │ ○ Conclusion       │ │
│ └────────────────────────────────────────┘ │ └────────────────────┘ │
│ ┌────────────────────────────────────────┐ │                        │
│ │ 📡 Part 2: GitHub API Integration      │ │                        │
│ │ ▶ Expand to read                       │ │                        │
│ └────────────────────────────────────────┘ │                        │
└────────────────────────────────────────────┴────────────────────────┘
```

#### Key Features

1. **Section Cards**
   - Each section renders as a glassmorphic card
   - Collapsed: Shows title, icon, summary, expand button
   - Expanded: Shows full markdown content with syntax highlighting
   - Smooth expand/collapse animations

2. **Floating Outline**
   - Fixed sidebar showing all sections
   - Highlights current section on scroll
   - Click to jump to section
   - Shows read/unread indicators

3. **Progress Tracking**
   - Progress bar in header (% of sections read)
   - Sections marked as "read" when scrolled past
   - State persisted to localStorage by walkthrough ID

4. **Reading Controls**
   - "Expand All" / "Collapse All" toggle
   - "Mark All Read" / "Mark Unread" buttons
   - View mode: Cards vs. Linear (traditional markdown)

### 2. Section Parser

**Location**: `src/utils/walkthroughParser.ts`

Parses walkthrough content and splits it into sections based on YAML metadata.

```typescript
interface ParsedSection {
  id: string;
  title: string;
  summary?: string;
  icon?: string;
  collapsed: boolean;
  estimatedMinutes?: number;
  type: SectionType;
  content: string;      // Raw markdown content for this section
  headingLevel: number; // 1 for #, 2 for ##, etc.
  isRead: boolean;      // Tracked in localStorage
}

function parseWalkthroughSections(
  markdown: string,
  sectionsMeta: SectionMeta[]
): ParsedSection[];
```

**Parsing Logic**:
1. Split markdown at `##` boundaries (H2 headings)
2. Generate anchor IDs from headings (kebab-case)
3. Match sections to metadata via `id` field
4. Sections without metadata rendered with defaults
5. Content before first H2 becomes "intro" section

### 3. Section Editor Modal

**Location**: `src/components/walkthroughs/SectionEditorModal.tsx`

A UI for editing section metadata without touching raw YAML.

```
┌──────────────────────────────────────────────────────────────┐
│ Edit Section                                              [×] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Title:    [Part 1: Authentication Flow              ]      │
│                                                              │
│  Summary:  [Complete OAuth implementation with PKCE,  ]      │
│            [token storage, and security architecture. ]      │
│                                                              │
│  Icon:     [🔑] ← emoji picker                              │
│                                                              │
│  Type:     [deep-dive ▼]                                     │
│                                                              │
│  Reading Time: [8] minutes                                   │
│                                                              │
│  □ Collapsed by default                                      │
│                                                              │
│                                        [Cancel] [Save]       │
└──────────────────────────────────────────────────────────────┘
```

Clicking "Save" updates the YAML front matter and triggers file save.

### 4. Walkthrough Settings Panel

**Location**: `src/components/walkthroughs/WalkthroughSettingsPanel.tsx`

Controls for the `reading` configuration.

- Toggle progress bar visibility
- Toggle outline visibility
- Default expand/collapse behavior
- Reorder sections via drag-and-drop (updates YAML order)

---

## Implementation Phases

### Phase 1: YAML Schema & Parser

**Goal**: Enable section definitions in front matter

1. **Update TypeScript types** (`src/types/walkthrough.ts`)
   - Add `sections` array type
   - Add `reading` configuration type
   - Add `SectionMeta` and `ParsedSection` types

2. **Create section parser** (`src/utils/walkthroughParser.ts`)
   - Split markdown by headings
   - Match sections to metadata
   - Handle missing metadata gracefully

3. **Update Rust parser** (`src-tauri/src/parser.rs`)
   - Parse new YAML fields
   - Return sections metadata to frontend

### Phase 2: Walkthrough Reader UI

**Goal**: Beautiful section-based reading experience

1. **Create WalkthroughReader component**
   - Section card rendering
   - Expand/collapse animations
   - Scroll-to-section functionality

2. **Create SectionCard component**
   - Collapsed state (title + summary)
   - Expanded state (full markdown)
   - Visual treatments per section type

3. **Create OutlineSidebar component**
   - Section list with icons
   - Current section highlighting
   - Click-to-navigate

4. **Create ProgressHeader component**
   - Reading progress bar
   - Expand all / Collapse all controls

### Phase 3: Reading Progress Persistence

**Goal**: Remember what you've read

1. **Create reading state store** (`src/stores/readingProgress.ts`)
   - localStorage-backed state
   - Per-walkthrough progress tracking
   - Section read/unread states

2. **Integrate with WalkthroughReader**
   - Mark sections read on scroll
   - Display read indicators in outline
   - Calculate overall progress percentage

### Phase 4: Section Editor UI

**Goal**: Edit sections without touching YAML

1. **Create SectionEditorModal**
   - Form for section metadata
   - Emoji picker for icons
   - Type selector dropdown

2. **Create WalkthroughSettingsPanel**
   - Reading config toggles
   - Section reordering (drag-drop)

3. **Integrate with file save system**
   - Update YAML front matter
   - Trigger auto-save

### Phase 5: Fallback & Migration

**Goal**: Graceful handling of legacy walkthroughs

1. **Auto-generate sections from headings**
   - If no `sections` array defined
   - Parse H2 headings as sections
   - Use heading text as title, no summary/icon

2. **"Convert to Sections" action**
   - Button in walkthrough header
   - Opens modal to configure sections
   - Saves populated YAML structure

---

## File Changes

### New Files

```
src/
├── components/walkthroughs/
│   ├── WalkthroughReader.tsx       # Main reader component
│   ├── SectionCard.tsx             # Individual section card
│   ├── OutlineSidebar.tsx          # Floating section outline
│   ├── ProgressHeader.tsx          # Header with progress bar
│   ├── SectionEditorModal.tsx      # Edit section metadata
│   └── WalkthroughSettingsPanel.tsx # Reading config UI
├── utils/
│   └── walkthroughParser.ts        # Section parsing logic
├── stores/
│   └── readingProgress.ts          # LocalStorage reading state
└── types/
    └── sections.ts                 # Section type definitions
```

### Modified Files

```
src/types/walkthrough.ts            # Add sections/reading types
src/pages/NoteViewPage.tsx          # Detect walkthrough, use WalkthroughReader
src/components/workstation/EditableMarkdownViewer.tsx  # Option to use reader
```

---

## Example: Before and After

### Before (Current Format)

```yaml
---
id: github-auth-flow
alias: GitHub Auth Flow
type: walkthrough
complexity: comprehensive
format: architecture
---
# GitHub Auth Flow

## Part 1: Current Auth Flow
...content...

## Part 2: GitHub API Integration
...content...
```

**Result**: Standard linear markdown, scroll to read everything.

### After (New Format)

```yaml
---
id: github-auth-flow
alias: GitHub Auth Flow
type: walkthrough
complexity: comprehensive
format: architecture

sections:
  - id: overview
    title: "Overview"
    summary: "Why GitHub auth matters and what this walkthrough covers."
    icon: "🎯"
    type: overview
    estimatedMinutes: 2

  - id: part-1-current-auth-flow
    title: "Part 1: Current Auth Flow"
    summary: "Complete OAuth implementation with PKCE, token storage, and security architecture."
    icon: "🔑"
    type: deep-dive
    estimatedMinutes: 8
    collapsed: true

  - id: part-2-github-api-integration
    title: "Part 2: GitHub API Integration"
    summary: "API client architecture, token injection, and available operations."
    icon: "📡"
    type: deep-dive
    estimatedMinutes: 5
    collapsed: true

reading:
  showProgress: true
  showOutline: true
  expandAllByDefault: false
---
```

**Result**: Beautiful section cards, collapsible deep-dives, progress tracking, jump navigation.

---

## Design Philosophy

### Progressive Disclosure

Not everyone needs every detail. The section-based approach lets readers:
- Scan summaries to find what they need
- Expand only relevant sections
- Collapse sections they've read
- Track their progress through complex walkthroughs

### Immersive Reading

This isn't just documentation—it's an experience:
- Glassmorphic cards with subtle shadows
- Smooth animations on expand/collapse
- Contextual icons that guide the eye
- Progress that rewards completion

### Developer Control

Authors control the experience via YAML:
- Define which sections start collapsed
- Write compelling summaries for each section
- Choose icons that match content mood
- Estimate reading time to set expectations

### Graceful Degradation

Walkthroughs without sections still work:
- Auto-parsed from H2 headings
- Default styling applied
- One-click conversion to structured format

---

## Success Criteria

1. **Existing walkthroughs render** with auto-generated sections
2. **Section cards** expand/collapse smoothly
3. **Outline sidebar** highlights current section on scroll
4. **Progress bar** accurately reflects sections read
5. **Section editor** updates YAML without corrupting file
6. **Reading state persists** across sessions
7. **Performance**: No perceptible lag with 20+ sections
