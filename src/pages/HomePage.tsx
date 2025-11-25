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
  IconButton,
  Icon,
  HStack,
  Separator,
  EmptyState,
  Highlight,
  Group,
  Dialog,
  Field,
  Input,
  Portal,
  CloseButton,
  Tag,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuMenu, LuPackage, LuLayers, LuBookOpen, LuFolderOpen, LuArrowRight, LuArrowLeft, LuPlus } from 'react-icons/lu';
import { BiMinusFront } from 'react-icons/bi';
import { ImTree } from 'react-icons/im';
import { PiTreeStructure } from 'react-icons/pi';
import NavigationMenu from '../components/NavigationDrawer';
import Header from '../components/Header';
import CreateBlueprintModal from '../components/CreateBlueprintModal';
import FeaturedBasesModal from '../components/FeaturedBasesModal';
import { invokeGetProjectRegistry, invokeGetProjectKits, invokeWatchProjectKits, KitFile, ProjectEntry } from '../ipc';
import { useSelection } from '../contexts/SelectionContext';

interface Blueprint {
  id: string;
  name: string;
  description: string;
}

interface HomePageProps {
  onCreateBlueprint: (name: string, description: string) => void;
}

export default function HomePage({ onCreateBlueprint }: HomePageProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [kits, setKits] = useState<KitFile[]>([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedItems, toggleItem, isSelected } = useSelection();
  
  // Fake blueprint data for now
  const [blueprints] = useState<Blueprint[]>([
    { id: '1', name: 'Authentication Flow', description: 'Complete user authentication setup' },
    { id: '2', name: 'Dashboard Layout', description: 'Main dashboard with navigation' },
    { id: '3', name: 'API Integration', description: 'REST API integration patterns' },
  ]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('kits');
  const [isFeaturedBasesModalOpen, setIsFeaturedBasesModalOpen] = useState(false);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  
  // Branches state - each branch has a name and an array of blueprint IDs
  interface Branch {
    id: string;
    name: string;
    blueprints: string[];
  }
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isAddBranchDialogOpen, setIsAddBranchDialogOpen] = useState(false);
  const [isSelectBlueprintModalOpen, setIsSelectBlueprintModalOpen] = useState(false);
  const [selectedBranchForBlueprint, setSelectedBranchForBlueprint] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');

  // Featured bases data - these are foundational templates for spinning up new apps
  const featuredBases = [
    { id: '1', name: 'React + TypeScript', description: 'Modern React app with TypeScript' },
    { id: '2', name: 'Next.js Starter', description: 'Full-stack Next.js application' },
    { id: '3', name: 'Vite + React', description: 'Fast Vite-based React setup' },
    { id: '4', name: 'Tauri Desktop', description: 'Cross-platform desktop app' },
  ];

  // Load projects from registry
  const loadProjects = async () => {
    try {
      console.log('Loading projects from registry...');
      const registryProjects = await invokeGetProjectRegistry();
      console.log('Loaded projects:', registryProjects);
      setProjects(registryProjects);
    } catch (error) {
      console.error('Error loading project registry:', error);
    }
  };

  // Load kits from all projects
  const loadAllKits = async () => {
    try {
      setKitsLoading(true);
      setError(null);
      
      if (projects.length === 0) {
        setKits([]);
        setKitsLoading(false);
        return;
      }

      // Load kits from all projects in parallel
      const kitPromises = projects.map(project => 
        invokeGetProjectKits(project.path).catch(err => {
          console.error(`Error loading kits from ${project.path}:`, err);
          return [] as KitFile[];
        })
      );

      const allKitsArrays = await Promise.all(kitPromises);
      
      // Flatten and deduplicate kits by path
      const kitsMap = new Map<string, KitFile>();
      allKitsArrays.flat().forEach(kit => {
        kitsMap.set(kit.path, kit);
      });
      
      setKits(Array.from(kitsMap.values()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kits');
      console.error('Error loading kits:', err);
    } finally {
      setKitsLoading(false);
    }
  };

  useEffect(() => {
    // Load projects on mount
    loadProjects();

    // Set up file watcher event listener for registry changes
    let unlistenFn: (() => void) | null = null;

    const setupFileWatcher = async () => {
      const unlisten = await listen('project-registry-changed', () => {
        // Reload projects when registry file changes
        loadProjects();
      });
      unlistenFn = unlisten;
    };

    setupFileWatcher();

    // Cleanup: unlisten when component unmounts
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Reload kits when projects change
  useEffect(() => {
    loadAllKits();
  }, [projects]);

  // Set up file watchers for all projects
  useEffect(() => {
    if (projects.length === 0) return;

    const setupWatchers = async () => {
      const unlistenFunctions: (() => void)[] = [];

      for (const project of projects) {
        try {
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
            console.log(`Kits directory changed for ${project.path}, reloading...`);
            loadAllKits();
          });
          unlistenFunctions.push(unlisten);
        } catch (error) {
          console.error(`Failed to set up file watcher for ${project.path}:`, error);
        }
      }

      // Cleanup: unlisten all watchers when component unmounts or projects change
      return () => {
        unlistenFunctions.forEach(unlisten => unlisten());
      };
    };

    const cleanup = setupWatchers();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [projects]);

  const handleKitToggle = (kit: KitFile) => {
    console.log('[HomePage] handleKitToggle called for kit:', kit);
    console.log('[HomePage] Current selectedItems:', selectedItems);
    const itemToToggle = {
      id: kit.path,
      name: kit.name,
      type: 'Kit' as const,
      path: kit.path,
    };
    console.log('[HomePage] Toggling item:', itemToToggle);
    toggleItem(itemToToggle);
  };

  const selectedCount = selectedItems.length;
  console.log('[HomePage] Render - selectedCount:', selectedCount, 'selectedItems:', selectedItems);

  return (
    <Box position="relative" minH="100vh" bg="main.bg">
      <VStack align="stretch" gap={0}>
        <Header />
        
        <Box flex="1" p={6} position="relative">
          <Tabs.Root 
            defaultValue="kits" 
            variant="enclosed"
            onValueChange={(details) => setActiveTab(details.value)}
            css={{
              '& [data-selected]': {
                borderColor: 'colors.primary.300',
              },
            }}
          >
            <Flex align="center" gap={4} mb={6} mt={6} position="relative" w="100%">
              <NavigationMenu>
                {({ onOpen }) => (
                  <IconButton
                    variant="ghost"
                    size="lg"
                    aria-label="Open menu"
                    onClick={onOpen}
                    color="gray.600"
                    _hover={{ bg: 'gray.100', opacity: 0.8 }}
                  >
                    <LuMenu />
                  </IconButton>
                )}
              </NavigationMenu>
              <Box 
                position="absolute" 
                left="50%" 
                style={{ transform: 'translateX(-50%)' }}
              >
                <Tabs.List>
                  <Tabs.Trigger value="bases">
                    <HStack gap={2}>
                      <Icon>
                        <BiMinusFront />
                      </Icon>
                      <Text>Bases</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="kits">
                    <HStack gap={2}>
                      <Icon>
                        <LuPackage />
                      </Icon>
                      <Text>Kits</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="blueprints">
                    <HStack gap={2}>
                      <Icon>
                        <LuLayers />
                      </Icon>
                      <Text>Blueprints</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="walkthroughs">
                    <HStack gap={2}>
                      <Icon>
                        <LuBookOpen />
                      </Icon>
                      <Text>Walkthroughs</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="collections">
                    <HStack gap={2}>
                      <Icon>
                        <LuFolderOpen />
                      </Icon>
                      <Text>Collections</Text>
                    </HStack>
                  </Tabs.Trigger>
                </Tabs.List>
              </Box>
              {activeTab === 'blueprints' && (
                <Box position="absolute" right={0}>
                  <Button onClick={() => setIsCreateModalOpen(true)} colorPalette="primary">
                    Create Blueprint
                  </Button>
                </Box>
              )}
            </Flex>

            <Tabs.Content value="bases">
              {selectedBase ? (
                // Base detail view
                <VStack align="stretch" gap={4}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedBase(null);
                      setBranches([]);
                    }}
                    alignSelf="flex-start"
                  >
                    <HStack gap={2}>
                      <LuArrowLeft />
                      <Text>Back</Text>
                    </HStack>
                  </Button>
                  
                  {/* Base Name */}
                  <Heading size="lg">
                    {featuredBases.find(b => b.id === selectedBase)?.name || 'Base'}
                  </Heading>

                  {branches.length === 0 ? (
                    // Empty state when no branches
                    <EmptyState.Root>
                      <EmptyState.Content>
                        <EmptyState.Indicator>
                          <Icon size="xl" color="primary.500">
                            <ImTree />
                          </Icon>
                        </EmptyState.Indicator>
                        <EmptyState.Title>
                          <Highlight
                            query="Branches"
                            styles={{
                              px: '1',
                              py: '0.5',
                              bg: 'primary.100',
                              color: 'primary.700',
                              borderRadius: 'sm',
                            }}
                          >
                            Add Blueprints in separately reusable Branches for your base
                          </Highlight>
                        </EmptyState.Title>
                        <EmptyState.Description>
                          Branches are separately reusable components for your base
                        </EmptyState.Description>
                        <Button
                          colorPalette="primary"
                          onClick={() => setIsAddBranchDialogOpen(true)}
                          mt={4}
                        >
                          <HStack gap={2}>
                            <ImTree />
                            <Text>Add Branch</Text>
                          </HStack>
                        </Button>
                      </EmptyState.Content>
                    </EmptyState.Root>
                  ) : (
                    // Branches view
                    <VStack align="stretch" gap={6}>
                      {branches.map((branch) => (
                        <Box key={branch.id}>
                          <Flex align="center" justify="space-between" mb={3}>
                            <HStack gap={2}>
                              <Icon color="primary.500">
                                <PiTreeStructure />
                              </Icon>
                              <Heading size="md">
                                {branch.name}
                              </Heading>
                            </HStack>
                            <Tag.Root
                              cursor="pointer"
                              colorPalette="primary"
                              variant="subtle"
                              onClick={() => {
                                // Handle "Add to Project" click
                                console.log('Add branch to project:', branch.id);
                              }}
                              _hover={{ bg: 'primary.100' }}
                            >
                              <Tag.Label>Add to Project</Tag.Label>
                            </Tag.Root>
                          </Flex>
                          <Group>
                            {branch.blueprints.map((blueprintId) => (
                              <Card.Root
                                key={blueprintId}
                                variant="subtle"
                                minW="200px"
                              >
                                <CardBody>
                                  <Text fontSize="sm">
                                    {blueprints.find(b => b.id === blueprintId)?.name || 'Blueprint'}
                                  </Text>
                                </CardBody>
                              </Card.Root>
                            ))}
                            <Card.Root
                              borderWidth="1px"
                              borderColor="primary.600"
                              bg="primary.100"
                              cursor="pointer"
                              _hover={{ bg: 'primary.200' }}
                              transition="all 0.2s"
                              minW="200px"
                              onClick={() => {
                                setSelectedBranchForBlueprint(branch.id);
                                setIsSelectBlueprintModalOpen(true);
                              }}
                            >
                              <CardBody>
                                <HStack gap={2} justify="center">
                                  <Icon color="primary.700">
                                    <LuPlus />
                                  </Icon>
                                  <Text color="primary.700" fontSize="sm" fontWeight="medium">
                                    Add Blueprint
                                  </Text>
                                </HStack>
                              </CardBody>
                            </Card.Root>
                          </Group>
                        </Box>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddBranchDialogOpen(true)}
                        alignSelf="flex-start"
                      >
                        <HStack gap={2}>
                          <ImTree />
                          <Text>Add Branch</Text>
                        </HStack>
                      </Button>
                    </VStack>
                  )}
                </VStack>
              ) : (
                <VStack align="stretch" gap={6}>
                  {/* Featured Bases Section */}
                  <Box>
                    <Heading size="md" mb={4}>
                      Featured Bases
                    </Heading>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4} mb={4}>
                      {featuredBases.map((base) => (
                        <Card.Root
                          key={base.id}
                          variant="subtle"
                          cursor="pointer"
                          _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
                          transition="all 0.2s"
                          onClick={() => {
                            setSelectedBase(base.id);
                            setBranches([]);
                          }}
                        >
                          <CardHeader>
                            <Heading size="sm">{base.name}</Heading>
                          </CardHeader>
                          <CardBody>
                            <Text fontSize="sm" color="text.secondary">
                              {base.description}
                            </Text>
                          </CardBody>
                        </Card.Root>
                      ))}
                    </SimpleGrid>
                    <Flex justify="flex-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFeaturedBasesModalOpen(true)}
                      >
                        <HStack gap={2}>
                          <Text>See More</Text>
                          <LuArrowRight />
                        </HStack>
                      </Button>
                    </Flex>
                  </Box>

                  <Separator />

                  {/* Personal Templates Empty State */}
                  <EmptyState.Root>
                    <EmptyState.Content>
                      <EmptyState.Title>
                        <Highlight
                          query="Bases"
                          styles={{
                            px: '1',
                            py: '0.5',
                            bg: 'primary.100',
                            color: 'primary.700',
                            borderRadius: 'sm',
                          }}
                        >
                          Assign Kits as Bases to view here
                        </Highlight>
                      </EmptyState.Title>
                      <EmptyState.Description>
                        Bases are foundational templates that are specifically meant to spin up entirely new apps
                      </EmptyState.Description>
                    </EmptyState.Content>
                  </EmptyState.Root>
                </VStack>
              )}
            </Tabs.Content>
            <Tabs.Content value="kits">
              {kitsLoading ? (
                <Box textAlign="center" py={12} color="text.secondary">
                  Loading kits...
                </Box>
              ) : error ? (
                <Box textAlign="center" py={12} color="red.500">
                  Error: {error}
                </Box>
              ) : projects.length === 0 ? (
                <Box textAlign="center" py={12} color="text.secondary">
                  No projects linked. Projects are managed via CLI and will appear here automatically.
                </Box>
              ) : kits.length === 0 ? (
                <Box textAlign="center" py={12} color="text.secondary">
                  No kits found in any linked project's .bluekit directory.
                </Box>
              ) : (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                    {kits.map((kit) => {
                      const kitSelected = isSelected(kit.path);
                      console.log('[HomePage] Kit:', kit.name, 'path:', kit.path, 'isSelected:', kitSelected);
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
                            <Text fontSize="sm" color="text.secondary" mb={4}>
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
                <Box textAlign="center" py={12} color="text.secondary">
                  <Text>No blueprints yet.</Text>
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                  {blueprints.map((blueprint) => (
                    <Card.Root key={blueprint.id} variant="subtle">
                      <CardHeader>
                        <Heading size="md">{blueprint.name}</Heading>
                      </CardHeader>
                      <CardBody>
                        <Text fontSize="sm" color="text.secondary" mb={4}>
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
              )}
            </Tabs.Content>
            <Tabs.Content value="walkthroughs">
              <Box textAlign="center" py={12} color="text.secondary">
                Walkthroughs content coming soon...
              </Box>
            </Tabs.Content>
            <Tabs.Content value="collections">
              <Box textAlign="center" py={12} color="text.secondary">
                Collections content coming soon...
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
      <FeaturedBasesModal
        isOpen={isFeaturedBasesModalOpen}
        onClose={() => setIsFeaturedBasesModalOpen(false)}
      />
      
      {/* Add Branch Dialog */}
      <Dialog.Root open={isAddBranchDialogOpen} onOpenChange={(e) => {
        if (!e.open) {
          setIsAddBranchDialogOpen(false);
          setNewBranchName('');
        }
      }}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Add Branch</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>Branch Name</Field.Label>
                  <Input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Enter branch name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBranchName.trim()) {
                        const newBranch: Branch = {
                          id: `branch-${Date.now()}`,
                          name: newBranchName.trim(),
                          blueprints: [],
                        };
                        setBranches([...branches, newBranch]);
                        setNewBranchName('');
                        setIsAddBranchDialogOpen(false);
                      }
                    }}
                  />
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  onClick={() => {
                    if (newBranchName.trim()) {
                      const newBranch: Branch = {
                        id: `branch-${Date.now()}`,
                        name: newBranchName.trim(),
                        blueprints: [],
                      };
                      setBranches([...branches, newBranch]);
                      setNewBranchName('');
                      setIsAddBranchDialogOpen(false);
                    }
                  }}
                  disabled={!newBranchName.trim()}
                  colorPalette="primary"
                >
                  Add
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Select Blueprint Modal */}
      <Dialog.Root open={isSelectBlueprintModalOpen} onOpenChange={(e) => {
        if (!e.open) {
          setIsSelectBlueprintModalOpen(false);
          setSelectedBranchForBlueprint(null);
        }
      }}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="600px">
              <Dialog.Header>
                <Dialog.Title>Select Blueprint</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <VStack align="stretch" gap={2}>
                  {blueprints.length === 0 ? (
                    <Text color="text.secondary" textAlign="center" py={4}>
                      No blueprints available
                    </Text>
                  ) : (
                    blueprints.map((blueprint) => (
                      <Card.Root
                        key={blueprint.id}
                        variant="subtle"
                        cursor="pointer"
                        _hover={{ bg: 'primary.50', borderColor: 'primary.300' }}
                        borderWidth="1px"
                        borderColor="border.subtle"
                        onClick={() => {
                          if (selectedBranchForBlueprint) {
                            setBranches(branches.map(branch =>
                              branch.id === selectedBranchForBlueprint
                                ? { ...branch, blueprints: [...branch.blueprints, blueprint.id] }
                                : branch
                            ));
                            setIsSelectBlueprintModalOpen(false);
                            setSelectedBranchForBlueprint(null);
                          }
                        }}
                      >
                        <CardBody>
                          <Heading size="sm" mb={1}>{blueprint.name}</Heading>
                          {blueprint.description && (
                            <Text fontSize="sm" color="text.secondary">
                              {blueprint.description}
                            </Text>
                          )}
                        </CardBody>
                      </Card.Root>
                    ))
                  )}
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
