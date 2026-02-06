# Phase 5: Stabilize

**Status:** Not Started
**Duration:** 3-5 days
**Dependencies:** Phase 4 complete

## Overview

Dogfood the hybrid editor with the feature flag ON. Fix bugs, optimize performance, handle edge cases, and gather feedback. This phase ensures the editor is production-ready before making it the default.

## Goals

- Enable hybrid editor for development team
- Fix all critical bugs
- Optimize performance for large files
- Handle edge cases gracefully
- Gather user feedback
- Prepare for public release

## Testing Focus Areas

### 1. Content Integrity

**Goal:** Ensure no markdown corruption during edit cycles.

**Test Cases:**

**Complex Markdown:**
```markdown
# Heading 1

Paragraph with **bold** and *italic* and `inline code`.

## Heading 2

- Nested lists
  - Level 2
    - Level 3
- Back to level 1

1. Ordered list
2. Second item

> Blockquote with multiple lines
> Still in blockquote

\`\`\`typescript
// Code block with empty lines

function test() {
  return true;
}
\`\`\`

Tables (if supported):
| Col 1 | Col 2 |
|-------|-------|
| A     | B     |

[Links](https://example.com)

![Images](path/to/image.png)
```

**Testing:**
- [ ] Edit each block type → Verify no syntax loss
- [ ] Edit block → Blur → Re-edit → Content unchanged
- [ ] Multiple rapid edits → No corruption
- [ ] Paste complex markdown → Parses correctly
- [ ] Copy block → Paste elsewhere → Formatting preserved

**Edge Cases:**
- [ ] Empty file (no content)
- [ ] File with only frontmatter
- [ ] File with only code blocks
- [ ] File with no paragraph breaks (single block)
- [ ] File with many empty lines
- [ ] File with special characters (emoji, unicode)

---

### 2. Performance

**Goal:** Ensure editor performs well with realistic content.

**Metrics:**
- First render: <100ms
- Block edit activation: <50ms
- Save operation: <200ms
- Scroll smoothness: 60fps

**Test Cases:**

**Small Files (< 1KB):**
- [ ] Typical kit file (~500 words)
- [ ] Load time acceptable
- [ ] Edit smooth

**Medium Files (1-10KB):**
- [ ] Typical walkthrough (~2000 words)
- [ ] Load time acceptable
- [ ] Scroll performance good
- [ ] Edit blocks smoothly

**Large Files (10-50KB):**
- [ ] Large plan document (~5000 words)
- [ ] May need optimization
- [ ] Scroll lag acceptable
- [ ] Edit blocks still responsive

**Very Large Files (>50KB):**
- [ ] Comprehensive documentation (>10000 words)
- [ ] Performance degradation expected
- [ ] Fallback: Add warning or auto-switch to old editor

**Performance Optimization Options:**

```tsx
// Option 1: Virtual scrolling (if needed)
import { VirtualList } from '@/shared/components/VirtualList';

<VirtualList
  items={blocks}
  renderItem={(block) => <MarkdownBlock block={block} {...props} />}
  itemHeight={100} // Estimated
/>

// Option 2: Lazy rendering
const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

const visibleBlocks = blocks.slice(visibleRange.start, visibleRange.end);

// Option 3: File size limit
if (content.length > 50000) {
  return (
    <Alert>
      This file is very large. Using legacy editor.
      <MarkdownEditor value={content} onChange={onChange} />
    </Alert>
  );
}
```

---

### 3. Auto-Save Reliability

**Goal:** No data loss, consistent save behavior.

**Test Cases:**

- [ ] Edit block → Wait 1.5s → File saved
- [ ] Rapid edits → Only final version saved (debouncing works)
- [ ] Edit → Cmd+S → Immediate save
- [ ] Edit → Close tab → Save triggered
- [ ] Edit → App crash → Content recovered (localStorage backup?)
- [ ] Edit → Network error → Retry logic works
- [ ] Edit → File deleted externally → Error handled gracefully

**Save Indicator:**
```tsx
<Box position="absolute" top={2} right={2}>
  {isSaving && <Spinner size="sm" color="blue.500" />}
  {!isSaving && hasUnsavedChanges && (
    <Text fontSize="xs" color="orange.500">Unsaved</Text>
  )}
  {!isSaving && !hasUnsavedChanges && (
    <Text fontSize="xs" color="green.500">Saved</Text>
  )}
</Box>
```

---

### 4. File Watcher Integration

**Goal:** External changes detected and handled correctly.

**Test Cases:**

- [ ] Edit file in VSCode → Content updates in app
- [ ] Edit in app → Edit in VSCode → Conflict detected
- [ ] Multiple rapid external edits → Debounced correctly
- [ ] External edit while editing block → User warned
- [ ] External delete → Error handled
- [ ] External rename → Path updated

