import { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { PlanDocument, PlanDetails } from '@/types/plan';
import { ResourceFile } from '@/types/resource';
import { invokeGetPlanDetails, invokeWatchPlanFolder } from '@/ipc';
import { invokeStopWatcher } from '@/ipc/projects';
import { toaster } from '@/shared/components/ui/toaster';

import PlanOverviewPanel from './PlanOverviewPanel';
import PlanDocViewPage from './PlanDocViewPage';

interface PlanWorkspaceProps {
    plan: ResourceFile;
    onPlanDeleted?: () => void | Promise<void>;
    onBack?: () => void;
}

// Sidebar constants
const SIDEBAR_WIDTH = 480; // Fixed width in pixels

/**
 * PlanWorkspace is the main container for the plan view.
 * It combines PlanOverviewPanel (right sidebar) and PlanDocViewPage (main content)
 * with synchronized document selection.
 *
 * Simple two-panel layout with:
 * - Glassmorphic fixed-width sidebar (toggleable)
 * - Main content area with subtle background
 */
export default function PlanWorkspace({ plan, onPlanDeleted, onBack }: PlanWorkspaceProps) {

    const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDocIndex, setSelectedDocIndex] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    const planId = (plan as any).id || plan.frontMatter?.id || '';

    // Toggle sidebar
    const togglePanel = useCallback(() => {
        setIsPanelOpen(prev => !prev);
    }, []);

    // Load plan details
    const loadPlanDetails = useCallback(async (isBackground = false) => {
        if (!planId) {
            setLoading(false);
            return;
        }

        try {
            if (!isBackground) {
                setLoading(true);
            }
            const details = await invokeGetPlanDetails(planId);
            setPlanDetails(details);

            // Reset to first document when plan loads (only on initial load)
            if (!isBackground && details.documents.length > 0) {
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
            if (!isBackground) {
                setLoading(false);
            }
        }
    }, [planId]);

    // Wrapper for silent updates
    const handlePlanUpdate = useCallback(() => {
        loadPlanDetails(true);
    }, [loadPlanDetails]);

    // Load on mount
    useEffect(() => {
        loadPlanDetails(false);
    }, [loadPlanDetails]);

    // Set up file watcher for plan folder
    useEffect(() => {
        if (!planId || !planDetails?.folderPath) return;

        let isMounted = true;
        let unlistenFn: (() => void) | null = null;

        const setupWatcher = async () => {
            try {
                // Start watching the plan folder
                await invokeWatchPlanFolder(planId, planDetails.folderPath);
                const eventName = `plan-documents-changed-${planId}`;

                // Listen for file changes
                const unlisten = await listen<string[]>(eventName, (event) => {
                    if (isMounted) {
                        const changedPaths = event.payload;
                        if (changedPaths.length > 0) {
                            // Reload plan details in background (updates document list)
                            handlePlanUpdate();
                        }
                    }
                });

                unlistenFn = unlisten;
            } catch (error) {
                console.error(`Failed to set up file watcher for plan ${planId}:`, error);
            }
        };

        setupWatcher();

        return () => {
            isMounted = false;
            if (unlistenFn) {
                unlistenFn();
            }

            // Stop the watcher when component unmounts
            const eventName = `plan-documents-changed-${planId}`;
            invokeStopWatcher(eventName).catch(err => {
                console.warn('Failed to stop plan folder watcher:', err);
            });
        };
    }, [planId, planDetails?.folderPath, handlePlanUpdate]);

    // Get documents (already sorted by backend)
    const sortedDocuments = useMemo(() => planDetails?.documents || [], [planDetails?.documents]);

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
        <Flex h="100%" w="100%" overflow="hidden">
            {/* Main Content Area - matches tab content styling */}
            <Box
                flex="1"
                h="100%"
                minH={0}
                overflowY="auto"
                overflowX="hidden"
                position="relative"

            >
                {loading ? (
                    <Box h="100%" display="flex" alignItems="center" justifyContent="center">
                        Loading...
                    </Box>
                ) : (
                    <PlanDocViewPage
                        documents={sortedDocuments}
                        currentIndex={selectedDocIndex}
                        planId={planId}
                        isPanelOpen={isPanelOpen}
                        onTogglePanel={togglePanel}
                        onNavigate={handleDocNavigate}
                        onBack={onBack}
                    />
                )}
            </Box>

            {/* Sidebar Panel - No extra blur since we're inside BrowserTabs content */}
            {isPanelOpen && (
                <Box
                    w={`${SIDEBAR_WIDTH}px`}
                    h="100%"
                    overflow="hidden"
                    css={{
                        // Transparent - inherits from parent's blur
                        background: 'transparent',

                    }}
                >
                    <PlanOverviewPanel
                        plan={plan}
                        planDetails={planDetails}
                        loading={loading}
                        selectedDocumentId={sortedDocuments[selectedDocIndex]?.id}
                        onSelectDocument={handleDocumentSelect}
                        onPlanDeleted={onPlanDeleted}
                        onUpdate={handlePlanUpdate}
                    />
                </Box>
            )}
        </Flex>
    );
}

