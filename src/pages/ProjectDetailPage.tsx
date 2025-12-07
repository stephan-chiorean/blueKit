import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Tabs,
  Flex,
  VStack,
  Text,
  Icon,
  HStack,
  Button,
  Select,
  Portal,
  createListCollection,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuArrowLeft, LuPackage, LuBookOpen, LuFolder, LuBot, LuNotebook, LuNetwork, LuCopy, LuListTodo, LuPlus } from 'react-icons/lu';
import { BsStack } from 'react-icons/bs';
import Header from '../components/Header';
import KitsTabContent from '../components/kits/KitsTabContent';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import BlueprintsTabContent from '../components/blueprints/BlueprintsTabContent';
import AgentsTabContent from '../components/agents/AgentsTabContent';
import ScrapbookTabContent from '../components/scrapbook/ScrapbookTabContent';
import DiagramsTabContent from '../components/diagrams/DiagramsTabContent';
import ClonesTabContent from '../components/clones/ClonesTabContent';
import TasksTabContent, { TasksTabContentRef } from '../components/tasks/TasksTabContent';
import ResourceViewPage from './ResourceViewPage';
import { invokeGetProjectArtifacts, invokeWatchProjectArtifacts, invokeReadFile, invokeGetProjectRegistry, invokeGetBlueprintTaskFile, ArtifactFile, ProjectEntry, TimeoutError } from '../ipc';
import { parseFrontMatter } from '../utils/parseFrontMatter';
import { ResourceFile, ResourceType } from '../types/resource';

interface ProjectDetailPageProps {
  project: ProjectEntry;
  onBack: () => void;
  onProjectSelect?: (project: ProjectEntry) => void;
}

