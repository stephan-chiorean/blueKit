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
    LuBookmark,
    LuTrash2,
    LuX,
    LuPackage,
    LuBookOpen,
    LuBot,
    LuNetwork,
} from 'react-icons/lu';
import { CiBookmarkPlus } from 'react-icons/ci';
import { Project } from '@/ipc';
import { LibraryCollection } from '@/ipc/library';
import { PullButton } from './PullButton';
import { SelectorPopover } from './SelectorPopover';
import { SelectedVariation } from './CatalogDetailModal';

// Artifact type icon mapping - matches other components
const artifactTypeIcon: Record<string, React.ReactNode> = {
    kit: <LuPackage />,
    walkthrough: <LuBookOpen />,
    agent: <LuBot />,
    diagram: <LuNetwork />,
    implementation_plan: <LuNetwork />,
};

// Artifact type label mapping for pluralization
const artifactTypeLabels: Record<string, { singular: string; plural: string }> = {
    kit: { singular: 'kit', plural: 'kits' },
    walkthrough: { singular: 'walkthrough', plural: 'walkthroughs' },
    agent: { singular: 'agent', plural: 'agents' },
    diagram: { singular: 'diagram', plural: 'diagrams' },
    implementation_plan: { singular: 'plan', plural: 'plans' },
};

interface LibrarySelectionBarProps {
    isOpen: boolean;
    selectedVariations: SelectedVariation[];
    onClearSelection: () => void;
    onRemoveFromCollection: () => void;
    onMoveToCollection: (collectionId: string) => void;
    onBulkPull: (projects: Project[]) => void;
    projects: Project[];
    collections: LibraryCollection[];
    isLoading?: boolean;
    // Positioning mode: 'fixed' (bottom of screen) or 'absolute' (rendered in place, e.g. inside a modal's footer area)
    position?: 'fixed' | 'absolute';
    bottomOffset?: string;
}

