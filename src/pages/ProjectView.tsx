import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Tabs,
  Flex,
  VStack,
  Text,
  HStack,
  Breadcrumb,
  HoverCard,
  Tag,
  Stack,
  Portal,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import { listen } from '@tauri-apps/api/event';
import NavigationMenu, { MenuButton } from '../components/NavigationDrawer';
import { invokeGetProjectKits, invokeWatchProjectKits, KitFile } from '../ipc';
import { useSelection } from '../contexts/SelectionContext';
import CreateBlueprintModal from '../components/CreateBlueprintModal';

interface ProjectData {
  id: string;
  title: string;
  description: string;
  path: string;
}

interface ProjectViewProps {
  project: ProjectData;
  onBack: () => void;
  onCreateBlueprint: (name: string, description: string) => void;
}

interface Blueprint {
  id: string;
  name: string;
  description: string;
}

export default function ProjectView({ project, onBack, onCreateBlueprint }: ProjectViewProps) {
  const [kits, setKits] = useState<KitFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedItems, toggleItem, isSelected, hasSelection } = useSelection();
  
  // Fake blueprint data for now
  const [blueprints] = useState<Blueprint[]>([
    { id: '1', name: 'Authentication Flow', description: 'Complete user authentication setup' },
    { id: '2', name: 'Dashboard Layout', description: 'Main dashboard with navigation' },
    { id: '3', name: 'API Integration', description: 'REST API integration patterns' },
  ]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Debug: Log when selectedItems changes
  useEffect(() => {
    console.log('[ProjectView] selectedItems changed:', selectedItems);
  }, [selectedItems]);

  useEffect(() => {
    const loadKits = async () => {
      try {
        setLoading(true);
        setError(null);
        const projectKits = await invokeGetProjectKits(project.path);
        setKits(projectKits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load kits');
        console.error('Error loading kits:', err);
      } finally {
        setLoading(false);
      }
    };

    // Load initial kits
    loadKits();

    // Set up file watcher for this project
    let unlistenFn: (() => void) | null = null;

    const setupFileWatcher = async () => {
      try {
        // Start watching the project's .bluekit directory
        await invokeWatchProjectKits(project.path);

        // Generate the event name (must match the Rust code)
        const sanitizedPath = project.path
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .replace(/:/g, '_')
          .replace(/\./g, '_')
          .replace(/ /g, '_');
        const eventName = `project-kits-changed-${sanitizedPath}`;

        // Listen for file change events
        const unlisten = await listen(eventName, () => {
          console.log('Kits directory changed, reloading...');
          loadKits();
        });
        unlistenFn = unlisten;
      } catch (error) {
        console.error('Failed to set up file watcher:', error);
      }
    };

    setupFileWatcher();

    // Cleanup: unlisten when component unmounts
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [project.path]);

  const handleKitToggle = (kit: KitFile) => {
    console.log('[ProjectView] handleKitToggle called for kit:', kit);
    console.log('[ProjectView] Current selectedItems:', selectedItems);
    const itemToToggle = {
      id: kit.path,
      name: kit.name,
      type: 'Kit' as const,
      path: kit.path,
    };
    console.log('[ProjectView] Toggling item:', itemToToggle);
    toggleItem(itemToToggle);
  };

  const selectedCount = selectedItems.length;
  console.log('[ProjectView] Render - selectedCount:', selectedCount, 'selectedItems:', selectedItems);

  return (
    <Box position="relative" minH="100vh" bg="main.bg">
      <VStack align="stretch" gap={0}>
        <Box flex="1" p={6} position="relative">
          <NavigationMenu>
            {({ onOpen }) => <MenuButton onClick={onOpen} />}
          </NavigationMenu>
          <Breadcrumb.Root mb={6}>
            <Breadcrumb.List>
              <Breadcrumb.Item>
                <Breadcrumb.Link as="button" onClick={onBack}>
                  Projects
                </Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator />
              <Breadcrumb.Item>
                <Breadcrumb.CurrentLink>{project.title}</Breadcrumb.CurrentLink>
              </Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb.Root>

          <Tabs.Root 
            defaultValue="kits" 
            variant="enclosed"
            css={{
              '& [data-selected]': {
                borderColor: 'colors.primary.300',
              },
            }}
          >
            <Flex align="center" gap={4} mb={6} position="relative" w="100%">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
              >
                <HStack gap={2}>
                  <LuArrowLeft />
                  <Text>Back</Text>
                </HStack>
              </Button>
              <Box 
                position="absolute" 
                left="50%" 
                style={{ transform: 'translateX(-50%)' }}
              >
                <Tabs.List>
                  <Tabs.Trigger value="kits">Kits</Tabs.Trigger>
                  <Tabs.Trigger value="blueprints">Blueprints</Tabs.Trigger>
                  <Tabs.Trigger value="configuration">Configuration</Tabs.Trigger>
                </Tabs.List>
              </Box>
              {hasSelection && (
                <Box position="absolute" right={0}>
                  <HoverCard.Root size="sm">
                    <HoverCard.Trigger asChild>
                      <Button variant="subtle" size="sm">
                        Show Selected ({selectedCount})
                      </Button>
                    </HoverCard.Trigger>
                    <Portal>
                      <HoverCard.Positioner>
                        <HoverCard.Content maxW="300px">
                          <Stack gap={3}>
                            <Text fontWeight="semibold" fontSize="sm">
                              Selected Items
                            </Text>
                            <Stack gap={2}>
                              {selectedItems.map((item) => (
                                <Flex key={item.id} align="center" justify="space-between" gap={2}>
                                  <Text fontSize="sm">{item.name}</Text>
                                  <Tag.Root size="sm" variant="subtle">
                                    <Tag.Label>{item.type}</Tag.Label>
                                  </Tag.Root>
                                </Flex>
                              ))}
                            </Stack>
                          </Stack>
                        </HoverCard.Content>
                      </HoverCard.Positioner>
                    </Portal>
                  </HoverCard.Root>
                </Box>
              )}
            </Flex>

            <Tabs.Content value="kits">
              {loading ? (
                <Box textAlign="center" py={12} color="gray.500">
                  Loading kits...
                </Box>
              ) : error ? (
                <Box textAlign="center" py={12} color="red.500">
                  Error: {error}
                </Box>
              ) : kits.length === 0 ? (
                <Box textAlign="center" py={12} color="gray.500">
                  No kits found in .bluekit directory.
                </Box>
              ) : (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                    {kits.map((kit) => {
                      const kitSelected = isSelected(kit.path);
                      console.log('[ProjectView] Kit:', kit.name, 'path:', kit.path, 'isSelected:', kitSelected);
                      return (
                        <Card.Root 
                          key={kit.path} 
                          variant="subtle"
                          borderWidth={kitSelected ? "2px" : "1px"}
                          borderColor={kitSelected ? "primary.500" : "border.subtle"}
                          bg={kitSelected ? "primary.50" : undefined}
                        >
                          <CardHeader>
                            <Heading size="md">{kit.name}</Heading>
                          </CardHeader>
                          <CardBody>
                            <Text fontSize="sm" color="gray.500" mb={4}>
                              {kit.path}
                            </Text>
                            <Flex gap={2} justify="flex-end">
                              <Button size="sm" variant="subtle">
                                View
                              </Button>
                              <Button 
                                size="sm" 
                                variant={kitSelected ? "solid" : "outline"}
                                colorPalette={kitSelected ? "primary" : undefined}
                                onClick={() => handleKitToggle(kit)}
                              >
                                {kitSelected ? "Selected" : "Select"}
                              </Button>
                            </Flex>
                          </CardBody>
                        </Card.Root>
                      );
                    })}
                  </SimpleGrid>
                </>
              )}
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              {blueprints.length === 0 ? (
                <Box textAlign="center" py={12} color="gray.500">
                  <Flex direction="column" align="center" gap={4}>
                    <Text>No blueprints yet.</Text>
                    <Button onClick={() => setIsCreateModalOpen(true)} colorPalette="primary">
                      Create Blueprint
                    </Button>
                  </Flex>
                </Box>
              ) : (
                <>
                  <Flex justify="flex-start" mb={4}>
                    <Button onClick={() => setIsCreateModalOpen(true)} colorPalette="primary">
                      Create Blueprint
                    </Button>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                    {blueprints.map((blueprint) => (
                      <Card.Root key={blueprint.id} variant="subtle">
                        <CardHeader>
                          <Heading size="md">{blueprint.name}</Heading>
                        </CardHeader>
                        <CardBody>
                          <Text fontSize="sm" color="gray.500" mb={4}>
                            {blueprint.description}
                          </Text>
                          <Flex gap={2} justify="flex-end">
                            <Button size="sm" variant="subtle">
                              View
                            </Button>
                            <Button size="sm" variant="outline">
                              Select
                            </Button>
                          </Flex>
                        </CardBody>
                      </Card.Root>
                    ))}
                  </SimpleGrid>
                </>
              )}
            </Tabs.Content>
            <Tabs.Content value="configuration">
              <Box textAlign="center" py={12} color="gray.500">
                Configuration content coming soon...
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </VStack>
      <CreateBlueprintModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={onCreateBlueprint}
      />
    </Box>
  );
}

