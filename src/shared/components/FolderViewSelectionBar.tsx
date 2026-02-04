import { HStack, Icon, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import {
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import { SelectionBar, SelectionBarAction } from './SelectionBar';
import { ProjectSelectorPopover } from './ProjectSelectorPopover';
import {
  ArtifactFile,
  Project,
  deleteResources,
  invokeCopyKitToProject,
  invokeCopyWalkthroughToProject,
  invokeCopyDiagramToProject,
} from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

// Artifact type icon mapping
const artifactTypeIcon: Record<string, React.ReactNode> = {
  kit: <LuPackage />,
  walkthrough: <LuBookOpen />,
  agent: <LuBot />,
  diagram: <LuNetwork />,
  implementation_plan: <LuNetwork />,
};

// Artifact type label mapping
const artifactTypeLabels: Record<string, { singular: string; plural: string }> = {
  kit: { singular: 'kit', plural: 'kits' },
  walkthrough: { singular: 'walkthrough', plural: 'walkthroughs' },
  agent: { singular: 'agent', plural: 'agents' },
  diagram: { singular: 'diagram', plural: 'diagrams' },
  implementation_plan: { singular: 'plan', plural: 'plans' },
};

interface FolderViewSelectionBarProps {
  isOpen: boolean;
  selectedArtifacts: ArtifactFile[];
  onClearSelection: () => void;
  onDeleteComplete?: () => void;
  onAddComplete?: () => void;
  projects: Project[];
  position?: 'fixed' | 'absolute';
}

/**
 * Selection footer for FolderView with spotlight popover actions.
 * Supports bulk delete and add to project operations.
 */
export function FolderViewSelectionBar({
  isOpen,
  selectedArtifacts,
  onClearSelection,
  onDeleteComplete,
  onAddComplete,
  projects,
  position = 'absolute',
}: FolderViewSelectionBarProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Build selection summary with icons grouped by artifact type
  const selectionSummary = useMemo(() => {
    const typeCounts: Record<string, number> = {};

    for (const artifact of selectedArtifacts) {
      const artifactType = artifact.frontMatter?.type || 'kit';
      typeCounts[artifactType] = (typeCounts[artifactType] || 0) + 1;
    }

    const parts: { count: number; label: string; icon: React.ReactNode }[] = [];

    // Build summary parts
    for (const [artifactType, count] of Object.entries(typeCounts)) {
      const icon = artifactTypeIcon[artifactType] || <LuPackage />;
      const labels = artifactTypeLabels[artifactType] || {
        singular: artifactType,
        plural: `${artifactType}s`,
      };
      const label = count === 1 ? labels.singular : labels.plural;

      parts.push({ count, label, icon });
    }

    return (
      <HStack gap={1.5} justify="center" wrap="wrap">
        {parts.length > 0 ? (
          <>
            {parts.map((part, index) => (
              <HStack key={index} gap={1}>
                {index > 0 && (
                  <Text fontSize="xs" color="text.secondary">
                    •
                  </Text>
                )}
                <Text
                  fontSize="xs"
                  color="secondary.solid"
                  _dark={{ color: 'blue.300' }}
                >
                  {part.count}
                </Text>
                <Icon
                  fontSize="xs"
                  color="secondary.solid"
                  _dark={{ color: 'blue.300' }}
                >
                  {part.icon}
                </Icon>
              </HStack>
            ))}
            <Text fontSize="xs" color="text.secondary">
              selected
            </Text>
          </>
        ) : (
          <Text fontSize="xs" color="text.secondary" fontWeight="medium">
            {selectedArtifacts.length} item{selectedArtifacts.length !== 1 ? 's' : ''} selected
          </Text>
        )}
      </HStack>
    );
  }, [selectedArtifacts]);

  // Handle delete artifacts
  const handleDelete = async () => {
    if (selectedArtifacts.length === 0) return;

    const confirmMessage = `Delete ${selectedArtifacts.length} artifact${selectedArtifacts.length !== 1 ? 's' : ''}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setIsLoading(true);
    try {
      const filePaths = selectedArtifacts.map(a => a.path);
      await deleteResources(filePaths);

      toaster.create({
        type: 'success',
        title: 'Artifacts deleted',
        description: `Deleted ${selectedArtifacts.length} artifact${selectedArtifacts.length !== 1 ? 's' : ''}`,
      });

      onClearSelection();
      onDeleteComplete?.();
    } catch (error) {
      console.error('Failed to delete artifacts:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete artifacts',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle add to projects
  const handleAddToProjects = async (selectedProjects: Project[]) => {
    if (selectedArtifacts.length === 0 || selectedProjects.length === 0) return;

    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const project of selectedProjects) {
        for (const artifact of selectedArtifacts) {
          try {
            const artifactType = artifact.frontMatter?.type || 'kit';

            // Use appropriate copy function based on artifact type
            if (artifactType === 'walkthrough') {
              await invokeCopyWalkthroughToProject(artifact.path, project.path);
            } else if (artifactType === 'diagram') {
              await invokeCopyDiagramToProject(artifact.path, project.path);
            } else {
              // Default to kit copy (handles kits, agents, etc.)
              await invokeCopyKitToProject(artifact.path, project.path);
            }

            successCount++;
          } catch (err) {
            console.error(`Failed to copy ${artifact.name} to ${project.name}:`, err);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toaster.create({
          type: 'success',
          title: 'Add complete',
          description: `Added ${successCount} artifact${successCount !== 1 ? 's' : ''} to ${selectedProjects.length} project${selectedProjects.length !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
      } else if (errorCount > 0) {
        toaster.create({
          type: 'error',
          title: 'Add failed',
          description: `Failed to add ${errorCount} artifact${errorCount !== 1 ? 's' : ''}`,
        });
      }

      onClearSelection();
      onAddComplete?.();
    } finally {
      setIsLoading(false);
    }
  };

  // Define actions
  const actions: SelectionBarAction[] = [
    {
      id: 'delete',
      type: 'button',
      label: 'Delete',
      icon: <LuTrash2 />,
      onClick: handleDelete,
      variant: 'subtle',
      colorPalette: 'red',
      disabled: isLoading,
    },
    { id: 'sep1', type: 'separator' },
    {
      id: 'clear',
      type: 'button',
      label: 'Clear',
      icon: <LuX />,
      onClick: onClearSelection,
      variant: 'surface',
      colorPalette: 'gray',
      disabled: isLoading,
    },
    { id: 'sep2', type: 'separator' },
    {
      id: 'add-to-project',
      type: 'popover',
      popover: {
        trigger: (
          <ProjectSelectorPopover
            projects={projects}
            mode="add"
            onConfirm={handleAddToProjects}
            loading={isLoading}
            disabled={isLoading}
          />
        ),
      },
    },
  ];

  return (
    <SelectionBar
      isOpen={isOpen}
      selectionSummary={selectionSummary}
      actions={actions}
      position={position}
      isLoading={isLoading}
    />
  );
}
