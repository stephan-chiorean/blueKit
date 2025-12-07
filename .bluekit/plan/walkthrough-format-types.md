# Walkthrough Format Types & Enhanced UX

## Philosophy

Walkthroughs in BlueKit currently use a **one-size-fits-all** markdown approach. While this keeps things simple, we're missing opportunities to provide specialized UX for different **use cases** that walkthroughs serve.

The solution: **Format types** that adapt the UI/UX based on the `format` field in YAML front matter, while keeping the underlying storage agnostic (still just markdown).

**Key Principle:** Folders give users organizational freedom, but **format types** unlock specialized, purpose-built UX.

---

## Current State

**Walkthrough Definition** (from `blueKitMcp/bluekit-prompts/get-walkthrough-definition.md`):

```yaml
format: reference | guide | review | architecture | documentation
complexity: simple | moderate | comprehensive
```

**Currently:** These fields exist but don't affect the UI. All walkthroughs render the same way.

**Opportunity:** Each format type has unique UX needs that we're not addressing.

---

## Format Type Variations

### 1. `reference` - Quick Lookup

**Use Case:** API cheatsheets, command references, keyboard shortcuts, common patterns

**Current Pain:** Users have to scroll through markdown to find specific snippets

**Enhanced UX:**

#### Visual Design
- **Compact card layout** with search/filter at top
- **Section tabs** for quick jumping (e.g., "Functions", "Classes", "Utils")
- **Copy buttons** on every code block
- **Searchable index** of all headings/code snippets

