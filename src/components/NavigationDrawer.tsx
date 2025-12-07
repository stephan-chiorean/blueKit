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
  LuArchive,
  LuCode,
} from 'react-icons/lu';
import {FaBucket} from "react-icons/fa6";
import { RiClaudeFill } from "react-icons/ri";

interface NavigationMenuProps {
  children?: (props: { isOpen: boolean; onOpen: () => void }) => ReactNode;
  onNavigateToPlans?: (source: 'claude' | 'cursor') => void;
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
      { id: 'plans', label: 'Plans', icon: LuFileText, children: [
        { id: 'claude', label: 'Claude', icon: RiClaudeFill },
        { id: 'cursor', label: 'Cursor', icon: LuCode },
      ]},
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

export default function NavigationMenu({ children, onNavigateToPlans }: NavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
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

  const handleChildClick = (child: MenuItem) => {
    if (child.id === 'claude' || child.id === 'cursor') {
      onNavigateToPlans?.(child.id as 'claude' | 'cursor');
      setIsOpen(false);
    } else {
      console.log('Navigate to:', child.id);
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
                              {item.children.map((child) => {
                                // Check if this child has children (nested menu)
                                if (child.children) {
                                  return (
                                    <Collapsible.Root
                                      key={child.id}
                                      open={expandedItems.has(child.id)}
                                      onOpenChange={(e) => {
                                        if (e.open) {
                                          setExpandedItems((prev) => new Set(prev).add(child.id));
                                        } else {
                                          setExpandedItems((prev) => {
                                            const next = new Set(prev);
                                            next.delete(child.id);
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
                                        >
                                          <HStack gap={3} flex="1">
                                            <Icon size="sm">
                                              <child.icon />
                                            </Icon>
                                            <Text flex="1" textAlign="left">{child.label}</Text>
                                            <Collapsible.Indicator
                                              transition="transform 0.2s"
                                              _open={{ transform: 'rotate(90deg)' }}
                                            >
                                              <LuChevronRight />
                                            </Collapsible.Indicator>
                                          </HStack>
                                        </Button>
                                      </Collapsible.Trigger>
                                      {child.children && (
                                        <Collapsible.Content>
                                          <VStack align="stretch" gap={0} pl={8} mt={1}>
                                            {child.children.map((grandchild) => (
                                              <Button
                                                key={grandchild.id}
                                                variant="ghost"
                                                size="sm"
                                                w="100%"
                                                justifyContent="flex-start"
                                                onClick={() => handleChildClick(grandchild)}
                                              >
                                                <HStack gap={3}>
                                                  <Icon size="sm">
                                                    <grandchild.icon />
                                                  </Icon>
                                                  <Text>{grandchild.label}</Text>
                                                </HStack>
                                              </Button>
                                            ))}
                                          </VStack>
                                        </Collapsible.Content>
                                      )}
                                    </Collapsible.Root>
                                  );
                                }
                                // Regular child item
                                return (
                                  <Button
                                    key={child.id}
                                    variant="ghost"
                                    size="sm"
                                    w="100%"
                                    justifyContent="flex-start"
                                    onClick={() => handleChildClick(child)}
                                  >
                                    <HStack gap={3}>
                                      <Icon size="sm">
                                        <child.icon />
                                      </Icon>
                                      <Text>{child.label}</Text>
                                    </HStack>
                                  </Button>
                                );
                              })}
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
