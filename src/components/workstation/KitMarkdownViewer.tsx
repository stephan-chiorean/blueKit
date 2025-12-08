import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
} from '@chakra-ui/react';
import { ArtifactFile } from '../../ipc';

interface KitMarkdownViewerProps {
  kit: ArtifactFile;
  content: string;
}

export default function KitMarkdownViewer({ kit, content }: KitMarkdownViewerProps) {
  // Remove front matter from content for display
  const contentWithoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const displayName = kit.frontMatter?.alias || kit.name;

  return (
    <Box p={6} maxW="100%" h="100%" overflow="auto">
      <VStack align="stretch" gap={6}>
        {/* Header */}
        <Box>
          <Heading size="xl" mb={2}>
            {displayName}
          </Heading>
          {kit.frontMatter?.description && (
            <Text fontSize="lg" color="text.secondary" mb={4}>
              {kit.frontMatter.description}
            </Text>
          )}
          
          {/* Metadata Tags */}
          <HStack gap={2} flexWrap="wrap" mt={4}>
            {kit.frontMatter?.tags && kit.frontMatter.tags.map((tag) => (
              <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                <Tag.Label>{tag}</Tag.Label>
              </Tag.Root>
            ))}
            {kit.frontMatter?.is_base && (
              <Tag.Root size="sm" variant="solid" colorPalette="primary">
                <Tag.Label>Base</Tag.Label>
              </Tag.Root>
            )}
            {kit.frontMatter?.version && (
              <Tag.Root size="sm" variant="outline">
                <Tag.Label>v{kit.frontMatter.version}</Tag.Label>
              </Tag.Root>
            )}
          </HStack>
        </Box>

        <Separator />

        {/* Markdown Content */}
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
              fontSize: 'xl',
              fontWeight: 'semibold',
              mt: 5,
              mb: 3,
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
              bg: 'bg.subtle',
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
              bg: 'bg.subtle',
              fontWeight: 'semibold',
            },
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <Heading as="h1" size="2xl" mt={6} mb={4}>{children}</Heading>,
              h2: ({ children }) => <Heading as="h2" size="xl" mt={5} mb={3}>{children}</Heading>,
              h3: ({ children }) => <Heading as="h3" size="lg" mt={4} mb={2}>{children}</Heading>,
              h4: ({ children }) => <Heading as="h4" size="md" mt={3} mb={2}>{children}</Heading>,
              h5: ({ children }) => <Heading as="h5" size="sm" mt={3} mb={2}>{children}</Heading>,
              h6: ({ children }) => <Heading as="h6" size="xs" mt={3} mb={2}>{children}</Heading>,
              p: ({ children }) => <Text mb={4} lineHeight="1.75" color="text.primary">{children}</Text>,
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
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                const codeString = String(children).replace(/\n$/, '');
                
                if (isInline) {
                  // Inline code
                  return (
                    <Code
                      px={1.5}
                      py={0.5}
                      bg="bg.subtle"
                      borderRadius="sm"
                      fontSize="0.9em"
                      {...props}
                    >
                      {children}
                    </Code>
                  );
                }
                
                // Code block
                return (
                  <Box
                    as="pre"
                    mb={4}
                    p={4}
                    bg="gray.900"
                    color="gray.100"
                    borderRadius="md"
                    overflow="auto"
                    fontSize="sm"
                    fontFamily="mono"
                    lineHeight="1.6"
                    {...props}
                  >
                    <Code
                      as="code"
                      display="block"
                      whiteSpace="pre"
                      color="inherit"
                      bg="transparent"
                      p={0}
                    >
                      {codeString}
                    </Code>
                  </Box>
                );
              },
              a: ({ href, children }) => (
                <Link href={href} color="primary.500" textDecoration="underline" _hover={{ color: 'primary.600' }}>
                  {children}
                </Link>
              ),
              blockquote: ({ children }) => (
                <Box
                  as="blockquote"
                  borderLeft="4px solid"
                  borderColor="border.emphasized"
                  pl={4}
                  py={2}
                  my={4}
                  bg="bg.subtle"
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
                <Box as="th" border="1px solid" borderColor="border.subtle" px={3} py={2} bg="bg.subtle" fontWeight="semibold">
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
      </VStack>
    </Box>
  );
}




