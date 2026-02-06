# Phase 1: Build in Parallel

**Status:** Not Started
**Duration:** 3-5 days
**Dependencies:** None

## Overview

Build the hybrid markdown editor components in complete isolation without touching any existing code. This allows us to develop and test the new editor without risk of breaking the current system.

## Goals

- Create all core hybrid editor components
- Implement block parsing and reconstruction
- Build glassmorphic styling system
- Test in isolation with demo page
- Verify block editing UX is smooth

## Components to Build

### 1. BlockParser.ts

**Location:** `src/shared/components/hybridEditor/BlockParser.ts`

**Purpose:** Split markdown into editable blocks and reconstruct from block array.

**API:**
```typescript
export interface MarkdownBlock {
  id: string;           // Unique block ID (for React keys)
  type: 'paragraph' | 'heading' | 'code' | 'list' | 'blockquote';
  level?: number;       // For headings (1-6)
  content: string;      // Raw markdown for this block
  language?: string;    // For code blocks
}

export function parseMarkdown(markdown: string): MarkdownBlock[];
export function reconstructMarkdown(blocks: MarkdownBlock[]): string;
```

**Implementation Notes:**
- Split on `\n\n` as primary delimiter
- Special handling for code fences (don't split inside ` ``` `)
- Preserve exact whitespace and newlines
- Generate stable IDs (hash of content + position)
- No loss of markdown syntax during parse/reconstruct cycle

**Test Cases:**
```markdown
# Should parse correctly
- Simple paragraphs separated by \n\n
- Headings (# H1, ## H2, etc.)
- Code blocks with \n\n inside them
- Lists (ordered and unordered)
- Blockquotes
- Mixed content with various newline patterns
```

---

### 2. MarkdownBlock.tsx

**Location:** `src/shared/components/hybridEditor/MarkdownBlock.tsx`

**Purpose:** Smart component that switches between preview and edit modes.

**API:**
```typescript
interface MarkdownBlockProps {
  block: MarkdownBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onFinishEdit: (newContent: string) => void;
  onCancelEdit: () => void;
}

export function MarkdownBlock(props: MarkdownBlockProps): JSX.Element;
```

**Behavior:**
- **Preview Mode:**
  - Renders with ReactMarkdown + custom Chakra components
  - Click anywhere → calls `onStartEdit()`
  - Hover → subtle highlight to show clickability

- **Edit Mode:**
  - Renders TextareaAutosize with matching typography
  - Auto-focus on mount
  - Blur → calls `onFinishEdit(value)`
  - Escape → calls `onCancelEdit()`
  - Enter (for single-line blocks) → calls `onFinishEdit(value)`

**Typography Matching:**
```tsx
// Preview and edit must have identical:
- font-family
- font-size
- line-height (1.75)
- letter-spacing
- padding
```

**Styling:**
```tsx
// Preview hover
bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50'
borderRadius: 'md'
transition: 'all 0.15s'

// Edit mode
bg: colorMode === 'light' ? 'white' : 'gray.800'
border: '2px solid'
borderColor: 'blue.400'
borderRadius: 'md'
```

---

### 3. GlassCodeBlock.tsx

**Location:** `src/shared/components/hybridEditor/GlassCodeBlock.tsx`

**Purpose:** Specialized renderer for code fences with glassmorphic styling.

**API:**
```typescript
interface GlassCodeBlockProps {
  code: string;
  language: string;
  colorMode: 'light' | 'dark';
}

export function GlassCodeBlock(props: GlassCodeBlockProps): JSX.Element;
```

**Styling Tokens:**
```tsx
// Light mode
background: 'rgba(255, 255, 255, 0.45)'
backdropFilter: 'blur(24px) saturate(180%)'
border: '1px solid rgba(0, 0, 0, 0.08)'
boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.1)'

// Dark mode
background: 'rgba(20, 20, 20, 0.6)'
backdropFilter: 'blur(24px) saturate(180%)'
border: '1px solid rgba(255, 255, 255, 0.15)'
boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)'
```

**Integration:**
- Use existing `ShikiCodeBlock` for syntax highlighting
- Wrap in glassmorphic container
- Click to edit → switch to textarea with same styling

---

### 4. HybridMarkdownEditor.tsx

**Location:** `src/shared/components/hybridEditor/HybridMarkdownEditor.tsx`

**Purpose:** Main orchestrator component that manages block state.

**API:**
```typescript
interface HybridMarkdownEditorProps {
  value: string;                        // Raw markdown
  onChange: (value: string) => void;    // Called on any edit
  readOnly?: boolean;                   // Disable editing
}

export function HybridMarkdownEditor(props: HybridMarkdownEditorProps): JSX.Element;
```

**State Management:**
```typescript
const [blocks, setBlocks] = useState<MarkdownBlock[]>([]);
const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

useEffect(() => {
  // Parse markdown into blocks when value changes externally
  setBlocks(parseMarkdown(value));
}, [value]);

const handleBlockEdit = (blockId: string, newContent: string) => {
  // Update block content
  const newBlocks = blocks.map(b =>
    b.id === blockId ? { ...b, content: newContent } : b
  );
  setBlocks(newBlocks);

  // Reconstruct and notify parent
  onChange(reconstructMarkdown(newBlocks));
};
```

**Layout:**
```tsx
<VStack align="stretch" gap={2} w="100%">
  {blocks.map(block => (
    <MarkdownBlock
      key={block.id}
      block={block}
      isEditing={editingBlockId === block.id}
      onStartEdit={() => setEditingBlockId(block.id)}
      onFinishEdit={(content) => {
        handleBlockEdit(block.id, content);
        setEditingBlockId(null);
      }}
      onCancelEdit={() => setEditingBlockId(null)}
    />
  ))}
</VStack>
```

---

### 5. Demo Page

**Location:** `src/pages/HybridEditorDemo.tsx`

**Purpose:** Test page for developing the editor in isolation.

**Implementation:**
```tsx
export default function HybridEditorDemo() {
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const { colorMode } = useColorMode();

  return (
    <Box minH="100vh" bg={colorMode === 'light' ? 'gray.50' : 'gray.900'} p={8}>
      <VStack gap={4} maxW="800px" mx="auto">
        <HStack justify="space-between" w="100%">
          <Text fontSize="2xl" fontWeight="bold">Hybrid Editor Demo</Text>
          <Button onClick={() => console.log(content)}>
            Log Content
          </Button>
        </HStack>

        <Box
          w="100%"
          bg={colorMode === 'light' ? 'white' : 'gray.800'}
          borderRadius="lg"
          p={6}
          boxShadow="lg"
        >
          <HybridMarkdownEditor value={content} onChange={setContent} />
        </Box>

        <Box w="100%">
          <Text fontSize="sm" fontWeight="medium" mb={2}>Raw Markdown:</Text>
          <Code display="block" whiteSpace="pre" p={4} borderRadius="md">
            {content}
          </Code>
        </Box>
      </VStack>
    </Box>
  );
}

const SAMPLE_MARKDOWN = `# Hybrid Editor Test

This is a paragraph. Click it to edit.

## Features

- Block-based editing
- Glassmorphic code blocks
- Smooth transitions

\`\`\`typescript
function example() {
  return "Code blocks have frosted glass effect";
}
\`\`\`

> This is a blockquote.
> It can span multiple lines.

Another paragraph here.
`;
```

**Add route** (temporary, in `App.tsx` or router config):
```tsx
<Route path="/demo/hybrid-editor" element={<HybridEditorDemo />} />
```

---

## Testing Checklist

### BlockParser Tests

- [ ] Splits simple paragraphs correctly
- [ ] Preserves headings with correct level
- [ ] Doesn't split inside code blocks
- [ ] Handles lists (ordered and unordered)
- [ ] Preserves blockquotes
- [ ] Reconstructs identical markdown
- [ ] No content loss after parse/reconstruct cycle
- [ ] Handles edge cases (empty lines, trailing newlines)

### MarkdownBlock Tests

- [ ] Click paragraph → enters edit mode
- [ ] Textarea appears with same typography
- [ ] Blur → saves changes
- [ ] Escape → cancels changes
- [ ] Preview renders markdown correctly
- [ ] Hover shows subtle highlight
- [ ] No layout shift during mode switch

### GlassCodeBlock Tests

- [ ] Glassmorphic styling in light mode
- [ ] Glassmorphic styling in dark mode
- [ ] Syntax highlighting works (via Shiki)
- [ ] Click to edit → textarea appears
- [ ] Code formatting preserved

### HybridMarkdownEditor Tests

- [ ] Parses sample markdown into blocks
- [ ] Clicking different blocks works
- [ ] Only one block edits at a time
- [ ] Changes propagate to parent via onChange
- [ ] External value changes update blocks
- [ ] Multiple edit cycles don't corrupt content

### Integration Tests

- [ ] Demo page loads without errors
- [ ] Can edit all types of blocks
- [ ] Dark mode toggle works
- [ ] Raw markdown matches edited content
- [ ] No console errors or warnings

---

## Implementation Order

1. **Day 1-2: BlockParser.ts**
   - Write parse/reconstruct functions
   - Add comprehensive tests
   - Verify no content loss

2. **Day 2-3: MarkdownBlock.tsx**
   - Build preview/edit toggle
   - Match typography exactly
   - Test transitions

3. **Day 3: GlassCodeBlock.tsx**
   - Implement glassmorphic styling
   - Integrate with ShikiCodeBlock
   - Test in light/dark mode

4. **Day 4: HybridMarkdownEditor.tsx**
   - Wire up block state management
   - Handle edit coordination
   - Test full flow

5. **Day 4-5: Demo Page & Testing**
   - Build comprehensive demo
   - Edge case testing
   - Performance profiling

---

## Acceptance Criteria

- [ ] All components built and exported
- [ ] Demo page fully functional
- [ ] Click any block → edit mode works
- [ ] Typography matches between preview/edit
- [ ] Glassmorphic styling matches design system
- [ ] No markdown corruption after multiple edits
- [ ] Works in light and dark mode
- [ ] No console errors or warnings
- [ ] Code reviewed and approved

---

## Next Steps

After Phase 1 completion:
- Tag commit: `hybrid-editor-phase-1-complete`
- Move to Phase 2: Integration Adapter
- Begin wiring up existing features (auto-save, file watching)

---

**Dependencies to Install:**
```bash
npm install react-textarea-autosize
```

**Existing Dependencies (Already installed):**
- `react-markdown`
- `remark-gfm`
- `@chakra-ui/react`
- `shiki`
