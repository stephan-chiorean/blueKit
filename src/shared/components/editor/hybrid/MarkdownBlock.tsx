import { useState, useRef, useEffect } from 'react';
import { Box, Heading } from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TextareaAutosize from 'react-textarea-autosize';
import GlassCodeBlock from './GlassCodeBlock';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

interface MarkdownBlockProps {
    content: string;
    onChange: (newContent: string) => void;
    autoFocus?: boolean;
}

export default function MarkdownBlock({ content, onChange, autoFocus = false }: MarkdownBlockProps) {
    const { colorMode } = useColorMode();
    const [isEditing, setIsEditing] = useState(autoFocus);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            // Optional: move cursor to end?
            const len = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(len, len);
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            setIsEditing(false);
        }
    };

    const handlePreviewClick = () => {
        setIsEditing(true);
    };

    if (isEditing) {
        return (
            <Box
                mb={4}
                css={{
                    '& textarea': {
                        width: '100%',
                        bg: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        lineHeight: 'inherit',
                        color: 'inherit',
                        p: 0,
                        overflow: 'hidden',
                    }
                }}
            >
                <TextareaAutosize
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    minRows={1}
                />
            </Box>
        );
    }

    return (
        <Box
            onClick={handlePreviewClick}
            cursor="text"
            minH="1.5em"
            mb={4}
            css={{
                // Ensure styles match standard text
                color: colorMode === 'dark' ? 'gray.100' : 'gray.800',
                '& p': {
                    mb: 4,
                    lineHeight: '1.75',
                },
                '& > *:last-child': {
                    mb: 0,
                },
                // Headings
                '& h1': {
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    mt: 6,
                    mb: 4,
                },
                '& h2': {
                    fontSize: '2xl',
                    fontWeight: 'semibold',
                    mt: 5,
                    mb: 3,
                    color: 'var(--chakra-colors-primary-500)', // Dynamic primary color
                },
                '& h3': {
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    mt: 4,
                    mb: 2,
                },
                '& h4, & h5, & h6': {
                    fontSize: 'md',
                    fontWeight: 'semibold',
                    mt: 3,
                    mb: 2,
                },
                // Lists
                '& ul, & ol': {
                    pl: 4,
                    mb: 4,
                },
                '& li': {
                    mb: 2,
                },
                // Task list items (checkboxes) - remove bullet/number
                '& li:has(input[type="checkbox"])': {
                    listStyleType: 'none',
                    marginLeft: '-1.5em',
                },
                // Checkbox styling
                '& input[type="checkbox"]': {
                    marginRight: '0.5em',
                    cursor: 'pointer',
                },
                // Links
                '& a': {
                    color: 'var(--chakra-colors-primary-500)',
                    textDecoration: 'underline',
                },
                '& a:hover': {
                    color: 'var(--chakra-colors-primary-600)',
                },
                // Blockquotes
                '& blockquote': {
                    borderLeft: '4px solid',
                    borderColor: 'var(--chakra-colors-border-emphasized)',
                    pl: 4,
                    py: 2,
                    my: 4,
                    fontStyle: 'italic',
                },
                // Tables
                '& table': {
                    width: '100%',
                    borderCollapse: 'collapse',
                    mb: 4,
                },
                '& th, & td': {
                    border: '1px solid',
                    borderColor: 'var(--chakra-colors-border-subtle)',
                    px: 3,
                    py: 2,
                },
                '& th': {
                    fontWeight: 'semibold',
                },
            }}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <Heading
                            as="h1"
                            size="2xl"
                            mt={6}
                            mb={4}
                            css={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                _dark: {
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                },
                            }}
                        >
                            {children}
                        </Heading>
                    ),
                    h2: ({ children }) => (
                        <Heading
                            as="h2"
                            size="2xl"
                            mt={5}
                            mb={3}
                            color="primary.500"
                            css={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                _dark: {
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                },
                            }}
                        >
                            {children}
                        </Heading>
                    ),
                    h3: ({ children }) => (
                        <Heading
                            as="h3"
                            size="lg"
                            mt={4}
                            mb={2}
                            css={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                _dark: {
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                },
                            }}
                        >
                            {children}
                        </Heading>
                    ),
                    h4: ({ children }) => (
                        <Heading
                            as="h4"
                            size="md"
                            mt={3}
                            mb={2}
                            css={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                _dark: {
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                },
                            }}
                        >
                            {children}
                        </Heading>
                    ),
                    h5: ({ children }) => (
                        <Heading
                            as="h5"
                            size="sm"
                            mt={3}
                            mb={2}
                            css={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                _dark: {
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                },
                            }}
                        >
                            {children}
                        </Heading>
                    ),
                    h6: ({ children }) => (
                        <Heading
                            as="h6"
                            size="xs"
                            mt={3}
                            mb={2}
                            css={{
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                _dark: {
                                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                                },
                            }}
                        >
                            {children}
                        </Heading>
                    ),
                    code({ className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;

                        if (isInline) {
                            return (
                                <Box
                                    as="code"
                                    px={1.5}
                                    py={0.5}
                                    bg={colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.100'}
                                    borderRadius="sm"
                                    fontSize="0.9em"
                                    fontFamily="mono"
                                    {...props}
                                >
                                    {children}
                                </Box>
                            );
                        }

                        return (
                            <GlassCodeBlock
                                language={match ? match[1] : ''}
                                code={String(children).replace(/\n$/, '')}
                            />
                        );
                    },
                    // Enhance other elements as needed to match design system
                    a: ({ node, ...props }) => (
                        <Box as="a" color="var(--chakra-colors-primary-500)" _hover={{ textDecoration: 'underline' }} {...props as any} />
                    ),
                    ul: ({ node, ...props }) => <Box as="ul" pl={6} mb={4} {...props as any} />,
                    ol: ({ node, ...props }) => <Box as="ol" pl={6} mb={4} {...props as any} />,
                    li: ({ node, ...props }) => <Box as="li" mb={1} {...props as any} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </Box>
    );
}
