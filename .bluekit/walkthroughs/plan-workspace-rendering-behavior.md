---
id: plan-workspace-rendering-behavior
alias: Plan Workspace Rendering Behavior
type: walkthrough
is_base: false
version: 1
tags:
  - react
  - rendering
  - performance
description: Deep dive into the PlanWorkspace rendering lifecycle, identifying causes of flickering and multiple re-renders when viewing and switching between plans
complexity: comprehensive
format: architecture
---
# Plan Workspace Rendering Behavior

This walkthrough analyzes the complete rendering lifecycle of the Plan feature, identifying why you see flickering and multiple re-renders, especially when switching tabs back to a Plan.

## Architecture Overview

The Plan feature uses a **nested loading architecture** with multiple components managing their own state:

```
PlanWorkspace (root container)
├── Loading state (plan details)
├── PlanDocViewPage (main content)
│   ├── Loading state (document content)
│   └── File change listener
└── PlanOverviewPanel (sidebar)
    ├── File watcher setup
    ├── LocalStorage load (notes)
    ├── MilestoneTimeline (memoized)
    │   └── Staggered animations
    └── PlanDocumentList (memoized)
```

## The Rendering Cascade: What You're Seeing

### 1. Initial Mount Sequence

When you first open a Plan or switch to a Plan tab:

**PlanWorkspace.tsx:81-83**
```typescript
useEffect(() => {
    loadPlanDetails(false);  // isBackground = false
}, [loadPlanDetails]);
```

**Timeline:**
1. **Render #1**: Component mounts → `loading = true` → Shows "Loading..."
2. **API Call**: `invokeGetPlanDetails(planId)` fetches from backend
3. **Render #2**: Plan details arrive → `setPlanDetails()` → `loading = false`
4. **Render #3**: Child components (`PlanDocViewPage`, `PlanOverviewPanel`) mount

**Why this flickers:** There's a visible "Loading..." text that appears briefly before the actual content renders.

---

### 2. PlanDocViewPage Loading (Nested)

**PlanDocViewPage.tsx:86-113**
```typescript
useEffect(() => {
    if (!currentDoc) {
        setLoading(false);
        return;
    }

    const loadContent = async () => {
        setLoading(true);  // ← Another loading state!
        try {
            const fileContent = await invokeReadFile(currentDoc.filePath);
            setContent(fileContent);
            setViewMode('preview'); // ← Resets view mode
        } finally {
            setLoading(false);
        }
    };

    loadContent();
}, [currentDoc?.filePath]);
```

**Timeline:**
1. **Render #4**: PlanDocViewPage mounts → `loading = true` → Shows "Loading document..."
2. **File Read**: `invokeReadFile()` reads markdown file
3. **Render #5**: Content loaded → `setContent()` → `loading = false`
4. **Render #6**: View mode resets to 'preview'

**Why this flickers:** Even if you're already viewing a document, switching tabs away and back triggers the entire load sequence again because the component remounts.

---

### 3. PlanOverviewPanel Side Effects

When `PlanOverviewPanel` mounts, multiple `useEffect` hooks fire:

#### A. LocalStorage Load (Lines 64-69)
```typescript
useEffect(() => {
    const savedNotes = localStorage.getItem(notesKey);
    if (savedNotes !== null) {
        setNotes(savedNotes);  // ← Render #7
    }
}, [notesKey]);
```

#### B. File Watcher Setup (Lines 86-127)
```typescript
useEffect(() => {
    if (!planId || !planDetails) return;
    
    const setupWatcher = async () => {
        await invokeWatchPlanFolder(planId, planDetails.folderPath);
        const unlisten = await listen<string[]>(eventName, (event) => {
            // This can trigger renders later
            updatePlanDocumentsIncremental(changedPaths);
        });
    };
    
    setupWatcher();
}, [planId, planDetails?.folderPath, ...]);
```

**Impact:** File watcher registration is async. If files change while loading, you get additional re-renders.

---

### 4. Milestone Animations (Still Present!)

**MilestoneTimeline.tsx:204-211**
```typescript
<MotionBox
    key={milestone.id}
    layout
    initial={{ opacity: 0, y: 10, scale: 0.95 }}  // ← Fade-in animation
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.2, delay: index * 0.02 }}  // ← Staggered!
>
```

**Why this contributes to flickering:**
- Each milestone animates in individually with a stagger delay
- If there are 10 milestones, the animation takes `0.2s + (10 * 0.02s) = 0.4s`
- This happens **every time** the component renders, including when switching tabs

**Note:** You removed the `initial` prop from the collapsible sections, but **milestones still have it**.

---

### 5. Memo() with JSON.stringify (Performance Issue)

Both child components use memoization with inefficient comparisons:

**MilestoneTimeline.tsx:557-562**
```typescript
memo(function MilestoneTimeline({ ... }), (prevProps, nextProps) => {
    return (
        prevProps.planId === nextProps.planId &&
        JSON.stringify(prevProps.phases) === JSON.stringify(nextProps.phases) &&  // ← Expensive!
        prevProps.embedded === nextProps.embedded
    );
});
```

