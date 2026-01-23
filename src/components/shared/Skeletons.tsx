import { Box, Flex, HStack, Skeleton, VStack, Card } from "@chakra-ui/react";

export const SimpleFolderCardSkeleton = () => {
    return (
        <Box position="relative">
            {/* Folder icon placeholder */}
            <Box
                position="absolute"
                top="-8px"
                left="12px"
                zIndex={2}
                width="24px"
                height="24px"
            >
                <Skeleton height="24px" width="24px" borderRadius="sm" />
            </Box>
            <Card.Root
                borderWidth="1px"
                borderRadius="xl"
                css={{
                    background: 'rgba(255, 255, 255, 0.4)',
                    _dark: { background: 'rgba(30, 30, 30, 0.4)' },
                }}
            >
                <Box p={2.5} minH="120px" display="flex" flexDirection="column" justifyContent="center">
                    <VStack align="center" gap={3}>
                        <Skeleton height="20px" width="70%" borderRadius="md" />
                        <Skeleton height="12px" width="50%" borderRadius="sm" />
                        <HStack gap={1} justify="center" mt={1}>
                            <Skeleton height="16px" width="16px" borderRadius="full" />
                            <Skeleton height="16px" width="20px" borderRadius="sm" />
                        </HStack>
                    </VStack>
                </Box>
            </Card.Root>
        </Box>
    );
};

export const ResourceCardSkeleton = () => {
    return (
        <Card.Root
            borderWidth="1px"
            borderRadius="xl"
            css={{
                background: 'rgba(255, 255, 255, 0.4)',
                _dark: { background: 'rgba(30, 30, 30, 0.4)' },
            }}
        >
            <Box p={4}>
                <VStack align="stretch" gap={3}>
                    <Flex justify="space-between" align="center">
                        <HStack gap={2} flex={1}>
                            <Skeleton height="20px" width="20px" borderRadius="sm" />
                            <Skeleton height="20px" width="60%" borderRadius="md" />
                        </HStack>
                        <Skeleton height="20px" width="20px" borderRadius="sm" />
                    </Flex>
                    <Skeleton height="14px" width="90%" borderRadius="sm" />
                    <Skeleton height="14px" width="70%" borderRadius="sm" />
                    <HStack gap={2} mt={1}>
                        <Skeleton height="20px" width="60px" borderRadius="full" />
                        <Skeleton height="20px" width="60px" borderRadius="full" />
                    </HStack>
                </VStack>
            </Box>
        </Card.Root>
    );
};

export const PlanCardSkeleton = () => {
    return (
        <Card.Root
            borderWidth="1px"
            borderRadius="xl"
            css={{
                background: 'rgba(255, 255, 255, 0.4)',
                _dark: { background: 'rgba(30, 30, 30, 0.4)' },
            }}
        >
            <Box p={4}>
                <VStack align="stretch" gap={3}>
                    {/* Header: Icon, Name, Status, Checkbox */}
                    <Flex justify="space-between" align="center">
                        <HStack gap={2} flex={1}>
                            <Skeleton height="20px" width="20px" borderRadius="sm" />
                            <Skeleton height="20px" width="50%" borderRadius="md" />
                            <Skeleton height="20px" width="60px" borderRadius="sm" />
                        </HStack>
                        <Skeleton height="20px" width="20px" borderRadius="sm" />
                    </Flex>

                    {/* Description */}
                    <Box minH="40px">
                        <VStack align="stretch" gap={2}>
                            <Skeleton height="14px" width="95%" borderRadius="sm" />
                            <Skeleton height="14px" width="70%" borderRadius="sm" />
                        </VStack>
                    </Box>

                    {/* Progress */}
                    <VStack gap={1} align="stretch" mt={1}>
                        <Flex justify="space-between" align="center">
                            <Skeleton height="12px" width="40px" borderRadius="sm" />
                            <Skeleton height="12px" width="30px" borderRadius="sm" />
                        </Flex>
                        <Skeleton height="8px" width="100%" borderRadius="full" />
                    </VStack>

                    {/* Footer: Date */}
                    <Flex justify="flex-end">
                        <Skeleton height="12px" width="80px" borderRadius="sm" />
                    </Flex>
                </VStack>
            </Box>
        </Card.Root>
    );
};

export const TableSkeleton = () => {
    return (
        <VStack gap={0} w="full" borderWidth="1px" borderRadius="16px" overflow="hidden">
            {/* Header */}
            <Box w="full" p={3} bg="bg.subtle" borderBottomWidth="1px">
                <HStack gap={4}>
                    <Skeleton height="20px" width="30%" />
                    <Skeleton height="20px" width="35%" />
                    <Skeleton height="20px" width="10%" />
                    <Skeleton height="20px" width="10%" />
                    <Skeleton height="20px" width="15%" />
                </HStack>
            </Box>
            {/* Rows */}
            {[1, 2, 3, 4, 5].map((i) => (
                <Box key={i} w="full" p={3} borderBottomWidth={i < 5 ? "1px" : "0px"}>
                    <HStack gap={4}>
                        <HStack width="30%" gap={2}>
                            <Skeleton height="16px" width="16px" />
                            <Skeleton height="16px" width="70%" />
                        </HStack>
                        <Skeleton height="16px" width="35%" />
                        <Skeleton height="16px" width="10%" />
                        <Skeleton height="16px" width="10%" />
                        <Skeleton height="16px" width="15%" />
                    </HStack>
                </Box>
            ))}
        </VStack>
    );
};
