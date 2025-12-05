# Task Card Background Hover Variations

This document captures the different implementations of card hover backgrounds across the application. These variations can be feature-flagged to allow A/B testing or gradual rollout of different hover styles.

## Current Implementations

### 1. Priority-Based Hover (Tasks) - CURRENT

**Location**: `src/components/tasks/TasksTabContent.tsx`

**Implementation**:
```typescript
// Uses priority-based colors that match tag backgrounds
const hoverColors = getPriorityHoverColors(task.priority);

<Card.Root
  _hover={{ borderColor: hoverColors.borderColor, bg: hoverColors.bg }}
>
```

**Colors** (from `src/utils/taskUtils.ts`):
- **Pinned**: `blue.400` border, `blue.100` background
- **High**: `red.400` border, `red.100` background
- **Long Term**: `purple.400` border, `purple.100` background
- **Nit**: `yellow.400` border, `yellow.100` background
- **Standard**: `orange.400` border, `orange.100` background

**Characteristics**:
- Background color matches tag subtle variant background (100 shade)
- Creates seamless blending effect - tags blend into card background on hover
- Border color uses 400 shade for visibility
- Color is determined by task priority

**Visual Effect**: When hovering, the card background matches the tag color, making tags appear to blend into the card.

---

### 2. Primary Color Hover (Kits/Walkthroughs) - ALTERNATIVE

**Location**: `src/components/kits/KitsTabContent.tsx`, `src/components/walkthroughs/WalkthroughsTabContent.tsx`

**Implementation**:
```typescript
<Card.Root
  _hover={{ borderColor: "primary.400", bg: "primary.50" }}
>
```

**Colors**:
- Border: `primary.400`
- Background: `primary.50`

**Characteristics**:
- Consistent hover color across all cards
- Uses primary brand color
- Lighter background (50 shade) for subtle effect
- No variation based on card content

**Visual Effect**: All cards show the same primary color hover effect regardless of content.

---

### 3. Subtle Background Hover (Table Rows) - ALTERNATIVE

**Location**: Various table implementations

**Implementation**:
```typescript
<Table.Row
  _hover={{ bg: "bg.subtle" }}
>
```

**Colors**:
- Background: `bg.subtle` (semantic token, typically gray.100 in light mode)

**Characteristics**:
- Minimal, neutral hover effect
- Uses semantic background token
- No border color change
- Very subtle visual feedback

**Visual Effect**: Minimal hover feedback with neutral gray background.

---

## Feature Flag Implementation Strategy

To feature flag these variations, create a feature flag in `src/contexts/FeatureFlagsContext.tsx`:

```typescript
interface FeatureFlags {
  // ... existing flags
  taskCardHoverStyle: 'priority-based' | 'primary-color' | 'subtle';
}
```

Then update the card implementation:

```typescript
const { taskCardHoverStyle } = useFeatureFlags();

const getHoverStyle = () => {
  switch (taskCardHoverStyle) {
    case 'priority-based':
      return { borderColor: hoverColors.borderColor, bg: hoverColors.bg };
    case 'primary-color':
      return { borderColor: "primary.400", bg: "primary.50" };
    case 'subtle':
      return { bg: "bg.subtle" };
    default:
      return { borderColor: hoverColors.borderColor, bg: hoverColors.bg };
  }
};

<Card.Root
  _hover={getHoverStyle()}
>
```

## Comparison Matrix

| Style | Visual Impact | Color Variation | Tag Blending | Use Case |
|-------|--------------|-----------------|--------------|----------|
| Priority-Based | High | Yes (5 colors) | Yes | Tasks with priority indicators |
| Primary Color | Medium | No (1 color) | No | Consistent brand experience |
| Subtle | Low | No (neutral) | No | Minimal, clean interface |

## Recommendations

1. **Priority-Based** (Current): Best for tasks where priority is important and visual distinction helps users quickly identify task importance.

2. **Primary Color**: Best for consistent brand experience across all card types, especially when content doesn't have inherent categorization.

3. **Subtle**: Best for minimal interfaces where hover feedback should be unobtrusive.

## Migration Path

To migrate from one style to another:

1. Add feature flag to `FeatureFlagsContext.tsx`
2. Update card component to use feature flag
3. Test each variation with users
4. Gradually roll out preferred style
5. Remove feature flag once style is finalized

