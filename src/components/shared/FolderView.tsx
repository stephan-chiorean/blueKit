import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Tag,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ImTree } from "react-icons/im";
import { LuArrowLeft, LuBookOpen, LuBot, LuPackage } from "react-icons/lu";
import { MdFolder } from "react-icons/md";
import { ArtifactFile, ArtifactFolder } from "../../ipc";
import { useColorMode } from "../../contexts/ColorModeContext";

interface FolderViewProps {
  folder: ArtifactFolder | null;
  artifacts: ArtifactFile[];
  isSelected: (path: string) => boolean;
  onArtifactToggle: (artifact: ArtifactFile) => void;
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
  isSelected,
  onArtifactToggle,
  onViewArtifact,
  onContextMenu,
  onBack,
}: FolderViewProps) {
  const { colorMode } = useColorMode();

  if (!folder) return null;

  // Get icon for artifact type
  const getTypeIcon = (artifact: ArtifactFile) => {
    const type = artifact.frontMatter?.type;
    if (type === "walkthrough") return <LuBookOpen />;
    if (type === "agent") return <LuBot />;
    return <LuPackage />;
  };

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
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} p={1}>
            {artifacts.map((artifact) => {
              const selected = isSelected(artifact.path);
              const displayName = artifact.frontMatter?.alias || artifact.name;
              const description = artifact.frontMatter?.description || "";
              const isBase = artifact.frontMatter?.is_base === true;

              return (
                <Card.Root
                  key={artifact.path}
                  borderWidth={selected ? "2px" : "1px"}
                  borderRadius="16px"
                  position="relative"
                  cursor="pointer"
                  onClick={() => onViewArtifact(artifact)}
                  onContextMenu={(e) => onContextMenu?.(e, artifact)}
                  transition="all 0.2s ease-in-out"
                  height="100%"
                  display="flex"
                  flexDirection="column"
                  css={{
                    background: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(30px) saturate(180%)",
                    WebkitBackdropFilter: "blur(30px) saturate(180%)",
                    borderColor: selected
                      ? "var(--chakra-colors-primary-500)"
                      : "rgba(255, 255, 255, 0.2)",
                    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
                    _dark: {
                      background: "rgba(0, 0, 0, 0.2)",
                      borderColor: selected
                        ? "var(--chakra-colors-primary-500)"
                        : "rgba(255, 255, 255, 0.15)",
                      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
                    },
                    _hover: {
                      transform: "scale(1.02)",
                      borderColor: "var(--chakra-colors-primary-400)",
                      zIndex: 10,
                    },
                  }}
                >
                  <Card.Header>
                    <Flex align="center" justify="space-between" gap={4}>
                      <HStack gap={2} align="center">
                        <Icon boxSize={4} color="fg.muted">
                          {getTypeIcon(artifact)}
                        </Icon>
                        <Heading size="md">{displayName}</Heading>
                        {isBase && (
                          <Icon
                            as={ImTree}
                            boxSize={5}
                            color="primary.500"
                            flexShrink={0}
                          />
                        )}
                      </HStack>
                      <Checkbox.Root
                        checked={selected}
                        colorPalette="blue"
                        onCheckedChange={() => onArtifactToggle(artifact)}
                        onClick={(e) => e.stopPropagation()}
                        cursor="pointer"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control cursor="pointer">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Root>
                    </Flex>
                  </Card.Header>
                  <Card.Body display="flex" flexDirection="column" flex="1">
                    <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                      {description || artifact.path}
                    </Text>
                    {artifact.frontMatter?.tags &&
                      artifact.frontMatter.tags.length > 0 && (
                        <HStack gap={2} flexWrap="wrap" mt="auto">
                          {artifact.frontMatter.tags.map((tag) => (
                            <Tag.Root
                              key={tag}
                              size="sm"
                              variant="subtle"
                              colorPalette="primary"
                            >
                              <Tag.Label>#{tag}</Tag.Label>
                            </Tag.Root>
                          ))}
                        </HStack>
                      )}
                  </Card.Body>
                </Card.Root>
              );
            })}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
}
