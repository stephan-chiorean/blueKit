# Blur Complexity

## Backdrop-Filter Layering Issue

When two elements both have `backdrop-filter: blur()`, they **don't blend together**. Each creates its own independent blur layer, causing visual artifacts where the overlapping area appears different (more opaque with a visible rectangular border).

### Example

```tsx
// Header.tsx
<Box style={{ backdropFilter: "blur(12px)" }}>...</Box>

// Child component (e.g., PlanOverviewPanel.tsx)
<Box css={{ backdropFilter: 'blur(12px)' }}>  // ❌ Creates visual conflict
  <Button>Back</Button>
</Box>
```

The child's back button area will "stick out" with a visibly different background.

### Solution

**Remove `backdrop-filter` from nested elements** that sit inside a parent already applying blur:

```tsx
<Box>  // ✅ No backdrop-filter, inherits parent's blur
  <Button>Back</Button>
</Box>
```

### Key Takeaway

Only apply `backdrop-filter: blur()` at **one level** of the component hierarchy. If a parent (like `Header.tsx`) already has blur, children should not add their own blur layer.
