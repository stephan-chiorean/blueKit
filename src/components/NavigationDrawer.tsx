import { useState, ReactNode } from 'react';
import {
  IconButton,
  Drawer,
  Portal,
  Text,
  CloseButton,
  Box,
  Icon,
  Flex,
  SimpleGrid,
  VStack,
} from '@chakra-ui/react';
import { useColorMode } from '../contexts/ColorModeContext';
import {
  LuMenu,
  LuUsers,
  LuLayoutGrid,
  LuCircleHelp,
  LuSettings,
} from 'react-icons/lu';

interface NavigationMenuProps {
  children?: (props: { isOpen: boolean; onOpen: () => void }) => ReactNode;
}

interface NavCard {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType;
}

const navCards: NavCard[] = [
  {
    id: 'community',
    label: 'Invite your team',
    description: 'Invite your team and unlock collaborative workflows like shared plans, tasks, and notes',
    icon: LuUsers,
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Sponsored and community resources (kits, walkthroughs, skills) you can ingest into vaults and projects',
    icon: LuLayoutGrid,
  },
  {
    id: 'help',
    label: 'Help',
    description: 'Documentation, guides, and support for getting the most out of BlueKit',
    icon: LuCircleHelp,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Configure preferences, integrations, and account options',
    icon: LuSettings,
  },
];

export default function NavigationMenu({ children }: NavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colorMode } = useColorMode();

  // Glass styling to match Header - more transparent
  const drawerBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(20, 20, 25, 0.15)';

  // Card styling
  const cardBg = colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.6)'
    : 'rgba(40, 40, 50, 0.5)';
  const cardBorder = colorMode === 'light'
    ? '1px solid rgba(0, 0, 0, 0.08)'
    : '1px solid rgba(255, 255, 255, 0.1)';
  const cardHoverBg = colorMode === 'light'
    ? 'rgba(59, 130, 246, 0.1)'
    : 'rgba(59, 130, 246, 0.15)';

  const handleCardClick = (cardId: string) => {
    console.log('Navigate to:', cardId);
    // TODO: Implement navigation for each section
    // - community: marketplace/gallery view
    // - vault: personal workspace (same UI as project detail, with Toolkit submenu)
    // - settings: app preferences
    setIsOpen(false);
  };

  return (
    <>
      {/* Render children with menu control props */}
      {children?.({ isOpen, onOpen: () => setIsOpen(true) })}

      {/* Drawer with navigation cards */}
      <Drawer.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} placement="top">
        <Portal>
          <Drawer.Backdrop
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <Drawer.Positioner>
            <Drawer.Content
              style={{
                background: drawerBg,
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderBottom: colorMode === 'light'
                  ? '1px solid rgba(0, 0, 0, 0.08)'
                  : '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <Drawer.Header>
                <Flex align="center" justify="space-between" w="100%">
                  <Text fontWeight="semibold" fontSize="lg">
                    Menu
                  </Text>
                  <Drawer.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Drawer.CloseTrigger>
                </Flex>
              </Drawer.Header>
              <Drawer.Body pb={6}>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap={4}>
                  {navCards.map((card) => (
                    <Box
                      key={card.id}
                      as="button"
                      p={5}
                      borderRadius="xl"
                      cursor="pointer"
                      textAlign="left"
                      transition="all 0.2s ease"
                      onClick={() => handleCardClick(card.id)}
                      style={{
                        background: cardBg,
                        border: cardBorder,
                      }}
                      _hover={{
                        background: cardHoverBg,
                        transform: 'translateY(-2px)',
                        boxShadow: colorMode === 'light'
                          ? '0 8px 24px rgba(0, 0, 0, 0.12)'
                          : '0 8px 24px rgba(0, 0, 0, 0.4)',
                        borderColor: 'primary.400',
                      }}
                      _active={{
                        transform: 'translateY(0)',
                      }}
                    >
                      <VStack align="start" gap={3}>
                        <Box
                          p={3}
                          borderRadius="lg"
                          bg={colorMode === 'light' ? 'primary.50' : 'rgba(59, 130, 246, 0.15)'}
                        >
                          <Icon
                            boxSize={6}
                            color="primary.500"
                          >
                            <card.icon />
                          </Icon>
                        </Box>
                        <Box>
                          <Text
                            fontWeight="semibold"
                            fontSize="md"
                            mb={1}
                          >
                            {card.label}
                          </Text>
                          <Text
                            fontSize="sm"
                            color={colorMode === 'light' ? 'gray.600' : 'gray.400'}
                            lineHeight="1.4"
                          >
                            {card.description}
                          </Text>
                        </Box>
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>
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
      _hover={{ bg: 'primary.hover.bg', opacity: 0.8 }}
      position="absolute"
      top={4}
      right={4}
      zIndex={10}
    >
      <LuMenu />
    </IconButton>
  );
}
