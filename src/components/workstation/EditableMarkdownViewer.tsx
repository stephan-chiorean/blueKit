/**
 * Editable Markdown Viewer component.
 *
 * Extends ResourceMarkdownViewer with editing capabilities:
 * - Preview mode: Read-only formatted markdown view
 * - Source mode: Raw markdown with syntax highlighting
 * - Edit mode: CodeMirror-based live editing
 *
 * Supports auto-save, keyboard shortcuts, and preserves all existing features.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  Portal,
  Button,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { open } from '@tauri-apps/api/shell';
import { ResourceFile, ResourceType, getResourceDisplayName } from '../../types/resource';
import ShikiCodeBlock from './ShikiCodeBlock';
import { LiquidViewModeSwitcher } from '../kits/LiquidViewModeSwitcher';
import { FaEye, FaCode, FaEdit } from 'react-icons/fa';
import { LuChevronDown, LuChevronUp, LuLink, LuSave, LuCheck, LuCircleAlert } from 'react-icons/lu';
import SearchInMarkdown from './SearchInMarkdown';
import { useWorkstation } from '../../contexts/WorkstationContext';
import { useResource } from '../../contexts/ResourceContext';
import { useProjectArtifacts } from '../../contexts/ProjectArtifactsContext';
import { invokeReadFile, ArtifactFile } from '../../ipc';
import { toaster } from '../ui/toaster';
import { parseFrontMatter } from '../../utils/parseFrontMatter';
import { extractOutboundLinks, findBacklinks, resolveOutboundLinks } from '../../utils/extractMarkdownLinks';
import { useColorMode } from '../../contexts/ColorModeContext';
import { useAutoSave, SaveStatus } from '../../hooks/useAutoSave';
import MarkdownEditor, { MarkdownEditorRef } from '../editor/MarkdownEditor';
import path from 'path-browserify';

export interface EditableMarkdownViewerProps {
  resource: ResourceFile;
  content: string;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Callback when content changes (for parent to track dirty state) */
  onContentChange?: (newContent: string) => void;
  /** Initial view mode (default: 'preview') */
  initialMode?: 'preview' | 'source' | 'edit';
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

// Save status indicator component
function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const statusConfig = {
    saved: { icon: LuCheck, color: 'green.500', text: 'Saved' },
    saving: { icon: LuSave, color: 'blue.500', text: 'Saving...' },
    unsaved: { icon: LuSave, color: 'yellow.500', text: 'Unsaved' },
    error: { icon: LuCircleAlert, color: 'red.500', text: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <HStack gap={1} color={config.color} fontSize="xs">
      <Icon boxSize={3}>
        <config.icon />
      </Icon>
      <Text>{config.text}</Text>
    </HStack>
  );
}

type ViewMode = 'preview' | 'source' | 'edit';

