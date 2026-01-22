import {
  Box,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Menu,
  Portal,
  Text,
  VStack,
  Badge,
  Flex,
} from "@chakra-ui/react";
import React, { useState, useRef, useEffect } from "react";
import { MdFolder } from "react-icons/md";
import { IoIosMore } from "react-icons/io";
import {
  LuBookOpen,
  LuBot,
  LuCheck,
  LuPackage,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";
import { motion } from "framer-motion";
import { ArtifactFile, ArtifactFolder } from "../../ipc";
import GlassCard from "./GlassCard";

const MotionBox = motion.create(Box);

interface SimpleFolderCardProps {
  folder: ArtifactFolder;
  artifacts: ArtifactFile[];
  onOpenFolder: () => void;
  onDeleteFolder: () => void;
  onRenameFolder: (newName: string) => Promise<void>;
  index?: number;
}

export function SimpleFolderCard({
  folder,
  artifacts,
  onOpenFolder,
  onDeleteFolder,
  onRenameFolder,
  index = 0,
}: SimpleFolderCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [renameLoading, setRenameLoading] = useState(false);

  // Extract config data
  const displayName = folder.config?.name || folder.name;
  const description = folder.config?.description;
  const tags = folder.config?.tags || [];

  // Refs for positioning and input selection
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuButtonRect, setMenuButtonRect] = useState<DOMRect | null>(null);

  // Reset name and measure position when opening
  useEffect(() => {
    if (isRenameOpen) {
      setRenameName(folder.name);
      if (menuButtonRef.current) {
        setMenuButtonRect(menuButtonRef.current.getBoundingClientRect());
      }
      // Select all text after a brief delay to ensure input is mounted
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isRenameOpen, folder.name]);

  // Update popover position on resize/scroll
  useEffect(() => {
    if (!isRenameOpen) return;

    const updateRect = () => {
      if (menuButtonRef.current) {
        setMenuButtonRect(menuButtonRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isRenameOpen]);

  const handleRenameSubmit = async () => {
    if (!renameName.trim()) return;
    setRenameLoading(true);
    try {
      await onRenameFolder(renameName);
      setIsRenameOpen(false);
    } finally {
      setRenameLoading(false);
    }
  };

  // Count artifacts by type
  const typeCounts = artifacts.reduce((acc, artifact) => {
    const type = artifact.frontMatter?.type;
    if (type === 'walkthrough') {
      acc.walkthrough = (acc.walkthrough || 0) + 1;
    } else if (type === 'agent') {
      acc.agent = (acc.agent || 0) + 1;
    } else {
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

  if (resourceSummary.length === 0 && artifacts.length > 0) {
    resourceSummary.push({ count: artifacts.length, icon: <LuPackage /> });
  }

  return (
    <MotionBox
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1]
      }}
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
          minH="120px"
        >
          {/* Menu button positioned absolutely in top-right corner */}
          <Box
            position="absolute"
            top={1.5}
            right={1.5}
            onClick={(e) => e.stopPropagation()}
            zIndex={3}
          >
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton
                  ref={menuButtonRef}
                  variant="ghost"
                  size="xs"
                  aria-label="Group options"
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
                  <Menu.Content
                    css={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      borderWidth: '1px',
                      borderColor: 'rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                      _dark: {
                        background: 'rgba(30, 30, 30, 0.85)',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
                      },
                    }}
                  >
                    <Menu.Item value="edit" onSelect={() => setIsRenameOpen(true)}>
                      <Icon>
                        <LuPencil />
                      </Icon>
                      Rename Group
                    </Menu.Item>
                    <Menu.Item value="delete" onSelect={onDeleteFolder}>
                      <Icon>
                        <LuTrash2 />
                      </Icon>
                      Delete Group
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
              {displayName}
            </Heading>

            {/* Description */}
            {description && (
              <Text fontSize="xs" color="text.secondary" lineClamp={2} textAlign="center" lineHeight="short">
                {description}
              </Text>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <Flex gap={1} wrap="wrap" justify="center" maxW="100%">
                {tags.slice(0, 3).map(tag => (
                  <Badge key={tag} size="xs" variant="surface" colorPalette="gray">{tag}</Badge>
                ))}
                {tags.length > 3 && <Badge size="xs" variant="outline" colorPalette="gray">+{tags.length - 3}</Badge>}
              </Flex>
            )}

            {/* Resource Counts */}
            <Box mt={1}>
              {resourceSummary.length > 0 ? (
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
              ) : (
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
            </Box>
          </VStack>
        </Box>
      </GlassCard>

      {/* Rename Popover (positioned below menu button) */}
      {isRenameOpen && menuButtonRect && (
        <Portal>
          {/* Click-outside handler */}
          <Box
            position="fixed"
            inset={0}
            zIndex={1399}
            onClick={() => setIsRenameOpen(false)}
          />

          {/* Popover positioned below the menu button */}
          <Box
            position="fixed"
            top={`${menuButtonRect.bottom + 8}px`}
            right={`${window.innerWidth - menuButtonRect.right}px`}
            zIndex={1400}
          >
            <Box
              width="260px"
              borderRadius="xl"
              p={3}
              css={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderWidth: '1px',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                _dark: {
                  background: 'rgba(30, 30, 30, 0.95)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
                },
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <VStack align="stretch" gap={3}>
                <Text fontSize="sm" fontWeight="semibold">Rename Group</Text>
                <HStack gap={2}>
                  <Input
                    ref={inputRef}
                    placeholder="Group Name"
                    size="sm"
                    variant="subtle"
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') setIsRenameOpen(false);
                    }}
                    disabled={renameLoading}
                    borderRadius="md"
                    css={{
                      border: 'none',
                      '&:focus': {
                        outline: 'none',
                        boxShadow: 'none',
                        border: 'none',
                      },
                      '&:focus-visible': {
                        outline: 'none',
                        boxShadow: 'none',
                        border: 'none',
                      },
                    }}
                  />
                  <IconButton
                    aria-label="Confirm rename"
                    size="sm"
                    colorPalette="blue"
                    onClick={handleRenameSubmit}
                    loading={renameLoading}
                    disabled={!renameName.trim()}
                    rounded="md"
                  >
                    <Icon><LuCheck /></Icon>
                  </IconButton>
                </HStack>
              </VStack>
            </Box>
          </Box>
        </Portal>
      )}
    </MotionBox>
  );
}

export default SimpleFolderCard;
