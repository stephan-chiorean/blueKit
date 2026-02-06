---
id: page-playground
alias: Page Playground
type: kit
is_base: false
version: 1
tags:
  - ui
  - layout
  - design-system
description: A reusable page layout providing the signature BlueKit gradient background with a glassmorphic content container.
---
## End State

After applying this kit, the application will have:

- A standardized `GlassPageLayout` component that encapsulates the correct background and blur settings.
- Consistent visual hierarchy with `GradientBackground` handling the ambient visuals.
- Helper patterns for creating glassmorphic cards without conflicting blurs.
- Theme-aware styles that automatically adjust opacity and colors for light/dark modes.

## Implementation Principles

- **Global Blur Strategy**: Apply `backdrop-filter: blur(30px)` ONLY to the top-level content container.
- **Avoid Nested Blurs**: Child components (like cards) should use semi-transparent backgrounds but MUST NOT user `backdrop-filter` again to prevent visual artifacts.
- **Layering**: `GradientBackground` sits at `zIndex: -1` (or fixed behind). Content sits at `zIndex: 1`.
- **Responsive Design**: Ensure the layout handles padding and max-widths consistently across breakpoints.

## Verification Criteria

After implementation, verify:
- ✓ Gradient blobs are visible and animated behind the content.
- ✓ Content container effectively blurs the background.
- ✓ No "double blur" artifacts or hard borders on nested cards.
- ✓ Dark mode switches background opacities correctly for readability.

## Interface Contracts

**Provides:**
- Component: `GlassPageLayout` - The main wrapper.
- Pattern: `GlassCard` - Examples of how to style child cards.

**Requires:**
- Component: `GradientBackground`
- Theme: Chakra UI theme with `bg.subtle`, `glass.light/dark` tokens.
