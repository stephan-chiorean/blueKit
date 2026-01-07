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
import { BsBookmarkFill } from "react-icons/bs";
import { IoIosMore } from "react-icons/io";
import {
    LuBookOpen,
    LuBot,
    LuNetwork,
    LuPackage,
    LuPencil,
    LuTrash2,
} from "react-icons/lu";
import { CatalogWithVariations } from "../../types/github";
import { LibraryCollection } from "../../ipc/library";
import GlassCard from "../shared/GlassCard";

interface LibraryCollectionCardProps {
    collection: LibraryCollection;
    catalogs: CatalogWithVariations[];
    onOpenModal: () => void;
    onDeleteCollection: () => void;
    onEditCollection: () => void;
}

export function LibraryCollectionCard({
    collection,
    catalogs,
    onOpenModal,
    onDeleteCollection,
    onEditCollection,
}: LibraryCollectionCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Helper function to infer artifact type from remote_path or variations
    const inferArtifactType = (
        catalogWithVariations: CatalogWithVariations
    ): string => {
        const catalog = catalogWithVariations.catalog;
        let type = catalog.artifact_type;

        // If type is "unknown", try to infer from remote_path or variations
        if (type === "unknown" || !type) {
            // First, check variations' remote_path
            for (const variation of catalogWithVariations.variations) {
                const remotePath = variation.remote_path || "";
                const pathParts = remotePath.split("/");

                // Look for artifact type directories in the path
                const artifactTypeMap: Record<string, string> = {
                    kits: "kit",
                    walkthroughs: "walkthrough",
                    agents: "agent",
                    diagrams: "diagram",
                };

                for (const part of pathParts) {
                    if (artifactTypeMap[part]) {
                        type = artifactTypeMap[part];
                        return type;
                    }
                }

                // Check file extension for diagrams
                if (remotePath.endsWith(".mmd") || remotePath.endsWith(".mermaid")) {
                    type = "diagram";
                    return type;
                }
            }

            // Fallback: check catalog's remote_path
            const remotePath = catalog.remote_path || "";
            const pathParts = remotePath.split("/");

            const artifactTypeMap: Record<string, string> = {
                kits: "kit",
                walkthroughs: "walkthrough",
                agents: "agent",
                diagrams: "diagram",
            };

            for (const part of pathParts) {
                if (artifactTypeMap[part]) {
                    type = artifactTypeMap[part];
                    return type;
                }
            }

            // Check file extension for diagrams
            if (remotePath.endsWith(".mmd") || remotePath.endsWith(".mermaid")) {
                type = "diagram";
                return type;
            }
        }

        return type || "unknown";
    };

    // Count catalogs by artifact type
    const typeCounts = catalogs.reduce((acc, cat) => {
        const type = inferArtifactType(cat);
        if (type && type !== "unknown") {
            acc[type] = (acc[type] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // Build summary similar to GlobalActionBar
    const resourceSummary: Array<{ count: number; icon: React.ReactNode }> = [];
    if (typeCounts.kit) {
        resourceSummary.push({ count: typeCounts.kit, icon: <LuPackage /> });
    }
    if (typeCounts.walkthrough) {
        resourceSummary.push({
            count: typeCounts.walkthrough,
            icon: <LuBookOpen />,
        });
    }
    if (typeCounts.agent) {
        resourceSummary.push({ count: typeCounts.agent, icon: <LuBot /> });
    }
    if (typeCounts.diagram) {
        resourceSummary.push({ count: typeCounts.diagram, icon: <LuNetwork /> });
    }

    // If we have catalogs but couldn't determine types, show total count
    // This handles cases where artifact_type is "unknown" and paths don't contain type info
    if (resourceSummary.length === 0 && catalogs.length > 0) {
        resourceSummary.push({ count: catalogs.length, icon: <LuPackage /> });
    }

    return (
        <Box
            position="relative"
            role="group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
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
                height="32px"
                filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.2))"
                as={BsBookmarkFill}
            />
            <GlassCard
                intensity="medium"
                cursor="pointer"
                onClick={onOpenModal}
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
                                    aria-label="Collection options"
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
                                        <Menu.Item value="edit" onSelect={onEditCollection}>
                                            <Icon>
                                                <LuPencil />
                                            </Icon>
                                            Edit Collection
                                        </Menu.Item>
                                        <Menu.Item value="delete" onSelect={onDeleteCollection}>
                                            <Icon>
                                                <LuTrash2 />
                                            </Icon>
                                            Remove Collection
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
                            {collection.name}
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
                    </VStack>
                </Box>
            </GlassCard>
        </Box>
    );
}
