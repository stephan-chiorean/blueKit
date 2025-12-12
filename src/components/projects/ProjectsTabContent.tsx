import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Text,
  VStack,
  HStack,
  EmptyState,
  Icon,
  Menu,
  IconButton,
  Portal,
  Flex,
} from '@chakra-ui/react';
import { ProjectEntry, invokeOpenProjectInEditor } from '../../ipc';
import { LuFolder } from 'react-icons/lu';
import { IoIosMore } from 'react-icons/io';
import { LuChevronRight } from 'react-icons/lu';

interface ProjectsTabContentProps {
  projects: ProjectEntry[];
  projectsLoading: boolean;
  error: string | null;
  onProjectSelect: (project: ProjectEntry) => void;
}

export default function ProjectsTabContent({
  projects,
  projectsLoading,
  error,
  onProjectSelect,
}: ProjectsTabContentProps) {
  console.log('[ProjectsTabContent] Render - projectsLoading:', projectsLoading, 'projects.length:', projects.length, 'error:', error);

  if (projectsLoading) {
    console.log('[ProjectsTabContent] Showing loading state');
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading projects...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon boxSize={12} color="text.tertiary">
                <LuFolder />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No projects found</EmptyState.Title>
            <EmptyState.Description>
              Projects are managed via CLI and will appear here automatically when linked.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  const handleOpenInEditor = async (
    project: ProjectEntry,
    editor: 'cursor' | 'vscode'
  ) => {
    try {
      await invokeOpenProjectInEditor(project.path, editor);
    } catch (error) {
      console.error(`Failed to open project in ${editor}:`, error);
      // You could show a toast notification here if needed
    }
  };

  return (
    <VStack align="stretch" gap={4}>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {projects.map((project) => (
          <Card.Root 
            key={project.id} 
            variant="subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            cursor="pointer"
            _hover={{ borderColor: "primary.400" }}
            transition="all 0.2s"
            onClick={() => onProjectSelect(project)}
            position="relative"
            overflow="visible"
          >
            <CardHeader>
              <Flex align="center" justify="space-between" gap={4}>
                <VStack align="start" gap={2} flex={1}>
                  <HStack gap={2} align="center">
                    <Icon boxSize={5} color="primary.500">
                      <LuFolder />
                    </Icon>
                    <Heading size="md">{project.title}</Heading>
                  </HStack>
                </VStack>
                <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label="Project options"
                        onClick={(e) => e.stopPropagation()}
                        bg="transparent"
                        _hover={{ bg: "transparent" }}
                        _active={{ bg: "transparent" }}
                        _focus={{ bg: "transparent" }}
                        _focusVisible={{ bg: "transparent" }}
                      >
                        <Icon>
                          <IoIosMore />
                        </Icon>
                      </IconButton>
                    </Menu.Trigger>
                    <Portal>
                      <Menu.Positioner>
                        <Menu.Content>
                          <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
                            <Menu.TriggerItem>
                              Open <LuChevronRight />
                            </Menu.TriggerItem>
                            <Portal>
                              <Menu.Positioner>
                                <Menu.Content>
                                  <Menu.Item
                                    value="cursor"
                                    onSelect={() => handleOpenInEditor(project, 'cursor')}
                                  >
                                    Cursor
                                  </Menu.Item>
                                  <Menu.Item
                                    value="vscode"
                                    onSelect={() => handleOpenInEditor(project, 'vscode')}
                                  >
                                    VSCode
                                  </Menu.Item>
                                </Menu.Content>
                              </Menu.Positioner>
                            </Portal>
                          </Menu.Root>
                        </Menu.Content>
                      </Menu.Positioner>
                    </Portal>
                  </Menu.Root>
                </Box>
              </Flex>
            </CardHeader>
            <CardBody>
              <Text fontSize="sm" color="text.secondary" mb={2}>
                {project.description || 'No description'}
              </Text>
              <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                {project.path}
              </Text>
            </CardBody>
          </Card.Root>
        ))}
      </SimpleGrid>
    </VStack>
  );
}

