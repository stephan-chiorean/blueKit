---
id: color-mode-theming-system
alias: Color Mode Theming System
type: walkthrough
is_base: false
version: 1
tags:
  - theming
  - chakra-ui
  - dark-mode
description: Comprehensive guide to Chakra UI v3 color mode system, semantic tokens, and extending the color palette for dark mode support
complexity: comprehensive
format: guide
---
# Color Mode Theming System Guide

## Overview

BlueKit uses Chakra UI v3's theming system to support both light and dark modes. This guide walks through how the color mode system works, how to properly style components for dark mode, and how to extend the color palette with new variations.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Theme Configuration](#theme-configuration)
3. [Semantic Tokens Explained](#semantic-tokens-explained)
4. [Using Colors in Components](#using-colors-in-components)
5. [Common Pitfalls](#common-pitfalls)
6. [Extending the Color Palette](#extending-the-color-palette)
7. [Best Practices](#best-practices)

## Architecture Overview

### Three-Layer Color System

The theming system has three layers:

1. **Raw Color Tokens** (`themeColors`) - Base color palette with numeric scales (50-950)
2. **Semantic Tokens** (`semanticTokens.colors`) - Purpose-driven color tokens that adapt to color mode
3. **Component Usage** - How components reference semantic tokens

```
Raw Colors (primary.500) 
    ↓
Semantic Tokens (text.primary) 
    ↓
Component Props (color="text.primary")
```

### Files Involved

- **`src/theme.ts`** - Central theme configuration
- **`src/contexts/ColorModeContext.tsx`** - Color mode state management
- **`src/main.tsx`** - Theme system initialization
- **All component files** - Consume semantic tokens

## Theme Configuration

### Location: `src/theme.ts`

```typescript
import { createSystem, defaultConfig } from '@chakra-ui/react';

// Step 1: Define raw color palette
const themeColors = {
  primary: {
    50: { value: '#eff6ff' },   // Lightest
    100: { value: '#dbeafe' },
    200: { value: '#bfdbfe' },  // Light blue (used for dark mode text)
    300: { value: '#93c5fd' },
    400: { value: '#60a5fa' },
    500: { value: '#4287f5' },  // Base color
    600: { value: '#2563eb' },
    700: { value: '#1d4ed8' },
    800: { value: '#1e40af' },  // Dark blue (used for dark mode tags)
    900: { value: '#1e3a8a' },
    950: { value: '#172554' },  // Darkest
  },
};

// Step 2: Create system with semantic tokens
export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        ...themeColors,
      },
    },
    semanticTokens: {
      colors: {
        // Semantic tokens defined here
      },
    },
  },
});
```

### Color Scale Convention

Chakra UI uses a standard 50-950 scale:
- **50-200**: Very light shades (good for backgrounds in light mode, text in dark mode)
- **300-400**: Medium-light shades (good for hover states, secondary elements)
- **500**: Base color (brand color, primary actions)
- **600-700**: Medium-dark shades (good for text in light mode, buttons)
- **800-900**: Dark shades (good for dark backgrounds, tags in dark mode)
- **950**: Darkest shade (good for text in light mode, very dark backgrounds)

## Semantic Tokens Explained

Semantic tokens are the **bridge between raw colors and color modes**. They define what color a specific purpose should use in each mode.

### Anatomy of a Semantic Token

```typescript
'text.primary': { 
  value: { 
    _light: '{colors.gray.900}',      // Dark text in light mode
    _dark: '{colors.primary.200}'     // Light blue text in dark mode
  } 
}
```

**Key points:**
- Token name describes **purpose** (e.g., `text.primary`), not color
- `_light` condition applies when color mode is light
- `_dark` condition applies when color mode is dark
- References to raw colors use curly brace syntax: `{colors.primary.200}`

### Current Semantic Tokens

#### Primary Color Tokens

```typescript
primary: {
  // Solid fill color (doesn't change with mode)
  solid: { value: '{colors.primary.600}' },
  
  // Contrast color (for text on primary backgrounds)
  contrast: { value: '{colors.primary.50}' },
  
  // Foreground color (adapts to mode)
  fg: { value: { _light: '{colors.primary.700}', _dark: '{colors.primary.200}' } },
  
  // Muted color (doesn't change - always light)
  muted: { value: '{colors.primary.100}' },
  
  // Subtle color (adapts to mode) - USED FOR TAGS
  subtle: { value: { _light: '{colors.primary.200}', _dark: '{colors.primary.800}' } },
  
  // Emphasized color (doesn't change)
  emphasized: { value: '{colors.primary.300}' },
  
  // Focus ring color (doesn't change)
  focusRing: { value: '{colors.primary.500}' },
  
  // Border color (doesn't change)
  border: { value: '{colors.primary.200}' },
}
```

#### Custom Tokens

```typescript
// Hover/selected background for cards and interactive elements
'primary.hover.bg': { 
  value: { 
    _light: '{colors.primary.50}',           // Very light blue in light mode
    _dark: 'rgba(66, 135, 245, 0.1)'        // 10% opacity blue in dark mode
  } 
},

// Subtle background for cards, tabs, header
'bg.subtle': { 
  value: { 
    _light: '{colors.gray.100}',     // Light gray in light mode
    _dark: '{colors.gray.950}'       // Almost black in dark mode
  } 
},

// Surface background for selected states (e.g., view mode switcher)
'bg.surface': { 
  value: { 
    _light: 'white',                 // White in light mode
    _dark: '{colors.gray.900}'       // Dark gray in dark mode
  } 
},

// Header background - same as subtle background (cards/tabs)
'header.bg': { 
  value: { 
    _light: '{colors.gray.100}', 
    _dark: '{colors.gray.950}' 
  } 
},

// Main content background
'main.bg': { 
  value: { 
    _light: '{colors.white}',        // White in light mode
    _dark: '{colors.gray.950}'       // Almost black in dark mode
  } 
},

// Text colors (adapt to mode)
'text.primary': { 
  value: { 
    _light: '{colors.gray.900}',     // Dark gray in light mode
    _dark: '{colors.primary.200}'    // Light blue in dark mode
  } 
},
'text.secondary': { 
  value: { 
    _light: '{colors.gray.600}',     // Medium gray in light mode
    _dark: '{colors.primary.400}'    // Medium blue in dark mode
  } 
},

// Foreground colors (same as text colors)
fg: { 
  value: { 
    _light: '{colors.gray.900}', 
    _dark: '{colors.primary.200}' 
  } 
},
'fg.muted': { 
  value: { 
    _light: '{colors.gray.600}', 
    _dark: '{colors.primary.400}' 
  } 
},
```

## Using Colors in Components

### ✅ Correct: Using Semantic Tokens

```tsx
// Text color
<Text color="text.primary">Main content text</Text>
<Text color="text.secondary">Secondary text</Text>
<Text color="text.tertiary">Tertiary text (labels)</Text>

// Backgrounds
<Box bg="main.bg">Main content area</Box>
<Box bg="bg.subtle">Card or tab background</Box>
<Box bg="bg.surface">Selected button state</Box>

// Hover states
<Card.Root 
  _hover={{ bg: "primary.hover.bg", borderColor: "primary.400" }}
>
  Card content
</Card.Root>

// Tags with colorPalette
<Tag.Root variant="subtle" colorPalette="primary">
  <Tag.Label>Tag text</Tag.Label>
</Tag.Root>
```

### ❌ Incorrect: Common Mistakes

```tsx
// ❌ Using invalid semantic token
<Text color="text">Invalid - should be text.primary</Text>

// ❌ Using raw colors directly (won't adapt to dark mode)
<Box bg="white">Will be white in both modes</Box>
<Text color="gray.900">Will be dark in both modes</Text>

// ❌ Hardcoding colors
<Box bg="gray.50">Should use semantic token</Box>
<Text color="#4287f5">Should use semantic token</Text>

// ❌ Using primary.50 directly for hover states
<Card.Root _hover={{ bg: "primary.50" }}>
  Should use primary.hover.bg
</Card.Root>
```

### Component Patterns

#### Card with Selection/Hover States

```tsx
<Card.Root
  variant="subtle"
  borderWidth={isSelected ? "2px" : "1px"}
  borderColor={isSelected ? "primary.500" : "border.subtle"}
  bg={isSelected ? "primary.hover.bg" : undefined}
  _hover={{ borderColor: "primary.400", bg: "primary.hover.bg" }}
  cursor="pointer"
>
  <CardBody>
    <Text color="text.primary">Card title</Text>
    <Text color="text.secondary">Card description</Text>
  </CardBody>
</Card.Root>
```

#### View Mode Switcher

```tsx
<HStack gap={0} bg="bg.subtle" borderRadius="md">
  <Button
    bg={viewMode === 'card' ? 'bg.surface' : 'transparent'}
    color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
    _hover={{ bg: viewMode === 'card' ? 'bg.surface' : 'bg.subtle' }}
  >
    Cards
  </Button>
  <Button
    bg={viewMode === 'table' ? 'bg.surface' : 'transparent'}
    color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
    _hover={{ bg: viewMode === 'table' ? 'bg.surface' : 'bg.subtle' }}
  >
    Table
  </Button>
</HStack>
```

#### Markdown Styling

```tsx
<Box
  css={{
    // Paragraphs
    '& p': {
      lineHeight: '1.75',
      color: 'text.primary',  // ✅ Uses semantic token
    },
    // Blockquotes
    '& blockquote': {
      borderLeft: '4px solid',
      borderColor: 'border.emphasized',
      pl: 4,
      py: 2,
      fontStyle: 'italic',
      // No background - transparent in both modes
    },
    // Inline code
    '& code': {
      fontSize: '0.9em',
      // No background - uses default or transparent
    },
  }}
>
  <ReactMarkdown>
    {content}
  </ReactMarkdown>
</Box>
```

## Common Pitfalls

### 1. Invalid Semantic Token Names

**Problem:**
```tsx
<Text color="text">Text content</Text>
```

**Why it fails:** There's no semantic token called `text`. The valid tokens are `text.primary`, `text.secondary`, `text.tertiary`.

**Solution:**
```tsx
<Text color="text.primary">Text content</Text>
```

### 2. Hardcoded Colors

**Problem:**
```tsx
<Box bg="white">Content area</Box>
<Text color="gray.900">Dark text</Text>
```

**Why it fails:** These colors don't adapt to dark mode. The box will be white in dark mode (blinding), and the text will be dark gray (invisible).

**Solution:**
```tsx
<Box bg="main.bg">Content area</Box>
<Text color="text.primary">Dark text</Text>
```

### 3. Direct Use of Raw Color Scales

**Problem:**
```tsx
<Card.Root _hover={{ bg: "primary.50" }}>
  Hover me
</Card.Root>
```

**Why it fails:** `primary.50` is a very light blue that looks terrible in dark mode.

**Solution:**
```tsx
<Card.Root _hover={{ bg: "primary.hover.bg" }}>
  Hover me
</Card.Root>
```

### 4. Backgrounds in Markdown Components

**Problem:**
```tsx
<Box as="blockquote" bg="bg.subtle">
  Quote text
</Box>
```

**Why it might be wrong:** In dark mode, `bg.subtle` is `gray.950`, which might create unwanted visual separation. For markdown, transparent backgrounds often look better.

**Solution:**
```tsx
<Box as="blockquote" borderLeft="4px solid" borderColor="border.emphasized">
  Quote text (no background)
</Box>
```

## Extending the Color Palette

### Adding a New Color Palette

Let's say you want to add a secondary color palette (e.g., green for success states).

#### Step 1: Add Raw Colors

```typescript
// src/theme.ts
const themeColors = {
  primary: {
    // ... existing primary colors
  },
  // Add new palette
  success: {
    50: { value: '#f0fdf4' },
    100: { value: '#dcfce7' },
    200: { value: '#bbf7d0' },
    300: { value: '#86efac' },
    400: { value: '#4ade80' },
    500: { value: '#22c55e' },   // Base green
    600: { value: '#16a34a' },
    700: { value: '#15803d' },
    800: { value: '#166534' },
    900: { value: '#14532d' },
    950: { value: '#052e16' },
  },
};
```

#### Step 2: Add Semantic Tokens

```typescript
// src/theme.ts - inside semanticTokens.colors
success: {
  solid: { value: '{colors.success.600}' },
  contrast: { value: '{colors.success.50}' },
  fg: { value: { _light: '{colors.success.700}', _dark: '{colors.success.200}' } },
  subtle: { value: { _light: '{colors.success.200}', _dark: '{colors.success.800}' } },
  emphasized: { value: '{colors.success.300}' },
},
'success.hover.bg': { 
  value: { 
    _light: '{colors.success.50}', 
    _dark: 'rgba(34, 197, 94, 0.1)' 
  } 
},
```

#### Step 3: Use in Components

```tsx
// Success button
<Button colorPalette="success" variant="solid">
  Save Changes
</Button>

// Success tag
<Tag.Root variant="subtle" colorPalette="success">
  <Tag.Label>Completed</Tag.Label>
</Tag.Root>

// Success card with hover
<Card.Root 
  borderColor="success.500"
  _hover={{ bg: "success.hover.bg" }}
>
  Success message
</Card.Root>
```

### Adding Custom Semantic Tokens

You can add any custom semantic token for specific use cases.

#### Example: Warning States

```typescript
// src/theme.ts - inside semanticTokens.colors
warning: {
  solid: { value: '{colors.yellow.600}' },
  fg: { value: { _light: '{colors.yellow.700}', _dark: '{colors.yellow.200}' } },
  subtle: { value: { _light: '{colors.yellow.200}', _dark: '{colors.yellow.800}' } },
},
'warning.hover.bg': { 
  value: { 
    _light: '{colors.yellow.50}', 
    _dark: 'rgba(234, 179, 8, 0.1)' 
  } 
},
```

#### Example: Custom UI States

```typescript
// src/theme.ts - inside semanticTokens.colors

// Sidebar background
'sidebar.bg': { 
  value: { 
    _light: '{colors.gray.50}', 
    _dark: '{colors.gray.900}' 
  } 
},

// Code editor background
'code.bg': { 
  value: { 
    _light: '{colors.gray.100}', 
    _dark: '{colors.gray.800}' 
  } 
},

// Accent highlight
'accent.highlight': { 
  value: { 
    _light: '{colors.blue.100}', 
    _dark: 'rgba(59, 130, 246, 0.2)' 
  } 
},
```

### Extending with Opacity Variants

For subtle effects, use rgba with opacity:

```typescript
// Overlay backgrounds
'overlay.light': { 
  value: { 
    _light: 'rgba(0, 0, 0, 0.1)', 
    _dark: 'rgba(255, 255, 255, 0.05)' 
  } 
},
'overlay.medium': { 
  value: { 
    _light: 'rgba(0, 0, 0, 0.3)', 
    _dark: 'rgba(255, 255, 255, 0.1)' 
  } 
},
'overlay.heavy': { 
  value: { 
    _light: 'rgba(0, 0, 0, 0.5)', 
    _dark: 'rgba(255, 255, 255, 0.15)' 
  } 
},
```

## Best Practices

### 1. Always Use Semantic Tokens

✅ **Do this:**
```tsx
<Text color="text.primary">Content</Text>
<Box bg="main.bg">Container</Box>
```

❌ **Don't do this:**
```tsx
<Text color="gray.900">Content</Text>
<Box bg="white">Container</Box>
```

### 2. Name Tokens by Purpose, Not Appearance

✅ **Do this:**
```typescript
'text.primary': { value: { _light: 'gray.900', _dark: 'primary.200' } }
'button.primary.bg': { value: { _light: 'primary.600', _dark: 'primary.500' } }
```

❌ **Don't do this:**
```typescript
'light.blue.text': { value: { _light: 'gray.900', _dark: 'primary.200' } }
'blue.button': { value: { _light: 'primary.600', _dark: 'primary.500' } }
```

### 3. Test in Both Modes

Always test your changes in both light and dark modes:

1. Toggle color mode in the app
2. Check all states: default, hover, selected, disabled
3. Verify text contrast (use browser DevTools contrast checker)
4. Check borders, shadows, and overlays

### 4. Use Chakra's Built-in Tokens When Possible

Chakra UI provides many built-in semantic tokens. Check the documentation before creating custom ones:

- `bg.canvas`, `bg.subtle`, `bg.muted`, `bg.emphasized`
- `border.subtle`, `border.emphasized`, `border.muted`
- `text.primary`, `text.secondary`, `text.tertiary`, `text.disabled`

### 5. Document Custom Tokens

Add comments to custom tokens explaining their purpose:

```typescript
// Custom token for blueprint task cards
'blueprint.task.bg': { 
  value: { 
    _light: '{colors.blue.50}',      // Light blue for visibility
    _dark: 'rgba(59, 130, 246, 0.1)' // Subtle blue tint
  } 
},
```

### 6. Maintain Consistent Opacity Levels

For hover/selected states, use consistent opacity values:

- **Subtle hover**: `0.05` - `0.1` opacity
- **Medium hover**: `0.1` - `0.2` opacity
- **Strong hover**: `0.2` - `0.3` opacity
- **Overlay backgrounds**: `0.3` - `0.5` opacity

### 7. Consider Contrast Ratios

Ensure text meets WCAG accessibility standards:

- **AA standard**: 4.5:1 contrast ratio for normal text
- **AAA standard**: 7:1 contrast ratio for normal text
- Use browser DevTools to check contrast

**Example dark mode combinations:**
- `primary.200` (#bfdbfe) on `gray.950` (almost black) ✅ Good contrast
- `primary.400` (#60a5fa) on `gray.950` (almost black) ✅ Good contrast
- `primary.50` (#eff6ff) on `gray.950` (almost black) ❌ Too light, poor contrast

## Color Mode Context

### How Color Mode Works

The `ColorModeContext` manages the current color mode state.

**Location:** `src/contexts/ColorModeContext.tsx`

```typescript
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    // 1. Check localStorage first
    const stored = localStorage.getItem('chakra-ui-color-mode') as ColorMode | null;
    if (stored) return stored;
    
    // 2. Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // Apply color mode to document
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
    document.documentElement.setAttribute('data-theme', colorMode);
    localStorage.setItem('chakra-ui-color-mode', colorMode);
  }, [colorMode]);

  // toggleColorMode and setColorMode functions...
}
```

### How Semantic Tokens Resolve

When you use a semantic token like `text.primary`:

1. **Component renders** with `color="text.primary"`
2. **Chakra checks** `document.documentElement.classList` for `.dark` class
3. **Resolves value**:
   - If `.dark` class exists → use `_dark` value
   - Otherwise → use `_light` value
4. **Applies color** to the component

### Toggling Color Mode

```tsx
import { useColorMode } from '../contexts/ColorModeContext';

function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  
  return (
    <Button onClick={toggleColorMode}>
      {colorMode === 'light' ? '🌙 Dark' : '☀️ Light'}
    </Button>
  );
}
```

## Quick Reference

### Most Common Semantic Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `text.primary` | `gray.900` | `primary.200` | Main text content |
| `text.secondary` | `gray.600` | `primary.400` | Secondary text |
| `text.tertiary` | `gray.500` | `gray.400` | Labels, hints |
| `bg.subtle` | `gray.100` | `gray.950` | Card/tab backgrounds |
| `bg.surface` | `white` | `gray.900` | Selected states |
| `main.bg` | `white` | `gray.950` | Main content background |
| `primary.hover.bg` | `primary.50` | `rgba(66, 135, 245, 0.1)` | Hover states |
| `primary.subtle` | `primary.200` | `primary.800` | Tag backgrounds |

### Decision Tree: Which Token to Use?

**For text:**
- Main content → `text.primary`
- Supporting text → `text.secondary`
- Labels/hints → `text.tertiary`

**For backgrounds:**
- Main content area → `main.bg`
- Cards/tabs/header → `bg.subtle`
- Selected buttons → `bg.surface`
- Hover states → `primary.hover.bg`

**For tags:**
- Use `variant="subtle"` with `colorPalette="primary"`
- The `primary.subtle` token handles color mode automatically

**For borders:**
- Subtle borders → `border.subtle`
- Emphasized borders → `border.emphasized`
- Primary action borders → `primary.500` or `primary.400`

## Troubleshooting

### Text is Invisible in Dark Mode

**Symptom:** Text appears black on black background

**Cause:** Using raw color token or invalid semantic token

**Fix:**
```tsx
// ❌ Before
<Text color="gray.900">Text</Text>
<Text color="text">Text</Text>

// ✅ After
<Text color="text.primary">Text</Text>
```

### Background is Too Light/Dark

**Symptom:** Backgrounds look wrong in one mode

**Cause:** Using hardcoded color or non-adaptive semantic token

**Fix:**
```tsx
// ❌ Before
<Box bg="white">Content</Box>
<Box bg="gray.50">Content</Box>

// ✅ After
<Box bg="main.bg">Content</Box>
<Box bg="bg.subtle">Content</Box>
```

### Hover State Looks Wrong

**Symptom:** Hover effect is too bright in dark mode

**Cause:** Using `primary.50` directly instead of semantic token

**Fix:**
```tsx
// ❌ Before
<Card _hover={{ bg: "primary.50" }}>

// ✅ After
<Card _hover={{ bg: "primary.hover.bg" }}>
```

### Tags Have Wrong Color

**Symptom:** Tags are light blue in dark mode instead of dark blue

**Cause:** `primary.subtle` token not defined with `_dark` variant

**Fix:**
```typescript
// src/theme.ts
subtle: { 
  value: { 
    _light: '{colors.primary.200}', 
    _dark: '{colors.primary.800}'  // Add this
  } 
},
```

## Summary

**Key Takeaways:**

1. ✅ Always use semantic tokens, never raw colors
2. ✅ Test in both light and dark modes
3. ✅ Use descriptive token names based on purpose
4. ✅ Maintain consistent opacity levels for similar effects
5. ✅ Document custom tokens with comments
6. ❌ Never use invalid tokens like `color="text"`
7. ❌ Never hardcode colors like `bg="white"`
8. ❌ Never use raw color scales for mode-adaptive UI

**Quick Start Checklist:**

When styling a new component:

- [ ] Use semantic tokens (e.g., `text.primary`, `bg.subtle`)
- [ ] Test in light mode
- [ ] Toggle to dark mode and test again
- [ ] Check hover/selected states in both modes
- [ ] Verify text contrast meets accessibility standards
- [ ] Use `primary.hover.bg` for hover effects
- [ ] Use `bg.surface` for selected states
- [ ] Use `text.primary` for main text

**When in doubt:** Check existing components for similar patterns, and always prefer semantic tokens over raw colors.
