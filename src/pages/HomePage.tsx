import { useState } from 'react';
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
import NavigationMenu, { MenuButton } from '../components/NavigationDrawer';
import Header from '../components/Header';
import ProjectDetailsModal from '../components/ProjectDetailsModal';

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  path: string;
}

interface HomePageProps {
  onViewProject: (project: ProjectData) => void;
}

export default function HomePage({ onViewProject }: HomePageProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

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

  const handleSaveProject = (name: string, description: string) => {
    if (selectedPath) {
      const newProject: ProjectData = {
        id: Date.now().toString(),
        title: name,
        description: description || 'No description provided',
        path: selectedPath,
      };
      setProjects([...projects, newProject]);
      setSelectedPath(null);
    }
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
              <Flex justify="flex-end" mb={4}>
                <Button onClick={handleLinkProject}>Link Project</Button>
              </Flex>
              {projects.length === 0 ? (
                <Box
                  textAlign="center"
                  py={12}
                  color="gray.500"
                >
                  No projects linked yet. Click "Link Project" to get started.
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                  {projects.map((project) => (
                    <Card.Root key={project.id} variant="subtle">
                      <CardHeader>
                        <Heading size="md">{project.title}</Heading>
                      </CardHeader>
                      <CardBody>
                        <Box mb={4}>{project.description}</Box>
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
              )}
            </Tabs.Content>
            <Tabs.Content value="kits">
              <Box>Kits Content</Box>
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <Box>Blueprints Content</Box>
            </Tabs.Content>
            <Tabs.Content value="walkthroughs">
              <Box>Walkthroughs Content</Box>
            </Tabs.Content>
            <Tabs.Content value="collections">
              <Box>Collections Content</Box>
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
