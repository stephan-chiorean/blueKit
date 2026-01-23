import { Box, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import { ToolkitHeader, ToolkitHeaderProps } from './ToolkitHeader';

interface StandardPageLayoutProps {
    // Header
    title: string;
    headerAction?: ToolkitHeaderProps['action'];

    // Optional sections
    topSection?: React.ReactNode; // For folders or other content above main list

    // Filter/View bar
    filterControl?: React.ReactNode;
    viewSwitcher?: React.ReactNode;
    extraActions?: React.ReactNode;
    itemCount?: number;
    itemLabel?: string; // "plans", "kits", "walkthroughs"

    // Content states
    isLoading?: boolean;
    loadingSkeleton?: React.ReactNode;
    isEmpty?: boolean;
    emptyState?: React.ReactNode;
    children?: React.ReactNode;
}

export function StandardPageLayout({
    title,
    headerAction,
    topSection,
    filterControl,
    viewSwitcher,
    extraActions,
    itemCount,
    itemLabel = 'items',
    isLoading,
    loadingSkeleton,
    isEmpty,
    emptyState,
    children,
}: StandardPageLayoutProps) {
    return (
        <VStack align="stretch" gap={6} width="100%">
            <ToolkitHeader title={title} action={headerAction} />

            {topSection}

            <Box position="relative" width="100%">
                <Flex align="center" justify="space-between" mb={4} minH="40px">
                    <Flex align="center" gap={2}>
                        <Heading size="md" textTransform="capitalize">
                            {itemLabel}
                        </Heading>
                        {itemCount !== undefined && (
                            <Text fontSize="sm" color="text.muted">
                                {itemCount}
                            </Text>
                        )}
                        {filterControl}
                        {extraActions}
                    </Flex>
                    {viewSwitcher}
                </Flex>

                {isLoading ? (
                    loadingSkeleton
                ) : isEmpty ? (
                    emptyState
                ) : (
                    children
                )}
            </Box>
        </VStack>
    );
}