**PlanDocumentList.tsx:327-332**
```typescript
memo(function PlanDocumentList({ ... }), (prevProps, nextProps) => {
    return (
        JSON.stringify(prevProps.documents) === JSON.stringify(nextProps.documents) &&  // ← Expensive!
        prevProps.selectedDocumentId === nextProps.selectedDocumentId
    );
});
```

**Problem:**
- `JSON.stringify()` runs on **every render** to check if props changed
- For large phase/document arrays, this is slow
- If the serialization takes time, it contributes to perceived jank

---

### 6. Tab Switch Behavior

When you switch away from a Plan tab and back:

**Hypothesis:** The tab system might be **unmounting** the entire `PlanWorkspace` component when you switch away.

**Evidence:**
- All `useEffect` hooks re-run (file watcher, localStorage load, API calls)
- Loading states reset to `true`
- Animations play again

**Ideal behavior:** The component should stay mounted (hidden) and only update when data changes.

**Current behavior:** Full remount = entire loading cascade repeats = flickering.

---

## Architectural Comparison: Why NoteViewPage Doesn't Flicker

You noticed that `NoteViewPage` doesn't have this re-render problem when switching tabs. This is due to a **fundamental architectural difference** in how the two components handle data loading.

### NoteViewPage: Presentational Component Pattern

**NoteViewPage.tsx:33-40**
```typescript
export default function NoteViewPage({
  resource,
  content: initialContent,  // ← Content passed as prop!
  editable = true,
  onContentChange,
  onNavigate,
  initialViewMode = 'preview',
  editingTitle,
}: NoteViewPageProps)
```

**Key characteristics:**
1. **Content is passed down from parent** - No internal loading state
2. **Receives `resource` and `content` as props** - Parent owns the data
3. **Only updates content reactively** when props change

**NoteViewPage.tsx:76-88**
```typescript
useEffect(() => {
    const isNewFile = prevResourcePathRef.current !== resource.path;
    prevResourcePathRef.current = resource.path;

    // Always update on file change, or when not editing
    if (isNewFile || viewMode !== 'edit') {
        setContent(initialContent);  // ← Just sync local state to props
        // Reset view mode to initial when switching files
        if (isNewFile) {
            setViewMode(initialViewMode);
        }
    }
}, [initialContent, resource.path, viewMode, initialViewMode]);
```

**Flow:**
```
Parent Component (manages data)
    ↓ (passes content as prop)
NoteViewPage (renders content)
    ↓ (no loading, instant display)
User sees content immediately
```

**Result:** When you switch tabs back to a note, the parent component still has the content in memory. NoteViewPage just receives it as a prop and displays it instantly. **No loading state, no flickering.**

---

### PlanDocViewPage: Smart Component Pattern

**PlanDocViewPage.tsx:37-45**
```typescript
export default function PlanDocViewPage({
    documents,           // ← Only receives document metadata
    currentIndex,        // ← Not the actual content!
    planId,
    onNavigate,
    onContentChange,
    isPanelOpen = true,
    onTogglePanel,
}: PlanDocViewPageProps)
```

**Key characteristics:**
1. **Receives document metadata, not content** - Must fetch content itself
2. **Has internal loading state** - Manages its own data fetching
3. **Loads content on every mount** via `useEffect`

**PlanDocViewPage.tsx:86-113**
```typescript
useEffect(() => {
    if (!currentDoc) {
        setLoading(false);
        return;
    }

    const loadContent = async () => {
        setLoading(true);  // ← Internal loading state!
        try {
            const fileContent = await invokeReadFile(currentDoc.filePath);  // ← Fetches from disk
            setContent(fileContent);
            setViewMode('preview'); // ← Resets view mode
        } catch (error) {
            console.error('Failed to load document:', error);
            toaster.create({ type: 'error', title: 'Failed to load document', description: String(error) });
            setContent('');
        } finally {
            setLoading(false);
        }
    };

    loadContent();
}, [currentDoc?.filePath]);  // ← Runs every time filepath changes OR component mounts
```

**Flow:**
```
Parent Component (manages document list)
    ↓ (passes document metadata only)
PlanDocViewPage (fetches content itself)
    ↓ (shows loading state)
invokeReadFile() - IPC call to Rust backend
    ↓ (disk read ~50-100ms)
Content arrives, setContent()
    ↓
User sees content
```

**Result:** When you switch tabs back to a plan, PlanDocViewPage **remounts** (if tab system unmounts hidden tabs). The `useEffect` runs again, triggering the full loading sequence. **Loading state appears, content flickers.**

---

### Why This Architectural Difference Exists

**Design Intent:**

1. **NoteViewPage** is designed as a **dumb presentational component**:
   - Parent (e.g., Workstation, BrowserTabs) manages all state
   - Component just renders what it's told
   - Reusable in different contexts without coupling to data layer

