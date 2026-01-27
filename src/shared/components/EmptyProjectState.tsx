
import { VStack, Text, Icon, Button, Flex } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { LuFileText, LuPlus } from 'react-icons/lu';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

const MotionFlex = motion.create(Flex);

interface EmptyProjectStateProps {
    onCreateNote: () => void;
}

export default function EmptyProjectState({ onCreateNote }: EmptyProjectStateProps) {
    const { colorMode } = useColorMode();

    return (
        <MotionFlex
            h="100%"
            w="100%"
            align="center"
            justify="center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
                background: colorMode === 'light' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(20, 20, 25, 0.5)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTopLeftRadius: '0px', // Reset radius since parent handles it or it's full width
            }}
        >
            <VStack gap={6}>
                <VStack gap={3}>
                    <Icon boxSize={12} color="text.tertiary">
                        <LuFileText />
                    </Icon>
                    <Text color="text.secondary" fontSize="lg">
                        No document selected
                    </Text>
                    <Text color="text.tertiary" fontSize="sm">
                        Select a file from the sidebar or create a new note to get started
                    </Text>
                </VStack>

                <Button
                    onClick={onCreateNote}
                    variant="surface"
                    size="md"
                >
                    <Icon>
                        <LuPlus />
                    </Icon>
                    Add Note
                </Button>
            </VStack>
        </MotionFlex>
    );
}
