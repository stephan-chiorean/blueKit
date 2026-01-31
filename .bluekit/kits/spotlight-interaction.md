---
id: spotlight-interaction-kit
alias: Spotlight Interaction Kit
type: kit
tags:
  - ui-pattern
  - react
  - interaction
description: A complete implementation of the Spotlight Popover interaction, featuring a backdrop blur and portal-based triggering.
---

# Spotlight Interaction Kit

This kit provides the code for implementing a "Spotlight" interaction where:
1. Triggering an action dims/blurs the rest of the application.
2. The trigger element (or a clone of it) remains "spotlighted" above the blur.
3. A popover appears next to the spotlighted element.

## Components

### 1. SpotlightBackdrop.tsx

This component renders the full-screen blur overlay.

```tsx
import { Box, Portal } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

interface SpotlightBackdropProps {
    isOpen: boolean;
    onClose?: () => void;
    zIndex?: number;
}

const MotionBox = motion.create(Box);

export default function SpotlightBackdrop({ isOpen, onClose, zIndex = 1300 }: SpotlightBackdropProps) {
    const { colorMode } = useColorMode();

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <MotionBox
                        position="fixed"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        zIndex={zIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        css={{
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            backgroundColor: colorMode === 'light'
                                ? 'rgba(255, 255, 255, 0.4)'
                                : 'rgba(0, 0, 0, 0.4)',
                        }}
                    />
                )}
            </AnimatePresence>
        </Portal>
    );
}
```

### 2. Spotlight Popover Implementation

Here is the pattern for the Popover itself, which clones the trigger button into a Portal to place it above the backdrop.

```tsx
import { useState, useEffect } from 'react';
import { Box, Portal, IconButton, Icon } from '@chakra-ui/react'; // Adjust imports as needed
import { motion, AnimatePresence } from 'framer-motion';
import SpotlightBackdrop from './SpotlightBackdrop';

// ... other imports

const MotionBox = motion.create(Box);

export default function SpotlightPopover({
    isOpen,
    onClose,
    triggerRect, // Pass the bounding rect of the original trigger button
    children
}: any) {
    // ... hooks

    if (!isOpen || !triggerRect) return null;

    return (
        <>
            {/* The Blur Backdrop */}
            <SpotlightBackdrop isOpen={isOpen} onClose={onClose} zIndex={1300} />

            {/* Cloned Trigger (Spotlighted above blur) */}
            <Portal>
                <Box
                    position="absolute"
                    top={triggerRect.top}
                    left={triggerRect.left}
                    width={triggerRect.width}
                    height={triggerRect.height}
                    zIndex={1401} // Higher than backdrop (1300)
                    pointerEvents="none"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    {/* Render a visual clone of your trigger button here */}
                    {/* Example: */}
                    <IconButton
                        aria-label="Close spotlight"
                        size="xs"
                        variant="ghost"
                        pointerEvents="auto"
                        onClick={onClose}
                        // Add styles to match original trigger
                    >
                        <Icon>
                            {/* Icon */}
                        </Icon>
                    </IconButton>
                </Box>
            </Portal>

            {/* Popover Content */}
            <Portal>
                <AnimatePresence mode="wait">
                    {isOpen && (
                        <MotionBox
                            position="absolute"
                            top={triggerRect.bottom + 12}
                            left={triggerRect.left}
                            zIndex={1410} // Higher than trigger
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            // ... styles for glass effect
                        >
                           {children}
                        </MotionBox>
                    )}
                </AnimatePresence>
            </Portal>
        </>
    );
}
```

## Usage

1. In the parent component, capture the `DOMRect` of the trigger button when it is clicked.
2. Pass `isOpen={true}` and the `triggerRect` to the Spotlight Component.

```tsx
  const [showPopover, setShowPopover] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  const handleOpen = (e: React.MouseEvent) => {
      setButtonRect(e.currentTarget.getBoundingClientRect());
      setShowPopover(true);
  };

  return (
      <>
          <Button onClick={handleOpen}>Open Spotlight</Button>
          <SpotlightPopover 
              isOpen={showPopover} 
              onClose={() => setShowPopover(false)} 
              triggerRect={buttonRect} 
          />
      </>
  )
```
