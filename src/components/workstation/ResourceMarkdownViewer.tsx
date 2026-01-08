import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

import {
  Box,
  Heading,
  Text,
  Code,
  Separator,
  HStack,
  Tag,
  VStack,
  Link,
  List,
  Alert,
  Flex,
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/shell';
import { ResourceFile } from '../../types/resource';
import { getResourceDisplayName } from '../../types/resource';
import ShikiCodeBlock from './ShikiCodeBlock';
import { LiquidViewModeSwitcher } from '../kits/LiquidViewModeSwitcher';
import { FaEye, FaCode } from 'react-icons/fa';

interface ResourceMarkdownViewerProps {
  resource: ResourceFile;
  content: string;
}

// Track if mermaid has been initialized to avoid multiple initializations
let mermaidInitialized = false;

// Component to render mermaid diagrams inline in markdown
function InlineMermaidDiagram({ code }: { code: string }) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Initialize mermaid once globally
  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'dark',
        themeVariables: {
          primaryBorderColor: '#4287f5',
          lineColor: '#4287f5',
          arrowheadColor: '#4287f5',
        },
      });
      mermaidInitialized = true;
    }
  }, []);

  // Render the diagram
  useEffect(() => {
    if (!diagramRef.current || !code.trim()) {
      return;
    }

    const renderTimeout = setTimeout(() => {
      if (!diagramRef.current) return;

      // Clear previous content and errors
      diagramRef.current.innerHTML = '';
      setRenderError(null);

      const id = `mermaid-inline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      mermaid.render(id, code.trim())
        .then((result) => {
          if (diagramRef.current) {
            diagramRef.current.innerHTML = result.svg;

            // Check for errors in the rendered SVG immediately
            const svg = diagramRef.current.querySelector('svg');
            if (svg) {
              const svgText = svg.textContent || '';
              const hasError = /syntax\s+error|parse\s+error|error\s+in\s+text/i.test(svgText);

              if (hasError) {
                diagramRef.current.innerHTML = '';
                setRenderError('Syntax error in Mermaid diagram');
              }
            }
          }
        })
        .catch((error) => {
          console.error('Error rendering mermaid diagram:', error);
          if (diagramRef.current) {
            diagramRef.current.innerHTML = '';
          }
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          setRenderError(errorMessage.includes('syntax') || errorMessage.includes('parse')
            ? 'Syntax error in Mermaid diagram'
            : 'Error rendering Mermaid diagram');
        });
    }, 100);

    return () => clearTimeout(renderTimeout);
  }, [code]);

  if (renderError) {
    return (
      <Alert.Root status="error" variant="subtle" mb={4}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Mermaid Error</Alert.Title>
          <Alert.Description>{renderError}</Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  return (
    <Box
      ref={diagramRef}
      mb={4}
      p={4}
      bg="bg.surface"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.subtle"
      overflow="auto"
    />
  );
}

export default function ResourceMarkdownViewer({ resource, content }: ResourceMarkdownViewerProps) {
  // Remove front matter from content for display
  const contentWithoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const displayName = getResourceDisplayName(resource);
  const [viewMode, setViewMode] = useState<string>('preview');

  return (
    <Box
      p={6}
      maxW="100%"
      h="100%"
      overflow="auto"
      css={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.2)',
        },
      }}
    >
      <VStack align="stretch" gap={6}>
        {/* Header */}
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={4}>
          <Box>
            <Heading
              size="xl"
              mb={2}
              css={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {displayName}
            </Heading>
            {resource.frontMatter?.description && (
              <Text
                fontSize="lg"
                color="text.secondary"
                mb={4}
                css={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                  _dark: {
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                  },
                }}
              >
                {resource.frontMatter.description}
              </Text>
            )}

            {/* Metadata Tags */}
            <HStack gap={2} flexWrap="wrap" mt={4}>
              {resource.frontMatter?.tags && resource.frontMatter.tags.map((tag) => (
                <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                  <Tag.Label>{tag}</Tag.Label>
                </Tag.Root>
              ))}
              {resource.frontMatter?.is_base && (
                <Tag.Root size="sm" variant="solid" colorPalette="primary">
                  <Tag.Label>Base</Tag.Label>
                </Tag.Root>
              )}
              {resource.frontMatter?.version && (
                <Tag.Root size="sm" variant="outline">
                  <Tag.Label>v{resource.frontMatter.version}</Tag.Label>
                </Tag.Root>
              )}
            </HStack>
          </Box>

          <Box>
            <LiquidViewModeSwitcher
              value={viewMode}
              onChange={setViewMode}
              modes={[
                { id: 'preview', label: 'Preview', icon: FaEye },
                { id: 'source', label: 'Source', icon: FaCode },
              ]}
            />
          </Box>
        </Flex>

        <Separator />

        {/* Content */}
        {viewMode === 'source' ? (
          <ShikiCodeBlock code={content} language="markdown" />
        ) : (
          <Box
            css={{
              '& > *': {
                mb: 4,
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
                color: 'primary.500',
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
              // Paragraphs
              '& p': {
                lineHeight: '1.75',
                color: 'text.primary',
              },
              // Lists
              '& ul, & ol': {
                pl: 4,
                mb: 4,
              },
              '& li': {
                mb: 2,
              },
              // Code blocks
              '& pre': {
                mb: 4,
              },
              // Inline code
              '& code': {
                fontSize: '0.9em',
              },
              // Links
              '& a': {
                color: 'primary.500',
                textDecoration: 'underline',
              },
              '& a:hover': {
                color: 'primary.600',
              },
              // Blockquotes
              '& blockquote': {
                borderLeft: '4px solid',
                borderColor: 'border.emphasized',
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
                borderColor: 'border.subtle',
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
                p: ({ children }) => (
                  <Text
                    mb={4}
                    lineHeight="1.75"
                    color="text.primary"
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    {children}
                  </Text>
                ),
                ul: ({ children }) => (
                  <List.Root mb={4} pl={4}>
                    {children}
                  </List.Root>
                ),
                ol: ({ children }) => (
                  <List.Root as="ol" mb={4} pl={4}>
                    {children}
                  </List.Root>
                ),
                li: ({ children }) => <List.Item mb={2}>{children}</List.Item>,
                code: ({ className, children, ...props }) => {
                  // Match language from className (e.g., "language-rust" or "language-78:93:src-tauri/src/main.rs")
                  const match = /language-(.+)/.exec(className || '');
                  const isInline = !match;
                  const codeString = String(children).replace(/\n$/, '');

                  if (isInline) {
                    // Inline code
                    return (
                      <Code
                        px={1.5}
                        py={0.5}
                        borderRadius="sm"
                        fontSize="0.9em"
                        {...props}
                      >
                        {children}
                      </Code>
                    );
                  }

                  // Code block with Shiki syntax highlighting
                  // Extract language, handling special formats like "78:93:src-tauri/src/main.rs"
                  let language = match ? match[1] : 'text';

                  // Special handling for mermaid diagrams
                  if (language === 'mermaid') {
                    return <InlineMermaidDiagram code={codeString} />;
                  }

                  // Handle file reference format (e.g., "78:93:src-tauri/src/main.rs")
                  // Extract file extension to infer language
                  if (language.includes(':') || language.includes('/') || language.includes('.')) {
                    const fileExtMatch = language.match(/\.(\w+)$/);
                    if (fileExtMatch) {
                      const ext = fileExtMatch[1];
                      // Map common extensions to languages
                      const extToLang: Record<string, string> = {
                        'rs': 'rust',
                        'ts': 'typescript',
                        'tsx': 'typescript',
                        'js': 'javascript',
                        'jsx': 'javascript',
                        'py': 'python',
                        'sh': 'bash',
                        'yml': 'yaml',
                        'yaml': 'yaml',
                        'json': 'json',
                        'md': 'markdown',
                      };
                      language = extToLang[ext] || ext;
                    } else {
                      // No file extension found, default to text
                      language = 'text';
                    }
                  }

                  return <ShikiCodeBlock code={codeString} language={language} />;
                },
                a: ({ href, children }) => {
                  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault();
                    if (href) {
                      // Check if it's an external link (http/https)
                      if (href.startsWith('http://') || href.startsWith('https://')) {
                        // Open in system browser
                        try {
                          await open(href);
                        } catch (error) {
                          console.error('Failed to open link:', error);
                        }
                      } else {
                        // For relative/internal links, you might want to handle them differently
                        // For now, we'll just prevent navigation
                        console.log('Internal link clicked:', href);
                      }
                    }
                  };

                  return (
                    <Link
                      href={href}
                      onClick={handleClick}
                      color="primary.500"
                      textDecoration="underline"
                      _hover={{ color: 'primary.600' }}
                      cursor="pointer"
                    >
                      {children}
                    </Link>
                  );
                },
                blockquote: ({ children }) => (
                  <Box
                    as="blockquote"
                    borderLeft="4px solid"
                    borderColor="border.emphasized"
                    pl={4}
                    py={2}
                    my={4}
                    fontStyle="italic"
                  >
                    {children}
                  </Box>
                ),
                table: ({ children }) => (
                  <Box as="table" width="100%" borderCollapse="collapse" mb={4}>
                    {children}
                  </Box>
                ),
                thead: ({ children }) => <Box as="thead">{children}</Box>,
                tbody: ({ children }) => <Box as="tbody">{children}</Box>,
                tr: ({ children }) => <Box as="tr">{children}</Box>,
                th: ({ children }) => (
                  <Box as="th" border="1px solid" borderColor="border.subtle" px={3} py={2} fontWeight="semibold">
                    {children}
                  </Box>
                ),
                td: ({ children }) => (
                  <Box as="td" border="1px solid" borderColor="border.subtle" px={3} py={2}>
                    {children}
                  </Box>
                ),
                hr: () => <Separator my={6} />,
              }}
            >
              {contentWithoutFrontMatter}
            </ReactMarkdown>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
