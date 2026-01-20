import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSlug from 'remark-slug';
import { useRef, useState, useEffect } from 'react';
import mermaid from 'mermaid';
import {
  Box,
  Heading,
  Text,
  Code,
  Separator,
  HStack,
  List,
  Link,
  Alert,
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/shell';
import { ResourceFile, ResourceType } from '../../types/resource';
import ShikiCodeBlock from './ShikiCodeBlock';
import { invokeReadFile, ArtifactFile } from '../../ipc';
import { toaster } from '../ui/toaster';
import { parseFrontMatter } from '../../utils/parseFrontMatter';
import { useResource } from '../../contexts/ResourceContext';
import path from 'path';

interface ResourceMarkdownContentProps {
  resource: ResourceFile;
  content: string;
  viewMode: 'preview' | 'source';
  onResolveInternalPath: (href: string) => string;
}

// Track if mermaid has been initialized to avoid multiple initializations
let mermaidInitialized = false;

/**
 * Cleans up orphaned mermaid elements that may have escaped into document.body.
 * Mermaid.js creates temporary elements for rendering, and when errors occur
 * (especially module loading failures), these elements can get orphaned at the
 * document root level instead of being contained within the React component.
 */
function cleanupOrphanedMermaidElements() {
  // Find and remove orphaned mermaid SVGs in document body
  // These are typically created with IDs starting with 'mermaid' or 'd' followed by numbers
  const orphanedElements = document.querySelectorAll(
    'body > svg[id^="mermaid"], body > svg[id^="d"], body > div[id^="dmermaid"], body > div[id^="d"]'
  );

  orphanedElements.forEach((el) => {
    // Check if this looks like a mermaid element
    const isMermaidElement =
      el.id?.includes('mermaid') ||
      el.classList?.contains('mermaid') ||
      (el.tagName === 'SVG' && el.querySelector('.error-icon, .error-text')) ||
      (el.innerHTML?.includes('Syntax error') || el.innerHTML?.includes('Parse error'));

    if (isMermaidElement) {
      console.warn('Removing orphaned mermaid element:', el.id || el.tagName);
      el.remove();
    }
  });

  // Also clean up any floating error elements that mermaid might create
  const errorElements = document.querySelectorAll('body > div.mermaid-error, body > .error');
  errorElements.forEach((el) => el.remove());
}

// Component to render mermaid diagrams inline in markdown
function InlineMermaidDiagram({ code }: { code: string }) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

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

  // Set up MutationObserver to catch and remove any mermaid elements that escape to body
  useEffect(() => {
    // Create observer to watch for mermaid elements being added to body
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element && node.parentElement === document.body) {
              const isMermaidElement =
                (node.id?.includes('mermaid') || node.id?.match(/^d\d/)) &&
                (node.tagName === 'SVG' || node.tagName === 'DIV');

              if (isMermaidElement) {
                console.warn('Caught escaping mermaid element, removing:', node.id);
                node.remove();
              }
            }
          });
        }
      }
    });

    // Observe body for direct children being added
    observerRef.current.observe(document.body, { childList: true });

    return () => {
      observerRef.current?.disconnect();
      // Cleanup any orphaned elements on unmount
      cleanupOrphanedMermaidElements();
    };
  }, []);

  // Render the diagram
  useEffect(() => {
    if (!diagramRef.current || !code.trim()) {
      return;
    }

    const renderTimeout = setTimeout(async () => {
      if (!diagramRef.current) return;

      // Clear previous content and errors
      diagramRef.current.innerHTML = '';
      setRenderError(null);

      // Clean up any orphaned elements before rendering
      cleanupOrphanedMermaidElements();

      const id = `mermaid-inline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        const result = await mermaid.render(id, code.trim());

        // Clean up after successful render (in case mermaid left temp elements)
        cleanupOrphanedMermaidElements();

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
      } catch (error) {
        console.error('Error rendering mermaid diagram:', error);

        // CRITICAL: Clean up orphaned elements after error
        // This is where mermaid often leaves elements at document.body
        cleanupOrphanedMermaidElements();

        // Also clean up after a short delay since mermaid may create elements asynchronously
        setTimeout(cleanupOrphanedMermaidElements, 50);
        setTimeout(cleanupOrphanedMermaidElements, 200);

        if (diagramRef.current) {
          diagramRef.current.innerHTML = '';
        }

        const errorMessage = (error as Error)?.message || String(error) || 'Unknown error';

        // Check for module loading failures (Vite dev server issues)
        if (errorMessage.includes('module script failed') || errorMessage.includes('Failed to fetch')) {
          setRenderError('Failed to load Mermaid diagram module. Try refreshing the page.');
        } else if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
          setRenderError('Syntax error in Mermaid diagram');
        } else {
          setRenderError('Error rendering Mermaid diagram');
        }
      }
    }, 100);

    return () => {
      clearTimeout(renderTimeout);
      // Clean up on effect cleanup
      cleanupOrphanedMermaidElements();
    };
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

export function ResourceMarkdownContent({
  resource,
  content,
  viewMode,
  onResolveInternalPath,
}: ResourceMarkdownContentProps) {
  // Remove front matter from content for display
  const contentWithoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const { setSelectedResource } = useResource();

  // Handle initial hash in URL (e.g., when page loads with #1-current-state-analysis)
  useEffect(() => {
    if (window.location.hash) {
      const targetId = window.location.hash.slice(1);
      // Wait for content to render
      setTimeout(() => {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 100);
    }
  }, [content]);

  if (viewMode === 'source') {
    return (
      <Box id="markdown-content-source">
        <ShikiCodeBlock code={content} language="markdown" />
      </Box>
    );
  }

  return (
    <Box
      id="markdown-content-preview"
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
        remarkPlugins={[remarkGfm, remarkSlug]}
        components={{
          h1: ({ children, id }) => (
            <Heading
              as="h1"
              id={id}
              size="2xl"
              mt={6}
              mb={4}
              css={{
                scrollMarginTop: '80px',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {children}
            </Heading>
          ),
          h2: ({ children, id }) => (
            <Heading
              as="h2"
              id={id}
              size="2xl"
              mt={5}
              mb={3}
              color="primary.500"
              css={{
                scrollMarginTop: '80px',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {children}
            </Heading>
          ),
          h3: ({ children, id }) => (
            <Heading
              as="h3"
              id={id}
              size="lg"
              mt={4}
              mb={2}
              css={{
                scrollMarginTop: '80px',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {children}
            </Heading>
          ),
          h4: ({ children, id }) => (
            <Heading
              as="h4"
              id={id}
              size="md"
              mt={3}
              mb={2}
              css={{
                scrollMarginTop: '80px',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {children}
            </Heading>
          ),
          h5: ({ children, id }) => (
            <Heading
              as="h5"
              id={id}
              size="sm"
              mt={3}
              mb={2}
              css={{
                scrollMarginTop: '80px',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {children}
            </Heading>
          ),
          h6: ({ children, id }) => (
            <Heading
              as="h6"
              id={id}
              size="xs"
              mt={3}
              mb={2}
              css={{
                scrollMarginTop: '80px',
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
              if (!href) return;

              // Handle anchor links (table of contents)
              if (href.startsWith('#')) {
                const targetId = href.slice(1); // Remove the '#'
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                  // Scroll to the element with smooth behavior
                  targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                  
                  // Update URL hash without triggering scroll
                  window.history.pushState(null, '', `#${targetId}`);
                  return;
                } else {
                  // If element not found, try to find it in the current document
                  // This handles cases where the ID format might be slightly different
                  console.warn(`Could not find element with id: ${targetId}`);
                }
                return;
              }

              // External links - open in browser
              if (href.startsWith('http://') || href.startsWith('https://')) {
                try {
                  await open(href);
                } catch (error) {
                  console.error('Failed to open link:', error);
                  toaster.create({
                    type: 'error',
                    title: 'Failed to open link',
                    description: String(error),
                  });
                }
                return;
              }

              // Internal markdown file links - navigate within BlueKit
              if (href.endsWith('.md') || href.endsWith('.mmd') || href.endsWith('.mermaid')) {
                console.log('[Link Navigation] Clicked internal link:', href);
                console.log('[Link Navigation] Current resource path:', resource.path);

                try {
                  // Resolve the path relative to current resource
                  const targetPath = onResolveInternalPath(href);
                  console.log('[Link Navigation] Resolved target path:', targetPath);

                  // Load the target file content
                  console.log('[Link Navigation] Loading file...');
                  const targetContent = await invokeReadFile(targetPath);
                  console.log('[Link Navigation] File loaded, length:', targetContent.length);

                  // Parse front matter from the content
                  const frontMatter = parseFrontMatter(targetContent);
                  console.log('[Link Navigation] Parsed front matter:', frontMatter);

                  // Extract file name without extension
                  const fileName = path.basename(targetPath, path.extname(targetPath));
                  console.log('[Link Navigation] File name:', fileName);

                  // Determine resource type based on file extension
                  const resourceType = targetPath.endsWith('.mmd') || targetPath.endsWith('.mermaid')
                    ? 'diagram'
                    : 'kit';
                  console.log('[Link Navigation] Resource type:', resourceType);

                  // Construct the artifact file object
                  const targetResource: ArtifactFile = {
                    name: fileName,
                    path: targetPath,
                    content: targetContent,
                    frontMatter: frontMatter,
                  };

                  console.log('[Link Navigation] Calling setSelectedResource with:', targetResource);
                  // Navigate to the new resource using ResourceContext
                  setSelectedResource(targetResource, targetContent, resourceType);
                  console.log('[Link Navigation] Navigation complete');
                } catch (error) {
                  console.error('[Link Navigation] ERROR:', error);
                  toaster.create({
                    type: 'error',
                    title: 'Failed to open file',
                    description: `Could not load ${href}: ${error}`,
                  });
                }
                return;
              }

              // Other internal links - log for now
              console.log('Internal link clicked:', href);
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
  );
}

