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
import { ArtifactFile, ArtifactFolder } from "@/ipc";
import { useColorMode } from "@/shared/contexts/ColorModeContext";
import { ElegantList } from "./ElegantList";

interface FolderViewProps {
  folder: ArtifactFolder | null;
  artifacts: ArtifactFile[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onViewArtifact: (artifact: ArtifactFile) => void;
  onContextMenu?: (e: React.MouseEvent, artifact: ArtifactFile) => void;
  onBack: () => void;
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
}: FolderViewProps) {
  const { colorMode } = useColorMode();

  if (!folder) return null;

  return (
    <Box width="100%" h="100%" overflowY="auto" pb={20}>
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
  );
}
