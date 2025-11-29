import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Tabs,
  Flex,
  VStack,
  Text,
  IconButton,
  Icon,
  HStack,
  Heading,
  Button,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuArrowLeft, LuPackage, LuBookOpen, LuFolder } from 'react-icons/lu';
import { BsStack } from 'react-icons/bs';
import Header from '../components/Header';
import KitsTabContent from '../components/kits/KitsTabContent';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import BlueprintsTabContent from '../components/blueprints/BlueprintsTabContent';
import KitViewPage from './KitViewPage';
import WalkthroughViewPage from './WalkthroughViewPage';
import { invokeGetProjectKits, invokeWatchProjectKits, invokeReadFile, KitFile, ProjectEntry } from '../ipc';
import { parseFrontMatter } from '../utils/parseFrontMatter';

interface ProjectDetailPageProps {
  project: ProjectEntry;
  onBack: () => void;
}

export default function ProjectDetailPage({ project, onBack }: ProjectDetailPageProps) {
  const [kits, setKits] = useState<KitFile[]>([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Kit view state - for viewing a kit/walkthrough in split view
  const [viewingKit, setViewingKit] = useState<KitFile | null>(null);
  const [kitViewContent, setKitViewContent] = useState<string | null>(null);

  // Load kits from this project only
  const loadProjectKits = async () => {
    try {
      setKitsLoading(true);
      setError(null);
      
      console.log(`Loading kits from project: ${project.path}`);
      const projectKits = await invokeGetProjectKits(project.path);
      
      // Read file contents and parse front matter for each kit
      const kitsWithFrontMatter = await Promise.all(
        projectKits.map(async (kit) => {
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
    // Load kits on mount
    loadProjectKits();

    // Set up file watcher for this project
    const setupWatcher = async () => {
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
          loadProjectKits();
        });

        // Cleanup: unlisten when component unmounts
        return () => {
          unlisten();
        };
      } catch (error) {
        console.error(`Failed to set up file watcher for ${project.path}:`, error);
      }
    };

    const cleanup = setupWatcher();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [project.path]);

  // Filter kits by type
  const kitsOnly = useMemo(() => {
    return kits.filter(kit => {
      const type = kit.frontMatter?.type;
      return !type || (type !== 'walkthrough' && type !== 'blueprint');
    });
  }, [kits]);

  const walkthroughs = useMemo(() => {
    return kits.filter(kit => kit.frontMatter?.type === 'walkthrough');
  }, [kits]);

  const blueprints = useMemo(() => {
    return kits.filter(kit => kit.frontMatter?.type === 'blueprint');
  }, [kits]);

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
      
      {/* Full screen content area */}
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
            {/* Back button, project title, and tabs all on the same row */}
            <Flex align="center" gap={4} mb={6} mt={3} position="relative" w="100%">
              {/* Left side: Back button and project title */}
              <Flex align="center" gap={4}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuArrowLeft />
                    </Icon>
                    <Text>Back</Text>
                  </HStack>
                </Button>
                <HStack gap={2} align="center">
                  <Icon boxSize={5} color="primary.500">
                    <LuFolder />
                  </Icon>
                  <Heading size="lg">{project.title}</Heading>
                </HStack>
              </Flex>
              
              {/* Centered: Tabs */}
              <Box 
                position="absolute" 
                left="50%" 
                style={{ transform: 'translateX(-50%)' }}
              >
                <Tabs.List>
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
                </Tabs.List>
              </Box>
            </Flex>

            <Tabs.Content value="kits">
              <KitsTabContent
                kits={kitsOnly}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={1}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <BlueprintsTabContent
                kits={blueprints}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={1}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="walkthroughs">
              <WalkthroughsTabContent
                kits={walkthroughs}
                kitsLoading={kitsLoading}
                error={error}
                projectsCount={1}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </Box>
    </VStack>
  );
}

