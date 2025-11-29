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
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuMenu, LuPackage, LuBookOpen, LuFolderOpen, LuBot, LuFolder } from 'react-icons/lu';
import { BsStack } from 'react-icons/bs';
import NavigationMenu from '../components/NavigationDrawer';
import Header from '../components/Header';
import ProjectsTabContent from '../components/projects/ProjectsTabContent';
import KitsTabContent from '../components/kits/KitsTabContent';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import CollectionsTabContent from '../components/collections/CollectionsTabContent';
import BlueprintsTabContent from '../components/blueprints/BlueprintsTabContent';
import AgentsTabContent from '../components/agents/AgentsTabContent';
import KitViewPage from './KitViewPage';
import WalkthroughViewPage from './WalkthroughViewPage';
import { invokeGetProjectRegistry, invokeGetProjectKits, invokeWatchProjectKits, invokeReadFile, KitFile, ProjectEntry } from '../ipc';
import { parseFrontMatter } from '../utils/parseFrontMatter';
import { useSelection } from '../contexts/SelectionContext';
import { Collection } from '../components/collections/AddCollectionDialog';

interface HomePageProps {
}

export default function HomePage({}: HomePageProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [kits, setKits] = useState<KitFile[]>([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedItems } = useSelection();
  
  // Collections state - store selectedItemIds with each collection
  interface CollectionWithItems extends Collection {
    selectedItemIds: string[];
  }
  const [collections, setCollections] = useState<CollectionWithItems[]>([]);

  // Kit view state - for viewing a kit/walkthrough in split view
  const [viewingKit, setViewingKit] = useState<KitFile | null>(null);
  const [kitViewContent, setKitViewContent] = useState<string | null>(null);

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

  // Load projects from registry
  const loadProjects = async () => {
    try {
      setProjectsLoading(true);
      setProjectsError(null);
      console.log('Loading projects from registry...');
      const registryProjects = await invokeGetProjectRegistry();
      console.log('Loaded projects:', registryProjects);
      setProjects(registryProjects);
    } catch (error) {
      console.error('Error loading project registry:', error);
      setProjectsError(error instanceof Error ? error.message : 'Failed to load projects');
    } finally {
      setProjectsLoading(false);
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
  console.log('[HomePage] Render - selectedCount:', selectedCount, 'selectedItems:', selectedItems);

  // Handler to navigate to kit view
  const handleViewKit = async (kit: KitFile) => {
    try {
      const content = await invokeReadFile(kit.path);
      setViewingKit(kit);
      setKitViewContent(content);
    } catch (error) {
      console.error('Failed to load kit content:', error);
    }
  };

  // Handler to go back from kit view
  const handleBackFromKitView = () => {
    setViewingKit(null);
    setKitViewContent(null);
  };

  // If viewing a kit or walkthrough, show the appropriate view page
  if (viewingKit && kitViewContent) {
    const isWalkthrough = viewingKit.frontMatter?.type === 'walkthrough';
    
    if (isWalkthrough) {
      return (
        <WalkthroughViewPage 
          kit={viewingKit} 
          kitContent={kitViewContent}
          onBack={handleBackFromKitView}
        />
      );
    } else {
      return (
        <KitViewPage 
          kit={viewingKit} 
          kitContent={kitViewContent}
          onBack={handleBackFromKitView}
        />
      );
    }
  }

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header />
      </Box>
      
      {/* Full screen content area - no workstation until kit is selected */}
      <Box flex="1" minH={0} overflow="hidden">
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
                  <Tabs.Trigger value="projects">
                    <HStack gap={2}>
                      <Icon>
                        <LuFolder />
                      </Icon>
                      <Text>Projects</Text>
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
                  <Tabs.Trigger value="agents">
                    <HStack gap={2}>
                      <Icon>
                        <LuBot />
                      </Icon>
                      <Text>Agents</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="blueprints">
                    <HStack gap={2}>
                      <Icon>
                        <BsStack />
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

            <Tabs.Content value="projects">
              <ProjectsTabContent
                projects={projects}
                projectsLoading={projectsLoading}
                error={projectsError}
              />
            </Tabs.Content>
            <Tabs.Content value="kits">
              <KitsTabContent
                kits={kits}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={projects.length}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="agents">
              <AgentsTabContent
                kits={kits}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={projects.length}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <BlueprintsTabContent
                kits={kits}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={projects.length}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="walkthroughs">
              <WalkthroughsTabContent
                kits={kits}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={projects.length}
                onViewKit={handleViewKit}
              />
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
      </Box>
    </VStack>
  );
}
