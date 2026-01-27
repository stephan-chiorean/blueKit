import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { ToolkitHeader, ToolkitHeaderProps } from '../ToolkitHeader';

interface StandardPageLayoutProps {
    // Header
    title: string;
    headerAction?: ToolkitHeaderProps['action'];
    parentName?: string; // For breadcrumbs

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
    parentName,
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
        <Flex direction="column" h="100%" w="100%" overflow="hidden">
            <ToolkitHeader title={title} action={headerAction} parentName={parentName} />

            <Box flex={1} overflowY="auto" p={6}>
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
            </Box>
        </Flex>
    );
}
