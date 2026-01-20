/**
 * WalkthroughWorkspace - Main container for the walkthrough view
 * 
 * Combines:
 * - Left sidebar: WalkthroughOverviewPanel
 * - Right content: WalkthroughDocViewPage
 * 
 * Styled to match PlanWorkspace with:
 * - Glassmorphic sidebar
 * - Minimal invisible resize trigger  
 * - Rounded content panel with border styling
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Splitter, VStack, Spinner, Text } from '@chakra-ui/react';
import type { WalkthroughDetails, Takeaway } from '../../types/walkthrough';
import {
    invokeGetWalkthroughDetails,
    invokeToggleTakeawayComplete,
    invokeAddWalkthroughTakeaway,
    invokeDeleteWalkthroughTakeaway,
} from '../../ipc/walkthroughs';
import { invokeReadFile } from '../../ipc';
import { toaster } from '../ui/toaster';
import { useColorMode } from '../../contexts/ColorModeContext';
import WalkthroughOverviewPanel from './WalkthroughOverviewPanel';
import WalkthroughDocViewPage from './WalkthroughDocViewPage';

// Sidebar drag UX constants - matching PlanWorkspace/ProjectDetailPage
const SIDEBAR_STORAGE_KEY = 'bluekit-walkthrough-sidebar-width';
const SIDEBAR_MIN_PX = 240;
const SIDEBAR_MAX_PX = 500;
const SIDEBAR_MAX_PERCENT = 40;
const SIDEBAR_DEFAULT_PERCENT = 25;
const SNAP_COLLAPSE_THRESHOLD = 0.55;

interface WalkthroughWorkspaceProps {
    walkthroughId: string;
    onBack: () => void;
}

export default function WalkthroughWorkspace({
    walkthroughId,
    onBack,
}: WalkthroughWorkspaceProps) {
    const { colorMode } = useColorMode();

    const [details, setDetails] = useState<WalkthroughDetails | null>(null);
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Sidebar state - matching PlanWorkspace
    const [splitSizes, setSplitSizes] = useState<[number, number]>(() => {
        try {
            const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length === 2) {
                    return parsed as [number, number];
                }
            }
        } catch {
            // Invalid stored value, use default
        }
        return [SIDEBAR_DEFAULT_PERCENT, 100 - SIDEBAR_DEFAULT_PERCENT];
    });
    const [isSidebarDragging, setIsSidebarDragging] = useState(false);
    const splitterContainerRef = useRef<HTMLDivElement>(null);

    // Styling matching PlanWorkspace exactly
    const sidebarBg = colorMode === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(20, 20, 25, 0.15)';
    const contentBorderStyle = colorMode === 'light'
        ? {
            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
            borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
        }
        : {
            borderTop: '1px solid rgba(99, 102, 241, 0.2)',
            borderLeft: '1px solid rgba(99, 102, 241, 0.2)',
        };

    // Persist sidebar width to localStorage
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(splitSizes));
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [splitSizes]);

    // Toggle sidebar collapse/expand
    const toggleSidebar = useCallback(() => {
        const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
        const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;

        setSplitSizes(prev => {
            if (prev[0] < 5) {
                return [minSidebarPercent, 100 - minSidebarPercent];
            } else {
                return [0, 100];
            }
        });
    }, []);

    // Load walkthrough details and content
    const loadWalkthrough = useCallback(async () => {
        try {
            setLoading(true);
            const walkthroughDetails = await invokeGetWalkthroughDetails(walkthroughId);
            setDetails(walkthroughDetails);

            // Load markdown content
            const fileContent = await invokeReadFile(walkthroughDetails.filePath);
            setContent(fileContent);
        } catch (error) {
            console.error('Failed to load walkthrough:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to load walkthrough',
                description: String(error),
            });
        } finally {
            setLoading(false);
        }
    }, [walkthroughId]);

    useEffect(() => {
        loadWalkthrough();
    }, [loadWalkthrough]);

    // Takeaway handlers
    const handleToggleTakeaway = useCallback(async (takeawayId: string) => {
        try {
            const updated = await invokeToggleTakeawayComplete(takeawayId);
            setDetails((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    takeaways: prev.takeaways.map((t) =>
                        t.id === takeawayId ? updated : t
                    ),
                    progress: calculateProgress(
                        prev.takeaways.map((t) => (t.id === takeawayId ? updated : t))
                    ),
                };
            });
        } catch (error) {
            console.error('Failed to toggle takeaway:', error);
            toaster.create({ type: 'error', title: 'Failed to update takeaway' });
        }
    }, []);

    const handleAddTakeaway = useCallback(async (title: string) => {
        if (!details) return;
        try {
            const newTakeaway = await invokeAddWalkthroughTakeaway(walkthroughId, title);
            setDetails((prev) => {
                if (!prev) return prev;
                const newTakeaways = [...prev.takeaways, newTakeaway];
                return {
                    ...prev,
                    takeaways: newTakeaways,
                    progress: calculateProgress(newTakeaways),
                };
            });
        } catch (error) {
            console.error('Failed to add takeaway:', error);
            toaster.create({ type: 'error', title: 'Failed to add takeaway' });
        }
    }, [details, walkthroughId]);

    const handleDeleteTakeaway = useCallback(async (takeawayId: string) => {
        try {
            await invokeDeleteWalkthroughTakeaway(takeawayId);
            setDetails((prev) => {
                if (!prev) return prev;
                const newTakeaways = prev.takeaways.filter((t) => t.id !== takeawayId);
                return {
                    ...prev,
                    takeaways: newTakeaways,
                    progress: calculateProgress(newTakeaways),
                };
            });
        } catch (error) {
            console.error('Failed to delete takeaway:', error);
            toaster.create({ type: 'error', title: 'Failed to delete takeaway' });
        }
    }, []);

    // Helper function
    const calculateProgress = (takeaways: Takeaway[]): number => {
        if (takeaways.length === 0) return 0;
        const completed = takeaways.filter((t) => t.completed).length;
        return (completed / takeaways.length) * 100;
    };

    if (loading) {
        return (
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                h="100%"
                bg="bg.canvas"
            >
                <Spinner size="lg" color="orange.500" />
            </Box>
        );
    }

    if (!details) {
        return (
            <Box p={8}>
                <Text color="text.secondary">Walkthrough not found</Text>
            </Box>
        );
    }

    return (
        <Box
            ref={splitterContainerRef}
            h="100%"
            w="100%"
            overflow="hidden"
        >
            <Splitter.Root
                defaultSize={[SIDEBAR_DEFAULT_PERCENT, 100 - SIDEBAR_DEFAULT_PERCENT]}
                size={splitSizes}
                onResize={(resizeDetails) => {
                    if (resizeDetails.size && resizeDetails.size.length >= 2) {
                        const [sidebar, sidebarContent] = resizeDetails.size;
                        const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
                        const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;
                        const pixelMaxPercent = (SIDEBAR_MAX_PX / containerWidth) * 100;
                        const maxSidebarPercent = Math.min(pixelMaxPercent, SIDEBAR_MAX_PERCENT);
                        const snapThresholdPercent = minSidebarPercent * SNAP_COLLAPSE_THRESHOLD;

                        let newSidebar = sidebar;
                        let newContent = sidebarContent;

                        if (sidebar > 0 && sidebar < snapThresholdPercent) {
                            newSidebar = 0;
                            newContent = 100;
                        } else if (sidebar >= snapThresholdPercent && sidebar < minSidebarPercent) {
                            newSidebar = minSidebarPercent;
                            newContent = 100 - minSidebarPercent;
                        } else if (sidebar > maxSidebarPercent) {
                            newSidebar = maxSidebarPercent;
                            newContent = 100 - newSidebar;
                        } else {
                            newSidebar = sidebar;
                            newContent = sidebarContent;
                        }

                        setSplitSizes([newSidebar, newContent]);
                    }
                }}
                panels={[
                    { id: 'overview', minSize: 0, maxSize: 100 },
                    { id: 'docview', minSize: 30 },
                ]}
                h="100%"
                orientation="horizontal"
            >
                {/* Overview Panel - glassmorphic sidebar */}
                <Splitter.Panel
                    id="overview"
                    bg="transparent"
                    style={{
                        background: sidebarBg,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        transition: isSidebarDragging ? 'none' : 'flex-basis 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: isSidebarDragging ? 'flex-basis' : 'auto',
                    }}
                >
                    <WalkthroughOverviewPanel
                        details={details}
                        loading={loading}
                        onBack={onBack}
                        onToggleTakeaway={handleToggleTakeaway}
                        onAddTakeaway={handleAddTakeaway}
                        onDeleteTakeaway={handleDeleteTakeaway}
                    />
                </Splitter.Panel>

                {/* Minimal Resize Handle - matching PlanWorkspace exactly */}
                <Splitter.ResizeTrigger
                    id="overview:docview"
                    w="20px"
                    minW="20px"
                    maxW="20px"
                    p={0}
                    mx="-10px"
                    bg="transparent"
                    cursor="col-resize"
                    border="none"
                    outline="none"
                    boxShadow="none"
                    position="relative"
                    zIndex={10}
                    onDoubleClick={toggleSidebar}
                    onPointerDown={() => setIsSidebarDragging(true)}
                    onPointerUp={() => setIsSidebarDragging(false)}
                    onPointerLeave={() => setIsSidebarDragging(false)}
                    css={{
                        // Hide default splitter decorations
                        '&::before': { display: 'none' },
                        '&::after': { display: 'none' },
                        '&': {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                    }}
                >
                    {/* Invisible resize hit area */}
                    <Box
                        position="absolute"
                        left="50%"
                        top={0}
                        bottom={0}
                        w="2px"
                        transform="translateX(-50%)"
                        bg="transparent"
                    />
                    {/* Drag dots indicator (shows on hover) */}
                    <Box
                        position="absolute"
                        left="50%"
                        top="50%"
                        transform="translate(-50%, -50%)"
                        opacity={0}
                        transition="opacity 0.2s ease, transform 0.2s ease"
                        css={{
                            '[data-part="resize-trigger"]:hover &': {
                                opacity: 0.7,
                                transform: 'translate(-50%, -50%) scale(1)',
                            },
                            '[data-part="resize-trigger"][data-state="dragging"] &': {
                                opacity: 1,
                                transform: 'translate(-50%, -50%) scale(1.1)',
                            },
                        }}
                    >
                        <VStack gap="3px">
                            {[0, 1, 2].map((i) => (
                                <Box
                                    key={i}
                                    w="4px"
                                    h="4px"
                                    borderRadius="full"
                                    bg={{ _light: 'rgba(99,102,241,0.7)', _dark: 'rgba(129,140,248,0.9)' }}
                                    transition="transform 0.15s ease"
                                    css={{
                                        '[data-part="resize-trigger"][data-state="dragging"] &': {
                                            transform: 'scale(1.2)',
                                        },
                                    }}
                                />
                            ))}
                        </VStack>
                    </Box>
                </Splitter.ResizeTrigger>

                {/* Document Viewer Panel - rounded content with borders */}
                <Splitter.Panel id="docview">
                    <Box
                        h="100%"
                        minH={0}
                        overflowY="auto"
                        overflowX="hidden"
                        position="relative"
                        borderTopLeftRadius="2xl"
                        style={contentBorderStyle}
                        css={{
                            background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
                            backdropFilter: 'blur(30px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                        }}
                    >
                        <WalkthroughDocViewPage
                            details={details}
                            content={content}
                            onContentChange={(newContent) => setContent(newContent)}
                        />
                    </Box>
                </Splitter.Panel>
            </Splitter.Root>
        </Box>
    );
}
