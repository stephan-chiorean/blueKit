---
id: selection-context-refactor
alias: Selection Context Refactor & UI Polish
type: walkthrough
is_base: false
version: 1
tags:
  - refactor
  - performance
  - ui
description: Removed global SelectionContext, implemented local selection with sticky footers, and removed document transition animations.
complexity: moderate
format: review
---
# Selection Context Refactor & UI Polish

This walkthrough covers the refactoring of `PlansSection`, `KitsSection`, and `WalkthroughsSection` to remove dependencies on the global `SelectionContext`. It also details the implementation of inline sticky footers for bulk actions and the removal of document transition animations for improved performance.

## 1. Local Selection State

We replaced the global `SelectionContext` with local state management in each section component. This isolates selection logic and prevents unnecessary re-renders across the application.

### Implementation Pattern

In each section (`PlansSection`, `KitsSection`, `WalkthroughsSection`), we introduced:

```typescript
// Local selection state
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// Toggle handler
const handleToggle = (item: ArtifactFile) => {
  const path = item.path;
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
};
```

## 2. Inline Sticky Footers

Instead of a global `ResourceSelectionBar`, each section now has its own inline, sticky footer that appears when items are selected. This provides immediate context for actions like "Delete", "Publish", or "Add to Project".

```typescript
// Footer implementation (example from KitsSection)
<Box
  position="sticky"
  bottom={0}
  width="100%"
  display="grid"
  css={{
    gridTemplateRows: selectedIds.size > 0 ? "1fr" : "0fr",
    transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  }}
>
  {/* Footer Content */}
</Box>
```

Refactored components:
- `PlansSection.tsx`
- `KitsSection.tsx`
- `WalkthroughsSection.tsx`

## 3. Removing Document Transitions

To enhance perceived performance and responsiveness, we removed `framer-motion` transition animations from the document view. Switching between documents is now instant.

**Changes:**
- Removed `AnimatePresence`, `MotionBox`, and `MotionFlex` from `PlanDocViewPage.tsx`.
- Replaced animated components with standard Chakra UI `Box` and `Flex` components.
