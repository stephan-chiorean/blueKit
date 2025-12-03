import { Checkbox, VStack, Text, Box, HStack, Badge, Field } from '@chakra-ui/react';
import { ProjectEntry } from '../../ipc';
import { LuFolder } from 'react-icons/lu';

interface ProjectMultiSelectProps {
  projects: ProjectEntry[];
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

  return (
    <Field.Root>
      <Field.Label>Assign to Projects</Field.Label>
      <Box
        maxH="200px"
        overflowY="auto"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="md"
        p={3}
      >
        <VStack align="stretch" gap={2}>
          {projects.length === 0 ? (
            <Text fontSize="sm" color="text.tertiary">
              No projects available
            </Text>
          ) : (
            projects.map((project) => (
              <Checkbox.Root
                key={project.id}
                checked={selectedProjectIds.includes(project.id)}
                onCheckedChange={() => handleToggle(project.id)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label>
                  <HStack gap={2}>
                    <LuFolder size={14} />
                    <Text fontSize="sm">{project.title}</Text>
                  </HStack>
                </Checkbox.Label>
              </Checkbox.Root>
            ))
          )}
        </VStack>
      </Box>
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
