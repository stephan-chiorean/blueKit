---
id: spotlight-popover-flow
alias: Spotlight Popover Flow
type: kit
is_base: false
version: 1
tags:
  - ui-pattern
  - react
  - interaction
description: A coordinated popover interaction that spotlights the active element by blurring the rest of the application interface
---
## End State

After applying this kit, the application will have:

**Coordinated Blur System:**
- A unified state manager that tracks if *any* spotlight popover is open.
- A `SpotlightBackdrop` component that renders a full-screen, high-z-index blur overlay (e.g., `backdrop-filter: blur(8px)`) when active.
- The blur overlay appears immediately when a popover opens but fades out with a slight delay when all popovers close.

**True Spotlight Mechanism:**
- **Cloned Trigger:** The active trigger is "cloned" and rendered in a Portal exactly on top of the original element but with a higher Z-Index (e.g., 1401). This ensures it sits *above* the blur layer regardless of the original element's stacking context.
- **Floating Panel:** The popover content floats near the trigger without any connecting arrow or "tooltippy" indicator.
- **Portal-Aware Content:** The popover content is also rendered in a Portal (Z-Index 1400) to ensure it sits above the blur (Z-Index 1300).

**Visual Result:**
- When a user interacts with a designated trigger, the rest of the application interface is visually receded (blurred and dimmed).
- The trigger itself appears to "pop out" through the blur, remaining sharp and interactive.
- The popover appears as a clean, floating panel next to the spotlighted trigger.

## Implementation Principles

- **Portal-Based Overlay:** Render the blur backdrop in a React Portal body-level to ensure it covers the entire viewport.
- **Clone & Portal Strategy (CRITICAL):** Do NOT rely on `z-index` manipulation of the original trigger element, as complex stacking contexts will often trap it below the backdrop.
    1. Measure the original trigger's bounding box (`getBoundingClientRect`).
    2. Render a **visual clone** of the trigger in a Portal.
    3. Position the clone absolutely using the measured coordinates.
    4. Set the clone's `z-index` higher than the backdrop (e.g., `Backdrop: 1300` -> `Clone: 1401`).
    5. Ensure the clone has `pointer-events: none` if it's purely visual, or handle interactions carefully.
    6. **Active State:** Explicitly inject active state props (e.g., `data-state="open"`, `aria-expanded="true"`) into the clone so it appears "pressed" or active, matching the user's specific styling requirements.
- **Floating Popover:** Render the popover content in a Portal (Z-Index 1400). Explicitly disable or remove any "Arrow" component.
- **Reference-Based State Sync:** Use `ref`s alongside state to track open status synchronously. This is critical for preventing the "blur flicker" when switching between triggers.
- **Debounced Closing:** Implement a small timeout (e.g., 100ms) before removing the blur effect when a popover closes. Cancel this timeout if another spotlight popover opens immediately.
- **Glassmorphism:** Use modern CSS backdrop filters (e.g., `backdrop-filter: blur(8px) saturate(120%)`) for the popover content to match the premium BlueKit aesthetic.

## Verification Criteria

After generation, verify:
- ✓ Clicking a trigger opens the popover and immediately applies the full-screen blur.
- ✓ The active popover and its trigger are *not* blurred.
- ✓ **NO Arrow:** The popover should "float" near the trigger without an arrow indicator.
- ✓ clicking from Trigger A directly to Trigger B keeps the blur active without it flashing off and on.
- ✓ Clicking the blurred background closes the active popover and removes the blur.
- ✓ The blur effect works correctly in both light and dark modes (appropriate overlay opacity).

## Adjacent Context Spotlight (Menu → Popover Flow)

When a popover is triggered from a context menu (e.g., "Rename Folder" from a folder card menu), additional elements must remain visible and unblurred:

**Elements to Keep Visible:**
1. **The parent card/container** - The folder card itself must remain visible
2. **The context menu** - The menu that triggered the popover stays open
3. **The popover** - Positioned relative to the triggering menu item

**Implementation Pattern:**
1. When the popover opens, measure bounding rects of both the card AND the menu item
2. Render the blur backdrop (Z-Index: 1300)
3. Clone the entire card and portal it above the blur (Z-Index: 1401)
4. Keep the menu open with elevated z-index (Z-Index: 1405)
5. Position the popover above/below the menu item (Z-Index: 1410)

**Popover Positioning:**
- For "above menu item" placement: `top: ${menuItemRect.top - 8}px; transform: translateY(-100%)`
- For "below menu item" placement: `top: ${menuItemRect.bottom + 8}px`
- Align left edge with menu item: `left: ${menuItemRect.left}px`

**Z-Index Hierarchy:**
```
1410 - Rename/Action Popover
1405 - Context Menu (elevated)
1401 - Cloned Card/Trigger
1400 - (reserved for standard popovers)
1300 - Blur Backdrop
```

**Closure Conditions:**
- Click outside popover (on blur backdrop) → Close popover
- Submit action (Enter key or confirm button) → Close on success
- Escape key → Close popover

## Interface Contracts

**Provides:**
- Component: `SpotlightContainer` or `useSpotlight` hook to coordinate state.
- Component: `BlurBackdrop` for the visual effect.
- Pattern: Reusable logic for connecting new popovers to this system.

**Requires:**
- React 18+ (for concurrent features/portals).
- A UI library with Portal support (e.g., Chakra UI, Radix UI, or native `createPortal`).
