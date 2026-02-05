import {
  Box,
  Button,
  HStack,
  Icon,
  Text,
  VStack,
  Menu,
  Badge,
} from "@chakra-ui/react";
import { LuArrowLeft, LuArchive, LuLibrary, LuUsers, LuLayers, LuFolder, LuTrash2, LuX, LuPlus, LuShare } from "react-icons/lu";
import { ArtifactFile, ArtifactFolder, Project, deleteResources, invokeCopyKitToProject, invokeCopyWalkthroughToProject, invokeCopyDiagramToProject } from "@/ipc";
import { useColorMode } from "@/shared/contexts/ColorModeContext";
import { ElegantList } from "./ElegantList";
import { useState } from "react";
import { toaster } from "@/shared/components/ui/toaster";
import AddToProjectDialog from "@/views/project/sections/components/AddToProjectDialog";

interface GroupViewProps {
  folder: ArtifactFolder | null;
  artifacts: ArtifactFile[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewArtifact: (artifact: ArtifactFile) => void;
  onContextMenu?: (e: React.MouseEvent, artifact: ArtifactFile) => void;
  onBack: () => void;
  onArtifactsChanged?: () => void;
  projects?: Project[];
}

/**
 * GroupView component - displays contents of a group with navigation header.
 * Follows the WalkthroughsSection pattern with inline selection footer.
 */
export default function GroupView({
  folder,
  artifacts,
  selectedIds,
  onSelectionChange,
  onViewArtifact,
  onContextMenu,
  onBack,
  onArtifactsChanged,
  projects = [],
}: GroupViewProps) {
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState(false);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);

  // Determine group icon based on folder contents
  const getGroupIcon = () => {
    if (!artifacts.length) return LuFolder;

    const firstArtifact = artifacts[0];
    const artifactType = firstArtifact.frontMatter?.type;

    switch (artifactType) {
      case 'kit':
        return LuArchive;
      case 'walkthrough':
        return LuLibrary;
      case 'agent':
        return LuUsers;
      case 'diagram':
        return LuLayers;
      default:
        return LuFolder;
    }
  };

  const GroupIcon = getGroupIcon();

  // Note: selectedArtifacts computation removed since it's recalculated in handleDelete

  // Handle clear selection
  const handleClearSelection = () => {
    onSelectionChange(new Set());
  };

  // Handle publish
  const handlePublish = () => {
    console.log('Publish selected items:', Array.from(selectedIds));
    handleClearSelection();
  };

