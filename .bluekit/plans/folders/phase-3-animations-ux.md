---
id: folders-phase-3-animations-ux
alias: "Phase 3: Animations & Beautiful UX"
type: plan
tags: [frontend, animations, framer-motion, ux]
description: "Add framer-motion animations to folder cards matching PlansTabContent quality"
status: pending
---

# Phase 3: Animations & Beautiful UX

## Overview
Transform folder cards with smooth animations matching the quality and feel of `PlansTabContent`. Add staggered entrance animations, hover effects, and layout transitions.

## Prerequisites
- ✅ Phase 1 complete (backend config)
- ✅ Phase 2 complete (frontend creation UI)

## Goals
- ✅ Match animation quality of PlansTabContent
- ✅ Staggered card entrance (delay based on index)
- ✅ Smooth hover effects (lift + shadow)
- ✅ Layout transitions when filtering
- ✅ Glass morphism styling
- ✅ Consistent with Plans aesthetic

## Reference Implementation
`src/components/plans/PlansTabContent.tsx` (lines 116-199):
- Uses `framer-motion` with `motion.create(Card.Root)`
- Entrance: `opacity: 0 → 1`, `y: 20 → 0`, `scale: 0.95 → 1`
- Stagger delay: `index * 0.05`
- Easing: `[0.4, 0, 0.2, 1]` (cubic bezier)
- Hover: `translateY(-4px)` + shadow increase

## Files to Modify

### 1. Add Dependencies

**package.json** - verify framer-motion is installed:
```json
{
  "dependencies": {
    "framer-motion": "^11.x.x"  // Should already exist
  }
}
```

### 2. `src/components/shared/SimpleFolderCard.tsx`

**Current:** Static card with hover state

**New:** Animated motion card with glass morphism

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@chakra-ui/react';

const MotionCard = motion.create(Card.Root);

interface SimpleFolderCardProps {
  folder: ArtifactFolder;
  artifacts: ArtifactFile[];
  onOpenFolder: () => void;
  onRenameFolder: (newName: string) => Promise<void>;
  onDeleteFolder: () => void;
  index?: number;  // NEW: for stagger delay
}

export function SimpleFolderCard({
  folder,
  artifacts,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  index = 0,  // Default to 0 if not provided
}: SimpleFolderCardProps) {
  const displayName = folder.config?.name || folder.name;
  const description = folder.config?.description;
  const tags = folder.config?.tags || [];

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,  // Stagger based on position
        ease: [0.4, 0, 0.2, 1]
      }}
      borderWidth="1px"
      borderRadius="20px"
      cursor="pointer"
      onClick={onOpenFolder}
      css={{
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderColor: 'rgba(255, 255, 255, 0.25)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
        _dark: {
          background: 'rgba(20, 20, 25, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        },
        _hover: {
          transform: 'translateY(-4px)',
          boxShadow: '0 16px 48px 0 rgba(31, 38, 135, 0.2)',
          borderColor: 'var(--chakra-colors-primary-400)',
          zIndex: 10,
        },
      }}
    >
      <CardHeader>
        {/* Folder icon + name */}
        <HStack gap={2}>
          <Icon boxSize={5} color="primary.500">
            <LuFolder />
          </Icon>
          <Heading size="sm">{displayName}</Heading>
        </HStack>

        {/* Description (if exists) */}
        {description && (
          <Text fontSize="xs" color="text.secondary" mt={2} lineClamp={2}>
            {description}
          </Text>
        )}
      </CardHeader>

      <CardBody>
        {/* Tags (if exist) */}
        {tags.length > 0 && (
          <Flex gap={1} wrap="wrap" mb={2}>
            {tags.slice(0, 3).map(tag => (
              <Badge key={tag} size="xs" variant="subtle">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge size="xs" variant="outline">
                +{tags.length - 3}
              </Badge>
            )}
          </Flex>
        )}

        {/* Artifact count */}
        <Text fontSize="xs" color="text.tertiary">
          {artifacts.length} {artifacts.length === 1 ? 'item' : 'items'}
        </Text>
      </CardBody>

      {/* Context menu trigger (existing) */}
      {/* ... keep existing popover menu ... */}
    </MotionCard>
  );
}
```

### 3. `src/components/kits/KitsTabContent.tsx`

**Wrap folder grid with AnimatePresence:**

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// Around line 364-383:
{viewMode === 'card' ? (
  <AnimatePresence mode="popLayout">
    <SimpleGrid
      columns={{ base: 3, md: 4, lg: 5, xl: 6 }}
      gap={4}
      p={1}
      width="100%"
      maxW="100%"
      overflow="visible"
    >
      {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map((folder, index) => (
        <SimpleFolderCard
          key={folder.path}
          folder={folder}
          artifacts={getFolderArtifacts(folder.path)}
          onOpenFolder={() => setViewingFolder(folder)}
          onRenameFolder={async (newName) => handleRenameFolder(folder, newName)}
          onDeleteFolder={() => handleDeleteFolder(folder)}
          index={index}  // NEW: pass index for stagger
        />
      ))}
    </SimpleGrid>
  </AnimatePresence>
) : (
  // ... blueprints view ...
)}
```

