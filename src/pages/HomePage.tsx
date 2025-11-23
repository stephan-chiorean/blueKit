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
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import { LuFolderOpen, LuPackage, LuFileText, LuBookOpen, LuLayers } from 'react-icons/lu';
import NavigationMenu, { MenuButton } from '../components/NavigationDrawer';
import Header from '../components/Header';
import ProjectDetailsModal from '../components/ProjectDetailsModal';
import ConditionalTabContent from '../components/BaseTabContent';
import { invokeGetProjectRegistry, ProjectEntry } from '../ipc';

export type ProjectData = ProjectEntry;

interface HomePageProps {
  onViewProject: (project: ProjectData) => void;
}

export default function HomePage({ onViewProject }: HomePageProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      console.log('Loading projects from registry...');
      const registryProjects = await invokeGetProjectRegistry();
      console.log('Loaded projects:', registryProjects);
      setProjects(registryProjects);
    } catch (error) {
      console.error('Error loading project registry:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load projects on mount
    loadProjects();

    // Set up file watcher event listener
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

  const handleLinkProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory',
      });

      if (selected && typeof selected === 'string') {
        setSelectedPath(selected);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  };

  const handleSaveProject = async (_name: string, _description: string) => {
    if (selectedPath) {
      // TODO: Write to projectRegistry.json file using name and description
      // For now, just reload from registry
      // In the future, we'll need a write command to update the registry
      // Reload projects from registry after adding
      try {
        const registryProjects = await invokeGetProjectRegistry();
        setProjects(registryProjects);
      } catch (error) {
        console.error('Error reloading project registry:', error);
      }
      setSelectedPath(null);
    }
    // Note: name and description parameters will be used when implementing registry write
  };

  const handleView = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      onViewProject(project);
    }
  };

  const handleSelect = (projectId: string) => {
    console.log('Select project:', projectId);
  };

  return (
    <Box position="relative" minH="100vh" bg="main.bg">
      <VStack align="stretch" gap={0}>
        <Header />
        
        <Box flex="1" p={6} position="relative">
          <NavigationMenu>
            {({ onOpen }) => <MenuButton onClick={onOpen} />}
          </NavigationMenu>
          <Tabs.Root defaultValue="projects" variant="enclosed">
            <Flex justify="center" mb={6}>
              <Tabs.List>
                <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
                <Tabs.Trigger value="kits">Kits</Tabs.Trigger>
                <Tabs.Trigger value="blueprints">Blueprints</Tabs.Trigger>
                <Tabs.Trigger value="walkthroughs">Walkthroughs</Tabs.Trigger>
                <Tabs.Trigger value="collections">Collections</Tabs.Trigger>
              </Tabs.List>
            </Flex>

            <Tabs.Content value="projects">
              {loading ? (
                <Box textAlign="center" py={12} color="gray.500">
                  Loading projects...
                </Box>
              ) : projects.length === 0 ? (
                <ConditionalTabContent
                  hasDependency={false}
                  onSatisfyDependency={handleLinkProject}
                  emptyStateTitle="No projects linked yet"
                  emptyStateDescription="Link a project to get started and manage your blueKit projects."
                  emptyStateIcon={<LuFolderOpen />}
                  actionButtonText="Link Project"
                >
                  <Box />
                </ConditionalTabContent>
              ) : (
                <>
                  <Flex justify="flex-end" mb={4}>
                    <Button onClick={handleLinkProject}>Link Project</Button>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                    {projects.map((project) => (
                      <Card.Root key={project.id} variant="subtle">
                        <CardHeader>
                          <Heading size="md">{project.title}</Heading>
                        </CardHeader>
                        <CardBody>
                          {project.description && (
                            <Box mb={4}>{project.description}</Box>
                          )}
                          <Box mb={4} fontSize="sm" color="gray.500">
                            {project.path}
                          </Box>
                          <Flex gap={2}>
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() => handleView(project.id)}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelect(project.id)}
                            >
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
            <Tabs.Content value="kits">
              <ConditionalTabContent
                hasDependency={projects.length > 0}
                onSatisfyDependency={handleLinkProject}
                emptyStateTitle="No kits available"
                emptyStateDescription="Link a project to discover and use kits from your .bluekit directory."
                emptyStateIcon={<LuPackage />}
                actionButtonText="Link Project"
              >
                <Box>Kits Content</Box>
              </ConditionalTabContent>
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <ConditionalTabContent
                hasDependency={projects.length > 0}
                onSatisfyDependency={handleLinkProject}
                emptyStateTitle="No blueprints available"
                emptyStateDescription="Link a project to access and manage blueprints."
                emptyStateIcon={<LuFileText />}
                actionButtonText="Link Project"
              >
                <Box>Blueprints Content</Box>
              </ConditionalTabContent>
            </Tabs.Content>
            <Tabs.Content value="walkthroughs">
              <ConditionalTabContent
                hasDependency={projects.length > 0}
                onSatisfyDependency={handleLinkProject}
                emptyStateTitle="No walkthroughs available"
                emptyStateDescription="Link a project to access walkthroughs and guides."
                emptyStateIcon={<LuBookOpen />}
                actionButtonText="Link Project"
              >
                <Box>Walkthroughs Content</Box>
              </ConditionalTabContent>
            </Tabs.Content>
            <Tabs.Content value="collections">
              <ConditionalTabContent
                hasDependency={projects.length > 0}
                onSatisfyDependency={handleLinkProject}
                emptyStateTitle="No collections available"
                emptyStateDescription="Link a project to browse and organize collections."
                emptyStateIcon={<LuLayers />}
                actionButtonText="Link Project"
              >
                <Box>Collections Content</Box>
              </ConditionalTabContent>
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </VStack>
      <ProjectDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPath(null);
        }}
        onSave={handleSaveProject}
        defaultName={selectedPath ? selectedPath.split(/[/\\]/).pop() || '' : ''}
      />
    </Box>
  );
}