  // Handle add to projects
  const handleAddToProjects = async (selectedProjects: Project[]) => {
    const selectedArtifacts = artifacts.filter(a => selectedIds.has(a.path));
    if (selectedArtifacts.length === 0 || selectedProjects.length === 0) return;

    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const project of selectedProjects) {
        for (const artifact of selectedArtifacts) {
          try {
            const artifactType = artifact.frontMatter?.type || 'kit';

            if (artifactType === 'walkthrough') {
              await invokeCopyWalkthroughToProject(artifact.path, project.path);
            } else if (artifactType === 'diagram') {
              await invokeCopyDiagramToProject(artifact.path, project.path);
            } else {
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
          description: `Added ${successCount} item${successCount !== 1 ? 's' : ''} to ${selectedProjects.length} project${selectedProjects.length !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
      } else if (errorCount > 0) {
        toaster.create({
          type: 'error',
          title: 'Add failed',
          description: `Failed to add ${errorCount} item${errorCount !== 1 ? 's' : ''}`,
        });
      }

      handleClearSelection();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    const selectedArtifacts = artifacts.filter(a => selectedIds.has(a.path));
    if (selectedArtifacts.length === 0) return;

    const confirmMessage = `Delete ${selectedArtifacts.length} item${selectedArtifacts.length !== 1 ? 's' : ''}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setIsLoading(true);
    try {
      const filePaths = selectedArtifacts.map(a => a.path);
      await deleteResources(filePaths);

      toaster.create({
        type: 'success',
        title: 'Items deleted',
        description: `Deleted ${selectedArtifacts.length} item${selectedArtifacts.length !== 1 ? 's' : ''}`,
      });

      handleClearSelection();
      onArtifactsChanged?.();
    } catch (error) {
      console.error('Failed to delete items:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete items',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!folder) return null;

  return (
    <Box width="100%" h="100%" position="relative">
      {/* Scrollable content area */}
      <Box width="100%" h="100%" overflowY="auto">
        {/* Header / Breadcrumbs */}
        <Box
          position="sticky"
          top={0}
          zIndex={100}
          bg="transparent"
          borderBottomWidth="1px"
          borderColor="border.subtle"
          px={8}
          py={4}
        >
          <HStack gap={4} align="center">
            {/* Back button */}
            <Button
              variant="ghost"
              size="md"
              onClick={onBack}
              px={2}
              borderRadius="full"
              _hover={{
                bg: colorMode === "light" ? "blackAlpha.50" : "whiteAlpha.100",
              }}
            >
              <LuArrowLeft size={20} />
            </Button>

            {/* Group name with dynamic icon */}
            <HStack gap={3} align="center">
              <Box
                p={2}
                borderRadius="lg"
                bg={colorMode === "light" ? "blue.50" : "blue.900/30"}
                color="blue.500"
              >
                <Icon boxSize={5}>
                  <GroupIcon />
                </Icon>
              </Box>
              <VStack align="start" gap={0}>
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  fontWeight="medium"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Group
                </Text>
                <Text fontWeight="bold" fontSize="xl" color="fg">
                  {folder.name}
                </Text>
              </VStack>
            </HStack>
          </HStack>
        </Box>

        <Box p={6}>
          {artifacts.length === 0 ? (
            <Box
              p={10}
              bg="bg.subtle"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
            >
              <Text color="text.muted" fontSize="sm">
                No items in this group
              </Text>
            </Box>
          ) : (
            <ElegantList
              items={artifacts}
              // Infer type from artifacts. They are ArtifactFiles.
              // We'll let ElegantList handle icon logic.
              onItemClick={(item) => onViewArtifact(item as ArtifactFile)}
              onItemContextMenu={(e, item) => onContextMenu?.(e, item as ArtifactFile)}
              selectable={true}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              getItemId={(item) => (item as ArtifactFile).path}
              renderActions={(item) => (
                <Menu.Item value="open" onClick={() => onViewArtifact(item as ArtifactFile)}>
                  <Text>Open</Text>
                </Menu.Item>
              )}
            />
          )}
        </Box>
      </Box>

      {/* Inline Selection Footer - matches WalkthroughsSection pattern */}
      <Box
        position="sticky"
        bottom={0}
        width="100%"
        display="grid"
        css={{
          gridTemplateRows: selectedIds.size > 0 ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <Box overflow="hidden" minHeight={0}>
          <Box
            borderTopWidth="1px"
            borderColor="border.subtle"
            py={4}
            px={6}
            css={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              _dark: {
                background: 'rgba(20, 20, 20, 0.85)',
              }
            }}
          >
            <HStack justify="space-between">
              <HStack gap={3}>
                <Badge colorPalette="blue" size="lg" variant="solid">
                  {selectedIds.size}
                </Badge>
                <Text fontWeight="medium" fontSize="sm">
                  item{selectedIds.size > 1 ? 's' : ''} selected
                </Text>
              </HStack>
              <HStack gap={2}>
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="blue"
                  onClick={() => setIsAddToProjectOpen(true)}
                  disabled={isLoading}
                >
                  <HStack gap={1}>
                    <LuPlus />
                    <Text>Add to Project</Text>
                  </HStack>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="orange"
                  onClick={handlePublish}
                  disabled={isLoading}
                >
                  <HStack gap={1}>
                    <LuShare />
                    <Text>Publish to Library</Text>
                  </HStack>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <HStack gap={1}>
                    <LuTrash2 />
                    <Text>Delete</Text>
                  </HStack>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="gray"
                  onClick={handleClearSelection}
                  disabled={isLoading}
                >
                  <HStack gap={1}>
                    <LuX />
                    <Text>Clear</Text>
                  </HStack>
                </Button>
              </HStack>
            </HStack>
          </Box>
        </Box>
      </Box>

      <AddToProjectDialog
        isOpen={isAddToProjectOpen}
        onClose={() => setIsAddToProjectOpen(false)}
        projects={projects}
        onConfirm={handleAddToProjects}
        loading={isLoading}
      />
    </Box>
  );
}
