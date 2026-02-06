---
id: markdown-preview-styling-system
alias: Markdown Preview Styling System
type: walkthrough
is_base: false
version: 1
tags:
  - styling
  - markdown
  - theme
description: Deep dive into the glassmorphic styling system powering BlueKit's markdown preview mode with semantic tokens and adaptive color modes
complexity: comprehensive
format: architecture
---
# Markdown Preview Styling System

This walkthrough explores the styling architecture behind BlueKit's markdown preview mode—a carefully crafted system that combines glassmorphism, semantic color tokens, and adaptive theming to create a polished reading experience.

## Overview: The Styling Philosophy

BlueKit's preview mode is built on three core principles:

1. **Semantic tokens** - Theme-aware colors that adapt automatically to light/dark mode
2. **Glassmorphism** - Subtle transparency and blur effects for depth and elegance  
3. **Typography hierarchy** - Intentional spacing, sizing, and color to guide the eye

These principles work together to create a preview that feels both modern and readable, with a distinct visual identity that avoids generic markdown styling.

## Theme Foundation

### The Color System (src/theme.ts)

At the heart of BlueKit's visual identity is a semantic token system built on Chakra UI's theming architecture:

```typescript
// Primary brand color: #4287f5 (bright blue)
primary: {
  500: { value: '#4287f5' },    // Main brand color
  600: { value: '#2563eb' },    // Darker variant for contrast
  // ... full palette 50-950
}
```

**Semantic tokens** translate these raw colors into contextual meanings:

```typescript
// Text colors - uses blue tints in dark mode for warmth
'text.primary': { 
  value: { 
    _light: '{colors.gray.900}',     // Near-black in light mode
    _dark: '{colors.primary.200}'    // Blue-tinted in dark mode
  } 
}

// Surface backgrounds
'bg.surface': { 
  value: { 
    _light: 'white', 
    _dark: '{colors.gray.900}' 
  } 
}

// Primary accent (used for H2, links)
'primary.500': inherited from primary palette
```

**Why semantic tokens?** They enable the entire UI to adapt instantly to color mode changes without hardcoded color values scattered throughout components.

### Glassmorphism Tokens

BlueKit employs glassmorphic effects—semi-transparent surfaces with backdrop blur—to create visual depth:

```typescript
// Code blocks use these glass tokens
'glass.light': { value: 'rgba(255, 255, 255, 0.15)' },
'glass.dark': { value: 'rgba(0, 0, 0, 0.2)' },
'glass.border.light': { value: 'rgba(255, 255, 255, 0.2)' },
'glass.border.dark': { value: 'rgba(255, 255, 255, 0.15)' },
```

These tokens are applied with `backdrop-filter: blur()` to create the signature "frosted glass" effect visible on code blocks.

## Preview Mode Styling Architecture

### The Container (ResourceMarkdownContent.tsx:258-357)

The preview wrapper establishes base styling for all markdown elements using Chakra UI's `css` prop:

```typescript
<Box
  id="markdown-content-preview"
  css={{
    '& > *': { mb: 4 },              // Consistent spacing between all children
    '& > *:last-child': { mb: 0 },  // Remove bottom margin from last element
    
    // Typography hierarchy
    '& h1': { fontSize: '2xl', fontWeight: 'bold', mt: 6, mb: 4 },
    '& h2': { fontSize: '2xl', fontWeight: 'semibold', mt: 5, mb: 3, color: 'primary.500' },
    '& h3': { fontSize: 'lg', fontWeight: 'semibold', mt: 4, mb: 2 },
    
    // Body text
    '& p': { lineHeight: '1.75', color: 'text.primary' },
    
    // Lists
    '& ul, & ol': { pl: 4, mb: 4 },
    '& li': { mb: 2 },
    
    // Task lists - remove bullets/numbers
    '& li:has(input[type="checkbox"])': {
      listStyleType: 'none',
      marginLeft: '-1.5em',
    },
    
    // Links
    '& a': { color: 'primary.500', textDecoration: 'underline' },
    '& a:hover': { color: 'primary.600' },
    
    // Tables
    '& table': { width: '100%', borderCollapse: 'collapse', mb: 4 },
    '& th, & td': { border: '1px solid', borderColor: 'border.subtle', px: 3, py: 2 },
  }}
>
```

**Key Design Decisions:**

1. **H2 accent color** (`primary.500`) - Creates a visual landmark for major sections
2. **Generous line-height** (`1.75`) - Improves readability for long-form content
3. **Task list styling** - Removes default bullets when checkboxes are present
4. **Consistent spacing** - 4-unit (`mb: 4`) rhythm throughout

