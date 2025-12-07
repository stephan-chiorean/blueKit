# Walkthrough Format Types & Enhanced UX

## Philosophy

Walkthroughs in BlueKit currently use a **one-size-fits-all** markdown approach. While this keeps things simple, we're missing opportunities to provide specialized UX for different **use cases** that walkthroughs serve.

**Core Vision:** BlueKit follows the principle of **"agnostic container, opinionated workflow"** - the storage (markdown files) should be flexible and agnostic, but the tooling should be smart about how it presents and works with that content. This rewards users who add structure while keeping simple workflows easy.

## Analysis: Explicit Format Types vs. Structure Detection

### The Question

Should we require users to explicitly set a `format` field in YAML front matter, or should we auto-detect structure from content and provide progressive enhancement?

### Assessment

**"Monumental UX" Features (High Value):**
1. **Review checklists with progress tracking** - Truly useful if you do code reviews regularly
2. **Guide step navigation with progress saving** - Valuable for multi-step tutorials
3. **Reference search/filter** - Helpful for large reference docs

**Nice-to-Have (Lower Priority):**
- Format badges/indicators (visual polish)
- Auto-format suggestions (convenience)
- Architecture split-view (can be auto-detected from mermaid presence)

### The Problem with Explicit Format Types

Requiring explicit format types adds complexity:
- Users must learn about format types
- Users must remember to set the format field
- Creates friction for simple use cases
- Requires format-specific components and logic
- Adds maintenance burden

### Better Approach: Structure Detection + Progressive Enhancement

Instead of requiring explicit format types, **auto-detect structure from content** and provide progressive enhancement:

**Benefits:**
- ✅ **Agnostic container:** No format field required - plain markdown works
- ✅ **Opinionated workflow:** UI adapts automatically based on detected structure
- ✅ **Simple by default:** Users don't need to learn format types
- ✅ **Rewards structure:** Adding checkboxes/steps/mermaid automatically unlocks features
- ✅ **No friction:** Works immediately without configuration

