---
id: unified-section-headers
alias: Unified Section Headers Implementation
type: walkthrough
is_base: false
version: 1
tags:
  - ui-ux
  - refactoring
  - components
description: Review of the implementation of unified sticky section headers across the application.
complexity: moderate
format: review
---
# Unified Section Headers Implementation

This walkthrough reviews the changes made to implement a unified, sticky header design across the application's main sections (`Tasks`, `Kits`, `Walkthroughs`, `Plans`). The goal was to improve consistency, accessibility, and maximize screen real estate for content.

## Key Changes

### 1. `ToolkitHeader` Enhancement

The `ToolkitHeader` component was significantly enhanced to support a flexible action system and sticky positioning.

**Changes:**
- **Multiple Actions**: Added `leftActions` and `rightActions` props to support arrays of actions.
- **Sticky Positioning**: Added `sticky` prop to enable sticky positioning with backdrop blur.
- **Badges**: Added support for notification badges on action buttons.
- **Ref Forwarding**: Action config now accepts a `ref` to allow positioning popovers (e.g., FilterPanel).

```typescript
// Shared component interface
export interface ToolkitHeaderProps {
    title: string;
    parentName?: string;
    sticky?: boolean; // New prop
    leftActions?: ActionConfig[]; // New prop
    rightActions?: ActionConfig[]; // New prop
    // ...
}
```

### 2. Section Refactoring

All major sections were refactored to use the new `ToolkitHeader` capabilities.

#### `TasksSection`
- Moved the "Filter" button to the `leftActions` slot as an icon.
- "Add Task" remains on the right as an icon.

#### `KitsSection`
- Moved "Filter" and "New Group" buttons to the `leftActions` slot as icons.
- Added a "New Kit" (Plus icon) to the `rightActions` for symmetry and future functionality.

#### `WalkthroughsSection`
- Moved "Filter" and "New Group" buttons to the `leftActions` slot as icons.
- "Add Walkthrough" remains on the right as an icon.

#### `PlansSection`
- Replaced `StandardPageLayout` with `ToolkitHeader`.
- Moved "Filter" to `leftActions`.
- "Create Plan" is on the right.

### 3. `CreateFolderPopover` Improvement

To support the "New Group" button living in the header, `CreateFolderPopover` was updated to support being triggered by an external button (or passed as a `trigger` prop).

**Changes:**
- Made `trigger` prop optional.
- Added `anchorRef` prop for positioning without a trigger.
- Logic update: If trigger is missing, it renders as a controlled popover positioned relative to the anchor or just centered/default (though we primarily use it with state control now).

## Verification Checklist

When reviewing these changes, please verify:
- [ ] **Sticky Behavior**: Scroll down in each section; the header should stick to the top with a blur effect.
- [ ] **Filter Panel**: Clicking the filter icon in the header should open the filter panel correctly positioned.
- [ ] **Action Buttons**: All action buttons (New Group, New Task, etc.) work as expected.
- [ ] **Badges**: Filter badges show the correct count of active filters.
- [ ] **Responsiveness**: The header layout adjusts gracefully on smaller screens (though primarily desktop focused).

## Conclusion

These changes establish a consistent UX pattern for section headers, making the application feel more cohesive and polished. future sections should adopt this `ToolkitHeader` pattern.

### Status
All sections have been successfully refactored to use the new symmetrical `ToolkitHeader` layout.
- `TasksSection`: Filter (Left), Add Task (Right, Icon)
- `KitsSection`: Filter + New Group (Left), New Kit (Right, Icon)
- `WalkthroughsSection`: Filter + New Group (Left), Add Walkthrough (Right, Icon)
- `PlansSection`: Filter (Left), Create Plan (Right, Icon)
