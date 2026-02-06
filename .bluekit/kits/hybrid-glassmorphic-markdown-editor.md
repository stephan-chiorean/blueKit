---
id: hybrid-glassmorphic-markdown-editor
alias: Hybrid Glassmorphic Markdown Editor
type: kit
is_base: false
version: 1
tags:
  - markdown
  - editor
  - styling
description: A barebones hybrid editor that switches seamlessly between glassmorphic preview blocks and a raw markdown textarea.
---
# Hybrid Glassmorphic Markdown Editor

This kit provides a `HybridMarkdownEditor` component that delivers a high-fidelity "What You See Is What You Get" feel while maintaining raw markdown editability. It uses a block-based approach where content is visibly rendered using the BlueKit glassmorphic styling system, but individual blocks transform into textareas for editing upon interaction.

## End State

After applying this kit, the application will have:

### 1. Components
-   **`HybridEditor`**: The main entry point. It parses raw markdown into "blocks" (paragraphs, headers, lists) based on double-newlines.
-   **`MarkdownBlock`**: A smart component that manages `isEditing` state.
    -   *Preview Mode*: Renders the content using `ReactMarkdown` with custom Chakra UI components.
    -   *Edit Mode*: Renders a `TextareaAutosize` that perfectly matches the typography of the preview to minimize layout shift.
-   **`GlassCodeBlock`**: A specialized renderer for code fences that applies the comprehensive glassmorphism tokens (blur, saturation, border).

### 2. Styling System Integration
The editor fully implements the styling system defined in `theme.ts`:
-   **Semantic Tokens**: Uses `text.primary`, `bg.surface`, and `primary.500` for color mode adaptability.
-   **Glassmorphism**: Applies `backdrop-filter: blur(24px) saturate(180%)` to code blocks and containers.
-   **Typography**: Matches the precise line-height (`1.75`) and font-stack of the preview in the textarea to ensure "seamless" editing.

### 3. Data Model
-   **Input**: Raw Markdown string.
-   **Output**: Updated Markdown string (via `onChange` callback).
-   **Block Splitting**: Simple heuristic splitting on `\n\n` to isolate paragraphs and major blocks for individual editing, preventing the entire document from entering edit mode at once.

## Implementation Principles

-   **Visual Consistency**: The "Edit" mode must look as close to "Preview" mode as possible (font size, line height, color) so the transition isn't jarring.
-   **Restraint**: Do not implement a rich-text toolbar. This is a *markdown* editor.
-   **Performance**: Only re-render the block being edited.
-   **Glassmorphism**: Use the exact token values (`rgba(255, 255, 255, 0.45)` for light, `rgba(20, 20, 20, 0.6)` for dark) to maintain the premium feel.

## Verification Criteria

After generation, verify:
-   ✓ Clicking a paragraph turns it into a textarea.
-   ✓ Clicking away turns it back to rendered markdown.
-   ✓ Code blocks have the "frosted glass" effect.
-   ✓ Headings (H1, H2) render with correct sizes and spacing.
-   ✓ The exact same content string is preserved after an edit cycle (no loss of markdown syntax).
-   ✓ Dark mode toggle correctly inverts colors and adjusts glass opacity.

## Interface Contracts

**Provides:**
-   `HybridEditor` (Component)
    -   Props: `value: string`, `onChange: (value: string) => void`

**Requires:**
-   `react-markdown`
-   `remark-gfm`
-   `react-textarea-autosize`
-   `@chakra-ui/react` (or compatible styling engine with `sx`/`css` props)
