/**
 * WalkthroughWorkspace - Main container for the walkthrough view
 *
 * Combines:
 * - Right sidebar: WalkthroughOverviewPanel
 * - Main content: WalkthroughDocViewPage
 *
 * Simple two-panel layout with:
 * - Fixed-width sidebar (toggleable)
 * - Main content area
 */
import { useState, useCallback, useEffect } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import type { WalkthroughDetails, Takeaway } from '@/types/walkthrough';
import {
    invokeGetWalkthroughDetails,
    invokeToggleTakeawayComplete,
    invokeAddWalkthroughTakeaway,
    invokeDeleteWalkthroughTakeaway,
} from '@/ipc/walkthroughs';
import { invokeReadFile } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import WalkthroughOverviewPanel from './WalkthroughOverviewPanel';
import WalkthroughDocViewPage from './WalkthroughDocViewPage';

// Sidebar constants
const SIDEBAR_WIDTH = 480; // Fixed width in pixels

interface WalkthroughWorkspaceProps {
    walkthroughId: string;
    onBack?: () => void;
}

export default function WalkthroughWorkspace({
    walkthroughId,
    onBack,
}: WalkthroughWorkspaceProps) {
    const [details, setDetails] = useState<WalkthroughDetails | null>(null);
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    // Toggle sidebar
    const togglePanel = useCallback(() => {
        setIsPanelOpen(prev => !prev);
    }, []);

    // Load walkthrough details and content
    const loadWalkthrough = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const walkthroughDetails = await invokeGetWalkthroughDetails(walkthroughId);

            // Only update details if they changed to prevent re-renders
            setDetails(prev => {
                if (JSON.stringify(prev) === JSON.stringify(walkthroughDetails)) return prev;
                return walkthroughDetails;
            });

            // Load markdown content
            const fileContent = await invokeReadFile(walkthroughDetails.filePath);
            setContent(prev => prev !== fileContent ? fileContent : prev);
        } catch (error) {
            console.error('Failed to load walkthrough:', error);
            if (!isSilent) {
                toaster.create({
                    type: 'error',
                    title: 'Failed to load walkthrough',
                    description: String(error),
                });
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [walkthroughId]);

    // Initial load and polling for updates
    useEffect(() => {
        loadWalkthrough(); // Initial load (shows spinner)

        // Poll for updates every 2 seconds
        // This allows the user to edit the file externally and see updates here
        const intervalId = setInterval(() => {
            loadWalkthrough(true); // Silent load (no spinner)
        }, 2000);

        return () => clearInterval(intervalId);
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

    if (!loading && !details) {
        return (
            <Box p={8}>
                <Text color="text.secondary">Walkthrough not found</Text>
            </Box>
        );
    }

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
                ) : details ? (
                    <WalkthroughDocViewPage
                        details={details}
                        content={content}
                        onBack={onBack}
                        isPanelOpen={isPanelOpen}
                        onTogglePanel={togglePanel}
                        onContentChange={(newContent) => setContent(newContent)}
                    />
                ) : null}
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
                    <WalkthroughOverviewPanel
                        details={details}
                        loading={loading}
                        onToggleTakeaway={handleToggleTakeaway}
                        onAddTakeaway={handleAddTakeaway}
                        onDeleteTakeaway={handleDeleteTakeaway}
                    />
                </Box>
            )}
        </Flex>
    );
}
