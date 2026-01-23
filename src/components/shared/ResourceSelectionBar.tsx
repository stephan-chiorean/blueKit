import {
    Box,
    Button,
    HStack,
    Icon,
    Portal,
    Separator,
    Text,
    VStack,
} from '@chakra-ui/react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    LuFolderPlus,
    LuTrash2,
    LuX,
    LuPackage,
    LuBookOpen,
    LuBot,
    LuNetwork,
    LuUpload,
    LuMap,
} from 'react-icons/lu';
import { MdFolder } from 'react-icons/md';
import { ArtifactFolder, Project, invokeCopyKitToProject, invokeCopyWalkthroughToProject, invokeCopyDiagramToProject, deleteResources } from '../../ipc';
import { SelectorPopover } from '../library/SelectorPopover';
import { SelectedItem } from '../../contexts/SelectionContext';
import AddToProjectPopover from './AddToProjectPopover';
import PublishToLibraryDialog from '../library/PublishToLibraryDialog';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';
import { toaster } from '../ui/toaster';

// Artifact type icon mapping
const artifactTypeIcon: Record<string, React.ReactNode> = {
    kit: <LuPackage />,
    Kit: <LuPackage />,
    walkthrough: <LuBookOpen />,
    Walkthrough: <LuBookOpen />,
    agent: <LuBot />,
    Agent: <LuBot />,
    diagram: <LuNetwork />,
    Diagram: <LuNetwork />,
    Plan: <LuMap />,
};

// Artifact type label mapping
const artifactTypeLabels: Record<string, { singular: string; plural: string }> = {
    kit: { singular: 'kit', plural: 'kits' },
    Kit: { singular: 'kit', plural: 'kits' },
    walkthrough: { singular: 'walkthrough', plural: 'walkthroughs' },
    Walkthrough: { singular: 'walkthrough', plural: 'walkthroughs' },
    agent: { singular: 'agent', plural: 'agents' },
    Agent: { singular: 'agent', plural: 'agents' },
    diagram: { singular: 'diagram', plural: 'diagrams' },
    Diagram: { singular: 'diagram', plural: 'diagrams' },
    Plan: { singular: 'plan', plural: 'plans' },
};

// Extended folder type for SelectorPopover (needs id)
interface FolderWithId extends ArtifactFolder {
    id: string;
}

interface ResourceSelectionBarProps {
    isOpen: boolean;
    selectedItems: SelectedItem[];
    onClearSelection: () => void;
    onMoveToFolder: (folderPath: string) => void;
    folders: ArtifactFolder[];
    isLoading?: boolean;
}

