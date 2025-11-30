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
} from '@chakra-ui/react';
import { ProjectEntry } from '../../ipc';
import { LuFolder } from 'react-icons/lu';

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
            _hover={{ borderColor: "primary.400", bg: "primary.50" }}
            transition="all 0.2s"
            onClick={() => onProjectSelect(project)}
          >
            <CardHeader>
              <VStack align="start" gap={2}>
                <HStack gap={2} align="center">
                  <Icon boxSize={5} color="primary.500">
                    <LuFolder />
                  </Icon>
                  <Heading size="md">{project.title}</Heading>
                </HStack>
              </VStack>
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

