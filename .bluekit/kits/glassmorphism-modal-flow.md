---
id: glassmorphism-modal-flow
alias: Glassmorphism Modal Flow
type: kit
is_base: false
version: 1
tags:
  - ui
  - modal
  - glassmorphism
description: A beautiful glassmorphism modal component with vibrant colors, backdrop blur effects, smooth animations, and multi-view navigation for displaying detailed content with selection capabilities
---
# Glassmorphism Modal Flow Kit

## End State

After applying this kit, the application will have:

**Modal Component:**
- Full-screen modal dialog with glassmorphism design (frosted glass effect)
- Backdrop with blur and saturation effects that dims background content
- Modal content container with translucent background, border, and shadow
- Smooth enter/exit animations using scale and opacity transitions
- Dynamic color mode support (adapts to light/dark themes)

**Visual Design System:**
- Backdrop: Semi-transparent overlay with `backdrop-filter: blur(12px) saturate(150%)` and `-webkit-backdrop-filter` for cross-browser support
- Content background: Translucent white/black with `rgba()` values that adapt to color mode
  - Light mode: `rgba(255, 255, 255, 0.25)` background, `rgba(0, 0, 0, 0.08)` border
  - Dark mode: `rgba(255, 255, 255, 0.08)` background, `rgba(255, 255, 255, 0.15)` border
- Shadows: Layered box shadows that enhance depth perception
  - Light mode: `0 4px 16px 0 rgba(0, 0, 0, 0.06)`
  - Dark mode: `0 8px 32px 0 rgba(0, 0, 0, 0.4)`
- Border radius: 16px for modern, rounded appearance
- Z-index layering: Backdrop at 1400, content above backdrop

**Multi-View Navigation:**
- Two distinct views: picker view and preview view
- Automatic view routing: Single item goes directly to preview, multiple items show picker first
- Breadcrumb navigation in header showing current context
- Back button appears when navigating from picker to preview (hidden for single-item flows)
- Smooth transitions between views without modal re-mounting

**Interactive Elements:**
- Glassmorphism buttons with translucent backgrounds and blur effects
- Selected state styling with vibrant primary color highlights
  - Selected: `rgba(59, 130, 246, 0.15)` background with primary color borders and shadows
  - Unselected: Neutral translucent backgrounds
- Hover states that enhance glassmorphism effect
- Action bars that appear when items are selected
- Checkboxes and selection controls with glassmorphism styling

**Animation System:**
- Backdrop: Fade in/out with 0.2s duration
- Content: Scale from 0.95 to 1.0 with opacity fade, 0.2s duration
- Exit animations: Reverse of enter animations
- Uses AnimatePresence for smooth mount/unmount transitions
- All animations respect user preferences (reduced motion)

**Content Display:**
- Preview view with markdown rendering support
- Loading states with spinners and glassmorphism containers
- Front matter parsing for metadata extraction
- Rich typography with text shadows for depth
- Tag display with vibrant color palettes

**Selection System:**
- Multi-select capability with visual feedback
- Selection state persists across view changes
- Action bar appears when selections are made
- Bulk operations supported through selection state

## Implementation Principles

- Use glassmorphism design patterns consistently across all modal elements
- Implement backdrop blur using both `backdrop-filter` and `-webkit-backdrop-filter` for cross-browser compatibility
- Calculate color values dynamically based on color mode (light/dark) using theme context
- Use rgba() color values with low opacity (0.08-0.25) for translucent effects
- Apply saturation enhancement (150-180%) to backdrop filters for vibrant appearance
- Layer multiple visual effects: background opacity, border, shadow, and blur for depth
- Implement smooth animations with 0.2s duration for enter/exit transitions
- Use scale transforms (0.95 to 1.0) combined with opacity for natural-feeling animations
- Support reduced motion preferences for accessibility
- Maintain consistent z-index hierarchy: backdrop < content < overlays
- Apply glassmorphism styling to all interactive elements (buttons, inputs, cards)
- Use vibrant primary colors for selected states and highlights
- Ensure text remains readable with appropriate contrast ratios over translucent backgrounds
- Implement view state management that handles single vs. multiple item scenarios
- Provide breadcrumb navigation that reflects current view context
- Support keyboard navigation and focus management
- Handle loading states gracefully with glassmorphism loading indicators

## Verification Criteria

After generation, verify:
- ✓ Modal opens with smooth scale and fade animation
- ✓ Backdrop displays blur effect (12px blur, 150% saturation) that dims background
- ✓ Modal content has translucent background with visible blur effect (30px blur, 180% saturation)
- ✓ Colors adapt correctly to light and dark color modes
- ✓ Single-item flows skip picker view and go directly to preview
- ✓ Multiple-item flows show picker view first, then navigate to preview on selection
- ✓ Breadcrumb navigation updates correctly when switching views
- ✓ Back button appears only when navigating from picker to preview (not for single items)
- ✓ Selected items display with vibrant primary color highlights and glassmorphism effects
- ✓ Action bar appears when items are selected
- ✓ All buttons and interactive elements have glassmorphism styling
- ✓ Exit animation reverses enter animation smoothly
- ✓ Modal closes when backdrop is clicked or close button is pressed
- ✓ Text remains readable with proper contrast over translucent backgrounds
- ✓ Loading states display with glassmorphism spinners
- ✓ Markdown content renders correctly in preview view
- ✓ Keyboard navigation works (Escape to close, Tab for focus)
- ✓ Reduced motion preferences are respected

## Interface Contracts

**Provides:**
- Modal component with props: `isOpen`, `onClose`, `catalogWithVariations`, `onFetchVariationContent`, `selectedVariations`, `onVariationToggle`, `projects`, `onBulkPull`, `bulkPulling`, `initialVariation?`
- View state management: `CatalogModalView` type ('variations-picker' | 'variation-preview')
- Selection interface: `SelectedVariation` type with variation and catalog
- Glassmorphism styling utilities that calculate colors based on color mode
- Animation configuration for enter/exit transitions

**Requires:**
- UI framework: React with component library supporting Dialog/Modal primitives (Chakra UI, Radix UI, etc.)
- Animation library: framer-motion or equivalent for smooth transitions
- Color mode context: Theme provider that exposes current color mode (light/dark)
- Markdown rendering: react-markdown or equivalent for content preview
- Icon library: React icons for UI elements (Lucide, Heroicons, etc.)

**Compatible With:**
- Design System Kits: Extends existing color palette and theme tokens
- Selection Management: Works with multi-select state management systems
- Content Display: Integrates with markdown rendering and front matter parsing
- Navigation Systems: Complements breadcrumb and navigation patterns
- Action Bar Components: Works with floating action bars for bulk operations