export function ResourceSelectionBar({
    isOpen,
    selectedItems,
    onClearSelection,
    onMoveToFolder,
    folders,
    isLoading = false,
}: ResourceSelectionBarProps) {
    // State for coordinated blur effect (spotlight popover flow)
    const [isMovePopoverOpen, setIsMovePopoverOpen] = useState(false);
    const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
    const [shouldShowBlur, setShouldShowBlur] = useState(false);

    // State for dialogs
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Refs to track popover states synchronously
    const isMovePopoverOpenRef = useRef(false);
    const isAddPopoverOpenRef = useRef(false);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Build selection summary with icons grouped by artifact type
    const selectionSummary = useMemo(() => {
        const typeCounts: Record<string, number> = {};

        for (const item of selectedItems) {
            const artifactType = item.type || 'kit';
            typeCounts[artifactType] = (typeCounts[artifactType] || 0) + 1;
        }

        const parts: { count: number; label: string; icon: React.ReactNode }[] = [];

        for (const [artifactType, count] of Object.entries(typeCounts)) {
            const icon = artifactTypeIcon[artifactType] || <LuPackage />;
            const labels = artifactTypeLabels[artifactType] || { singular: artifactType, plural: `${artifactType}s` };
            const label = count === 1 ? labels.singular : labels.plural;

            parts.push({
                count,
                label,
                icon,
            });
        }

        return parts;
    }, [selectedItems]);

    // Convert folders to include id for SelectorPopover
    const foldersWithId = useMemo<FolderWithId[]>(() => {
        return folders.map(folder => ({
            ...folder,
            id: folder.path, // Use path as unique id
        }));
    }, [folders]);

    // Update blur state based on refs (synchronous check)
    const updateBlurState = useCallback(() => {
        const anyPopoverOpen = isMovePopoverOpenRef.current || isAddPopoverOpenRef.current;

        if (anyPopoverOpen) {
            // Clear any pending timeout and show blur immediately
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
            }
            setShouldShowBlur(true);
        } else {
            // Only hide blur after a delay to prevent flicker during rapid transitions
            blurTimeoutRef.current = setTimeout(() => {
                // Double-check refs before hiding (in case state changed during delay)
                if (!isMovePopoverOpenRef.current && !isAddPopoverOpenRef.current) {
                    setShouldShowBlur(false);
                }
            }, 100);
        }
    }, []);

    const hasPlanSelection = selectedItems.some(item => item.type === 'Plan');

    // Handlers that update both refs and state immediately
    const handleMovePopoverChange = useCallback((open: boolean) => {
        isMovePopoverOpenRef.current = open;
        setIsMovePopoverOpen(open);
        updateBlurState();
    }, [updateBlurState]);



    // Sync refs when state changes (fallback for external state changes)
    useEffect(() => {
        isMovePopoverOpenRef.current = isMovePopoverOpen;
        updateBlurState();
    }, [isMovePopoverOpen, updateBlurState]);

    useEffect(() => {
        isAddPopoverOpenRef.current = isAddPopoverOpen;
        updateBlurState();
    }, [isAddPopoverOpen, updateBlurState]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Handle delete confirmation
    const handleDeleteClick = () => {
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            setActionLoading(true);

            // Extract file paths from selected items
            const filePaths = selectedItems
                .map(item => item.path)
                .filter((path): path is string => path !== undefined);

            if (filePaths.length === 0) {
                toaster.create({
                    type: "error",
                    title: "Error",
                    description: "No valid file paths found for deletion",
                });
                return;
            }

            await deleteResources(filePaths);

            toaster.create({
                type: "success",
                title: "Resources deleted",
                description: `${selectedItems.length} resource${selectedItems.length !== 1 ? "s" : ""} deleted successfully`,
            });

            onClearSelection();
        } catch (error) {
            console.error("[ResourceSelectionBar] Error in Delete:", error);
            toaster.create({
                type: "error",
                title: "Error",
                description: `Failed to delete resources: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
        } finally {
            setActionLoading(false);
        }
    };

    // Handle add to project
    const handleAddToProject = async (selectedProjects: Project[]) => {
        try {
            setActionLoading(true);

            const copyPromises: Promise<void>[] = [];

            for (const item of selectedItems) {
                for (const project of selectedProjects) {
                    if (item.path) {
                        const itemType = item.type.toLowerCase();
                        let copyPromise: Promise<string>;

                        if (itemType === 'kit') {
                            copyPromise = invokeCopyKitToProject(item.path, project.path);
                        } else if (itemType === 'walkthrough') {
                            copyPromise = invokeCopyWalkthroughToProject(item.path, project.path);
                        } else if (itemType === 'diagram') {
                            copyPromise = invokeCopyDiagramToProject(item.path, project.path);
                        } else {
                            console.warn(`[ResourceSelectionBar] Skipping ${item.name} - type ${itemType} not yet implemented`);
                            continue;
                        }

                        copyPromises.push(
                            copyPromise
                                .then(() => { })
                                .catch((error) => {
                                    console.error(`[ResourceSelectionBar] Error copying ${item.name} to ${project.name}:`, error);
                                    throw error;
                                })
                        );
                    }
                }
            }

            await Promise.all(copyPromises);

            toaster.create({
                type: "success",
                title: "Artifacts added",
                description: `Added ${selectedItems.length} artifact${selectedItems.length !== 1 ? "s" : ""} to ${selectedProjects.length} project${selectedProjects.length !== 1 ? "s" : ""}`,
            });

            onClearSelection();
        } catch (error) {
            console.error("[ResourceSelectionBar] Error in Add to Project:", error);
            toaster.create({
                type: "error",
                title: "Error",
                description: `Failed to add artifacts to project: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
            throw error;
        } finally {
            setActionLoading(false);
        }
    };

    // Handle publish complete
    const handlePublishComplete = () => {
        onClearSelection();
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop blur when popover is open - positioned below selection bar and popover */}
            {shouldShowBlur && (
                <Portal>
                    <Box
                        position="fixed"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        zIndex={1300}
                        css={{
                            backdropFilter: 'blur(8px) saturate(120%)',
                            WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                            background: 'rgba(0, 0, 0, 0.2)',
                            _dark: {
                                background: 'rgba(0, 0, 0, 0.4)',
                            },
                            pointerEvents: 'auto',
                        }}
                        onClick={() => {
                            setIsMovePopoverOpen(false);
                            setIsAddPopoverOpen(false);
                        }}
                    />
                </Portal>
            )}

            <Portal>
                <Box
                    position="fixed"
                    bottom="20px"
                    left="50%"
                    transform="translateX(-50%)"
                    zIndex={1400}
                    minWidth="400px"
                    maxWidth="90vw"
                    pointerEvents="auto"
                    py={4}
                    px={6}
                    borderRadius="12px"
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
                    <VStack gap={2} width="100%">
                        {/* Selection summary */}
                        <HStack gap={1.5} justify="center" wrap="wrap">
                            {selectionSummary.length > 0 ? (
                                <>
                                    {selectionSummary.map((part, index) => (
                                        <HStack key={index} gap={1}>
                                            {index > 0 && (
                                                <Text fontSize="xs" color="text.secondary">
                                                    •
                                                </Text>
                                            )}
                                            <Text
                                                fontSize="xs"
                                                color="secondary.solid"
                                                _dark={{ color: "blue.300" }}
                                            >
                                                {part.count}
                                            </Text>
                                            <Icon
                                                fontSize="xs"
                                                color="secondary.solid"
                                                _dark={{ color: "blue.300" }}
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
                                    {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                                </Text>
                            )}
                        </HStack>

                        {/* Action buttons */}
                        <HStack gap={2} justify="center" wrap="wrap">
                            {/* Delete */}
                            <Button
                                variant="subtle"
                                size="sm"
                                onClick={handleDeleteClick}
                                disabled={isLoading || actionLoading}
                                colorPalette="red"
                                rounded="full"
                                px={4}
                            >
                                <HStack gap={2}>
                                    <LuTrash2 />
                                    <Text>Delete</Text>
                                </HStack>
                            </Button>

                            <Separator orientation="vertical" height="20px" />

                            {/* Clear selection */}
                            <Button
                                variant="surface"
                                colorPalette="gray"
                                size="sm"
                                onClick={onClearSelection}
                                disabled={isLoading || actionLoading}
                                rounded="full"
                                px={4}
                            >
                                <HStack gap={2}>
                                    <LuX />
                                    <Text>Clear</Text>
                                </HStack>
                            </Button>

                            {foldersWithId.length > 0 && !hasPlanSelection && (
                                <>
                                    <Separator orientation="vertical" height="20px" />

                                    {/* Move to Folder */}
                                    <SelectorPopover
                                        items={foldersWithId}
                                        triggerIcon={<LuFolderPlus />}
                                        triggerLabel="Move"
                                        showArrow={false}
                                        triggerVariant="subtle"
                                        triggerColorPalette="blue"
                                        popoverTitle="Move to Group"
                                        emptyStateMessage="No Groups Found"
                                        emptyStateIcon={
                                            <Icon fontSize="2xl" color="blue.500">
                                                <MdFolder />
                                            </Icon>
                                        }
                                        renderItem={(folder) => (
                                            <HStack gap={2}>
                                                <Icon color="blue.500">
                                                    <MdFolder />
                                                </Icon>
                                                <Text fontSize="sm" fontWeight="medium">
                                                    {folder.name}
                                                </Text>
                                            </HStack>
                                        )}
                                        getConfirmLabel={(count) =>
                                            `Move to ${count} Group${count !== 1 ? 's' : ''}`
                                        }
                                        confirmButtonLabel="Move"
                                        confirmButtonColorPalette="blue"
                                        onConfirm={(selectedFolders) => {
                                            if (selectedFolders.length > 0) {
                                                onMoveToFolder(selectedFolders[0].path);
                                            }
                                        }}
                                        onOpenChange={handleMovePopoverChange}
                                        loading={isLoading || actionLoading}
                                        disabled={isLoading || actionLoading}
                                    />
                                </>
                            )}

                            <Separator orientation="vertical" height="20px" />

                            {/* Add to Project */}
                            <AddToProjectPopover
                                onConfirm={handleAddToProject}
                                itemCount={selectedItems.length}
                                sourceFiles={selectedItems.map(item => ({
                                    path: item.path || '',
                                    name: item.name,
                                    type: item.type.toLowerCase() as 'kit' | 'walkthrough' | 'diagram' | 'agent'
                                }))}
                                trigger={
                                    <Button
                                        variant="subtle"
                                        colorPalette="blue"
                                        size="sm"
                                        disabled={isLoading || actionLoading}
                                        rounded="full"
                                        px={4}
                                        data-state={isAddPopoverOpen ? "open" : undefined}
                                        aria-expanded={isAddPopoverOpen}
                                    >
                                        <HStack gap={2}>
                                            <LuFolderPlus />
                                            <Text>Add to Project</Text>
                                        </HStack>
                                    </Button>
                                }
                            />

                            <Separator orientation="vertical" height="20px" />

                            {/* Publish to Library */}
                            <Button
                                variant="subtle"
                                colorPalette="blue"
                                size="sm"
                                onClick={() => setPublishDialogOpen(true)}
                                disabled={isLoading || actionLoading}
                                rounded="full"
                                px={4}
                            >
                                <HStack gap={2}>
                                    <LuUpload />
                                    <Text>Publish</Text>
                                </HStack>
                            </Button>
                        </HStack>
                    </VStack>
                </Box>
            </Portal>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmationDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                items={selectedItems}
            />

            {/* Publish to Library Dialog */}
            <PublishToLibraryDialog
                isOpen={publishDialogOpen}
                onClose={() => setPublishDialogOpen(false)}
                items={selectedItems.map(item => ({
                    path: item.path,
                    name: item.name,
                    type: item.type,
                    projectId: item.projectId,
                    projectPath: item.projectPath,
                }))}
                onPublished={handlePublishComplete}
            />
        </>
    );
}

export default ResourceSelectionBar;
