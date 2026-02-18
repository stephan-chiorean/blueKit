---
id: generic-glass-modal
alias: Generic Glass Modal
type: kit
is_base: false
version: 1
tags:
  - chakra-ui
  - modal
  - reusable
description: A reusable glassmorphism modal foundation that matches the Add Task and Add Walkthrough dialog style with configurable header, accent palette, body slot, and footer actions.
---
# Generic Glass Modal

## End State

After applying this kit, the application will have:

**Reusable modal foundation:**
- A single generic modal component that wraps Chakra `Dialog` primitives and provides the same backdrop blur, frosted surface, rounded corners, and motion used in current create flows.
- Standardized open/close behavior with optional `isBusy` guarding to prevent accidental close while submitting.
- Shared enter/exit animations for backdrop and modal shell via framer-motion.

**Configurable header system:**
- Header slot with icon container, title, subtitle, and close button.
- Accent palette input (for example `primary`, `orange`, `blue`) that styles icon badge and form focus rings consistently.
- Optional custom header rendering for advanced modal variants.

**Composable body and footer:**
- Body accepts arbitrary form/content children.
- Footer supports a standardized cancel/confirm action pattern with optional custom actions.
- Consistent spacing, typography, and button sizing across all create/edit modals.

**Project integration target:**
- Existing create flows in `TasksSection` and `WalkthroughsSection` can consume this modal foundation without changing business logic.
- Style parity with `CreateTaskDialog` and `CreateWalkthroughDialog` remains intact while removing duplicated modal shell styling.

## Implementation Principles

- Keep modal shell/chrome generic; keep form and resource logic in feature-level components.
- Preserve existing visual tokens from create dialogs (12px backdrop blur, 24px radius, translucent shell, layered shadow).
- Support accent-driven theming without hard-coding feature-specific copy or icons.
- Provide safe accessibility defaults (focus trap, Escape behavior, close button label, keyboard reachability).
- Respect reduced-motion preferences while preserving the same visual hierarchy.
- Keep the component API small and predictable: open state, close callback, header config, action config, and children slots.

## Verification Criteria

After generation, verify:
- ✓ Generic modal renders with the same glass backdrop/shell style as Add Task and Add Walkthrough dialogs.
- ✓ Header supports configurable icon, title, subtitle, and accent palette.
- ✓ Body and footer slots accept custom content and actions without layout regressions.
- ✓ Close behavior works via close button, backdrop click, and Escape (unless explicitly disabled or busy).
- ✓ Busy/submitting state prevents accidental close and disables destructive actions.
- ✓ Migrating both create dialogs to this shared modal reduces duplicated shell styling while preserving UX.

## Interface Contracts

**Provides:**
- `GenericModal` component with reusable shell visuals and animation.
- Header configuration type (icon/title/subtitle/accent).
- Footer/action configuration type for primary and secondary actions.
- Optional `isBusy`/`preventClose` behavior for long-running submissions.

**Requires:**
- React and Chakra UI dialog primitives.
- framer-motion for motion parity with existing create dialogs.
- Existing app theme tokens (`text.*`, `border.*`, and Chakra color palettes).

**Compatible With:**
- `src/views/project/sections/TasksSection.tsx`
- `src/views/project/sections/WalkthroughsSection.tsx`
- `src/features/tasks/components/CreateTaskDialog.tsx`
- `src/features/walkthroughs/components/CreateWalkthroughDialog.tsx`

## Design Reference

- Trigger points:
  - `src/views/project/sections/TasksSection.tsx`
  - `src/views/project/sections/WalkthroughsSection.tsx`
- Visual source components:
  - `src/features/tasks/components/CreateTaskDialog.tsx`
  - `src/features/walkthroughs/components/CreateWalkthroughDialog.tsx`

## Elegant Content Patterns

To achieve the premium "Project Switcher" aesthetic, use these patterns within the modal body:

**1. Subtle Search Input**
Instead of the default bordered input, use a flat, transparent-bg input that blends into the glass.

```tsx
<Box position="relative" px={6} pb={4}>
  <Input
    variant="subtle"
    placeholder="Search..."
    pl={10}
    size="lg"
    fontSize="sm"
    css={{
      borderRadius: '12px',
      bg: 'rgba(0,0,0,0.03)',
      _dark: { bg: 'rgba(255,255,255,0.05)' },
      border: 'none',
      _focus: {
        bg: 'transparent',
        boxShadow: 'none', // Critical for "clean" look
        outline: 'none',
      },
    }}
  />
  <Icon position="absolute" left={9} top="50%" transform="translateY(-50%)" color="text.secondary">
    <LuSearch />
  </Icon>
</Box>
```

**2. Faded Scroll Mask**
For scrollable lists, use a CSS mask to fade out the bottom edge softly, rather than a hard cutoff.

```tsx
<VStack
  overflowY="auto"
  css={{
    maskImage: 'linear-gradient(to bottom, black, black calc(100% - 16px), transparent)',
    // Custom thin scrollbar
    '&::-webkit-scrollbar': { width: '4px' },
    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(0,0,0,0.1)',
      borderRadius: 'full',
    },
  }}
>
  {/* List items */}
</VStack>
```

**3. Interactive List Items**
List items should be transparent by default and reveal their background + actions on hover.

```tsx
<HStack
  p={3}
  borderRadius="12px"
  cursor="pointer"
  position="relative" // For positioning hover actions
  _hover={{
    bg: 'rgba(0,0,0,0.03)',
    _dark: { bg: 'rgba(255,255,255,0.03)' },
    '& .action-buttons': { opacity: 1, pointerEvents: 'auto' } // Reveal actions
  }}
>
  <Icon boxSize={4} color="text.secondary" as={LuFolder} />
  <VStack gap={0} align="start">
    <Text fontSize="sm" fontWeight="medium">Item Title</Text>
    <Text fontSize="xs" color="text.muted">Item Subtitle</Text>
  </VStack>

  {/* Revealable Actions */}
  <HStack className="action-buttons" opacity={0} transition="opacity 0.2s">
    <IconButton size="xs" variant="ghost" icon={<LuEdit />} />
  </HStack>
</HStack>
```