### Typography: Text Shadows for Depth

Every heading and paragraph includes subtle text shadows that add dimension without overwhelming:

```typescript
// Applied to H1-H6 (ResourceMarkdownContent.tsx:369-374)
css={{
  scrollMarginTop: '80px',  // Prevents headers from hiding under fixed navbar
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
  _dark: {
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',  // Stronger shadow in dark mode
  },
}}
```

**Why text shadows?** They create subtle depth perception, making text feel "lifted" from the background. In dark mode, the stronger shadow provides necessary contrast against darker backgrounds.

Paragraphs receive the same treatment (ResourceMarkdownContent.tsx:476-480):

```typescript
<Text
  mb={4}
  lineHeight="1.75"
  color="text.primary"
  css={{
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    _dark: { textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' },
  }}
>
```

### Code Blocks: Glassmorphic Syntax Highlighting

Code blocks are rendered by `ShikiCodeBlock` (ShikiCodeBlock.tsx:107-146) with a distinctive glassmorphic style:

```typescript
css={{
  // Light mode: semi-transparent white with heavy blur
  background: 'rgba(255, 255, 255, 0.45)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1.5px solid rgba(255, 255, 255, 0.4)',
  boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.08), 0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.5)',

  _dark: {
    // Dark mode: semi-transparent black with subtle border
    background: 'rgba(20, 20, 20, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
  },
}}
```

**Breaking down the glassmorphism:**

1. **Semi-transparent background** - `rgba(255, 255, 255, 0.45)` allows content behind to show through faintly
2. **Backdrop blur** - `blur(24px)` creates the signature "frosted glass" effect by blurring background
3. **Saturation boost** - `saturate(180%)` makes blurred background colors more vibrant
4. **Layered shadows** - Combines outer shadow (depth), far shadow (elevation), and inset highlight (glass sheen)
5. **Subtle borders** - Semi-transparent borders define edges without harsh lines

**Why glassmorphism for code?** It visually separates code from prose while maintaining visual continuity. The transparency prevents code blocks from feeling like "heavy boxes" that break reading flow.

### Inline Code Styling

Inline code uses a simpler approach—solid background with subtle border radius:

```typescript
<Code
  px={1.5}
  py={0.5}
  borderRadius="sm"
  fontSize="0.9em"
>
  {children}
</Code>
```

Chakra's `<Code>` component automatically applies theme-aware background colors (`bg.subtle`) without needing glassmorphism. The result is readable inline code that doesn't compete with block-level code for attention.

## Interactive Elements

### Links with Smart Routing

Links in preview mode handle three distinct scenarios (ResourceMarkdownContent.tsx:556-666):

1. **Anchor links** (`#section-id`) - Smooth scroll to headings within the document
2. **External links** (`https://...`) - Open in system browser via Tauri's shell API
3. **Internal markdown links** (`./other-file.md`) - Navigate within BlueKit using ResourceContext

```typescript
<Link
  href={href}
  onClick={handleClick}
  color="primary.500"           // Brand color
  textDecoration="underline"    // Clear affordance
  _hover={{ color: 'primary.600' }}  // Darker on hover
  cursor="pointer"
>
```

**Styling decisions:**

- **Color** (`primary.500`) - Matches H2 headings, creating a cohesive accent system
- **Underline** - Provides clear visual affordance (unlike some modern designs that hide underlines)
- **Hover darkening** - `primary.600` gives tactile feedback

### Blockquotes: Border Emphasis

Blockquotes use a thick left border to indicate quoted content:

```typescript
<Box
  as="blockquote"
  borderLeft="4px solid"
  borderColor="border.emphasized"  // Semantic token for emphasis
  pl={4}
  py={2}
  my={4}
  fontStyle="italic"
>
```

The 4px border is substantial enough to be noticed peripherally while reading, clearly marking the quote boundary.

## Color Mode Adaptation

### The ColorModeContext (ColorModeContext.tsx)

BlueKit's color mode system manages theme switching:

```typescript
const [colorMode, setColorModeState] = useState<ColorMode>(() => {
  // Check localStorage first, then system preference
  const stored = localStorage.getItem('chakra-ui-color-mode');
  if (stored) return stored;
  
  // Respect system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
});

// Apply to document root for CSS variables
useEffect(() => {
  document.documentElement.classList.toggle('dark', colorMode === 'dark');
  document.documentElement.setAttribute('data-theme', colorMode);
  localStorage.setItem('chakra-ui-color-mode', colorMode);
}, [colorMode]);
```

