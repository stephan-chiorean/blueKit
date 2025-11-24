import { useState, ReactNode } from 'react';
import {
  Heading,
  IconButton,
  Drawer,
  Portal,
  VStack,
  Text,
  CloseButton,
} from '@chakra-ui/react';
import { LuMenu } from 'react-icons/lu';

interface NavigationMenuProps {
  children?: (props: { isOpen: boolean; onOpen: () => void }) => ReactNode;
}

export default function NavigationMenu({ children }: NavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Render children with menu control props */}
      {children?.({ isOpen, onOpen: () => setIsOpen(true) })}

      {/* Drawer with navigation menu */}
      <Drawer.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} placement="end">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <VStack align="flex-start" gap={2} mb={4}>
                  <Heading size="2xl">
                    <Text as="span" color="primary.500">
                      blue
                    </Text>
                    <Text as="span">Kit</Text>
                  </Heading>
                </VStack>
                <Drawer.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                <VStack align="stretch" gap={2}>
                  {/* Simple icon label menu items can be added here */}
                  <Text color="fg.muted" fontSize="sm">
                    Navigation menu items coming soon...
                  </Text>
                </VStack>
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  );
}

// Export menu button component for convenience
export function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton
      variant="ghost"
      size="lg"
      aria-label="Open menu"
      onClick={onClick}
      color="primary.500"
      _hover={{ bg: 'primary.50', opacity: 0.8 }}
      position="absolute"
      top={4}
      right={4}
      zIndex={10}
    >
      <LuMenu />
    </IconButton>
  );
}
