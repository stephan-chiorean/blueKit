---
id: liquid-glass-switcher
alias: Liquid Glass Switcher
type: kit
version: 1
tags:
  - ui-component
  - animation
  - framer-motion
description: A glassmorphic view mode switcher with smooth sliding layout animations using Framer Motion.
is_base: false
---
## End State

After applying this kit, the application will have a reusable `LiquidViewModeSwitcher` component that provides:

1.  **Glassmorphic UI**: A modern, translucent container with backdrop blur and subtle borders, adapting to both light and dark modes.
2.  **Fluid Animations**: A sliding "active state" pill that smoothly transitions between selected options using `framer-motion`'s shared layout animations (`layoutId`).
3.  **Accessible Interaction**: Keyboard-navigable buttons with proper cursor states and hover effects.

**Component Signature:**
```tsx
export interface LiquidViewModeSwitcherProps {
  value: string;
  onChange: (mode: string) => void;
  modes: Array<{ id: string; label: string; icon: React.ElementType }>;
}
```

## Implementation Principles

-   **Shared Layout Animation**: Use `framer-motion`'s `layoutId` prop on the active background element. This allows Framer Motion to automatically animate the layout changes (position and size) when the active item changes, creating the "liquid" effect.
-   **Glassmorphism**: Apply `backdrop-filter: blur()` along with semi-transparent backgrounds and borders. Ensure high contrast for text and icons against the blurred background.
-   **Semantics**: Use standard HTML button elements (or `Box as="button"` in Chakra UI) to ensure accessibility.
-   **Composition**: The component should be data-driven, accepting an array of `modes` to render, making it reusable for any segmented control use case (not just view modes).

### Reference Implementation

```tsx
import { HStack, Box, Icon, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';

export interface ViewModeConfig {
    id: string;
    label: string;
    icon: React.ElementType;
}

export interface LiquidViewModeSwitcherProps {
    value: string;
    onChange: (mode: string) => void;
    modes: ViewModeConfig[];
}

export function LiquidViewModeSwitcher({
    value,
    onChange,
    modes,
}: LiquidViewModeSwitcherProps) {
    return (
        <HStack
            gap={0}
            p={1}
            borderRadius="full"
            css={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px) saturate(180%)',
                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                _dark: {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                },
            }}
        >
            {modes.map((mode) => {
                const isActive = value === mode.id;

                return (
                    <Box
                        key={mode.id}
                        as="button"
                        onClick={() => onChange(mode.id)}
                        position="relative"
                        px={4}
                        py={1.5}
                        borderRadius="full"
                        cursor="pointer"
                        outline="none"
                        color={isActive ? 'text.success' : 'text.muted'}
                        _hover={{
                            color: isActive ? 'text.success' : 'text.primary',
                        }}
                        transition="color 0.2s"
                    >
                        {isActive && (
                            <Box
                                as={motion.div}
                                layoutId="liquid-switcher-active"
                                position="absolute"
                                inset={0}
                                bg="bg.surface"
                                borderRadius="full"
                                boxShadow="sm"
                                initial={false}
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 30,
                                }}
                                css={{
                                    background: 'rgba(255, 255, 255, 0.85)',
                                    backdropFilter: 'blur(8px)',
                                    _dark: {
                                        background: 'rgba(255, 255, 255, 0.15)',
                                    }
                                }}
                            />
                        )}
                        <HStack gap={2} position="relative" zIndex={1}>
                            <Icon boxSize={4}>
                                <mode.icon />
                            </Icon>
                            <Text fontSize="sm" fontWeight="medium">
                                {mode.label}
                            </Text>
                        </HStack>
                    </Box>
                );
            })}
        </HStack>
    );
}

```

## Verification Criteria

After implementation, verify:
-   ✓ **Visuals**: The component appears as a translucent pill with a distinct active state pill inside it.
-   ✓ **Animation**: Clicking a different option causes the active background to slide smoothly to the new position.
-   ✓ **Responsiveness**: The component scales correctly with its container (though usually fixed height).
-   ✓ **Theme Support**: It looks correct in both light and dark modes.

## Interface Contracts

**Provides:**
-   Component: `<LiquidViewModeSwitcher />`

**Requires:**
-   `framer-motion`: For `motion.div` and `layoutId` animations.
-   `@chakra-ui/react`: For layout components (`HStack`, `Box`, `Icon`, `Text`) and styling props.
-   React Icons (optional, but used in example): Any icon component type is supported.