**How semantic tokens respond:**

When `colorMode` changes, Chakra UI's token system automatically recalculates all semantic token values. For example:

```typescript
'text.primary': { 
  value: { _light: 'gray.900', _dark: 'primary.200' } 
}
```

This token instantly switches from `gray.900` to `primary.200` when dark mode activates. Every component using `text.primary` updates without manual intervention.

### Shiki Code Highlighting Themes

Syntax highlighting adapts to color mode by selecting appropriate Shiki themes (ShikiCodeBlock.tsx:38-43):

```typescript
const theme = colorMode === 'dark' ? 'github-dark' : 'github-light';
const highlighted = await codeToHtml(code, {
  lang: mappedLang,
  theme,
});
```

The `github-dark` and `github-light` themes are specifically chosen for readability and contrast—they provide syntax highlighting that remains clear against the glassmorphic backgrounds.

## Visual Hierarchy: The System at Work

Here's how the styling system creates visual hierarchy in a typical document:

1. **H1 title** - Large, bold, subtle shadow → Clear document start
2. **H2 sections** - Blue accent color (`primary.500`) → Major section markers
3. **H3 subsections** - Medium weight, gray → Nested structure
4. **Body paragraphs** - Generous line-height, subtle shadow → Readable prose
5. **Code blocks** - Glassmorphic containers → Separated but cohesive
6. **Links** - Blue underlined → Clear interaction points
7. **Blockquotes** - Thick left border → Visual nesting

This hierarchy guides readers through documents naturally, using color and spacing instead of relying solely on font size.

## Maintaining the Style Essence

As you implement AST parsing and advanced editing features, preserve these core principles:

### 1. Semantic Token Usage
Always use semantic tokens (`text.primary`, `primary.500`, `bg.surface`) instead of hardcoded colors. This ensures:
- Automatic color mode adaptation
- Consistent theming across the app
- Easy theme customization in one place (`theme.ts`)

### 2. Glassmorphism Formula
When adding new surfaces, follow the established pattern:
```css
background: rgba(255, 255, 255, 0.45);  /* ~45% opacity for light */
backdrop-filter: blur(24px) saturate(180%);
border: 1.5px solid rgba(255, 255, 255, 0.4);
box-shadow: /* layered shadows for depth */

_dark: {
  background: rgba(20, 20, 20, 0.6);    /* ~60% opacity for dark */
  border-color: rgba(255, 255, 255, 0.1);
}
```

### 3. Typography Rhythm
Maintain the 4-unit spacing rhythm (`mb: 4`) and generous line-height (`1.75`) for readability. Don't tighten spacing to fit more content—the breathing room is intentional.

### 4. Text Shadow Subtlety
Keep text shadows minimal:
- Light mode: `0 1px 2px rgba(0, 0, 0, 0.1)` - barely visible
- Dark mode: `0 1px 2px rgba(0, 0, 0, 0.5)` - slightly stronger for contrast

### 5. Accent Color Strategy
Use `primary.500` sparingly for emphasis:
- H2 headings (section markers)
- Interactive links
- Key UI elements

Don't overuse the accent color—its power comes from restraint.

## Implementation Reference

### Key Files
- `src/theme.ts:21-96` - Theme tokens and semantic color system
- `src/features/workstation/components/ResourceMarkdownContent.tsx:258-357` - Base preview styling container
- `src/features/workstation/components/ResourceMarkdownContent.tsx:362-699` - React-Markdown component overrides
- `src/features/workstation/components/ShikiCodeBlock.tsx:107-146` - Glassmorphic code block styling
- `src/shared/contexts/ColorModeContext.tsx` - Color mode state management

### Testing Color Modes
To verify styling across themes:
1. Toggle color mode in the app (Cmd+D or theme switcher)
2. Check all markdown elements: headings, paragraphs, code, links, quotes
3. Verify glassmorphic effects render with proper blur
4. Confirm text shadows are visible but subtle

## Conclusion

BlueKit's preview mode styling is a cohesive system where semantic tokens, glassmorphism, and typography work together to create a distinctive, readable interface. By understanding how these pieces connect—from theme tokens to component styles—you can extend the system while preserving its visual identity.

The essence is this: **thoughtful restraint**. The styling feels polished because it doesn't try to do too much. Subtle shadows, selective accent colors, and breathing room let the content shine.