#### Unique Features
```
┌─ Reference: React Hooks API ─────────────┐
│ [Search...🔍]                            │
│                                          │
│ 📑 Quick Jump: [useState] [useEffect]   │
│                                          │
│ ┌─ useState ──────────────────────┐     │
│ │ const [state, setState] = ...   │ [📋]│
│ │ Description: Manages state      │     │
│ └─────────────────────────────────┘     │
│                                          │
│ ┌─ useEffect ─────────────────────┐     │
│ │ useEffect(() => {...}, [deps])  │ [📋]│
│ │ Description: Side effects       │     │
│ └─────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

#### Auto-Parsing Features
- Extract all code blocks with surrounding headings
- Auto-generate table of contents with anchor links
- Keyboard navigation (j/k to scroll through items)
- "Recently copied" section (localStorage tracking)

---

### 2. `review` - Code Review Checklist

**Use Case:** PR reviews, audit checklists, QA walkthroughs, security reviews

**Current Pain:** No way to track which items you've reviewed

**Enhanced UX:**

#### Visual Design
- **Checkbox system** for each section/heading
- **Progress bar** showing completion percentage
- **Status badges** (Not Started / In Progress / Done)
- **Comments/notes** on each item

#### Unique Features
```
┌─ Review: Auth System PR #123 ───────────┐
│ Progress: ████████░░ 80%                 │
│                                          │
│ ☑ 1. Security Checks              [Done]│
│   ✓ JWT validation                      │
│   ✓ Input sanitization                  │
│   ☐ Rate limiting                       │
│   Notes: [Add note...] 💬               │
│                                          │
│ ☐ 2. Performance                  [Todo]│
│   ☐ Database query optimization         │
│   ☐ Caching strategy                    │
│                                          │
│ [Mark All Complete] [Reset Progress]    │
└──────────────────────────────────────────┘
```

#### Auto-Parsing Features
- Convert headings to checklist items automatically
- Parse nested lists as sub-tasks
- Save progress in localStorage per review
- Export checklist to markdown (for PR comments)

#### localStorage Schema
```json
{
  "review-auth-pr-123": {
    "lastUpdated": 1234567890,
    "checklist": {
      "section-1": { "checked": true, "notes": "Looks good" },
      "section-1-item-1": { "checked": true },
      "section-2": { "checked": false, "notes": "" }
    },
    "progress": 0.6
  }
}
```

---

### 3. `guide` - Step-by-Step Tutorial

**Use Case:** Implementation guides, setup instructions, migration guides

**Current Pain:** No way to track where you are in multi-step process

**Enhanced UX:**

#### Visual Design
- **Stepper UI** showing current step
- **Previous/Next navigation** buttons
- **Estimated time** per section (if specified in markdown)
- **"Save progress and exit"** functionality

#### Unique Features
```
┌─ Guide: Setting Up OAuth2 ──────────────┐
│ Step 2 of 5                              │
│ ━━━━━━━━━━━░░░░░░░░░░░ 40% complete     │
│                                          │
│ 📍 Current: Install Dependencies         │
│                                          │
│ Run the following command:               │
│ ┌────────────────────────────────┐       │
│ │ npm install passport jwt...    │  [📋] │
│ └────────────────────────────────┘       │
│                                          │
│ ⏱ Estimated time: 5 minutes             │
│                                          │
│ [ ← Previous ]      [ Next → ]           │
│                                          │
│ Jump to: [1] [2] [3] [4] [5]            │
└──────────────────────────────────────────┘
```

#### Auto-Parsing Features
- Detect H2/H3 headings as steps
- Extract time estimates from text (e.g., "This takes ~10 minutes")
- Save current step in localStorage
- Validation checkpoints (detect "Verify by..." sections)

---

### 4. `architecture` - System Diagrams

**Use Case:** System design docs, component relationships, data flow diagrams

**Current Pain:** No specialized rendering for diagrams or relationships

**Enhanced UX:**

#### Visual Design
- **Split view:** Diagram on left, explanation on right
- **Interactive diagrams** (if using mermaid)
- **Zoom/pan controls** for large diagrams
- **Component highlighting** (click diagram node → scroll to explanation)

#### Unique Features
```
┌─ Architecture: Backend Services ─────────────────┐
│                                                   │
│ ┌─ Diagram ──────┐  ┌─ Explanation ───────────┐ │
│ │                │  │ API Gateway              │ │
│ │    [API GW]    │  │ ──────────────           │ │
│ │       ↓        │  │ Handles all incoming     │ │
│ │  [Auth Svc]    │  │ requests and routes to   │ │
│ │       ↓        │  │ appropriate services.    │ │
│ │   [DB Layer]   │  │                          │ │
│ │                │  │ Tech: Node.js + Express  │ │
│ │                │  │ Port: 3000               │ │
│ └────────────────┘  └──────────────────────────┘ │
│                                                   │
│ [Expand] [Export PNG] [View Full Screen]         │
└───────────────────────────────────────────────────┘
```

#### Auto-Parsing Features
- Auto-detect mermaid diagrams in markdown
- Extract component metadata (parse headings for service names)
- Generate "Component Index" sidebar
- Link diagram nodes to explanation sections

---

### 5. `documentation` - Traditional Docs

**Use Case:** General understanding, how-to guides, concept explanations

**Current Pain:** This is what we have now, it's fine but could be better

**Enhanced UX:**

#### Visual Design
- **Table of contents sidebar** (always visible)
- **Breadcrumb navigation** for nested sections
- **Related walkthroughs** suggestions at bottom
- **Edit in place** button (opens in editor)

#### Unique Features
```
┌─ Documentation: JWT Authentication ───────────────┐
│                                                    │
│ ┌─ TOC ──────┐  ┌─ Content ───────────────────┐  │
│ │ Overview   │  │ # JWT Authentication         │  │
│ │ Setup      │  │                              │  │
│ │ Usage   ←  │  │ ## Overview                  │  │
│ │ Testing    │  │ JSON Web Tokens (JWT) are... │  │
│ │ FAQ        │  │                              │  │
│ └────────────┘  │ ## Usage                     │  │
│                 │ To implement JWT auth...     │  │
│                 └──────────────────────────────┘  │
│                                                    │
│ 📚 Related: [OAuth Guide] [Security Checklist]    │
│ ✏️ [Edit in VS Code]                              │
└────────────────────────────────────────────────────┘
```

#### Auto-Parsing Features
- Generate TOC from headings
- Detect links to other walkthroughs (suggest as related)
- Extract "See also" sections
- Version tracking (show git history if available)

---

## Implementation Strategy

### Phase 1: Format Detection & Basic Variants (Week 1-2)

**Goal:** Parse `format` field and render different UI for each type

#### Tasks
1. **Parse front matter format field**
   - Update `ArtifactFile` type to include `format` and `complexity`
   - Read in `WalkthroughsTabContent` component

2. **Create format-specific overview components**
   - `ReferenceOverview.tsx` - Search + quick jump
   - `ReviewOverview.tsx` - Checklist system
   - `GuideOverview.tsx` - Stepper UI
   - `ArchitectureOverview.tsx` - Diagram focus
   - `DocumentationOverview.tsx` - Enhanced current view

3. **Route to correct component based on format**
   ```typescript
   const renderOverview = () => {
     switch (walkthrough.frontMatter?.format) {
       case 'reference': return <ReferenceOverview {...props} />;
       case 'review': return <ReviewOverview {...props} />;
       case 'guide': return <GuideOverview {...props} />;
       case 'architecture': return <ArchitectureOverview {...props} />;
       default: return <DocumentationOverview {...props} />;
     }
   };
   ```

**Estimated Effort:** 3-4 days

---

### Phase 2: Interactive Features (Week 3-4)

**Goal:** Add format-specific interactive features

#### `reference` Type
- Implement search/filter across code blocks
- Add copy-to-clipboard for all snippets
- Build "Recently copied" tracking

#### `review` Type
- Checkbox state management (localStorage)
- Progress calculation
- Notes system per item
- Export checklist to markdown

#### `guide` Type
- Step navigation (prev/next)
- Progress saving
- Time estimate parsing
- Jump-to-step controls

#### `architecture` Type
- Interactive mermaid diagrams (click to highlight)
- Split view layout
- Zoom/pan for large diagrams
- Component index sidebar

#### `documentation` Type
- Persistent TOC sidebar
- Related walkthroughs detection
- "Edit in editor" integration
- Breadcrumb navigation

**Estimated Effort:** 1 week

---

### Phase 3: Advanced Parsing (Week 5-6)

**Goal:** Auto-extract structure from markdown content

#### Parsing Pipeline
```typescript
interface ParsedWalkthrough {
  frontMatter: {
    format: 'reference' | 'guide' | 'review' | 'architecture' | 'documentation';
    complexity: 'simple' | 'moderate' | 'comprehensive';
    tags: string[];
    description: string;
  };
  structure: {
    headings: Heading[];
    codeBlocks: CodeBlock[];
    diagrams: MermaidDiagram[];
    checklists: ChecklistItem[];
    steps: Step[];
    timeEstimates: TimeEstimate[];
  };
  raw: string;
}
```

#### Auto-Detection Logic
- **Reference:** Lots of code blocks with minimal text
- **Review:** Numbered lists, checkbox patterns
- **Guide:** Sequential headings with imperative verbs ("Install", "Configure")
- **Architecture:** Presence of mermaid diagrams
- **Documentation:** Mixed content, multiple sections

**Estimated Effort:** 1 week

---

## Complexity Field Integration

The `complexity` field affects **depth of detail**, not structure:

### `simple`
- **Single-page view** (no pagination)
- **Collapsed sections** by default
- **Minimal metadata** shown
- **Quick scan mode**

### `moderate` (default)
- **Normal rendering**
- **Table of contents** visible
- **Standard metadata**
- **Balanced detail**

### `comprehensive`
- **Full expanded view**
- **Persistent navigation sidebar**
- **All metadata visible**
- **Deep-dive mode**

**UI Indicator:**
```
┌─ Walkthrough Header ─────────────────────┐
│ 📘 JWT Authentication [moderate]         │
│ Format: Documentation                    │
└──────────────────────────────────────────┘
```

---

## Folder Integration

**Key Insight:** Folders are agnostic organization, formats are specialized UX.

Users can organize walkthroughs into folders like:
- `/reviews/` - Might contain `review` format walkthroughs
- `/guides/` - Might contain `guide` format walkthroughs
- `/architecture/` - Might contain `architecture` format walkthroughs

**But:** Folders don't enforce format. A user could put a `guide` in `/reviews/` and it still renders with guide UX.

**This gives:**
- **Flexibility:** Users organize how they want
- **Consistency:** Same format = same UX, regardless of folder
- **Discovery:** "Show me all reviews" filters by format, not folder

---

## Avoiding Bloat

### Code Bloat Prevention

**Strategy:** Shared base components + format-specific extensions

```typescript
// Base walkthrough viewer (shared)
<WalkthroughViewer content={content}>
  {/* Format-specific wrapper */}
  {format === 'review' && <ReviewChecklistOverlay />}
  {format === 'guide' && <StepperNavigation />}
  {/* etc. */}
