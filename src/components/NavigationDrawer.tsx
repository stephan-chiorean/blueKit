import { useState, ReactNode } from 'react';
import {
  IconButton,
  Drawer,
  Portal,
  VStack,
  Text,
  CloseButton,
  Collapsible,
  HStack,
  Button,
  Separator,
  Box,
  Icon,
  Flex,
  NativeSelect,
  Switch,
} from '@chakra-ui/react';
import { 
  LuMenu, 
  LuChevronRight, 
  LuUsers, 
  LuFolderOpen, 
  LuFileText, 
  LuBookOpen,
  LuWrench,
  LuNotebook,
  LuPlug,
  LuBriefcase,
  LuSettings,
  LuMoon,
  LuSun,
  LuArchive,
} from 'react-icons/lu';
import {FaBucket} from "react-icons/fa6";
import { FaMoon, FaSun } from "react-icons/fa";
import { useColorMode } from '../contexts/ColorModeContext';

interface NavigationMenuProps {
  children?: (props: { isOpen: boolean; onOpen: () => void }) => ReactNode;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  children?: MenuItem[];
  onClick?: () => void;
}

const menuItems: MenuItem[] = [
  {
    id: 'community',
    label: 'Community',
    icon: LuUsers,
    children: [
      { id: 'projects', label: 'Projects', icon: LuFolderOpen },
      { id: 'walkthroughs', label: 'Walkthroughs', icon: LuBookOpen },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: LuWrench,
    children: [
      { id: 'bucket', label: 'Bucket', icon: FaBucket },
      { id: 'notebook', label: 'Notebook', icon: LuNotebook },
      { id: 'mcp', label: 'MCP', icon: LuPlug },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: LuBriefcase,
    children: [
      { id: 'settings', label: 'Settings', icon: LuSettings },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: LuArchive,
  },
];

export default function NavigationMenu({ children }: NavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { colorMode, toggleColorMode } = useColorMode();
  const [selectedWorkspace, setSelectedWorkspace] = useState('workspace-1');

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.children) {
      // Toggle expansion handled by Collapsible
      return;
    } else {
      // Handle navigation
      console.log('Navigate to:', item.id);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Render children with menu control props */}
      {children?.({ isOpen, onOpen: () => setIsOpen(true) })}

      {/* Drawer with navigation menu */}
      <Drawer.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} placement="start">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Flex align="center" justify="space-between" w="100%">
                  <Text fontWeight="semibold" fontSize="md">
                    Navigation
                  </Text>
                  <Drawer.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Drawer.CloseTrigger>
                </Flex>
              </Drawer.Header>
              <Drawer.Body>
                <VStack align="stretch" gap={1}>
                  {/* Workspace Selector */}
                  <Box mb={2}>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={selectedWorkspace}
                        onChange={(e) => setSelectedWorkspace(e.currentTarget.value)}
                      >
                        <option value="workspace-1">Workspace 1</option>
                        <option value="workspace-2">Workspace 2</option>
                        <option value="workspace-3">Workspace 3</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Box>

                  <Separator mb={2} />

                  {/* Color Mode Toggle */}
                  <Box mb={2}>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="sm">
                        {colorMode === 'light' ? 'Dark Mode' : 'Light Mode'}
                      </Text>
                      <Switch.Root
                        colorPalette="blue"
                        size="lg"
                        checked={colorMode === 'dark'}
                        onCheckedChange={(e) => {
                          if (e.checked && colorMode === 'light') {
                            toggleColorMode();
                          } else if (!e.checked && colorMode === 'dark') {
                            toggleColorMode();
                          }
                        }}
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                          <Switch.Indicator fallback={<Icon as={FaSun} color="yellow.400" />}>
                            <Icon as={FaMoon} color="gray.400" />
                          </Switch.Indicator>
                        </Switch.Control>
                      </Switch.Root>
                    </HStack>
                  </Box>

                  <Separator mb={2} />

                  {/* Menu Items */}
                  {menuItems.map((item) => (
                    <Box key={item.id}>
                      <Collapsible.Root
                        open={expandedItems.has(item.id)}
                        onOpenChange={(e) => {
                          if (e.open) {
                            setExpandedItems((prev) => new Set(prev).add(item.id));
                          } else {
                            setExpandedItems((prev) => {
                              const next = new Set(prev);
                              next.delete(item.id);
                              return next;
                            });
                          }
                        }}
                      >
                        <Collapsible.Trigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            w="100%"
                            justifyContent="flex-start"
                            onClick={() => handleMenuItemClick(item)}
                          >
                            <HStack gap={3} flex="1">
                              <Icon>
                                <item.icon />
                              </Icon>
                              <Text flex="1" textAlign="left">
                                {item.label}
                              </Text>
                              {item.children && (
                                <Collapsible.Indicator
                                  transition="transform 0.2s"
                                  _open={{ transform: 'rotate(90deg)' }}
                                >
                                  <LuChevronRight />
                                </Collapsible.Indicator>
                              )}
                            </HStack>
                          </Button>
                        </Collapsible.Trigger>
                        {item.children && (
                          <Collapsible.Content>
                            <VStack align="stretch" gap={0} pl={8} mt={1}>
                              {item.children.map((child) => (
                                <Button
                                  key={child.id}
                                  variant="ghost"
                                  size="sm"
                                  w="100%"
                                  justifyContent="flex-start"
                                  onClick={() => {
                                    console.log('Navigate to:', child.id);
                                    setIsOpen(false);
                                  }}
                                >
                                  <HStack gap={3}>
                                    <Icon size="sm">
                                      <child.icon />
                                    </Icon>
                                    <Text>{child.label}</Text>
                                  </HStack>
                                </Button>
                              ))}
                            </VStack>
                          </Collapsible.Content>
                        )}
                      </Collapsible.Root>
                    </Box>
                  ))}
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
