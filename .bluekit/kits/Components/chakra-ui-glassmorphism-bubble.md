---
id: chakra-ui-glassmorphism-bubble
alias: Chakra UI Glassmorphism Bubble
type: kit
is_base: false
version: 1
tags:
  - chakra-ui
  - styling
  - glassmorphism
description: Glass-effect bubble containers with blur, transparency, and hover animations for modern UI design
---
# Chakra UI Glassmorphism Bubble

## End State

After applying this kit, the application will have:

**Visual Components:**
- Glass-effect containers with frosted blur background
- Semi-transparent backgrounds that adapt to light and dark modes
- Smooth hover animations with subtle scale transforms
- Consistent border styling with transparency
- Multi-layered shadow effects for depth

**Styling Properties:**
- Background: `rgba(255, 255, 255, 0.15)` in light mode, `rgba(0, 0, 0, 0.2)` in dark mode
- Backdrop filter: `blur(30px) saturate(180%)` with WebKit fallback
- Border: 1px with semi-transparent white (`rgba(255, 255, 255, 0.2)` light, `rgba(255, 255, 255, 0.15)` dark)
- Border radius: 16px for rounded corners
- Box shadow: Soft depth shadows that adapt to color mode
- Hover state: `scale(1.02)` with smooth `0.2s ease-in-out` transition

**Theme Integration:**
- Automatic adaptation between light and dark color modes
- Uses Chakra UI's `css` prop for advanced styling
- Supports `_dark` pseudo-prop for dark mode overrides
- Compatible with Chakra UI's theming system

## Implementation Principles

- Use Chakra UI's Box component as the container element
- Apply glassmorphism effects via the `css` prop for maximum control
- Include both `backdropFilter` and `WebkitBackdropFilter` for cross-browser support
- Implement color mode variants using `_dark` pseudo-prop
- Keep transition timing consistent (`0.2s ease-in-out`) across interactive states
- Layer multiple shadow types for realistic depth perception
- Use rgba colors for precise transparency control

## Verification Criteria

After generation, verify:
- ✓ Container has visible frosted glass blur effect
- ✓ Background transparency allows content behind to show through
- ✓ Hover animation smoothly scales container to 1.02x
- ✓ Dark mode switches to darker background with adjusted shadows
- ✓ Border remains subtle and semi-transparent in both modes
- ✓ Text remains readable with adequate contrast
- ✓ Transitions are smooth without jank or flicker

## Interface Contracts

**Provides:**
- Reusable Box component styling pattern
- Color mode aware glass effect
- Consistent visual hierarchy through shadows and blur

**Requires:**
- Chakra UI v3+ with emotion CSS-in-JS support
- ColorModeContext provider wrapping the component tree
- Browser support for backdrop-filter (modern browsers)

**Compatible With:**
- Any Chakra UI component that accepts `css` prop
- Nested content (text, buttons, forms) via proper text shadows
- Card, Container, and custom layout components
- Animation libraries (Framer Motion, etc.)

## Code Reference

Based on implementation in `KitOverview.tsx:134-175`, the pattern looks like:

```tsx
<Box
  p={4}
  borderRadius="16px"
  borderWidth="1px"
  transition="all 0.2s ease-in-out"
  css={{
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(30px) saturate(180%)',
    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
    _dark: {
      background: 'rgba(0, 0, 0, 0.2)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
    },
    _hover: {
      transform: 'scale(1.02)',
    },
  }}
>
  {/* Your content here */}
</Box>
```

**Text Enhancement Pattern:**
For text within glass bubbles to have better contrast, apply text shadows:

```tsx
<Text
  css={{
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    _dark: {
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    },
  }}
>
  Content
</Text>
```

## Customization Options

**Adjust blur intensity:**
- Increase/decrease `blur(30px)` value
- Modify `saturate(180%)` for color vibrancy

**Change transparency:**
- Light mode: Adjust `rgba(255, 255, 255, 0.15)` alpha (0-1)
- Dark mode: Adjust `rgba(0, 0, 0, 0.2)` alpha (0-1)

**Modify hover effect:**
- Change `scale(1.02)` for more/less movement
- Add rotation: `transform: 'scale(1.02) rotate(1deg)'`
- Adjust transition timing for faster/slower animation

**Border radius:**
- More rounded: Increase `16px` (e.g., `24px`)
- Less rounded: Decrease to `8px` or `12px`
- Pill shape: Use `9999px`