export function LibrarySelectionBar({
    isOpen,
    selectedVariations,
    onClearSelection,
    onRemoveFromCollection,
    onMoveToCollection,
    onBulkPull,
    projects,
    collections,
    isLoading = false,
    position = 'fixed',
    bottomOffset = '20px',
}: LibrarySelectionBarProps) {
    // Build selection summary with icons grouped by artifact type
    const selectionSummary = useMemo(() => {
        const typeCounts: Record<string, number> = {};

        for (const { catalog } of selectedVariations) {
            const artifactType = catalog.artifact_type || 'kit';
            typeCounts[artifactType] = (typeCounts[artifactType] || 0) + 1;
        }

        const parts: { count: number; label: string; icon: React.ReactNode }[] = [];

        // Dynamically handle all artifact types
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
    }, [selectedVariations]);
    const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
    const [isPullPopoverOpen, setIsPullPopoverOpen] = useState(false);
    const [shouldShowBlur, setShouldShowBlur] = useState(false);

    // Use refs to track popover states synchronously (no render delay)
    const isAddPopoverOpenRef = useRef(false);
    const isPullPopoverOpenRef = useRef(false);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update blur state based on refs (synchronous check)
    const updateBlurState = useCallback(() => {
        const anyPopoverOpen = isAddPopoverOpenRef.current || isPullPopoverOpenRef.current;

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
                if (!isAddPopoverOpenRef.current && !isPullPopoverOpenRef.current) {
                    setShouldShowBlur(false);
                }
            }, 100);
        }
    }, []);

    // Handlers that update both refs and state immediately
    const handleAddPopoverChange = useCallback((isOpen: boolean) => {
        isAddPopoverOpenRef.current = isOpen;
        setIsAddPopoverOpen(isOpen);
        updateBlurState();
    }, [updateBlurState]);

    const handlePullPopoverChange = useCallback((isOpen: boolean) => {
        isPullPopoverOpenRef.current = isOpen;
        setIsPullPopoverOpen(isOpen);
        updateBlurState();
    }, [updateBlurState]);

    // Sync refs when state changes (fallback for external state changes)
    useEffect(() => {
        isAddPopoverOpenRef.current = isAddPopoverOpen;
        updateBlurState();
    }, [isAddPopoverOpen, updateBlurState]);

    useEffect(() => {
        isPullPopoverOpenRef.current = isPullPopoverOpen;
        updateBlurState();
    }, [isPullPopoverOpen, updateBlurState]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Style config based on position
    const positionStyles = position === 'fixed' ? {
        position: 'fixed' as const,
        bottom: bottomOffset,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1400, // Higher than most things, lower than heavy modals if needed
    } : {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    };

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
                        zIndex={position === 'fixed' ? 1300 : 5} // Below selection bar (1400 when fixed, 10 when absolute)
                        css={{
                            backdropFilter: 'blur(8px) saturate(120%)',
                            WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                            background: 'rgba(0, 0, 0, 0.2)',
                            _dark: {
                                background: 'rgba(0, 0, 0, 0.4)',
                            },
                            pointerEvents: 'auto', // Allow clicks to close popover
                        }}
                        onClick={() => {
                            setIsAddPopoverOpen(false);
                            setIsPullPopoverOpen(false);
                        }}
                    />
                </Portal>
            )}

            {isOpen && (
                <Box
                    {...positionStyles}
                    width={position === 'absolute' ? '100%' : 'auto'}
                    minWidth={position === 'fixed' ? '400px' : 'auto'}
                    maxWidth="90vw"
                    pointerEvents="auto"
                    py={4}
                    px={6}
                    borderRadius={position === 'fixed' ? '12px' : '0 0 16px 16px'}
                    css={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        borderTopWidth: position === 'absolute' ? '1px' : '0',
                        borderWidth: position === 'fixed' ? '1px' : '0',
                        borderColor: 'rgba(0, 0, 0, 0.08)',
                        boxShadow: position === 'fixed'
                            ? '0 10px 40px -10px rgba(0,0,0,0.1)'
                            : 'none',
                        _dark: {
                            background: 'rgba(30, 30, 30, 0.85)',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            boxShadow: position === 'fixed'
                                ? '0 10px 40px -10px rgba(0,0,0,0.5)'
                                : 'none',
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
                                        // Fallback: Show total count if summary is empty
                                        <Text fontSize="xs" color="text.secondary" fontWeight="medium">
                                            {selectedVariations.length} item{selectedVariations.length !== 1 ? 's' : ''} selected
                                        </Text>
                                    )}
                                </HStack>

                                {/* Action buttons */}
                                <HStack gap={2} justify="center" wrap="wrap">
                                    {/* Remove from Collection - far left */}
                                    <Button
                                        variant="subtle"
                                        size="sm"
                                        onClick={onRemoveFromCollection}
                                        disabled={isLoading}
                                        colorPalette="red"
                                        rounded="full"
                                        px={4}
                                    >
                                        <HStack gap={2}>
                                            <LuTrash2 />
                                            <Text>Remove</Text>
                                        </HStack>
                                    </Button>

                                    <Separator orientation="vertical" height="20px" />

                                    {/* Clear selection */}
                                    <Button
                                        variant="surface"
                                        colorPalette="gray"
                                        size="sm"
                                        onClick={onClearSelection}
                                        disabled={isLoading}
                                        rounded="full"
                                        px={4}
                                    >
                                        <HStack gap={2}>
                                            <LuX />
                                            <Text>Clear</Text>
                                        </HStack>
                                    </Button>

                                    <Separator orientation="vertical" height="20px" />

                                    {/* Add to Collection */}
                                    <SelectorPopover
                                        items={collections}
                                        triggerIcon={<CiBookmarkPlus />}
                                        triggerLabel="Add"
                                        showArrow={false}
                                        triggerVariant="subtle"
                                        triggerColorPalette="blue"
                                        popoverTitle="Add to Collection"
                                        emptyStateMessage="No Collections Found"
                                        emptyStateIcon={
                                            <Icon fontSize="2xl" color="blue.500">
                                                <LuBookmark />
                                            </Icon>
                                        }
                                        renderItem={(collection) => (
                                            <HStack gap={2}>
                                                <Icon color={collection.color || 'blue.500'}>
                                                    <LuBookmark />
                                                </Icon>
                                                <Text fontSize="sm" fontWeight="medium">
                                                    {collection.name}
                                                </Text>
                                            </HStack>
                                        )}
                                        getConfirmLabel={(count) =>
                                            `Add to ${count} Collection${count !== 1 ? 's' : ''}`
                                        }
                                        confirmButtonLabel="Add"
                                        confirmButtonColorPalette="blue"
                                        onConfirm={(selectedCollections) => {
                                            // Move to first selected collection
                                            // (In practice, users typically select one collection)
                                            if (selectedCollections.length > 0) {
                                                onMoveToCollection(selectedCollections[0].id);
                                            }
                                        }}
                                        onOpenChange={handleAddPopoverChange}
                                        loading={isLoading}
                                        disabled={isLoading}
                                    />

                                    <Separator orientation="vertical" height="20px" />

                                    {/* Pull button */}
                                    <PullButton
                                        projects={projects}
                                        onConfirmPull={onBulkPull}
                                        loading={isLoading}
                                        onOpenChange={handlePullPopoverChange}
                                    />
                                </HStack>
                            </VStack>
                </Box>
            )}
        </>
    );
}
