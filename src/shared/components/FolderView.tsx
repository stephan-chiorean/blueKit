import {
  Box,
  Button,
  HStack,
  Icon,
  Text,
  VStack,
  Menu,
} from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { MdFolder } from "react-icons/md";
import { ArtifactFile, ArtifactFolder, Project } from "@/ipc";
import { useColorMode } from "@/shared/contexts/ColorModeContext";
import { ElegantList } from "./ElegantList";
import { FolderViewSelectionBar } from "./FolderViewSelectionBar";
import { useMemo } from "react";

interface FolderViewProps {
  folder: ArtifactFolder | null;
  artifacts: ArtifactFile[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewArtifact: (artifact: ArtifactFile) => void;
  onContextMenu?: (e: React.MouseEvent, artifact: ArtifactFile) => void;
  onBack: () => void;
  onArtifactsChanged?: () => void;
}

/**
 * FolderView component - displays contents of a folder with navigation header.
 * Follows the CollectionView pattern from LibraryTabContent.
 */
export default function FolderView({
  folder,
  artifacts,
  selectedIds,
  onSelectionChange,
  onViewArtifact,
  onContextMenu,
  onBack,
  onArtifactsChanged,
}: FolderViewProps) {
  const { colorMode } = useColorMode();

  // Get selected artifacts
  const selectedArtifacts = useMemo(() => {
    return artifacts.filter(a => selectedIds.has(a.path));
  }, [artifacts, selectedIds]);

  // Handle clear selection
  const handleClearSelection = () => {
    onSelectionChange(new Set());
  };

  // Handle delete/add complete
  const handleOperationComplete = () => {
    onArtifactsChanged?.();
  };

  if (!folder) return null;

  return (
    <Box width="100%" h="100%" position="relative">
      {/* Scrollable content area */}
      <Box width="100%" h="100%" overflowY="auto" pb={selectedIds.size > 0 ? "100px" : "20px"}>
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

            {/* Folder name with folder icon */}
            <HStack gap={3} align="center">
              <Box
                p={2}
                borderRadius="lg"
                bg={colorMode === "light" ? "blue.50" : "blue.900/30"}
                color="blue.500"
              >
                <Icon boxSize={5}>
                  <MdFolder />
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
                  Folder
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
                No items in this folder
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

      {/* Selection footer - absolute positioned within container */}
      <FolderViewSelectionBar
        isOpen={selectedIds.size > 0}
        selectedArtifacts={selectedArtifacts}
        onClearSelection={handleClearSelection}
        onDeleteComplete={handleOperationComplete}
        onAddComplete={handleOperationComplete}
        position="absolute"
      />
    </Box>
  );
}
