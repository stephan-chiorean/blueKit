import { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Flex,
  VStack,
  Text,
  IconButton,
  Icon,
  HStack,
  Splitter,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuMenu, LuPackage, LuLayers, LuBookOpen, LuFolderOpen } from 'react-icons/lu';
import { BiMinusFront } from 'react-icons/bi';
import NavigationMenu from '../components/NavigationDrawer';
import Header from '../components/Header';
import Workstation from '../components/Workstation';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import BasesTabContent from '../components/bases/BasesTabContent';
import KitsTabContent from '../components/kits/KitsTabContent';
import BlueprintsTabContentWrapper from '../components/blueprints/BlueprintsTabContentWrapper';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import CollectionsTabContent from '../components/collections/CollectionsTabContent';
import { invokeGetProjectRegistry, invokeGetProjectKits, invokeWatchProjectKits, invokeReadFile, KitFile, ProjectEntry } from '../ipc';
import { parseFrontMatter } from '../utils/parseFrontMatter';
import { useSelection } from '../contexts/SelectionContext';
import { Branch } from '../components/bases/AddBranchDialog';
import { Collection } from '../components/collections/CreateCollectionModal';

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
  const { selectedItems } = useSelection();
  
  // Fake blueprint data for now
  const [blueprints] = useState<Blueprint[]>([
    { id: '1', name: 'Authentication Flow', description: 'Complete user authentication setup' },
    { id: '2', name: 'Dashboard Layout', description: 'Main dashboard with navigation' },
    { id: '3', name: 'API Integration', description: 'REST API integration patterns' },
  ]);
  const [isCreateBlueprintMode, setIsCreateBlueprintMode] = useState(false);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  
  // Branches state - each branch has a name and an array of blueprint IDs
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isFeaturedBasesModalOpen, setIsFeaturedBasesModalOpen] = useState(false);
  
  // Collections state - store selectedItemIds with each collection
  interface CollectionWithItems extends Collection {
    selectedItemIds: string[];
  }
  const [collections, setCollections] = useState<CollectionWithItems[]>([]);

  const handleCollectionCreated = (collection: Collection, selectedItemIds: string[]) => {
    setCollections([...collections, { ...collection, selectedItemIds }]);
  };

  const handleCollectionUpdated = (collection: Collection, selectedItemIds: string[]) => {
    setCollections(collections.map(c => 
      c.id === collection.id 
        ? { ...collection, selectedItemIds }
        : c
    ));
  };

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
      
      // Read file contents and parse front matter for each kit
      const kitsWithFrontMatter = await Promise.all(
        Array.from(kitsMap.values()).map(async (kit) => {
          try {
            const content = await invokeReadFile(kit.path);
            const frontMatter = parseFrontMatter(content);
            return {
              ...kit,
              frontMatter,
            };
          } catch (err) {
            console.error(`Error reading kit file ${kit.path}:`, err);
            return kit; // Return kit without front matter if read fails
          }
        })
      );
      
      setKits(kitsWithFrontMatter);
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

  const selectedCount = selectedItems.length;
  const { flags } = useFeatureFlags();
  console.log('[HomePage] Render - selectedCount:', selectedCount, 'selectedItems:', selectedItems);

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header />
      </Box>
      
      {/* Splitter layout below header */}
      <Box flex="1" minH={0} overflow="hidden">
        {flags.workstation ? (
          <Splitter.Root
            defaultSize={[50, 50]}
            panels={[
              { id: 'workstation', minSize: 20, collapsible: true, collapsedSize: 5 },
              { id: 'content', minSize: 30 },
            ]}
            h="100%"
            orientation="horizontal"
          >
            {/* Workstation Panel */}
            <Splitter.Panel id="workstation">
              <Workstation />
            </Splitter.Panel>

            {/* Resize Trigger */}
            <Splitter.ResizeTrigger id="workstation:content" />

        {/* Main Content Area */}
        <Splitter.Panel id="content">
          <Box h="100%" p={6} position="relative" overflow="auto">
            <Tabs.Root 
              defaultValue="kits" 
              variant="enclosed"
              css={{
                '& [data-selected]': {
                  borderColor: 'colors.primary.300',
                },
              }}
            >
              <Flex align="center" gap={4} mb={6} mt={3} position="relative" w="100%">
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
              </Flex>

            <Tabs.Content value="bases">
              <BasesTabContent
                selectedBase={selectedBase}
                onSelectBase={(baseId) => {
                  setSelectedBase(baseId);
                  setBranches([]);
                }}
                onDeselectBase={() => {
                  setSelectedBase(null);
                  setBranches([]);
                }}
                featuredBases={featuredBases}
                branches={branches}
                onAddBranch={(branch) => setBranches([...branches, branch])}
                onSelectBlueprint={(branchId, blueprintId) => {
                  setBranches(branches.map(branch =>
                    branch.id === branchId
                      ? { ...branch, blueprints: [...branch.blueprints, blueprintId] }
                      : branch
                  ));
                }}
                blueprints={blueprints}
                isFeaturedBasesModalOpen={isFeaturedBasesModalOpen}
                onOpenFeaturedBasesModal={() => setIsFeaturedBasesModalOpen(true)}
                onCloseFeaturedBasesModal={() => setIsFeaturedBasesModalOpen(false)}
              />
            </Tabs.Content>
            <Tabs.Content value="kits">
              <KitsTabContent
                kits={kits}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={projects.length}
              />
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <BlueprintsTabContentWrapper
                blueprints={blueprints}
                onCreateBlueprint={onCreateBlueprint}
                isCreateMode={isCreateBlueprintMode}
                onSetCreateMode={setIsCreateBlueprintMode}
                kits={kits}
                kitsLoading={kitsLoading}
              />
            </Tabs.Content>
            <Tabs.Content value="walkthroughs">
              <WalkthroughsTabContent />
            </Tabs.Content>
            <Tabs.Content value="collections">
              <CollectionsTabContent
                collections={collections}
                onAddCollection={handleCollectionCreated}
                onUpdateCollection={handleCollectionUpdated}
                kits={kits}
                kitsLoading={kitsLoading}
              />
            </Tabs.Content>
          </Tabs.Root>
        </Box>
            </Splitter.Panel>
          </Splitter.Root>
        ) : (
          <Box h="100%" p={6} position="relative" overflow="auto">
            <Tabs.Root 
              defaultValue="kits" 
              variant="enclosed"
              css={{
                '& [data-selected]': {
                  borderColor: 'colors.primary.300',
                },
              }}
            >
              <Flex align="center" gap={4} mb={6} mt={3} position="relative" w="100%">
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
              </Flex>

              <Tabs.Content value="bases">
                <BasesTabContent
                  selectedBase={selectedBase}
                  onSelectBase={(baseId) => {
                    setSelectedBase(baseId);
                    setBranches([]);
                  }}
                  onDeselectBase={() => {
                    setSelectedBase(null);
                    setBranches([]);
                  }}
                  featuredBases={featuredBases}
                  branches={branches}
                  onAddBranch={(branch) => setBranches([...branches, branch])}
                  onSelectBlueprint={(branchId, blueprintId) => {
                    setBranches(branches.map(branch =>
                      branch.id === branchId
                        ? { ...branch, blueprints: [...branch.blueprints, blueprintId] }
                        : branch
                    ));
                  }}
                  blueprints={blueprints}
                  isFeaturedBasesModalOpen={isFeaturedBasesModalOpen}
                  onOpenFeaturedBasesModal={() => setIsFeaturedBasesModalOpen(true)}
                  onCloseFeaturedBasesModal={() => setIsFeaturedBasesModalOpen(false)}
                />
              </Tabs.Content>
              <Tabs.Content value="kits">
                <KitsTabContent
                  kits={kits}
                  kitsLoading={kitsLoading}
                  error={error}
                  projectsCount={projects.length}
                />
              </Tabs.Content>
              <Tabs.Content value="blueprints">
                <BlueprintsTabContentWrapper
                  blueprints={blueprints}
                  onCreateBlueprint={onCreateBlueprint}
                  isCreateMode={isCreateBlueprintMode}
                  onSetCreateMode={setIsCreateBlueprintMode}
                  kits={kits}
                  kitsLoading={kitsLoading}
                />
              </Tabs.Content>
              <Tabs.Content value="walkthroughs">
                <WalkthroughsTabContent />
              </Tabs.Content>
              <Tabs.Content value="collections">
                <CollectionsTabContent
                  collections={collections}
                  onAddCollection={handleCollectionCreated}
                  onUpdateCollection={handleCollectionUpdated}
                  kits={kits}
                  kitsLoading={kitsLoading}
                />
              </Tabs.Content>
            </Tabs.Root>
          </Box>
        )}
      </Box>
    </VStack>
  );
}
