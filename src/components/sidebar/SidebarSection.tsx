import { Box, VStack, Flex, Text, IconButton } from '@chakra-ui/react';
import { ReactNode, useState } from 'react';

import { LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { useColorMode } from '../../contexts/ColorModeContext';

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
            mb={flex ? 0 : 4}
            direction="column"
            flex={flex ? "1" : undefined}
            minH={flex ? 0 : undefined}
        >
            <Box
                px={3}
                py={2}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                cursor={collapsible ? "pointer" : "default"}
                onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
            >
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

                <Box display="flex" alignItems="center">
                    {rightElement}

                    {collapsible && (
                        <IconButton
                            aria-label={isExpanded ? "Collapse section" : "Expand section"}
                            size="xs"
                            variant="ghost"
                            color={labelColor}
                            boxSize={5}
                            minW={5}
                            ml={1}
                        >
                            {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                        </IconButton>
                    )}
                </Box>
            </Box>

            {(!collapsible || isExpanded) && (
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
            )}
        </Container>
    );
}
