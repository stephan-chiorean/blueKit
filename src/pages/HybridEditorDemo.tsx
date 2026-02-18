import { useState, useCallback } from 'react';
import { Box, Heading, VStack, HStack, IconButton } from '@chakra-ui/react';
import { LuSun, LuMoon } from 'react-icons/lu';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import ObsidianEditor from '@/shared/components/editor/obsidian';
import GradientBackground from '@/shared/components/GradientBackground';

const INITIAL_TITLE = 'Welcome to Live Preview Editor';
const INITIAL_BODY = `This is an **Obsidian-style** markdown editor with *Live Preview* mode.

## How It Works

Move your cursor into formatted text to reveal the markdown syntax:

- **Bold text** - click here to see the \`**\` markers
- *Italic text* - reveals \`*\` when cursor enters
- ~~Strikethrough~~ - shows \`~~\` on focus
- \`Inline code\` - backticks appear when editing

## Task Lists

Try clicking the checkboxes:

- [ ] Unchecked task
- [x] Completed task
- [ ] Another task to do

## Code Blocks

Code blocks have glassmorphic styling:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet('World');
console.log(message);
\`\`\`

## Links and More

Check out [Obsidian](https://obsidian.md) for inspiration.

> Blockquotes are styled with a left border
> and italic text.

---

### Features

1. Live Preview mode with cursor-aware syntax
2. Source mode for raw markdown editing
3. Reading mode for clean rendered view
4. Glassmorphic code blocks
5. Interactive task checkboxes
`;

export default function HybridEditorDemo() {
    const [title, setTitle] = useState(INITIAL_TITLE);
    const [body, setBody] = useState(INITIAL_BODY);
    const { colorMode, toggleColorMode } = useColorMode();
    const isLight = colorMode === 'light';

    const fullContent = `# ${title}\n\n${body}`;

    const handleBodyChange = useCallback((newContent: string) => {
        setBody(newContent);
    }, []);

    return (
        <Box position="relative" minH="100vh">
            <GradientBackground />
            {/* Content layer — single blur layer matching app's tab content panel */}
            <Box
                position="relative"
                zIndex={1}
                minH="100vh"
                css={{
                    background: isLight
                        ? 'rgba(255, 255, 255, 0.45)'
                        : 'rgba(20, 20, 25, 0.5)',
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                }}
            >
                <VStack gap={0} align="stretch" maxW="5xl" mx="auto" p={8}>
                    <HStack justify="flex-end" mb={4}>
                        <IconButton
                            aria-label="Toggle color mode"
                            variant="ghost"
                            size="lg"
                            onClick={toggleColorMode}
                            color={isLight ? 'gray.600' : 'gray.300'}
                            css={{
                                borderRadius: '10px',
                                '&:hover': {
                                    background: isLight
                                        ? 'rgba(0, 0, 0, 0.05)'
                                        : 'rgba(255, 255, 255, 0.08)',
                                },
                            }}
                        >
                            {isLight ? <LuMoon size={20} /> : <LuSun size={20} />}
                        </IconButton>
                    </HStack>

                    {/* Document area */}
                    <Box
                        borderRadius="xl"
                        overflow="hidden"
                        h="70vh"
                    >
                        <ObsidianEditor
                            initialContent={body}
                            onChange={handleBodyChange}
                            colorMode={colorMode}
                            defaultMode="live-preview"
                            headerSlot={
                                /* Outer padding mirrors .cm-scroller; inner maxWidth+auto margin mirrors .cm-content */
                                <Box w="100%" css={{ padding: '20px 40px 4px 40px' }}>
                                    <Box
                                        as="input"
                                        type="text"
                                        value={title}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                                        placeholder="Untitled"
                                        css={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '0',
                                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                                            fontSize: '1.875rem',
                                            fontWeight: 700,
                                            lineHeight: 1.3,
                                            color: isLight ? '#1a1a2e' : '#e4e4e7',
                                            textShadow: isLight
                                                ? '0 1px 2px rgba(0,0,0,0.1)'
                                                : '0 1px 2px rgba(0,0,0,0.5)',
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            '::placeholder': {
                                                color: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                                            },
                                        }}
                                    />
                                </Box>
                            }
                        />
                    </Box>

                    <Box mt={6}>
                        <Heading size="md" mb={2} color={isLight ? 'gray.700' : 'gray.200'}>
                            Live Source
                        </Heading>
                        <Box
                            as="pre"
                            p={4}
                            borderRadius="lg"
                            fontSize="sm"
                            overflow="auto"
                            maxH="300px"
                            css={{
                                background: isLight
                                    ? 'rgba(15, 15, 20, 0.85)'
                                    : 'rgba(10, 10, 15, 0.6)',
                                color: isLight ? '#86efac' : '#6ee7b7',
                            }}
                        >
                            {fullContent}
                        </Box>
                    </Box>
                </VStack>
            </Box>
        </Box>
    );
}
