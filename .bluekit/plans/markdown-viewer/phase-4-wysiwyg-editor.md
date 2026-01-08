# Phase 4: Edit in Preview (WYSIWYG Editor)

## Overview
Implement a full WYSIWYG markdown editor using TipTap, allowing users to edit content directly in the preview view.

## Architecture

### Component Structure

```
WysiwygEditor/
├── index.tsx                    # Main editor component
├── EditorToolbar.tsx            # Formatting toolbar
├── EditorContent.tsx            # TipTap editor instance
├── extensions/
│   ├── index.ts                 # Extension configuration
│   ├── MermaidBlock.ts          # Custom mermaid block handling
│   └── CodeBlockWithLanguage.ts # Code block with language selector
└── utils/
    ├── markdownToHtml.ts        # MD → HTML conversion
    └── htmlToMarkdown.ts        # HTML → MD conversion
```

## Implementation Details

### Step 1: Install Dependencies

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
npm install @tiptap/extension-code-block-lowlight @tiptap/extension-link
npm install @tiptap/extension-table @tiptap/extension-table-row
npm install @tiptap/extension-table-cell @tiptap/extension-table-header
npm install @tiptap/extension-task-list @tiptap/extension-task-item
npm install @tiptap/extension-underline @tiptap/extension-highlight
npm install lowlight turndown @types/turndown
npm install remark-parse remark-html unified
```

### Step 2: Create Markdown Conversion Utilities

```typescript
// src/components/workstation/WysiwygEditor/utils/markdownToHtml.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);

  return String(result);
}
```

```typescript
// src/components/workstation/WysiwygEditor/utils/htmlToMarkdown.ts
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Add GFM support (tables, strikethrough, task lists)
turndown.use(gfm);

// Custom rule for code blocks with language
turndown.addRule('codeBlock', {
  filter: (node) => {
    return (
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    );
  },
  replacement: (content, node) => {
    const codeNode = node.firstChild as HTMLElement;
    const language = codeNode.className?.match(/language-(\w+)/)?.[1] || '';
    const code = codeNode.textContent || '';
    return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
  },
});

