---
id: button-component
alias: Button Component
is_base: false
version: 1
tags: [ui, component, button]
description: "Reusable button component pattern for consistent, accessible buttons"
---

# Reusable Button Component Pattern

## Overview
A reusable pattern for creating consistent, accessible button components across an application. This pattern ensures buttons have consistent styling, behavior, and accessibility features while remaining flexible for different use cases.

## Pattern Description

This pattern solves the problem of inconsistent button implementations across an application. Instead of creating buttons ad-hoc, this pattern provides:

1. **Consistent Styling**: Unified visual design across all buttons
2. **Accessibility**: Built-in ARIA attributes and keyboard support
3. **State Management**: Loading, disabled, and active states
4. **Flexibility**: Variants and sizes for different contexts
5. **Type Safety**: TypeScript interfaces for props

## Use Cases

- Primary action buttons (submit, save, confirm)
- Secondary action buttons (cancel, back, skip)
- Icon buttons for toolbars and menus
- Link-style buttons for navigation
- Destructive action buttons (delete, remove)

## Component Structure

```tsx
<Button
  variant="primary" | "secondary" | "danger" | "ghost"
  size="sm" | "md" | "lg"
  isLoading={boolean}
  disabled={boolean}
  onClick={handler}
  type="button" | "submit" | "reset"
>
  {children}
</Button>
```

## Key Principles

1. **Variants**: Different visual styles for different contexts
2. **Sizes**: Consistent sizing scale (sm, md, lg)
3. **States**: Loading, disabled, and active states
4. **Accessibility**: Keyboard navigation and screen reader support
5. **Composition**: Can include icons, text, or both

## Implementation Pattern

The component should:
- Accept variant and size props for styling
- Handle loading state with spinner/indicator
- Disable interaction when loading or disabled
- Support keyboard events (Enter, Space)
- Include proper ARIA attributes
- Forward refs for advanced use cases

## Benefits

- **Consistency**: All buttons look and behave the same
- **Accessibility**: Built-in a11y features
- **Maintainability**: Single source of truth for button styles
- **Developer Experience**: Easy to use with clear props
- **Type Safety**: TypeScript ensures correct usage

## Customization Points

- Color schemes and variants
- Size scale and spacing
- Loading indicator style
- Icon positioning (left, right, or both)
- Border radius and shadows
- Hover and focus states