**Implementation:**
```typescript
// Auto-detect structure from content, don't require format field
const detectStructure = (content: string) => {
  const hasMermaid = /```mermaid/.test(content);
  const hasCheckboxes = /- \[ \]/.test(content);
  const hasSteps = /##\s+(Step \d+|Install|Setup)/.test(content);
  const codeBlockCount = (content.match(/```/g) || []).length / 2;
  
  // Progressive enhancement based on what's detected
  return {
    hasCheckboxes,      // → Enable checklist UI
    hasSteps,           // → Enable stepper navigation
    hasMermaid,         // → Enable diagram focus mode
    isReference: codeBlockCount > 5, // → Enable search/filter
  };
};
```

### Recommendation

1. **Keep folders for organization** (user-controlled, agnostic)
2. **Auto-detect structure** (no format field required)
3. **Progressive enhancement:**
   - Checkboxes detected → show checklist UI
   - Step patterns detected → show stepper navigation
   - Mermaid detected → enable diagram focus
   - Many code blocks → enable search/filter
4. **Optional format field:** If present, use it; otherwise auto-detect

This aligns with the vision: the container (markdown) stays agnostic, and the workflow (UI) adapts based on detected structure. Users get enhanced UX when structure is present, without needing to declare format types.

---

## Revised Approach: Structure-Based Progressive Enhancement

---

## Current State

**Walkthrough Definition** (from `blueKitMcp/bluekit-prompts/get-walkthrough-definition.md`):

```yaml
format: reference | guide | review | architecture | documentation
complexity: simple | moderate | comprehensive
```

**Currently:** These fields exist but don't affect the UI. All walkthroughs render the same way.

**Opportunity:** Detect structure from content and provide specialized UX without requiring explicit format declaration.

---

## Structure Detection & UX Enhancements

The following enhancements are **auto-detected** from content structure, not requiring explicit format types:

### 1. Reference Mode - Quick Lookup (Auto-detected)

**Use Case:** API cheatsheets, command references, keyboard shortcuts, common patterns

**Detection:** 5+ code blocks with minimal surrounding text

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

### 2. Review Mode - Code Review Checklist (Auto-detected)

**Use Case:** PR reviews, audit checklists, QA walkthroughs, security reviews

**Detection:** Presence of markdown checkboxes (`- [ ]` or `- [x]`)

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

### 3. Guide Mode - Step-by-Step Tutorial (Auto-detected)

**Use Case:** Implementation guides, setup instructions, migration guides

**Detection:** Sequential headings with imperative verbs ("Step 1", "Install", "Setup", "Configure")

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

### 4. Architecture Mode - System Diagrams (Auto-detected)

**Use Case:** System design docs, component relationships, data flow diagrams

**Detection:** Presence of mermaid diagram code blocks (```` ```mermaid ````)

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

### 5. Documentation Mode - Traditional Docs (Default)

**Use Case:** General understanding, how-to guides, concept explanations

**Detection:** Default mode when no specific structure is detected

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

### Phase 1: Structure Detection & Basic Enhancements (Week 1-2)

**Goal:** Auto-detect structure from content and render appropriate UI enhancements

#### Tasks
1. **Create structure detection utility**
   ```typescript
   interface DetectedStructure {
     hasCheckboxes: boolean;
     hasSteps: boolean;
     hasMermaid: boolean;
     isReference: boolean; // 5+ code blocks
   }
   
   const detectStructure = (content: string): DetectedStructure => {
     const hasMermaid = /```mermaid/.test(content);
     const hasCheckboxes = /- \[ \]/.test(content);
     const hasSteps = /##\s+(Step \d+|Install|Setup|Configure)/.test(content);
     const codeBlockCount = (content.match(/```/g) || []).length / 2;
     
     return {
       hasCheckboxes,
       hasSteps,
       hasMermaid,
       isReference: codeBlockCount > 5,
     };
   };
   ```

2. **Create enhancement components (progressive disclosure)**
   - `ChecklistOverlay.tsx` - Appears when checkboxes detected
   - `StepperNavigation.tsx` - Appears when steps detected
   - `DiagramFocusMode.tsx` - Appears when mermaid detected
   - `ReferenceSearch.tsx` - Appears when many code blocks detected
   - Base markdown renderer remains unchanged

3. **Apply enhancements conditionally**
   ```typescript
   const renderWalkthrough = (content: string) => {
     const structure = detectStructure(content);
     
     return (
       <WalkthroughViewer content={content}>
         {structure.hasCheckboxes && <ChecklistOverlay />}
         {structure.hasSteps && <StepperNavigation />}
         {structure.hasMermaid && <DiagramFocusMode />}
         {structure.isReference && <ReferenceSearch />}
       </WalkthroughViewer>
     );
   };
   ```

**Estimated Effort:** 3-4 days

---

### Phase 2: Interactive Features (Week 3-4)

**Goal:** Add interactive features for detected structures

#### Reference Mode (when many code blocks detected)
- Implement search/filter across code blocks
- Add copy-to-clipboard for all snippets
- Build "Recently copied" tracking (localStorage)

#### Review Mode (when checkboxes detected)
- Checkbox state management (localStorage)
- Progress calculation
- Notes system per item
- Export checklist to markdown

#### Guide Mode (when steps detected)
- Step navigation (prev/next)
- Progress saving (localStorage)
- Time estimate parsing
- Jump-to-step controls

#### Architecture Mode (when mermaid detected)
- Interactive mermaid diagrams (click to highlight)
- Split view layout (diagram + explanation)
- Zoom/pan for large diagrams
- Component index sidebar

#### Documentation Mode (default)
- Persistent TOC sidebar
- Related walkthroughs detection
- "Edit in editor" integration
- Breadcrumb navigation

**Estimated Effort:** 1 week

---

### Phase 3: Enhanced Parsing & Optional Format Override (Week 5-6)

**Goal:** Improve structure detection accuracy and support optional format field

#### Enhanced Parsing Pipeline
```typescript
interface ParsedWalkthrough {
  frontMatter: {
    format?: 'reference' | 'guide' | 'review' | 'architecture' | 'documentation'; // Optional override
    complexity?: 'simple' | 'moderate' | 'comprehensive';
    tags: string[];
    description: string;
  };
  detectedStructure: {
    hasCheckboxes: boolean;
    hasSteps: boolean;
    hasMermaid: boolean;
    isReference: boolean;
  };
  parsed: {
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

#### Detection Logic (Refined)
- **Reference:** 5+ code blocks with minimal surrounding text (< 3 lines per code block)
- **Review:** Presence of markdown checkboxes (`- [ ]` or `- [x]`)
- **Guide:** Sequential headings (H2/H3) with imperative verbs ("Step 1", "Install", "Setup", "Configure")
- **Architecture:** Presence of mermaid diagram code blocks
- **Documentation:** Default when no specific structure detected

#### Format Override Support
- If `format` field exists in front matter, use it (user override)
- Otherwise, use auto-detected structure
- UI shows detected mode with option to override if needed

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

**Key Insight:** Folders are agnostic organization, structure detection provides specialized UX.

Users can organize walkthroughs into folders like:
- `/reviews/` - Might contain walkthroughs with checkboxes
- `/guides/` - Might contain step-by-step walkthroughs
- `/architecture/` - Might contain mermaid diagrams

**But:** Folders don't enforce structure. A user could put a step-by-step guide in `/reviews/` and it still detects steps and shows stepper navigation.

**This gives:**
- **Flexibility:** Users organize how they want (agnostic container)
- **Smart UX:** Structure is auto-detected regardless of folder (opinionated workflow)
- **Discovery:** "Show me all reviews" filters by detected structure, not folder

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

## Optional Format Override

While structure is auto-detected, users can optionally set a `format` field in front matter to override detection:

```yaml
---
format: review  # Optional: overrides auto-detection
description: "Security review checklist"
---
```

**Use Cases for Override:**
- Content doesn't match expected patterns but user wants specific UX
- User wants to force a particular mode
- Edge cases where detection might be ambiguous

**Default Behavior:**
- No format field → auto-detect from content
- Format field present → use specified format (user override)

---

## Migration Path

**All existing walkthroughs:**
- Auto-detect structure from content
- Enhanced UX activates automatically when structure is detected
- No format field required
- No breaking changes - plain markdown still works perfectly

**Progressive Enhancement:**
1. User creates walkthrough (plain markdown)
2. BlueKit auto-detects structure (checkboxes, steps, mermaid, etc.)
3. Enhanced UX activates automatically
4. User can optionally add `format` field to override detection

**No forced migration, no breaking changes, no configuration required.**

---

## Success Metrics

### Phase 1
- ✓ Structure detection works accurately
- ✓ Enhancements appear when structure is detected
- ✓ UI adapts within 100ms of loading walkthrough
- ✓ No breaking changes for existing walkthroughs

### Phase 2
- ✓ Review checklists save progress reliably (localStorage)
- ✓ Guide stepper navigation feels smooth (no lag)
- ✓ Reference search returns results <50ms

### Phase 3
- ✓ Structure detection is accurate 90%+ of time
- ✓ Users discover enhancements organically (analytics)
- ✓ Enhancement features used regularly (track interactions)
- ✓ Optional format override works when needed

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
- Auto-detect from content (no user action required)
- User chooses format explicitly every time
- Auto-detect, show suggestion, require confirmation

**Recommendation:** Auto-detect from content by default, optional `format` field for override

### 2. Can users override format after creation?
**Options:**
- No override (always auto-detect)
- Format can be set/removed anytime (edit front matter)
- Format change triggers UI re-render

**Recommendation:** Allow optional `format` field override, but default to auto-detection

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
│   ├── enhancements/
│   │   ├── ChecklistOverlay.tsx        # Appears when checkboxes detected
│   │   ├── StepperNavigation.tsx        # Appears when steps detected
│   │   ├── DiagramFocusMode.tsx         # Appears when mermaid detected
│   │   └── ReferenceSearch.tsx         # Appears when many code blocks
│   ├── shared/
│   │   ├── MarkdownRenderer.tsx         # Shared markdown rendering
│   │   ├── CodeBlock.tsx                # Code block with copy
│   │   └── TableOfContents.tsx          # Shared TOC
│   └── utils/
│       ├── parseWalkthrough.ts          # Parse markdown structure
│       ├── detectStructure.ts           # Auto-detect structure from content
│       └── walkthroughStorage.ts        # localStorage helpers
```

### Type Definitions

```typescript
// Add to types/resource.ts

// Optional format override (for user preference)
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

// Detected structure from content (auto-detected)
export interface DetectedStructure {
  hasCheckboxes: boolean;  // Markdown checkboxes detected
  hasSteps: boolean;       // Step patterns detected
  hasMermaid: boolean;     // Mermaid diagrams detected
  isReference: boolean;    // Many code blocks detected
}

export interface WalkthroughFrontMatter extends ResourceFrontMatter {
  type: 'walkthrough';
  format?: WalkthroughFormat;  // Optional override
  complexity?: WalkthroughComplexity;
}

export interface ParsedWalkthroughStructure {
  detected: DetectedStructure;  // Auto-detected structure
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

> "Other tools just store markdown. BlueKit **understands** your walkthroughs and automatically provides specialized UX:
>
> - Add checkboxes → Get progress tracking automatically
> - Add step headings → Get stepper navigation automatically
> - Add mermaid diagrams → Get diagram focus mode automatically
> - Add many code blocks → Get search/filter automatically
>
> Same markdown files. No configuration. Way better UX."

This differentiation makes BlueKit **immediately valuable** compared to just storing markdown in folders or using generic note-taking apps. The "agnostic container, opinionated workflow" principle means users get smart UX without learning format types or setting configuration.