// Custom rule for mermaid blocks
turndown.addRule('mermaidBlock', {
  filter: (node) => {
    return node.getAttribute?.('data-type') === 'mermaid';
  },
  replacement: (content, node) => {
    const code = node.getAttribute('data-content') || content;
    return `\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
```

### Step 3: Configure TipTap Extensions

```typescript
// src/components/workstation/WysiwygEditor/extensions/index.ts
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export const editorExtensions = [
  StarterKit.configure({
    codeBlock: false, // We'll use CodeBlockLowlight instead
  }),
  Placeholder.configure({
    placeholder: 'Start writing...',
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'editor-link',
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableCell,
  TableHeader,
  CodeBlockLowlight.configure({
    lowlight,
  }),
];
```

### Step 4: Create Editor Toolbar

```typescript
// src/components/workstation/WysiwygEditor/EditorToolbar.tsx
import { HStack, IconButton, Separator, Tooltip, Menu } from '@chakra-ui/react';
import {
  LuBold, LuItalic, LuStrikethrough, LuCode,
  LuHeading1, LuHeading2, LuHeading3,
  LuList, LuListOrdered, LuListChecks,
  LuQuote, LuLink, LuTable, LuMinus,
} from 'react-icons/lu';
import { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const ToolbarButton = ({
    icon: Icon,
    label,
    action,
    isActive = false
  }: {
    icon: React.ComponentType;
    label: string;
    action: () => void;
    isActive?: boolean;
  }) => (
    <Tooltip content={label}>
      <IconButton
        aria-label={label}
        variant={isActive ? 'solid' : 'ghost'}
        size="sm"
        onClick={action}
      >
        <Icon />
      </IconButton>
    </Tooltip>
  );

  return (
    <HStack
      p={2}
      gap={1}
      borderBottom="1px solid"
      borderColor="border.subtle"
      flexWrap="wrap"
      css={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Text formatting */}
      <ToolbarButton
        icon={LuBold}
        label="Bold (Cmd+B)"
        action={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
      />
      <ToolbarButton
        icon={LuItalic}
        label="Italic (Cmd+I)"
        action={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
      />
      <ToolbarButton
        icon={LuStrikethrough}
        label="Strikethrough"
        action={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
      />
      <ToolbarButton
        icon={LuCode}
        label="Inline code"
        action={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
      />

      <Separator orientation="vertical" h={6} />

      {/* Headings */}
      <ToolbarButton
        icon={LuHeading1}
        label="Heading 1"
        action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
      />
      <ToolbarButton
        icon={LuHeading2}
        label="Heading 2"
        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
      />
      <ToolbarButton
        icon={LuHeading3}
        label="Heading 3"
        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
      />

      <Separator orientation="vertical" h={6} />

      {/* Lists */}
      <ToolbarButton
        icon={LuList}
        label="Bullet list"
        action={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
      />
      <ToolbarButton
        icon={LuListOrdered}
        label="Numbered list"
        action={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
      />
      <ToolbarButton
        icon={LuListChecks}
        label="Task list"
        action={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
      />

      <Separator orientation="vertical" h={6} />

      {/* Block elements */}
      <ToolbarButton
        icon={LuQuote}
        label="Blockquote"
        action={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
      />
      <ToolbarButton
        icon={LuMinus}
        label="Horizontal rule"
        action={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <Separator orientation="vertical" h={6} />

      {/* Insert elements */}
      <ToolbarButton
        icon={LuLink}
        label="Insert link"
        action={() => {
          const url = window.prompt('Enter URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        isActive={editor.isActive('link')}
      />
      <ToolbarButton
        icon={LuTable}
        label="Insert table"
        action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
    </HStack>
  );
}
```

### Step 5: Create Main Editor Component

```typescript
// src/components/workstation/WysiwygEditor/index.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useCallback } from 'react';
import { Box } from '@chakra-ui/react';
import EditorToolbar from './EditorToolbar';
import { editorExtensions } from './extensions';
import { markdownToHtml } from './utils/markdownToHtml';
import { htmlToMarkdown } from './utils/htmlToMarkdown';

interface WysiwygEditorProps {
  initialContent: string; // Markdown content (without front matter)
  onChange: (markdown: string) => void;
}

export default function WysiwygEditor({ initialContent, onChange }: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: '', // Will be set after HTML conversion
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: 'wysiwyg-editor-content',
      },
    },
  });

  // Convert markdown to HTML and set editor content
  useEffect(() => {
    if (editor && initialContent) {
      markdownToHtml(initialContent).then((html) => {
        editor.commands.setContent(html);
      });
    }
  }, [editor, initialContent]);

  return (
    <Box h="100%" display="flex" flexDirection="column">
      <EditorToolbar editor={editor} />
      <Box
        flex={1}
        overflow="auto"
        p={4}
        css={{
          '.wysiwyg-editor-content': {
            outline: 'none',
            minHeight: '100%',
          },
          '.ProseMirror': {
            minHeight: '100%',
            '& > * + *': {
              marginTop: '0.75em',
            },
            '& h1': {
              fontSize: '2em',
              fontWeight: 'bold',
            },
            '& h2': {
              fontSize: '1.5em',
              fontWeight: 'semibold',
              color: 'var(--chakra-colors-primary-500)',
            },
            '& h3': {
              fontSize: '1.25em',
              fontWeight: 'semibold',
            },
            '& ul, & ol': {
              paddingLeft: '1.5em',
            },
            '& ul[data-type="taskList"]': {
              listStyle: 'none',
              paddingLeft: '0.5em',
            },
            '& pre': {
              background: 'var(--chakra-colors-bg-subtle)',
              borderRadius: '0.375rem',
              padding: '0.75rem 1rem',
              fontFamily: 'mono',
            },
            '& code': {
              background: 'var(--chakra-colors-bg-subtle)',
              borderRadius: '0.25rem',
              padding: '0.125rem 0.25rem',
              fontFamily: 'mono',
            },
            '& blockquote': {
              borderLeft: '4px solid var(--chakra-colors-border-emphasized)',
              paddingLeft: '1rem',
              fontStyle: 'italic',
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& th, & td': {
              border: '1px solid var(--chakra-colors-border-subtle)',
              padding: '0.5rem',
            },
            '& a': {
              color: 'var(--chakra-colors-primary-500)',
              textDecoration: 'underline',
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
```

### Step 6: Integrate with ResourceMarkdownViewer

```typescript
// src/components/workstation/ResourceMarkdownViewer.tsx
import { useState, useEffect, useMemo } from 'react';
import WysiwygEditor from './WysiwygEditor';
import MarkdownPreview from './MarkdownPreview';
import MarkdownSource from './MarkdownSource';
import ViewerToolbar from './ViewerToolbar';
import { parseFrontMatter, reconstructContent } from './utils/frontMatterUtils';

type ViewMode = 'preview' | 'source' | 'edit';

export default function ResourceMarkdownViewer({ resource, content: originalContent }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Parse front matter once
  const { frontMatter, body: originalBody } = useMemo(
    () => parseFrontMatter(originalContent),
    [originalContent]
  );

  // Current body content (edited or original)
  const currentBody = editedBody ?? originalBody;

  // Full content for saving/copying
  const fullContent = useMemo(
    () => reconstructContent(frontMatter, currentBody),
    [frontMatter, currentBody]
  );

  const isDirty = editedBody !== null && editedBody !== originalBody;

  const handleBodyChange = (newBody: string) => {
    setEditedBody(newBody);
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    try {
      await writeResourceFile(resource.path, fullContent);
      setEditedBody(null); // Reset to "saved" state
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset when resource changes
  useEffect(() => {
    setEditedBody(null);
    setViewMode('preview');
  }, [resource.path]);

  return (
    <Box position="relative" h="100%">
      <ViewerToolbar
        content={fullContent}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
      />

      {viewMode === 'preview' && (
        <MarkdownPreview
          resource={resource}
          content={currentBody}
        />
      )}

      {viewMode === 'source' && (
        <MarkdownSource content={fullContent} />
      )}

      {viewMode === 'edit' && (
        <WysiwygEditor
          initialContent={currentBody}
          onChange={handleBodyChange}
        />
      )}
    </Box>
  );
}
```

### Step 7: Handle Mermaid Blocks in Editor

```typescript
// src/components/workstation/WysiwygEditor/extensions/MermaidBlock.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MermaidBlockView from './MermaidBlockView';

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      code: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  },
});
```

```typescript
// src/components/workstation/WysiwygEditor/extensions/MermaidBlockView.tsx
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Box, HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { LuEye, LuCode } from 'react-icons/lu';
import { useState } from 'react';
import InlineMermaidDiagram from '../../InlineMermaidDiagram';

export default function MermaidBlockView({ node, updateAttributes }) {
  const [showPreview, setShowPreview] = useState(true);
  const code = node.textContent;

  return (
    <NodeViewWrapper>
      <Box
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="md"
        overflow="hidden"
      >
        <HStack
          p={2}
          bg="bg.subtle"
          justifyContent="space-between"
        >
          <Box fontSize="sm" color="text.secondary">Mermaid Diagram</Box>
          <Tooltip content={showPreview ? 'Edit code' : 'Show preview'}>
            <IconButton
              aria-label="Toggle view"
              size="xs"
              variant="ghost"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <LuCode /> : <LuEye />}
            </IconButton>
          </Tooltip>
        </HStack>

        {showPreview ? (
          <InlineMermaidDiagram code={code} />
        ) : (
          <Box p={2}>
            <NodeViewContent as="pre" />
          </Box>
        )}
      </Box>
    </NodeViewWrapper>
  );
}
```

## Testing Checklist

### Basic Editor Functionality
- [ ] Editor loads with converted markdown content
- [ ] Text formatting works (bold, italic, strike, code)
- [ ] Headings work (H1-H6)
- [ ] Lists work (bullet, numbered, task)
- [ ] Blockquotes work
- [ ] Links work (insert, edit, remove)
- [ ] Tables work (insert, add/remove rows/cols)
- [ ] Horizontal rules work
- [ ] Code blocks work with syntax highlighting

### Markdown Conversion
- [ ] HTML → Markdown preserves formatting
- [ ] Markdown → HTML renders correctly
- [ ] Code blocks preserve language annotation
- [ ] Tables convert properly
- [ ] Task lists convert properly
- [ ] Links convert properly
- [ ] Nested lists convert properly

### Integration
- [ ] Edit mode accessible from toolbar
- [ ] Changes tracked as dirty
- [ ] Save writes correct markdown to file
- [ ] Front matter preserved on save
- [ ] Can switch between preview/source/edit modes
- [ ] Content persists when switching modes

### Mermaid Support
- [ ] Mermaid blocks render as diagrams
- [ ] Can toggle to code view for editing
- [ ] Mermaid code saved correctly as fenced block

### Performance
- [ ] Large documents don't lag
- [ ] Conversion doesn't block UI
- [ ] Editor remains responsive during typing

## Known Limitations

1. **Complex markdown may not round-trip perfectly**
   - Some edge cases in markdown syntax may change on save
   - Manual review recommended for critical documents

2. **Mermaid editing is code-based**
   - No visual mermaid editor (out of scope)
   - Users edit mermaid code directly

3. **No collaborative editing**
   - Single user at a time
   - External changes may conflict

## Future Enhancements

1. **Slash commands** (`/` to insert blocks)
2. **Drag-and-drop images**
3. **Markdown shortcuts** (type `**` for bold, etc.)
4. **Version history** (local undo history persistence)
5. **Spell check integration**
6. **AI writing assistance** (optional)

## Dependencies

```json
{
  "@tiptap/react": "^2.1.0",
  "@tiptap/starter-kit": "^2.1.0",
  "@tiptap/extension-placeholder": "^2.1.0",
  "@tiptap/extension-code-block-lowlight": "^2.1.0",
  "@tiptap/extension-link": "^2.1.0",
  "@tiptap/extension-table": "^2.1.0",
  "@tiptap/extension-table-row": "^2.1.0",
  "@tiptap/extension-table-cell": "^2.1.0",
  "@tiptap/extension-table-header": "^2.1.0",
  "@tiptap/extension-task-list": "^2.1.0",
  "@tiptap/extension-task-item": "^2.1.0",
  "lowlight": "^3.1.0",
  "turndown": "^7.1.2",
  "turndown-plugin-gfm": "^1.0.2",
  "@types/turndown": "^5.0.4",
  "unified": "^11.0.0",
  "remark-parse": "^11.0.0",
  "remark-html": "^16.0.0",
  "remark-gfm": "^4.0.0"
}
```
