import { useState } from 'react';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import HybridMarkdownEditor from '@/shared/components/editor/hybrid/HybridMarkdownEditor';
import GradientBackground from '@/shared/components/GradientBackground';

const initialMarkdown = `
# Welcome to Hybrid Editor

This is a demonstration of the **Hybrid Markdown Editor**.

- Click on any block to edit it.
- Click outside or press Shift+Enter to save.
- Code blocks have glass styling!

\`\`\`typescript
function hello(name: string) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

## Features

1. Block-based editing
2. Pure React implementation
3. Glassmorphic design
`;

export default function HybridEditorDemo() {
    const [content, setContent] = useState(initialMarkdown);
    const { colorMode, toggleColorMode } = useColorMode();

    return (
        <Box position="relative" minH="100vh">
            <GradientBackground />
            <Box
                minH="100vh"
                p={8}
                css={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    _dark: {
                        background: 'rgba(0, 0, 0, 0.15)',
                    },
                }}
            >
                <VStack gap={8} align="stretch" maxW="5xl" mx="auto" position="relative" zIndex={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                            <Heading mb={2}>Hybrid Editor Demo</Heading>
                            <Text color="fg.muted">Experimental block-based editor.</Text>
                        </Box>
                        <Button onClick={toggleColorMode}>
                            Toggle {colorMode === 'light' ? 'Dark' : 'Light'} Mode
                        </Button>
                    </Box>

                    <Box
                        p={6}
                        borderRadius="xl"
                        css={{
                            background: 'rgba(255, 255, 255, 0.45)',
                            _dark: {
                                background: 'rgba(20, 20, 25, 0.5)',
                            },
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        }}
                    >
                        <HybridMarkdownEditor
                            initialContent={content}
                            onChange={setContent}
                        />
                    </Box>

                    <Box>
                        <Heading size="md" mb={2}>Live Source</Heading>
                        <Box
                            as="pre"
                            p={4}
                            bg="gray.900"
                            color="green.300"
                            borderRadius="md"
                            fontSize="sm"
                            overflow="auto"
                            maxH="300px"
                        >
                            {content}
                        </Box>
                    </Box>
                </VStack>
            </Box>
        </Box>
    );
}
