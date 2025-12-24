import { Menu, Button, HStack, Text, Field, Icon, Badge } from '@chakra-ui/react';

import { LuFolder, LuCheck } from 'react-icons/lu';

interface ProjectMultiSelectProps {
  projects: Project[];
  selectedProjectIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export default function ProjectMultiSelect({
  projects,
  selectedProjectIds,
  onChange,
}: ProjectMultiSelectProps) {
  const handleToggle = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      onChange(selectedProjectIds.filter(id => id !== projectId));
    } else {
      onChange([...selectedProjectIds, projectId]);
    }
  };

  const selectedCount = selectedProjectIds.length;
  const displayText = selectedCount === 0
    ? 'Select projects...'
    : selectedCount === 1
    ? projects.find(p => p.id === selectedProjectIds[0])?.title || '1 project'
    : `${selectedCount} projects`;

  return (
    <Field.Root>
      <Field.Label>Assign to Projects</Field.Label>
      <Menu.Root closeOnSelect={false}>
        <Menu.Trigger asChild>
          <Button variant="outline" w="100%" justifyContent="space-between">
            <Text>{displayText}</Text>
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content maxH="300px" overflowY="auto">
            {projects.length === 0 ? (
              <Menu.Item value="empty" disabled>
                <Text fontSize="sm" color="text.tertiary">
                  No projects available
                </Text>
              </Menu.Item>
            ) : (
              projects.map((project) => {
                const isChecked = selectedProjectIds.includes(project.id);
                return (
                  <Menu.Item
                    key={project.id}
                    value={project.id}
                    onSelect={() => handleToggle(project.id)}
                  >
                    <HStack gap={2} justify="space-between" width="100%">
                      <HStack gap={2}>
                        <Icon>
                          <LuFolder />
                        </Icon>
                        <Text>{project.title}</Text>
                      </HStack>
                      {isChecked && (
                        <Icon color="blue.500">
                          <LuCheck />
                        </Icon>
                      )}
                    </HStack>
                  </Menu.Item>
                );
              })
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      {selectedProjectIds.length > 0 && (
        <HStack flexWrap="wrap" gap={1} mt={2}>
          <Text fontSize="xs" color="text.muted">Selected:</Text>
          {selectedProjectIds.map(id => {
            const project = projects.find(p => p.id === id);
            return project ? (
              <Badge key={id} size="sm" colorPalette="primary">
                {project.title}
              </Badge>
            ) : null;
          })}
        </HStack>
      )}
    </Field.Root>
  );
}
