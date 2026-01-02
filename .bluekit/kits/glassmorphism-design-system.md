---
id: glassmorphism-design-system
alias: Glassmorphism Design System
type: kit
is_base: false
version: 1
tags:
  - ui
  - design-system
  - glassmorphism
description: A modern glassmorphism design system with animated gradient backgrounds, frosted glass panels, and adaptive light/dark theming
---
# Glassmorphism Design System Kit

## End State

After applying this kit, the application will have:

**Animated Gradient Background Layer:**
- Fixed-position mesh gradient background that serves as the visual foundation
- Multiple floating gradient blobs with subtle animation (20-28 second cycles)
- Color palette adapts between light mode (warm sunset tones: rose, violet, amber, teal) and dark mode (deep purples, indigos)
- Noise texture overlay for subtle grain effect (2-3% opacity)
- Positioned at z-index -1 to sit behind all content

**Theme Semantic Tokens:**
- `glass.light` / `glass.dark` - Base semi-transparent backgrounds
- `glass.border.light` / `glass.border.dark` - Subtle border colors for glass edges
- `glass.content.light` / `glass.content.dark` - Main content area backgrounds
- `glass.card.light` / `glass.card.dark` - Card component backgrounds
- `glass.nav.light` / `glass.nav.dark` - Navigation/tab backgrounds

**Glass Panel Styling:**
- Content areas use `backdrop-filter: blur(30px) saturate(180%)` with semi-transparent backgrounds
- Cards use 15-20% opacity white/black backgrounds with blur and subtle borders
- Borders use rgba values (0.1-0.2 opacity) for soft edges
- Box shadows use rgba with 15-40% opacity for depth without harsh edges

**Glass Header Component:**
- Sticky header with 45-50% opacity background
- `backdrop-filter: blur(12px)` for frosted effect
- Subtle bottom border (8-12% opacity)

**Glass Tab Navigation:**
- Tab list container with glass background and rounded corners
- Tab indicator with lighter glass effect (60% light / 15% dark opacity)
- Nested blur effects (8-12px) for indicator refinement

**Text Enhancements:**
- Subtle text shadows on headings and important text for readability
- Light mode: `0 1px 2px rgba(0, 0, 0, 0.1)`
- Dark mode: `0 1px 2px rgba(0, 0, 0, 0.5)`
- Applied to branding, headings (h1-h6), and description text

**Layout Requirements:**
- Background component renders at root level (fixed position, full viewport)
- All content wrapped in container with `position: relative; z-index: 1`
- Component backgrounds set to `transparent` to allow glass effect through
- Splitter panels and cards use transparent backgrounds

**Responsive Color Mode Support:**
- All glass effects have light and dark mode variants
- Light mode: white-based transparency with warm undertones
- Dark mode: black/dark blue transparency with cool undertones
- Automatic switching via color mode context

## Implementation Principles

- Use CSS `backdrop-filter` with vendor prefixes (`-webkit-backdrop-filter`) for Safari support
- Layer blur with saturation (`saturate(180%)`) for richer colors through glass
- Keep glass opacity between 10-50% to maintain readability while showing background
- Use `rgba()` for all glass colors to ensure transparency
- Animate gradient blobs with CSS keyframes, not JavaScript (performance)
- Apply `pointer-events: none` to decorative background elements
- Use fixed positioning for background layer to prevent scroll issues
- Set explicit z-index hierarchy: background (-1), content (1), modals (10+)

## Verification Criteria

After generation, verify:
- ✓ Gradient background visible behind all content with floating blob animations
- ✓ Header has frosted glass appearance with content blurring through
- ✓ Tab navigation appears as floating glass pill with active indicator
- ✓ Cards and panels show content behind them with blur effect
- ✓ Text remains readable on glass surfaces (check contrast)
- ✓ Color mode toggle switches all glass styling between light/dark
- ✓ Backdrop blur works in Chrome, Firefox, and Safari
- ✓ No layout shifts when background animates
- ✓ Content remains scrollable with fixed background

## Interface Contracts

**Provides:**
- `GradientBackground` component - Drop-in animated gradient layer
- Glass semantic tokens in theme system (`glass.*`)
- CSS patterns for glass panels, headers, tabs, and cards
- Text shadow utilities for glass-friendly typography

**Requires:**
- CSS-in-JS framework supporting `css` prop (Chakra UI, Emotion, styled-components)
- Color mode context for light/dark switching
- Theme system supporting semantic token definitions
- Modern browser with `backdrop-filter` support

**Compatible With:**
- Chakra UI v3+ - Uses `css` prop and semantic tokens
- Any React component library supporting transparent backgrounds
- Tauri/Electron desktop apps - Works with native window styling
- PWA/web apps - Full browser support for glass effects

## Example Patterns

**Glass Content Area:**
```css
background: rgba(255, 255, 255, 0.1); /* light mode */
background: rgba(0, 0, 0, 0.15); /* dark mode */
backdrop-filter: blur(30px) saturate(180%);
-webkit-backdrop-filter: blur(30px) saturate(180%);
```

**Glass Card:**
```css
background: rgba(255, 255, 255, 0.15);
backdrop-filter: blur(30px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.2);
box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
border-radius: 16px;
```

**Gradient Blob Animation:**
```css
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}
animation: float 20s ease-in-out infinite;
```

**Text Shadow for Glass:**
```css
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); /* light mode */
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5); /* dark mode */
```