**Conflict Handling:**
```tsx
const [hasConflict, setHasConflict] = useState(false);

useFileWatcher({
  filePath: resource.path,
  onFileChange: (newContent) => {
    if (hasUnsavedChanges) {
      setHasConflict(true);
      // Show conflict modal
    } else {
      setContent(newContent);
    }
  },
});

// Conflict modal
<Dialog open={hasConflict}>
  <DialogContent>
    <DialogHeader>File Changed Externally</DialogHeader>
    <DialogBody>
      The file was modified outside the app. Choose an action:
    </DialogBody>
    <DialogFooter>
      <Button onClick={() => {
        // Keep local changes
        setHasConflict(false);
      }}>
        Keep My Changes
      </Button>
      <Button onClick={() => {
        // Reload from disk
        setContent(externalContent);
        setHasConflict(false);
      }}>
        Use External Changes
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 5. Keyboard Shortcuts

**Goal:** All expected shortcuts work.

**Test Cases:**

- [ ] Cmd+S → Save
- [ ] Cmd+F → Search
- [ ] Escape → Close search / Cancel edit
- [ ] Enter (in block edit) → Save block
- [ ] Tab → Focus next block (accessibility)
- [ ] Shift+Tab → Focus previous block

**Shortcut conflicts:**
- Ensure hybrid editor doesn't break existing app shortcuts
- Test in context of full app (not just isolated editor)

---

### 6. Dark Mode

**Goal:** Perfect rendering in both color modes.

**Test Cases:**

- [ ] Light mode → All blocks readable
- [ ] Dark mode → All blocks readable
- [ ] Code blocks → Glassmorphic effect correct
- [ ] Toggle color mode → Instant update
- [ ] Edit mode → Contrast sufficient
- [ ] Links → Visible in both modes

**Specific colors to verify:**

```tsx
// Light mode
text: 'gray.800'
bg: 'white'
border: 'gray.200'
codeBg: 'rgba(255, 255, 255, 0.45)'

// Dark mode
text: 'gray.100'
bg: 'gray.800'
border: 'gray.600'
codeBg: 'rgba(20, 20, 20, 0.6)'
```

---

### 7. Edge Cases

**Unusual content:**

- [ ] File with only frontmatter (no body)
- [ ] File with only a title (one line)
- [ ] File with 1000+ blocks (performance)
- [ ] File with very long single block (10000 chars in one paragraph)
- [ ] File with nested code blocks (Markdown inside code)
- [ ] File with HTML content
- [ ] File with broken markdown syntax

**Unusual behavior:**

- [ ] Rapidly clicking between blocks
- [ ] Editing while saving
- [ ] Editing while file watcher triggers
- [ ] Opening multiple files simultaneously
- [ ] Switching files mid-edit

---

## Bug Tracking

**Create issues for all bugs found:**

```markdown
**Bug Template:**

### Description
[Clear description of the bug]

### Steps to Reproduce
1. Open file X
2. Click block Y
3. Edit content
4. Bug occurs

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Environment
- OS: [macOS/Windows/Linux]
- App version: [commit hash]
- Feature flag: ON

### Priority
- [ ] Critical (data loss, crash)
- [ ] High (major feature broken)
- [ ] Medium (minor issue)
- [ ] Low (cosmetic)

### Screenshots
[If applicable]
```

**Bug triage:**
- **Critical:** Fix immediately (data loss, corruption, crashes)
- **High:** Fix before Phase 6 (major features broken)
- **Medium:** Fix if time allows
- **Low:** Defer to post-launch

---

## Feedback Collection

**Internal team feedback:**

```markdown
**Feedback Form:**

1. How does the hybrid editor compare to the old editor?
   - [ ] Much better
   - [ ] Somewhat better
   - [ ] About the same
   - [ ] Worse

2. What do you like about the hybrid editor?
   [Free text]

3. What frustrates you about the hybrid editor?
   [Free text]

4. Would you recommend switching to the hybrid editor full-time?
   - [ ] Yes
   - [ ] No
   - [ ] Need more time to decide

5. Any specific bugs or issues encountered?
   [Free text]
```

**Collect feedback via:**
- Daily standup discussions
- Slack channel
- GitHub issues
- Direct messages

---

## Optimization Opportunities

### 1. Block Parsing

**Current:** Parse full document on every external change

**Optimization:** Only re-parse changed blocks
```tsx
const [blocks, setBlocks] = useState([]);
const lastContentRef = useRef('');

useEffect(() => {
  if (value === lastContentRef.current) return;

  // Diff old and new content
  const changedIndices = detectChangedBlocks(lastContentRef.current, value);

  // Only update changed blocks
  setBlocks(prev => {
    const newBlocks = [...prev];
    changedIndices.forEach(i => {
      newBlocks[i] = parseBlock(value, i);
    });
    return newBlocks;
  });

  lastContentRef.current = value;
}, [value]);
```

---

### 2. Render Optimization

**Current:** Re-render all blocks on any change

**Optimization:** Memoize blocks
```tsx
const MemoizedMarkdownBlock = memo(MarkdownBlock, (prev, next) => {
  return prev.block.content === next.block.content &&
         prev.isEditing === next.isEditing;
});
```

---

### 3. Debounce Optimization

**Current:** Fixed 1.5s debounce

**Optimization:** Adaptive debounce (shorter for small files)
```tsx
const debounceDelay = useMemo(() => {
  if (content.length < 1000) return 500; // 0.5s for small files
  if (content.length < 10000) return 1500; // 1.5s for medium
  return 3000; // 3s for large files
}, [content.length]);
```

---

## Acceptance Criteria

- [ ] All critical bugs fixed
- [ ] Performance acceptable for typical files (<10KB)
- [ ] Performance acceptable for large files (<50KB)
- [ ] Content integrity verified (no corruption)
- [ ] Auto-save reliable (no data loss)
- [ ] File watcher works correctly
- [ ] Keyboard shortcuts work
- [ ] Dark mode rendering perfect
- [ ] Edge cases handled gracefully
- [ ] Team feedback mostly positive
- [ ] Ready for default rollout

---

## Next Steps

After Phase 5 completion:
- Tag commit: `hybrid-editor-phase-5-complete`
- Update README with test results
- Move to Phase 6: Remove Old Code
- Plan default rollout schedule

---

**Documents to Create:**
- Bug tracking spreadsheet/issues
- Performance benchmark results
- Feedback summary report
- Known limitations document

**Metrics to Report:**
- Total bugs found: [number]
- Critical bugs fixed: [number]
- Performance (median load time): [ms]
- Team satisfaction: [%]