**Similarly for Kits grid (line 489-514):**
```tsx
{viewMode === 'card' ? (
  <AnimatePresence mode="popLayout">
    <SimpleGrid
      columns={{ base: 1, md: 2, lg: 3 }}
      gap={4}
      p={1}
      width="100%"
      maxW="100%"
      overflow="visible"
    >
      {rootKits.map((kit, index) => (
        <ResourceCard
          key={kit.path}
          resource={kit}
          isSelected={isSelected(kit.path)}
          onToggle={() => handleKitToggle(kit)}
          onClick={() => handleViewKit(kit)}
          onContextMenu={(e) => handleContextMenu(e, kit)}
          resourceType="kit"
          index={index}  // NEW: pass to ResourceCard too
        />
      ))}
    </SimpleGrid>
  </AnimatePresence>
) : null}
```

### 4. `src/components/walkthroughs/WalkthroughsTabContent.tsx`

**Same changes as KitsTabContent:**
- Import `AnimatePresence` from framer-motion
- Wrap folder grid (line 428-444)
- Wrap walkthroughs grid (line 473-484)
- Pass `index` prop to cards

### 5. `src/components/shared/ResourceCard.tsx`

**Add motion animation (if not already animated):**
```tsx
import { motion } from 'framer-motion';

const MotionCard = motion.create(Card.Root);

interface ResourceCardProps {
  // ... existing props
  index?: number;
}

export function ResourceCard({ index = 0, ...props }: ResourceCardProps) {
  return (
    <MotionCard
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1]
      }}
      // ... rest of card props
    >
      {/* ... existing content */}
    </MotionCard>
  );
}
```

## Animation Specifications

### Entrance Animation
```typescript
initial={{ opacity: 0, y: 20, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
transition={{
  duration: 0.3,      // 300ms
  delay: index * 0.05, // 50ms stagger per card
  ease: [0.4, 0, 0.2, 1]  // Custom cubic bezier (smooth ease)
}
```

### Exit Animation
```typescript
exit={{ opacity: 0, y: -10, scale: 0.95 }}
```

### Hover Transform
```css
_hover: {
  transform: 'translateY(-4px)',
  boxShadow: '0 16px 48px 0 rgba(31, 38, 135, 0.2)',
  borderColor: 'var(--chakra-colors-primary-400)',
  zIndex: 10,  // Lift above siblings
}
```

## Glass Morphism Styling

### Light Mode
```css
background: 'rgba(255, 255, 255, 0.6)',
backdropFilter: 'blur(30px) saturate(180%)',
WebkitBackdropFilter: 'blur(30px) saturate(180%)',
borderColor: 'rgba(255, 255, 255, 0.25)',
boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
```

### Dark Mode
```css
_dark: {
  background: 'rgba(20, 20, 25, 0.7)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
}
```

## Performance Considerations

### AnimatePresence Mode
Use `mode="popLayout"` for smooth grid reordering:
```tsx
<AnimatePresence mode="popLayout">
  {/* Grid content */}
</AnimatePresence>
```

### Key Stability
Always use stable keys (folder.path, kit.path) to prevent unnecessary re-mounts

### Stagger Limits
With 50ms stagger and max ~20 folders:
- First card: 0ms delay
- Last card: ~1000ms delay (acceptable)
- Total animation time: ~1.3s (300ms duration + 1000ms stagger)

## Testing Checklist

### Animation Quality
- [ ] Folders fade in smoothly on first load
- [ ] Stagger effect is noticeable but not sluggish
- [ ] Hover lift is smooth (no jank)
- [ ] Cards settle without bounce
- [ ] Dark mode glass effect looks polished

### Layout Transitions
- [ ] Adding folder animates in smoothly
- [ ] Deleting folder animates out smoothly
- [ ] Filtering triggers smooth layout shift
- [ ] Clearing filters restores layout smoothly

### Edge Cases
- [ ] 1 folder: animates in (no stagger needed)
- [ ] 100 folders: stagger doesn't feel too slow
- [ ] Rapid filtering: animations don't queue up
- [ ] Slow devices: graceful degradation (prefer-reduced-motion)

### Cross-Component Consistency
- [ ] Folder cards match Plans card quality
- [ ] Kit cards have same animation timing
- [ ] Walkthrough cards have same animation timing
- [ ] All use same glass morphism values

## Accessibility

### Reduced Motion
Respect `prefers-reduced-motion`:
```tsx
const prefersReducedMotion = useReducedMotion();

<MotionCard
  initial={prefersReducedMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
  animate={prefersReducedMotion ? false : { opacity: 1, y: 0, scale: 1 }}
  // ...
>
```

### Focus States
Ensure keyboard navigation still works:
```css
_focusVisible: {
  outline: '2px solid',
  outlineColor: 'primary.500',
  outlineOffset: '2px',
}
```

## Acceptance Criteria
- ✅ Folder cards have smooth entrance animations
- ✅ Stagger effect matches Plans quality (50ms per card)
- ✅ Hover effects lift cards with shadow increase
- ✅ Glass morphism styling matches Plans
- ✅ AnimatePresence handles layout changes smoothly
- ✅ Kit and Walkthrough cards also animated
- ✅ Reduced motion preference respected
- ✅ Performance: 60fps on mid-range hardware

## Dependencies
**Before:** Phase 2 (frontend creation UI)
**After:** Phase 4 (rename to Groups)

## Design Notes
The glass morphism effect requires backdrop content. Test against:
- Light backgrounds
- Dark backgrounds
- Gradient backgrounds (if app has them)

Ensure sufficient contrast for text on glass in all modes.
