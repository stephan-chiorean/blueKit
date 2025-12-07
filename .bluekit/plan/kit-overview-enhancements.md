# Kit Overview Enhancements

## Vision

Transform the `KitOverview` component from a basic metadata viewer into an intelligent, context-aware interface that adapts based on the structure and content of each kit. Following BlueKit's principle of **"agnostic container, opinionated workflow"**, these enhancements reward users who add metadata while keeping simple kits perfectly functional.

## Current State

The `KitOverview` component currently displays:
- Project status (linked/disconnected)
- File information (name, path, project)
- Notes system (current + previous)

## Enhancement Categories

### 1. Token/Parameter Detection & Input UI

**Concept:** Parse kit content to detect tokens (e.g., `{{project_name}}`, `{{db_url}}`) and provide a UI for filling them in.

**UI Components:**
- "Parameters" section that appears when tokens are detected
- Input fields for each token with labels derived from token names
- localStorage persistence for filled values
- "Apply Template" button that sends kit + filled params to Claude
- Visual distinction between required and optional tokens (if schema is present)

**Technical Notes:**
- Regex pattern: `/\{\{([^}]+)\}\}/g` to detect tokens
- Store in format: `bluekit-params-${kitPath}` in localStorage
- Clear UX when no tokens detected (section doesn't render)

**Example:**
```markdown
# {{project_name}} Backend

Database: {{db_url}}
Port: {{port|default:8080}}
```

Renders as:
```
┌─ Parameters ────────────────┐
│ project_name: [_________]   │
│ db_url:       [_________]   │
│ port:         [8080____]    │
│                             │
│         [Apply Template]    │
└─────────────────────────────┘
```

---

### 2. Metadata-Driven UI Sections

**Based on YAML Front Matter:**

#### Tags Visualization
**When present:** Render as interactive tag chips
- Clickable to filter/search for related kits
- "Find similar kits" button
- Color-coded by category (if we establish tag taxonomy)

**UI:**
```
┌─ Tags ──────────────────────┐
│ [rust] [backend] [auth]     │
│ → Find similar kits         │
└─────────────────────────────┘
```

#### Capabilities (Agent Kits)
**When `type: agent`:** Render capabilities as feature list
- Checklist/bullet visualization
- Different icon scheme for agent-type kits
- "Test agent prompt" quick action

**UI:**
```
┌─ Agent Capabilities ────────┐
│ ✓ Analyze code structure    │
│ ✓ Generate documentation    │
│ ✓ Refactor legacy code      │
└─────────────────────────────┘
```

#### Base Template Badge
**When `is_base: true`:** Special indicator
- "Base Template" badge
- Display inheritance chain if kit references other bases
- "Create derived kit" quick action

#### Version History
**When `version` present:** Version tracking UI
- Current version display
- "View history" (if tracked in git)
- "Restore previous version" option
- Diff viewer for version comparison

---

### 3. Content Structure Analysis

**Parse markdown body to extract:**

#### Code Block Analysis
- **Language distribution chart:** "60% Rust, 40% TypeScript"
- **"Copy code only" buttons:** Strip markdown, extract just code
- **Syntax-highlighted previews:** Show code snippets in overview
- **Detected dependencies:** Parse imports/requires

**UI:**
```
┌─ Code Analysis ─────────────┐
│ Languages: Rust (60%)       │
│            TypeScript (40%) │
│                             │
│ [Copy All Code]             │
└─────────────────────────────┘
```

#### Heading-Based Table of Contents
- **Auto-generate TOC** from markdown headings
- **Quick-jump navigation** to sections in workstation
- **Collapsible section previews**
- **Section count:** "5 sections"

**UI:**
```
┌─ Contents ──────────────────┐
│ → Setup                     │
│ → Configuration             │
│ → Implementation            │
│ → Testing                   │
│ → Deployment                │
└─────────────────────────────┘
```

#### Kit Dependencies
**Detect links to other kits:** `[See auth kit](../kits/auth.md)`
- "Dependencies" section
- Validate that referenced kits exist
- "Install missing dependencies" workflow
- Graph view of kit relationships (future)

---

### 4. Usage Analytics

**Track in localStorage:**
- `lastUsed`: Timestamp of last execution
- `timesExecuted`: Counter
- `successRate`: Track outcomes (if we add feedback mechanism)

**UI:**
```
┌─ Usage Stats ───────────────┐
│ Last used: 2 days ago       │
│ Executed: 12 times          │
│ Success rate: 92%           │
└─────────────────────────────┘
```

**Benefits:**
- Helps users see what they actually use
- Surfaces frequently-used kits
- Identifies kits that might need improvement (low success rate)

---

### 5. Type-Specific Quick Actions

**Adapt action buttons based on kit type:**

#### `type: kit`
- **"Apply to current project"** → Send to Claude with context
- **"Customize and save"** → Fork workflow
- **"Edit kit"** → Open in editor

#### `type: walkthrough`
- **"Start walkthrough"** → Step-by-step guide mode
- **Progress tracker:** Checkboxes for each section
- **"Mark as completed"** → Usage tracking

#### `type: agent`
- **"Test agent prompt"** → Send to Claude in sandbox
- **"Edit capabilities"** → Quick edit front matter
- **"Clone agent"** → Duplicate with modifications

#### `type: blueprint`
- **"Preview blueprint"** → Show layer structure
- **"Validate config"** → Check schema
- **"Execute blueprint"** → Start project generation

---

### 6. Smart Suggestions

**AI-powered or rule-based recommendations:**

#### Dependency Detection
- **"This kit might need these dependencies"**
- Parse `import`, `require`, `use` statements
- Cross-reference with package.json/Cargo.toml

#### Similarity Suggestions
- **"Similar to these kits in your library"**
- Tag-based matching
- Content similarity (TF-IDF or embedding-based)

#### Tag Suggestions
- **"Consider adding these tags"**
- Analyze content to suggest relevant tags
- Learn from user's tagging patterns

**UI:**
```
┌─ Suggestions ───────────────┐
│ ℹ Add tag: "authentication" │
│ ℹ Similar: jwt-middleware   │
│ ℹ Missing dep: jsonwebtoken │
└─────────────────────────────┘
```

---

### 7. Validation & Health Checks

#### Schema Validation
**When kit declares schema:**
```yaml
schema:
  required:
    - project_name
    - db_url
  optional:
    - port
```

**UI Shows:**
- "Validate kit structure" button
- Warnings for missing required tokens
- Type validation for token values
- Green checkmark when valid

#### Dependency Health
- **"Check dependencies"** → Verify referenced kits exist
- **Broken link warnings:** Red indicators for missing kits
- **"Install missing dependencies"** → Workflow to add them

**UI:**
```
┌─ Health Check ──────────────┐
│ ✓ All parameters defined    │
│ ✓ Dependencies found        │
│ ⚠ Consider adding tests     │
└─────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (High Impact, Low Complexity)

**Goal:** Immediate UX improvements with minimal infrastructure changes

1. **Token Detection & Parameter UI**
   - Parse kit content for `{{token}}` patterns
   - Render input fields in overview
   - Store filled values in localStorage
   - Add "Apply Template" action

2. **Tag Visualization**
   - Render tags as clickable chips
   - "Find similar kits" button (filters by shared tags)
   - Color-coded tags

3. **Code Block Extraction**
   - Detect code blocks in markdown
   - "Copy code only" buttons
   - Language detection

**Estimated Effort:** 2-3 days

---

### Phase 2: Enhanced Navigation (Medium Complexity)

**Goal:** Make kits easier to browse and understand

4. **Heading-Based TOC**
   - Parse markdown headings (H1-H3)
   - Generate clickable table of contents
   - Sync with workstation scroll position

5. **Type-Specific Actions**
   - Different action buttons based on `type` field
   - Context-aware quick actions
   - Type-specific icons/badges

6. **Usage Tracking**
   - Track last used, execution count
   - Display in overview
   - "Recently used" sorting option

**Estimated Effort:** 3-4 days

---

### Phase 3: Intelligence Layer (High Complexity)

**Goal:** Smart features that adapt to content

7. **Dependency Graph**
   - Parse links to other kits
   - Visualize kit relationships
   - Dependency health checks

8. **Smart Suggestions**
   - AI-powered tag suggestions
   - Similar kit recommendations
   - Dependency detection from code

9. **Schema Validation**
   - Full schema support for kits
   - Validation UI
   - Type checking for parameters

**Estimated Effort:** 1-2 weeks

---

## Technical Architecture

### Parsing Strategy

**Library Choices:**
- **YAML Front Matter:** `gray-matter` (industry standard, well-maintained)
- **Markdown AST:** `remark` or `marked` (for structure extraction)
- **Code Detection:** `highlight.js` or `prism` (for language detection)

**Parsing Pipeline:**
```typescript
interface ParsedKit {
  frontMatter: {
    id?: string;
    alias?: string;
    type?: 'kit' | 'walkthrough' | 'agent' | 'blueprint';
    tags?: string[];
    description?: string;
    schema?: TokenSchema;
    capabilities?: string[];
    version?: number;
    is_base?: boolean;
  };
  content: {
    headings: Heading[];
    codeBlocks: CodeBlock[];
    tokens: Token[];
    links: Link[];
    dependencies: Dependency[];
  };
  raw: string;
}
```

**Caching:**
- Parse once when kit loads
- Store in `WorkstationContext` alongside raw content
- Invalidate cache on content change
- Use `useMemo` to prevent re-parsing on re-renders

---

### State Management

**Current Context:**
- `WorkstationContext`: Stores current kit content (raw string)

**Enhanced Context:**
```typescript
interface WorkstationContextValue {
  // Existing
  content: string | null;
  setContent: (content: string) => void;

  // New
  parsedKit: ParsedKit | null;
  setParsedKit: (parsed: ParsedKit) => void;
  tokenValues: Record<string, string>;
  setTokenValues: (values: Record<string, string>) => void;
}
```

**localStorage Keys:**
- `bluekit-params-${kitPath}`: Token values
- `bluekit-usage-${kitPath}`: Usage analytics
- `bluekit-notes-${kitPath}`: Notes (already exists)

---

### Backward Compatibility

**Graceful Degradation Principles:**

1. **All enhancements are optional**
   - Kits without tags/tokens/schema still work perfectly
   - UI sections only render when relevant data exists

2. **Parsing never blocks rendering**
   - If parsing fails, show raw content
   - Log errors to console, don't crash

3. **Progressive enhancement**
   - Basic kit → shows file info + notes
   - Kit with tags → adds tag chips
   - Kit with tokens → adds parameter UI
   - Kit with schema → adds validation

**Example Rendering Logic:**
```typescript
{parsedKit?.frontMatter.tags && (
  <TagsSection tags={parsedKit.frontMatter.tags} />
)}

{parsedKit?.content.tokens.length > 0 && (
  <ParametersSection tokens={parsedKit.content.tokens} />
)}
```

---

## Design Principles

### 1. Reward, Don't Punish
- Simple kits work out-of-the-box
- Adding metadata unlocks better UX
- No forced ceremony

### 2. Context-Aware UI
- UI adapts to kit type and structure
- Don't show irrelevant sections
- Smart defaults

### 3. Fast Feedback
- Parsing happens instantly
- No loading spinners for local operations
- Optimistic UI updates

### 4. Discoverability
- Visual cues for available features
- Tooltips for advanced options
- Examples in empty states

---

## Open Questions

### 1. Token Replacement Execution
**Question:** Do we replace tokens client-side or let Claude handle it?

**Options:**
- **Client-side:** Replace `{{tokens}}` with values before sending to Claude
  - Pros: Deterministic, user sees exact output
  - Cons: Claude can't adapt tokens to context

- **Claude-native:** Send kit + token values, Claude interprets
  - Pros: Claude can contextualize, adapt, improve
  - Cons: Less predictable, harder to debug

**Recommendation:** Hybrid approach
- Simple string replacement for preview
- Send both template + values to Claude for execution
- Claude can override/adapt as needed

### 2. Schema Complexity
**Question:** How complex should kit schemas be?

**Options:**
- **Minimal:** Just `required` vs `optional` token lists
- **Typed:** Add `type: string|number|boolean` for tokens
- **Full JSON Schema:** Support nested objects, validation rules

**Recommendation:** Start minimal (Phase 1), add types in Phase 3 if needed

### 3. Dependency Resolution
**Question:** Should we auto-install/import referenced kits?

**Options:**
- **Manual:** Just show warnings, user handles it
- **Assisted:** Offer "Install" button, user confirms
- **Automatic:** Silently fetch/import dependencies

**Recommendation:** Assisted (Phase 2), with clear user control

### 4. Usage Analytics Privacy
**Question:** Should usage data stay local or sync to cloud?

**Options:**
- **Local-only:** localStorage, never leaves machine
- **Opt-in sync:** Share anonymized data for insights
- **Team-level:** Share within organization (future)

**Recommendation:** Local-only for now, revisit in Phase 3

---

## Success Metrics

### Phase 1
- ✓ Token detection works for 100% of common patterns
- ✓ Parameter UI renders without lag (<100ms)
- ✓ Users can apply templates with filled params

### Phase 2
- ✓ TOC generation works for all markdown structures
- ✓ Type-specific actions reduce clicks to execute kit
- ✓ Usage tracking provides useful insights

### Phase 3
- ✓ Dependency detection catches 90%+ of common imports
- ✓ Smart suggestions match user intent 70%+ of time
- ✓ Schema validation prevents execution errors

---

## Visual Mockups (ASCII)

### Enhanced Kit Overview (All Features)

```
┌─────────────────────────────────────────────┐
│  ← Back                                     │
├─────────────────────────────────────────────┤
│                                             │
│  Project Status                             │
│  ● Linked                                   │
│                                             │
│  File Information                           │
│  Name:    jwt-auth-middleware.md            │
│  Path:    /project/.bluekit/kits/...       │
│  Project: /project                          │
│                                             │
│  Tags                                       │
│  [rust] [backend] [auth]                    │
│  → Find similar kits                        │
│                                             │
│  Parameters                          [Apply]│
│  secret_key:    [________________]          │
│  expiry_duration: [3600______] (seconds)    │
│                                             │
│  Contents                                   │
│  → Overview                                 │
│  → Installation                             │
│  → Configuration                            │
│  → Usage                                    │
│  → Testing                                  │
│                                             │
│  Code Analysis                              │
│  Languages: Rust (80%), TOML (20%)         │
│  [Copy All Code]                            │
│                                             │
│  Usage Stats                                │
│  Last used: 2 days ago                      │
│  Executed: 12 times                         │
│                                             │
│  Health Check                               │
│  ✓ All parameters defined                   │
│  ✓ Dependencies found                       │
│  ⚠ Consider adding tests                    │
│                                             │
│  Notes                              [Save]  │
│  [____________________________]             │
│  [____________________________]             │
│                                             │
│  Previous                                   │
│  Remember to check the auth flow...         │
│  2024-01-15                       [📋] [🗑] │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Next Steps

1. **Review & Prioritize:** Team discussion on which features to tackle first
2. **Proof of Concept:** Build token detection + parameter UI (Phase 1, Item 1)
3. **User Testing:** Validate UX with real kits
4. **Iterate:** Refine based on feedback before moving to Phase 2

---

## Related Documents

- `/blueKitMcp/.bluekit/dilemma.md` - Original abstraction philosophy
- `CLAUDE.md` - Technical architecture overview
- `product.md` - Product vision and use cases