export default function ProjectDetailPage({ project, onBack, onProjectSelect }: ProjectDetailPageProps) {
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectEntry[]>([]);
  const [currentTab, setCurrentTab] = useState<string>("kits");
  const tasksTabRef = useRef<TasksTabContentRef>(null);

  // Generic resource view state - for viewing any resource type
  const [viewingResource, setViewingResource] = useState<ResourceFile | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);


  // Load all projects for the dropdown
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projects = await invokeGetProjectRegistry();
        setAllProjects(projects);
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    loadProjects();
  }, []);

  // Load all artifacts from this project
  // This loads EVERYTHING from .bluekit/ (kits, walkthroughs, agents, diagrams, etc.)
  // Frontend filters by type later - see kitsOnly, walkthroughs, agents, blueprints memos below
  const loadProjectArtifacts = async () => {
    try {
      setArtifactsLoading(true);
      setError(null);

      console.log(`Loading artifacts from project: ${project.path}`);
      const projectArtifacts = await invokeGetProjectArtifacts(project.path);

      // Read file contents and parse front matter for each artifact
      const artifactsWithFrontMatter = await Promise.all(
        projectArtifacts.map(async (artifact) => {
          try {
            const content = await invokeReadFile(artifact.path);
            const frontMatter = parseFrontMatter(content);
            return {
              ...artifact,
              frontMatter,
            };
          } catch (err) {
            console.error(`Error reading artifact file ${artifact.path}:`, err);
            return artifact; // Return artifact without front matter if read fails
          }
        })
      );

      setArtifacts(artifactsWithFrontMatter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
      console.error('Error loading artifacts:', err);
    } finally {
      setArtifactsLoading(false);
    }
  };

  useEffect(() => {
    // Load artifacts on mount
    loadProjectArtifacts();

    let isMounted = true;
    let unlisten: (() => void) | null = null;

    // Set up file watcher for this project
    const setupWatcher = async () => {
      try {
        await invokeWatchProjectArtifacts(project.path);

        // Generate the event name (must match the Rust code)
        const sanitizedPath = project.path
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .replace(/:/g, '_')
          .replace(/\./g, '_')
          .replace(/ /g, '_');
        const eventName = `project-artifacts-changed-${sanitizedPath}`;

        // Listen for file change events
        unlisten = await listen(eventName, () => {
          if (isMounted) {
            console.log(`Artifacts directory changed for ${project.path}, reloading...`);
            loadProjectArtifacts();
          }
        });
      } catch (error) {
        console.error(`Failed to set up file watcher for ${project.path}:`, error);
        if (error instanceof TimeoutError) {
          console.warn('File watcher setup timed out - watchers may not work');
        }
      }
    };

    setupWatcher();

    // Synchronous cleanup
    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [project.path]);

  // Filter artifacts by type
  // This is where we separate the "load everything" approach into type-specific lists
  const kitsOnly = useMemo(() => {
    return artifacts.filter(artifact => {
      const type = artifact.frontMatter?.type;
      // Only include .md files that aren't other types
      return artifact.path.endsWith('.md') &&
             (!type || (type !== 'walkthrough' && type !== 'blueprint' && type !== 'agent' && type !== 'task'));
    });
  }, [artifacts]);

  const walkthroughs = useMemo(() => {
    return artifacts.filter(artifact => artifact.frontMatter?.type === 'walkthrough');
  }, [artifacts]);

  const blueprints = useMemo(() => {
    return artifacts.filter(artifact => artifact.frontMatter?.type === 'blueprint');
  }, [artifacts]);

  const agents = useMemo(() => {
    return artifacts.filter(artifact => artifact.frontMatter?.type === 'agent');
  }, [artifacts]);

  const diagrams = useMemo(() => {
    // Filter for diagram files (.mmd or .mermaid extensions)
    return artifacts.filter(artifact =>
      artifact.path.endsWith('.mmd') || artifact.path.endsWith('.mermaid')
    );
  }, [artifacts]);

  // Generic handler to view any resource type
  const handleViewResource = async (resource: ResourceFile, type: ResourceType) => {
    try {
      const content = await invokeReadFile(resource.path);
      setViewingResource(resource);
      setResourceContent(content);
      setResourceType(type);
    } catch (error) {
      console.error('Failed to load resource content:', error);
    }
  };

  // Convenience handlers for different resource types (backwards compatibility)
  const handleViewKit = async (artifact: ArtifactFile) => {
    await handleViewResource(artifact, (artifact.frontMatter?.type as ResourceType) || 'kit');
  };

  const handleViewDiagram = async (diagram: ArtifactFile) => {
    await handleViewResource(diagram, 'diagram');
  };

  const handleViewTask = async (blueprintPath: string, taskFile: string, taskDescription: string) => {
    try {
      const content = await invokeGetBlueprintTaskFile(blueprintPath, taskFile);

      // Create a ResourceFile object for the task
      const taskResource: ResourceFile = {
        name: taskFile.replace('.md', ''),
        path: `${blueprintPath}/${taskFile}`,
        frontMatter: {
          alias: taskDescription,
          type: 'task',
        },
        resourceType: 'task',
      };

      setViewingResource(taskResource);
      setResourceContent(content);
      setResourceType('task');
    } catch (error) {
      console.error('Failed to load task content:', error);
    }
  };

  // Handler to go back from resource view
  const handleBackFromResourceView = () => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
  };

  // Create collection for Select component
  const projectsCollection = useMemo(() => {
    return createListCollection({
      items: allProjects,
      itemToString: (item) => item.title,
      itemToValue: (item) => item.id,
    });
  }, [allProjects]);

  // Handler for project selection from dropdown
  const handleProjectChange = (details: { value: string[] }) => {
    const selectedProjectId = details.value[0];
    const selectedProject = allProjects.find(p => p.id === selectedProjectId);
    if (selectedProject && onProjectSelect) {
      onProjectSelect(selectedProject);
    }
  };

  // If viewing any resource, show the generic resource view page
  if (viewingResource && resourceContent && resourceType) {
    return (
      <ResourceViewPage
        resource={viewingResource}
        resourceContent={resourceContent}
        resourceType={resourceType}
        onBack={handleBackFromResourceView}
      />
    );
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
            value={currentTab}
            onValueChange={(details) => setCurrentTab(details.value)}
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
                <Select.Root
                  collection={projectsCollection}
                  value={[project.id]}
                  onValueChange={handleProjectChange}
                  size="sm"
                  variant="subtle"
                  width="auto"
                  minW="180px"
                >
                  <Select.HiddenSelect />
                  <Select.Control cursor="pointer">
                    <Select.Trigger>
                      <HStack gap={2} align="center">
                        <Icon boxSize={4} color="primary.500">
                          <LuFolder />
                        </Icon>
                        <Select.ValueText />
                      </HStack>
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {projectsCollection.items.map((item) => (
                          <Select.Item item={item} key={item.id}>
                            <HStack gap={2} align="center">
                              <Icon boxSize={4} color="primary.500">
                                <LuFolder />
                              </Icon>
                              <Select.ItemText>{item.title}</Select.ItemText>
                            </HStack>
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
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
                  <Tabs.Trigger value="agents">
                    <HStack gap={2}>
                      <Icon>
                        <LuBot />
                      </Icon>
                      <Text>Agents</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="scrapbook">
                    <HStack gap={2}>
                      <Icon>
                        <LuNotebook />
                      </Icon>
                      <Text>Scrapbook</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="diagrams">
                    <HStack gap={2}>
                      <Icon>
                        <LuNetwork />
                      </Icon>
                      <Text>Diagrams</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="clones">
                    <HStack gap={2}>
                      <Icon>
                        <LuCopy />
                      </Icon>
                      <Text>Clones</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="tasks">
                    <HStack gap={2}>
                      <Icon>
                        <LuListTodo />
                      </Icon>
                      <Text>Tasks</Text>
                    </HStack>
                  </Tabs.Trigger>
                </Tabs.List>
              </Box>
              {currentTab === 'tasks' && (
                <Box position="absolute" right={0}>
                  <Button
                    colorPalette="primary"
                    onClick={() => tasksTabRef.current?.openCreateDialog()}
                  >
                    <HStack gap={2}>
                      <Icon>
                        <LuPlus />
                      </Icon>
                      <Text>Add Task</Text>
                    </HStack>
                  </Button>
                </Box>
              )}
            </Flex>

            <Tabs.Content value="kits" key="kits">
              <KitsTabContent
                kits={kitsOnly}
                kitsLoading={artifactsLoading}
                error={error}
                projectsCount={1}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <BlueprintsTabContent
                projectPath={project.path}
                projectsCount={1}
                onViewTask={handleViewTask}
              />
            </Tabs.Content>
            <Tabs.Content value="walkthroughs" key="walkthroughs">
              <WalkthroughsTabContent
                kits={walkthroughs}
                kitsLoading={artifactsLoading}
                error={error}
                projectsCount={1}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="agents" key="agents">
              <AgentsTabContent
                kits={agents}
                kitsLoading={artifactsLoading}
                error={error}
                projectsCount={1}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="scrapbook">
              <ScrapbookTabContent
                projectPath={project.path}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            <Tabs.Content value="diagrams" key="diagrams">
              <DiagramsTabContent
                diagrams={diagrams}
                diagramsLoading={artifactsLoading}
                error={error}
                onViewDiagram={handleViewDiagram}
              />
            </Tabs.Content>
            <Tabs.Content value="clones">
              <ClonesTabContent
                projectPath={project.path}
              />
            </Tabs.Content>
            <Tabs.Content value="tasks">
              <TasksTabContent
                ref={tasksTabRef}
                context={project}
                projects={allProjects}
              />
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </Box>
    </VStack>
  );
}

