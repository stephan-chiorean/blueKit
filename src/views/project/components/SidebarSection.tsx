import { Box, VStack, Flex, Text, Icon } from '@chakra-ui/react';
import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

const MotionBox = motion.create(Box);

interface SidebarSectionProps {
    title: string;
    children: ReactNode;
    collapsible?: boolean;
    defaultExpanded?: boolean;
    collapsed?: boolean;
    rightElement?: ReactNode;
    flex?: boolean;
}

export default function SidebarSection({
    title,
    children,
    collapsible = false,
    defaultExpanded = true,
    collapsed = false, // parent sidebar state
    rightElement,
    flex = false
}: SidebarSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const { colorMode } = useColorMode();

    const labelColor = colorMode === 'light' ? 'gray.500' : 'gray.500';

    if (collapsed) {
        return (
            <VStack gap={2} w="100%" align="center" py={2}>
                <Box w="60%" h="1px" bg={colorMode === 'light' ? 'gray.200' : 'whiteAlpha.200'} mb={1} />
                {children}
            </VStack>
        );
    }

    const Container = flex ? Flex : Box;
    const ChildrenContainer = flex ? Flex : VStack;

    return (
        <Container
            w="100%"
            mb={flex ? 0 : 0}
            direction="column"
            flex={flex ? "1" : undefined}
            minH={flex ? 0 : undefined}
        >
            <Box
                pb={2}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                cursor={collapsible ? "pointer" : "default"}
                onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
                // Determine group hover state for chevron if needed
                role="group"
            >
                <Flex alignItems="center" gap={1}>
                    <Text
                        fontSize="xs"
                        fontWeight="bold"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        color={labelColor}
                        css={{
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                            _dark: {
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                            },
                        }}
                    >
                        {title}
                    </Text>

                    {collapsible && (
                        <Icon
                            boxSize={4}
                            color={labelColor}
                            as={isExpanded ? LuChevronDown : LuChevronRight}
                            opacity={0.6}
                            _groupHover={{ opacity: 1 }}
                            transition="opacity 0.2s"
                        />
                    )}
                </Flex>

                <Box display="flex" alignItems="center">
                    {rightElement}
                </Box>
            </Box>

            <AnimatePresence initial={false}>
                {(!collapsible || isExpanded) && (
                    <MotionBox
                        key="content"
                        initial={collapsible ? { opacity: 0, height: 0 } : undefined}
                        animate={collapsible ? { opacity: 1, height: 'auto' } : undefined}
                        exit={collapsible ? { opacity: 0, height: 0 } : undefined}
                        transition={{
                            height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                            opacity: { duration: 0.15, delay: 0.05 }
                        }}
                        style={{ overflow: flex ? undefined : 'hidden' }}
                        flex={flex ? "1" : undefined}
                        minH={flex ? 0 : undefined}
                        display={flex ? "flex" : undefined}
                        flexDirection={flex ? "column" : undefined}
                    >
                        <ChildrenContainer
                            gap={flex ? 0 : 0}
                            align="stretch"
                            direction={flex ? "column" : undefined}
                            flex={flex ? "1" : undefined}
                            minH={flex ? 0 : undefined}
                            overflow={flex ? "hidden" : undefined}
                        >
                            {children}
                        </ChildrenContainer>
                    </MotionBox>
                )}
            </AnimatePresence>
        </Container>
    );
}
