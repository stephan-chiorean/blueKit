import {
  Box,
  Heading,
  HStack,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { MdFolder } from "react-icons/md";
import { IoIosMore } from "react-icons/io";
import {
  LuBookOpen,
  LuBot,
  LuPackage,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";
import { ArtifactFile, ArtifactFolder } from "../../ipc";
import GlassCard from "./GlassCard";

interface SimpleFolderCardProps {
  folder: ArtifactFolder;
  artifacts: ArtifactFile[];
  onOpenFolder: () => void;
  onDeleteFolder: () => void;
  onEditFolder: () => void;
}

export function SimpleFolderCard({
  folder,
  artifacts,
  onOpenFolder,
  onDeleteFolder,
  onEditFolder,
}: SimpleFolderCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Count artifacts by type
  const typeCounts = artifacts.reduce((acc, artifact) => {
    const type = artifact.frontMatter?.type;
    if (type === 'walkthrough') {
      acc.walkthrough = (acc.walkthrough || 0) + 1;
    } else if (type === 'agent') {
      acc.agent = (acc.agent || 0) + 1;
    } else {
      // Default to kit for anything else
      acc.kit = (acc.kit || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Build resource summary with type icons
  const resourceSummary: Array<{ count: number; icon: React.ReactNode }> = [];
  if (typeCounts.kit) {
    resourceSummary.push({ count: typeCounts.kit, icon: <LuPackage /> });
  }
  if (typeCounts.walkthrough) {
    resourceSummary.push({ count: typeCounts.walkthrough, icon: <LuBookOpen /> });
  }
  if (typeCounts.agent) {
    resourceSummary.push({ count: typeCounts.agent, icon: <LuBot /> });
  }

  // If we have artifacts but couldn't determine types, show total count
  if (resourceSummary.length === 0 && artifacts.length > 0) {
    resourceSummary.push({ count: artifacts.length, icon: <LuPackage /> });
  }

  return (
    <Box
      position="relative"
      role="group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Folder icon positioned above card */}
      <Icon
        position="absolute"
        top="-8px"
        left="12px"
        zIndex={2}
        color={isHovered ? "primary.solid" : "secondary.solid"}
        _dark={{
          color: isHovered ? "primary.solid" : "blue.300"
        }}
        transition="color 0.2s"
        width="24px"
        height="24px"
        filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.2))"
        as={MdFolder}
      />
      <GlassCard
        intensity="medium"
        cursor="pointer"
        onClick={onOpenFolder}
        _hover={{
          borderColor: "rgba(255, 255, 255, 0.4)",
        }}
        _dark={{
          _hover: {
            borderColor: "rgba(255, 255, 255, 0.1)",
          },
        }}
      >
        <Box
          position="relative"
          p={2.5}
          display="flex"
          flexDirection="column"
          justifyContent="center"
          minH="100px"
        >
          {/* Menu button positioned absolutely in top-right corner */}
          <Box
            position="absolute"
            top={1.5}
            right={1.5}
            onClick={(e) => e.stopPropagation()}
          >
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  variant="ghost"
                  size="xs"
                  aria-label="Folder options"
                  onClick={(e) => e.stopPropagation()}
                  bg="transparent"
                  _hover={{ bg: "transparent" }}
                  _active={{ bg: "transparent" }}
                  _focus={{ bg: "transparent" }}
                  _focusVisible={{ bg: "transparent" }}
                >
                  <Icon fontSize="xs">
                    <IoIosMore />
                  </Icon>
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="edit" onSelect={onEditFolder}>
                      <Icon>
                        <LuPencil />
                      </Icon>
                      Rename Folder
                    </Menu.Item>
                    <Menu.Item value="delete" onSelect={onDeleteFolder}>
                      <Icon>
                        <LuTrash2 />
                      </Icon>
                      Delete Folder
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </Box>

          {/* Centered content */}
          <VStack align="center" gap={1.5}>
            <Heading
              size="md"
              fontWeight="medium"
              textAlign="center"
              css={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
                lineHeight: "1.2",
              }}
            >
              {folder.name}
            </Heading>
            {resourceSummary.length > 0 && (
              <HStack gap={1.5} justify="center" wrap="wrap">
                {resourceSummary.map((part, index) => (
                  <HStack key={index} gap={1}>
                    {index > 0 && (
                      <Text
                        fontSize="sm"
                        color={isHovered ? "primary.solid" : "secondary.solid"}
                        _dark={{
                          color: isHovered ? "primary.solid" : "blue.300"
                        }}
                        transition="color 0.2s"
                      >
                        •
                      </Text>
                    )}
                    <Text
                      fontSize="sm"
                      color={isHovered ? "primary.solid" : "secondary.solid"}
                      _dark={{
                        color: isHovered ? "primary.solid" : "blue.300"
                      }}
                      transition="color 0.2s"
                    >
                      {part.count}
                    </Text>
                    <Icon
                      fontSize="sm"
                      color={isHovered ? "primary.solid" : "secondary.solid"}
                      _dark={{
                        color: isHovered ? "primary.solid" : "blue.300"
                      }}
                      transition="color 0.2s"
                    >
                      {part.icon}
                    </Icon>
                  </HStack>
                ))}
              </HStack>
            )}
            {resourceSummary.length === 0 && (
              <Text
                fontSize="sm"
                color={isHovered ? "primary.solid" : "secondary.solid"}
                _dark={{
                  color: isHovered ? "primary.solid" : "blue.300"
                }}
                transition="color 0.2s"
              >
                Empty
              </Text>
            )}
          </VStack>
        </Box>
      </GlassCard>
    </Box>
  );
}

export default SimpleFolderCard;
