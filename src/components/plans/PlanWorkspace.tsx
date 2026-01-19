import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Splitter, VStack } from '@chakra-ui/react';
import { PlanDocument, PlanDetails } from '../../types/plan';
import { ResourceFile } from '../../types/resource';
import { invokeGetPlanDetails } from '../../ipc';
import { toaster } from '../ui/toaster';
import { useColorMode } from '../../contexts/ColorModeContext';
import PlanOverviewPanel from './PlanOverviewPanel';
import PlanDocViewPage from './PlanDocViewPage';

interface PlanWorkspaceProps {
    plan: ResourceFile;
    onBack?: () => void;
    onPlanDeleted?: () => void;
}

// Sidebar drag UX constants - matching ProjectDetailPage
const SIDEBAR_STORAGE_KEY = 'bluekit-plan-sidebar-width';
const SIDEBAR_MIN_PX = 240;
const SIDEBAR_MAX_PX = 500;
const SIDEBAR_MAX_PERCENT = 40;
const SIDEBAR_DEFAULT_PERCENT = 25;
const SNAP_COLLAPSE_THRESHOLD = 0.55;

/**
 * PlanWorkspace is the main container for the plan view.
 * It combines PlanOverviewPanel (left) and PlanDocViewPage (right)
 * with synchronized document selection.
 * 
 * Styled to match NoteViewPage/ProjectDetailPage with:
 * - Glassmorphic sidebar
 * - Minimal invisible resize trigger  
 * - Rounded content panel with border styling
 */
export default function PlanWorkspace({ plan, onBack, onPlanDeleted }: PlanWorkspaceProps) {
    const { colorMode } = useColorMode();
    const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDocIndex, setSelectedDocIndex] = useState(0);

    // Sidebar state - matching ProjectDetailPage
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

    const planId = (plan as any).id || plan.frontMatter?.id || '';

    // Styling matching ProjectDetailPage exactly
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

    // Load plan details
    const loadPlanDetails = useCallback(async () => {
        if (!planId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const details = await invokeGetPlanDetails(planId);
            setPlanDetails(details);

            // Reset to first document when plan loads
            if (details.documents.length > 0) {
                setSelectedDocIndex(0);
            }
        } catch (error) {
            console.error('Failed to load plan details:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to load plan details',
                description: String(error),
                closable: true,
            });
        } finally {
            setLoading(false);
        }
    }, [planId]);

    // Load on mount
    useEffect(() => {
        loadPlanDetails();
    }, [loadPlanDetails]);

    // Get documents sorted by filename
    const sortedDocuments = useMemo(() => planDetails?.documents
        ? [...planDetails.documents].sort((a, b) => a.fileName.localeCompare(b.fileName))
        : [], [planDetails?.documents]);

    // Handle document selection from overview panel
    const handleDocumentSelect = useCallback((document: PlanDocument) => {
        const index = sortedDocuments.findIndex(d => d.id === document.id);
        if (index >= 0) {
            setSelectedDocIndex(index);
        }
    }, [sortedDocuments]);

    // Handle navigation from doc viewer
    const handleDocNavigate = useCallback((index: number, _document: PlanDocument) => {
        setSelectedDocIndex(index);
    }, []);

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
                onResize={(details) => {
                    if (details.size && details.size.length >= 2) {
                        const [sidebar, content] = details.size;
                        const containerWidth = splitterContainerRef.current?.clientWidth || window.innerWidth;
                        const minSidebarPercent = (SIDEBAR_MIN_PX / containerWidth) * 100;
                        const pixelMaxPercent = (SIDEBAR_MAX_PX / containerWidth) * 100;
                        const maxSidebarPercent = Math.min(pixelMaxPercent, SIDEBAR_MAX_PERCENT);
                        const snapThresholdPercent = minSidebarPercent * SNAP_COLLAPSE_THRESHOLD;

                        let newSidebar = sidebar;
                        let newContent = content;

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
                            newContent = content;
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
                {/* Plan Overview Panel - glassmorphic sidebar */}
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
                    <PlanOverviewPanel
                        plan={plan}
                        planDetails={planDetails}
                        loading={loading}
                        selectedDocumentId={sortedDocuments[selectedDocIndex]?.id}
                        onSelectDocument={handleDocumentSelect}
                        onBack={onBack}
                        onPlanDeleted={onPlanDeleted}
                        onUpdate={loadPlanDetails}
                    />
                </Splitter.Panel>

                {/* Minimal Resize Handle - matching ProjectDetailPage exactly */}
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
                        {loading ? (
                            <Box h="100%" display="flex" alignItems="center" justifyContent="center">
                                Loading...
                            </Box>
                        ) : (
                            <PlanDocViewPage
                                documents={sortedDocuments}
                                currentIndex={selectedDocIndex}
                                onNavigate={handleDocNavigate}
                            />
                        )}
                    </Box>
                </Splitter.Panel>
            </Splitter.Root>
        </Box>
    );
}