export default function EditableMarkdownViewer({
  resource,
  content: initialContent,
  editable = false,
  onContentChange,
  initialMode = 'preview',
}: EditableMarkdownViewerProps) {
  const { colorMode } = useColorMode();
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const { isSearchOpen, setIsSearchOpen } = useWorkstation();
  const { setSelectedResource } = useResource();
  const { artifacts: allArtifacts } = useProjectArtifacts();
  const editorRef = useRef<MarkdownEditorRef>(null);

  // Scroll position tracking for each mode
  const [scrollPositions, setScrollPositions] = useState<{
    preview: number;
    source: number;
    edit: number;
  }>({ preview: 0, source: 0, edit: 0 });

  // Auto-save hook
  const { save, saveNow, status: saveStatus, isDirty, lastSaveTime } = useAutoSave(resource.path, {
    delay: 1500,
    enabled: editable && viewMode === 'edit',
    onSaveSuccess: () => {
      toaster.create({
        type: 'success',
        title: 'Saved',
        duration: 2000,
      });
    },
    onSaveError: (error) => {
      toaster.create({
        type: 'error',
        title: 'Save failed',
        description: error.message,
      });
    },
  });

  // Update content when prop changes (external file change)
  // Skip reset if we saved within last 2 seconds (save protection window)
  // This prevents the file watcher from reverting content after a save
  useEffect(() => {
    const timeSinceLastSave = Date.now() - lastSaveTime;
    const inSaveProtectionWindow = lastSaveTime > 0 && timeSinceLastSave < 2000;

    if (initialContent !== content && !isDirty && !inSaveProtectionWindow) {
      setContent(initialContent);
    }
  }, [initialContent, isDirty, lastSaveTime, content]);

  // Handle content changes from editor
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
    save(newContent);
  }, [onContentChange, save]);

  // Handle manual save (Cmd+S)
  const handleSave = useCallback(async (contentToSave: string) => {
    try {
      await saveNow(contentToSave);
    } catch {
      // Error handled in hook
    }
  }, [saveNow]);

  // Remove front matter from content for display
  const contentWithoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  const displayName = getResourceDisplayName(resource);

  // Compute outbound links from this resource
  const outboundLinks = useMemo(() => {
    const links = extractOutboundLinks(content);
    return resolveOutboundLinks(resource.path, links);
  }, [content, resource.path]);

  // Compute backlinks to this resource
  const backlinks = useMemo(() => {
    if (!allArtifacts || allArtifacts.length === 0) return [];
    return findBacklinks(resource.path, allArtifacts);
  }, [resource.path, allArtifacts]);

  // Group backlinks by type for organized display
  const groupedBacklinks = useMemo(() => {
    const groups: Record<string, typeof backlinks> = {};
    backlinks.forEach(backlink => {
      const type = backlink.resourceType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(backlink);
    });
    return groups;
  }, [backlinks]);

  // Resolve relative paths for internal markdown links
  const resolveInternalPath = (href: string): string => {
    const currentDir = path.dirname(resource.path);
    return path.resolve(currentDir, href);
  };

  // Keyboard shortcut for opening search (cmd+F / ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setIsSearchOpen]);

  // Get current scroll position for a given mode
  const getCurrentScrollPosition = useCallback((mode: ViewMode): number => {
    if (mode === 'edit' && editorRef.current) {
      return editorRef.current.getScrollPosition().top;
    }
    const containerId = mode === 'source' ? 'markdown-content-source' : 'markdown-content-preview';
    const container = document.getElementById(containerId);
    return container?.scrollTop ?? 0;
  }, []);

  // Handle view mode change with scroll position preservation
  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    // Save current scroll position before switching
    const currentScroll = getCurrentScrollPosition(viewMode);
    setScrollPositions(prev => ({ ...prev, [viewMode]: currentScroll }));
    setViewMode(newMode);
  }, [viewMode, getCurrentScrollPosition]);

  // Restore scroll position after mode switch
  useEffect(() => {
    // Use requestAnimationFrame to wait for DOM update
    const frame = requestAnimationFrame(() => {
      const targetScroll = scrollPositions[viewMode];
      if (viewMode === 'edit' && editorRef.current) {
        editorRef.current.setScrollPosition({ top: targetScroll, left: 0 });
      } else {
        const containerId = viewMode === 'source' ? 'markdown-content-source' : 'markdown-content-preview';
        const container = document.getElementById(containerId);
        if (container) {
          container.scrollTop = targetScroll;
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [viewMode, scrollPositions]);

  // Build view mode options
  const viewModes = useMemo(() => {
    const modes = [
      { id: 'preview', label: 'Preview', icon: FaEye },
      { id: 'source', label: 'Source', icon: FaCode },
    ];

    if (editable) {
      modes.push({ id: 'edit', label: 'Edit', icon: FaEdit });
    }

    return modes;
  }, [editable]);

  return (
    <Box
      p={6}
      maxW="100%"
      h="100%"
      overflow={viewMode === 'edit' ? 'hidden' : 'auto'}
      css={{
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        _dark: {
          background: 'rgba(20, 20, 25, 0.5)',
        },
      }}
    >
      <VStack align="stretch" gap={6} h={viewMode === 'edit' ? '100%' : 'auto'}>
        {/* Header */}
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={4}>
          <Box>
            <HStack gap={3} align="center">
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
              {editable && viewMode === 'edit' && (
                <SaveStatusIndicator status={saveStatus} />
              )}
            </HStack>
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

            <Box mt={4} width="fit-content">
              <LiquidViewModeSwitcher
                value={viewMode}
                onChange={(mode) => handleViewModeChange(mode as ViewMode)}
                modes={viewModes}
              />
            </Box>

            {/* Links Button - matches filter button styling */}
            {(outboundLinks.length > 0 || backlinks.length > 0) && (
              <Box mt={4} width="fit-content">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinksExpanded(!linksExpanded)}
                  borderWidth="1px"
                  borderRadius="lg"
                  css={{
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    borderColor: 'rgba(0, 0, 0, 0.08)',
                    boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                    transition: 'none',
                    _dark: {
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                    },
                  }}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuLink />
                    </Icon>
                    <Text>Links</Text>
                    <Badge size="sm" colorPalette="primary" variant="solid">
                      {outboundLinks.length + backlinks.length}
                    </Badge>
                    <Icon>
                      {linksExpanded ? <LuChevronUp /> : <LuChevronDown />}
                    </Icon>
                  </HStack>
                </Button>
              </Box>
            )}
          </Box>
        </Flex>

        <Separator />

        {/* Links Section - Collapsible */}
        {linksExpanded && (outboundLinks.length > 0 || backlinks.length > 0) && (
          <>
            <Box>
              <Heading size="sm" mb={3} color="text.secondary">
                Links
              </Heading>

              <VStack align="stretch" gap={4}>
                {/* Outbound Links */}
                {outboundLinks.length > 0 && (
                  <Box>
                    <Text fontSize="xs" color="text.tertiary" mb={2} fontWeight="semibold">
                      Links from this {resource.resourceType || 'kit'}
                    </Text>
                    <HStack gap={2} flexWrap="wrap">
                      {outboundLinks.map((link, index) => (
                        <Link
                          key={index}
                          onClick={async () => {
                            try {
                              const targetContent = await invokeReadFile(link.absolutePath);
                              const frontMatter = parseFrontMatter(targetContent);
                              const fileName = path.basename(link.absolutePath, path.extname(link.absolutePath));
                              const resourceType: ResourceType = link.absolutePath.endsWith('.mmd') || link.absolutePath.endsWith('.mermaid')
                                ? 'diagram'
                                : (frontMatter?.type as ResourceType) || 'kit';

                              const targetResource: ArtifactFile = {
                                name: fileName,
                                path: link.absolutePath,
                                content: targetContent,
                                frontMatter,
                              };

                              setSelectedResource(targetResource, targetContent, resourceType);
                            } catch (error) {
                              console.error('Failed to navigate:', error);
                              toaster.create({
                                type: 'error',
                                title: 'Failed to open file',
                                description: `Could not load ${link.path}: ${error}`,
                              });
                            }
                          }}
                          cursor="pointer"
                          color="primary.500"
                          fontSize="sm"
                          textDecoration="underline"
                          _hover={{ color: 'primary.600' }}
                        >
                          {link.text}
                        </Link>
                      ))}
                    </HStack>
                  </Box>
                )}

                {/* Backlinks */}
                {backlinks.length > 0 && (
                  <Box>
                    <Text fontSize="xs" color="text.tertiary" mb={2} fontWeight="semibold">
                      Linked by {backlinks.length} other {backlinks.length === 1 ? 'resource' : 'resources'}
                    </Text>

                    {Object.entries(groupedBacklinks).map(([type, links]) => (
                      <Box key={type} mb={2}>
                        <Text fontSize="xs" color="text.muted" mb={1}>
                          {type}s
                        </Text>
                        <HStack gap={2} flexWrap="wrap">
                          {links.map((backlink, index) => {
                            const backlinkDisplayName = backlink.source.frontMatter?.alias || backlink.source.name;
                            return (
                              <Link
                                key={index}
                                onClick={async () => {
                                  try {
                                    const sourceContent = backlink.source.content || await invokeReadFile(backlink.source.path);
                                    setSelectedResource(backlink.source, sourceContent, backlink.resourceType);
                                  } catch (error) {
                                    console.error('Failed to navigate:', error);
                                    toaster.create({
                                      type: 'error',
                                      title: 'Failed to open file',
                                      description: `Could not load ${backlink.source.name}: ${error}`,
                                    });
                                  }
                                }}
                                cursor="pointer"
                                color="primary.500"
                                fontSize="sm"
                                textDecoration="underline"
                                _hover={{ color: 'primary.600' }}
                              >
                                {backlinkDisplayName}
                              </Link>
                            );
                          })}
                        </HStack>
                      </Box>
                    ))}
                  </Box>
                )}
              </VStack>
            </Box>

            <Separator />
          </>
        )}

        {/* Content Area */}
        <Box flex={viewMode === 'edit' ? 1 : undefined}>
          {viewMode === 'edit' ? (
            <MarkdownEditor
              ref={editorRef}
              content={content}
              onChange={handleContentChange}
              onSave={handleSave}
              colorMode={colorMode}
              readOnly={false}
              showLineNumbers={true}
              placeholder="Start writing..."
            />
          ) : viewMode === 'source' ? (
            <Box id="markdown-content-source">
              <ShikiCodeBlock code={content} language="markdown" />
            </Box>
          ) : (
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
                    const match = /language-(.+)/.exec(className || '');
                    const isInline = !match;
                    const codeString = String(children).replace(/\n$/, '');

                    if (isInline) {
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

                    let language = match ? match[1] : 'text';

                    if (language === 'mermaid') {
                      return <InlineMermaidDiagram code={codeString} />;
                    }

                    if (language.includes(':') || language.includes('/') || language.includes('.')) {
                      const fileExtMatch = language.match(/\.(\w+)$/);
                      if (fileExtMatch) {
                        const ext = fileExtMatch[1];
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
                        language = 'text';
                      }
                    }

                    return <ShikiCodeBlock code={codeString} language={language} />;
                  },
                  a: ({ href, children }) => {
                    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      if (!href) return;

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

                      if (href.endsWith('.md') || href.endsWith('.mmd') || href.endsWith('.mermaid')) {
                        try {
                          const targetPath = resolveInternalPath(href);
                          const targetContent = await invokeReadFile(targetPath);
                          const frontMatter = parseFrontMatter(targetContent);
                          const fileName = path.basename(targetPath, path.extname(targetPath));
                          const resourceType = targetPath.endsWith('.mmd') || targetPath.endsWith('.mermaid')
                            ? 'diagram'
                            : 'kit';

                          const targetResource: ArtifactFile = {
                            name: fileName,
                            path: targetPath,
                            content: targetContent,
                            frontMatter: frontMatter,
                          };

                          setSelectedResource(targetResource, targetContent, resourceType);
                        } catch (error) {
                          console.error('Failed to navigate:', error);
                          toaster.create({
                            type: 'error',
                            title: 'Failed to open file',
                            description: `Could not load ${href}: ${error}`,
                          });
                        }
                        return;
                      }

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
          )}
        </Box>
      </VStack>

      {/* Search Component */}
      <Portal>
        {isSearchOpen && viewMode !== 'edit' && (
          <SearchInMarkdown
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            containerId={viewMode === 'source' ? 'markdown-content-source' : 'markdown-content-preview'}
            viewMode={viewMode as 'preview' | 'source'}
          />
        )}
      </Portal>
    </Box>
  );
}