</WalkthroughViewer>
```

**Reuse:**
- Markdown parsing: Single library (`remark`)
- Content rendering: Shared component
- Metadata display: Common card layout
- Only **overlays and controls** are format-specific

### UX Bloat Prevention

**Strategy:** Progressive disclosure - only show format-specific UI when needed

**Example:** Review checklist
- Default view: Normal markdown rendering
- Hover on heading: Checkbox appears
- Click checkbox: Progress bar appears at top
- Only when user engages → full review UI activates

**Example:** Guide stepper
- First visit: Normal markdown with "Start guided mode" button
- Click button: Stepper UI activates, progress saving begins
- Exit guided mode: Returns to normal view, progress preserved

**Principle:** Don't force format-specific UI, offer it as enhancement.

---

## Format Type Suggestions (AI-Powered)

When user creates a walkthrough **without** specifying format, suggest based on content:

```typescript
const suggestFormat = (content: string): Format => {
  const codeBlockCount = (content.match(/```/g) || []).length / 2;
  const hasMermaid = /```mermaid/.test(content);
  const hasCheckboxes = /- \[ \]/.test(content);
  const hasSteps = /##\s+(Step \d+|Install|Setup|Configure)/.test(content);

  if (hasMermaid) return 'architecture';
  if (hasCheckboxes) return 'review';
  if (hasSteps) return 'guide';
  if (codeBlockCount > 5) return 'reference';
  return 'documentation';
};
```

**UI Prompt:**
```
┌─ Format Suggestion ──────────────────────┐
│ Based on your content, this looks like   │
│ a "guide" walkthrough.                   │
│                                          │
│ [Use Guide Format] [Choose Different]    │
└──────────────────────────────────────────┘
```

---

## Migration Path

**All existing walkthroughs (no format field):**
- Default to `format: documentation`
- Render with current UI (no breaking changes)
- Users can add `format` field later to unlock enhanced UX

**Opt-in enhancement:**
1. User creates walkthrough (default: documentation)
2. BlueKit suggests format based on content
3. User accepts or chooses different format
4. Enhanced UX activates immediately

**No forced migration, no breaking changes.**

---

## Success Metrics

### Phase 1
- ✓ All 5 format types render correctly
- ✓ Format detection works 100% of the time
- ✓ UI adapts within 100ms of loading walkthrough

### Phase 2
- ✓ Review checklists save progress reliably (localStorage)
- ✓ Guide stepper navigation feels smooth (no lag)
- ✓ Reference search returns results <50ms

### Phase 3
- ✓ Auto-format suggestions are accurate 70%+ of time
- ✓ Users discover format types organically (analytics)
- ✓ Format-specific features used regularly (track interactions)

---

## Visual Comparison

### Before (Current)
```
┌─ All Walkthroughs Look The Same ────────┐
│                                          │
│ # Title                                  │
│                                          │
│ Some content here...                     │
│                                          │
│ More content...                          │
│                                          │
│ [Just scroll through markdown]           │
└──────────────────────────────────────────┘
```

### After (Format-Specific)

**Reference:**
```
┌─ Quick Lookup UI ────────────────────────┐
│ [Search: "useState"🔍]                   │
│ 📑 [useState] [useEffect] [useContext]   │
│ Code snippets with copy buttons          │
└──────────────────────────────────────────┘
```

**Review:**
```
┌─ Checklist UI ───────────────────────────┐
│ Progress: ████████░░ 80%                 │
│ ☑ Security ☑ Performance ☐ Tests        │
│ Notes per item, completion tracking      │
└──────────────────────────────────────────┘
```

**Guide:**
```
┌─ Step-by-Step UI ────────────────────────┐
│ Step 2 of 5 ━━━━━━━━░░░░░░░░ 40%        │
│ [← Previous] [Next →]                    │
│ Jump to: [1] [2] [3] [4] [5]            │
└──────────────────────────────────────────┘
```

**Architecture:**
```
┌─ Diagram-Focused UI ─────────────────────┐
│ [Diagram] | [Explanation]                │
│ Interactive mermaid, zoom controls        │
│ Click node → scroll to description        │
└──────────────────────────────────────────┘
```

**Documentation:**
```
┌─ Enhanced Docs UI ───────────────────────┐
│ [TOC Sidebar] | [Content]                │
│ Related walkthroughs, edit button         │
│ Breadcrumbs, version history              │
└──────────────────────────────────────────┘
```

---

## Alternative Naming

**Current:** "Walkthrough" feels generic and educational

**Alternatives to consider:**

### Option 1: Keep "Walkthrough" as umbrella term
- Walkthroughs contain different formats
- Format badge shows type (e.g., "Walkthrough: Review")

### Option 2: Rename to "Guides"
- Feels more action-oriented
- "Guides" can include references, reviews, etc.
- Tab label: "Guides" instead of "Walkthroughs"

### Option 3: Use format names as types
- "References" tab, "Reviews" tab, "Guides" tab, etc.
- Separate tabs for each format type
- **Con:** More tabs, more UI complexity

### Option 4: "Documentation" as umbrella
- Documentation includes all format types
- Tab label: "Docs"
- **Pro:** Familiar term, clear purpose

**Recommendation:** Keep "Walkthroughs" but add format badges/filters
- Tab still labeled "Walkthroughs"
- Filter dropdown: "Show: All | References | Reviews | Guides | Architecture | Documentation"
- Card/table shows format badge clearly

---

## Open Questions

### 1. Should format be auto-detected or manually set?
**Options:**
- Auto-detect on creation, user can override
- User chooses format explicitly every time
- Auto-detect, show suggestion, require confirmation

**Recommendation:** Auto-detect with suggestion prompt (non-blocking)

### 2. Can users change format after creation?
**Options:**
- Format is immutable (locked at creation)
- Format can be changed anytime (edit front matter)
- Format change triggers UI re-render

**Recommendation:** Allow changes (just edit YAML), UI re-renders automatically

### 3. Should complexity affect UX or just display?
**Options:**
- Complexity is metadata only (display badge, no UX change)
- Complexity changes rendering (simple = compact, comprehensive = expanded)
- Complexity unlocks features (comprehensive gets more tools)

**Recommendation:** Complexity affects default UI state (collapsed vs expanded)

### 4. How to handle localStorage bloat?
**Options:**
- No limit (users manage their own data)
- Auto-cleanup after 30 days
- Limit to last 50 review/guide progress saves

**Recommendation:** Auto-cleanup of untouched progress after 90 days

---

## Technical Architecture

### Component Structure

```
components/
├── walkthroughs/
│   ├── WalkthroughsTabContent.tsx       # Main tab (already exists)
│   ├── WalkthroughViewer.tsx            # Base viewer (shared)
│   ├── formats/
│   │   ├── ReferenceOverview.tsx        # Quick lookup UI
│   │   ├── ReviewOverview.tsx           # Checklist system
│   │   ├── GuideOverview.tsx            # Stepper navigation
│   │   ├── ArchitectureOverview.tsx     # Diagram focus
│   │   └── DocumentationOverview.tsx    # Enhanced docs
│   ├── shared/
│   │   ├── MarkdownRenderer.tsx         # Shared markdown rendering
│   │   ├── CodeBlock.tsx                # Code block with copy
│   │   ├── TableOfContents.tsx          # Shared TOC
│   │   └── FormatBadge.tsx              # Format type indicator
│   └── utils/
│       ├── parseWalkthrough.ts          # Parse markdown structure
│       ├── detectFormat.ts              # Auto-detect format type
│       └── walkthroughStorage.ts        # localStorage helpers
```

### Type Definitions

```typescript
// Add to types/resource.ts
export type WalkthroughFormat =
  | 'reference'   // Quick lookup, search-focused
  | 'guide'       // Step-by-step, progress tracking
  | 'review'      // Checklist, completion tracking
  | 'architecture'// Diagram-focused, interactive
  | 'documentation'; // Traditional docs

export type WalkthroughComplexity =
  | 'simple'        // Concise, collapsed
  | 'moderate'      // Standard detail
  | 'comprehensive'; // Deep dive, expanded

export interface WalkthroughFrontMatter extends ResourceFrontMatter {
  type: 'walkthrough';
  format?: WalkthroughFormat;
  complexity?: WalkthroughComplexity;
}

export interface ParsedWalkthroughStructure {
  headings: { level: number; text: string; id: string }[];
  codeBlocks: { language: string; code: string; lineNumber: number }[];
  diagrams: { type: 'mermaid'; code: string; lineNumber: number }[];
  checklists: { text: string; checked: boolean; lineNumber: number }[];
  steps: { title: string; content: string; timeEstimate?: number }[];
  links: { text: string; href: string; isInternal: boolean }[];
}
```

### localStorage Schema

```typescript
// Review progress
interface ReviewProgress {
  walkthroughPath: string;
  lastUpdated: number;
  checklist: {
    [itemId: string]: {
      checked: boolean;
      notes: string;
    };
  };
  progress: number; // 0-1
}

// Guide progress
interface GuideProgress {
  walkthroughPath: string;
  lastUpdated: number;
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  timeSpent: number; // milliseconds
}

// Reference recent copies
interface ReferenceHistory {
  walkthroughPath: string;
  recentlyCopied: {
    snippet: string;
    timestamp: number;
    heading?: string;
  }[];
}
```

---

## Next Steps

1. **Validate Concept:** Team review of format types and UX proposals
2. **Prototype:** Build one format type (recommend `review` for high impact)
3. **User Testing:** Test with real walkthroughs, gather feedback
4. **Iterate:** Refine UX based on usage patterns
5. **Roll Out:** Implement remaining format types in phases

---

## Related Documents

- `/blueKitMcp/.bluekit/dilemma.md` - Kit abstraction philosophy
- `kit-overview-enhancements.md` - Similar enhancement approach for kits
- `CLAUDE.md` - Technical architecture
- `product.md` - Product vision

---

## Immediate Benefit to Using BlueKit

**The Pitch:**

> "Other tools just store markdown. BlueKit **understands** your walkthroughs and gives you specialized UX for each type:
>
> - **References** become searchable snippet libraries
> - **Reviews** track your progress with checklists
> - **Guides** navigate step-by-step with auto-save
> - **Architecture docs** highlight diagrams with interactive controls
>
> Same markdown files. Way better UX."

This differentiation makes BlueKit **immediately valuable** compared to just storing markdown in folders or using generic note-taking apps.