2. **PlanDocViewPage** is designed as a **smart container component**:
   - Owns its data fetching logic
   - Encapsulates document navigation
   - Self-contained feature with internal state management

**Trade-offs:**

| Aspect | NoteViewPage | PlanDocViewPage |
|--------|-------------|-----------------|
| **Re-render cost** | Low (no I/O) | High (IPC + file read) |
| **Tab switch** | Instant | Flickers (reloads) |
| **Coupling** | Depends on parent | Self-contained |
| **Complexity** | Simple | Complex |
| **Memory** | Parent holds content | Component holds content |

---

### The Solution: Lift State or Keep Mounted

**Option A: Lift State (Match NoteViewPage)**
```typescript
// Parent component (PlanWorkspace) would:
const [documentContent, setDocumentContent] = useState('');

useEffect(() => {
    // Load content when document changes
    const loadContent = async () => {
        const content = await invokeReadFile(documents[currentIndex].filePath);
        setDocumentContent(content);
    };
    loadContent();
}, [currentIndex, documents]);

// Pass content as prop
<PlanDocViewPage
    content={documentContent}  // ← Pass content down
    documents={documents}
    currentIndex={currentIndex}
/>
```

**Benefits:**
- Content persists when tab is hidden
- No re-fetch on tab switch
- Matches NoteViewPage pattern

**Drawbacks:**
- PlanWorkspace becomes more complex
- Parent must manage content state

---

**Option B: Keep Mounted (Simpler)**

Ensure tab system keeps `PlanWorkspace` mounted when switching tabs, just hide it with CSS:

```typescript
// In BrowserTabs or tab container
<Box display={isActive ? 'block' : 'none'}>
    <PlanWorkspace plan={plan} />
</Box>
```

**Benefits:**
- No architectural changes needed
- State naturally persists
- Minimal code change

**Drawbacks:**
- All tabs stay in memory
- More DOM nodes active

---

## Summary: The Flickering Timeline

When you switch to a Plan tab, here's what you see:

| Time | What Renders | Why You See It |
|------|-------------|----------------|
| 0ms | "Loading..." text | `PlanWorkspace` loading state |
| ~100ms | Empty sidebar | `PlanOverviewPanel` mounts |
| ~150ms | "Loading document..." | `PlanDocViewPage` loading state |
| ~200ms | Sidebar content pops in | Plan details arrive |
| ~250ms | Document content appears | File read completes |
| ~250-450ms | Milestones fade in one-by-one | Staggered animations |
| ~300ms | Notes load | LocalStorage read completes |

**Total perceived load time: ~450ms of visual shifting**

---

## Root Causes of Flickering

1. **Cascading Loading States**
   - Three separate loading states (workspace → panel → doc viewer)
   - Each shows different loading UI briefly

2. **Component Remounting on Tab Switch**
   - If tabs unmount components, entire sequence repeats
   - No state preservation between switches

3. **Milestone Staggered Animations**
   - Still using `initial` prop with per-item delays
   - Creates 200-400ms of content "popping in"

4. **File Watcher Events**
   - Background file changes trigger incremental updates
   - Can interrupt rendering if files change during load

5. **Inefficient Memoization**
   - `JSON.stringify()` comparisons add overhead
   - Might delay renders or cause extra work

---

## Recommended Fixes

### High Impact (Eliminates Flickering)

1. **Keep tabs mounted with CSS display toggle** ⭐ **EASIEST FIX**
   - Modify tab container to use `display: none` instead of unmounting
   - This single change eliminates all tab-switch flickering
   - Matches how modern browsers handle inactive tabs

2. **Lift document content state to parent** (Alternative architectural fix)
   - Move content loading from PlanDocViewPage to PlanWorkspace
   - Pass content as prop (like NoteViewPage does)
   - More complex but decouples data from presentation

3. **Remove milestone `initial` animations**
   - Same as you did for collapsible sections
   - Prevents 200-400ms staggered fade-in on every render

### Medium Impact (Improves Performance)

4. **Replace JSON.stringify() with shallow equality**
   - Use proper deep comparison library or `React.useMemo()` for derived data
   - Reduces CPU overhead on every render

5. **Consolidate loading states**
   - Single loading indicator instead of three cascading states
   - Cleaner UX, less visual shifting

### Low Impact (Nice to Have)

6. **Debounce file watcher updates** (already has 300ms, could increase to 500ms)
7. **Preload plan details** when hovering over plan in list (speculative loading)
8. **Add transition states** instead of instant show/hide to smooth visual changes

---

## Code References

- **Main container**: `src/features/plans/components/PlanWorkspace.tsx`
- **Sidebar**: `src/features/plans/components/PlanOverviewPanel.tsx`
- **Document viewer**: `src/features/plans/components/PlanDocViewPage.tsx`
- **Milestones**: `src/features/plans/components/MilestoneTimeline.tsx`
- **Document list**: `src/features/plans/components/PlanDocumentList.tsx`
