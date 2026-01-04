import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Dialog,
  Portal,
  Heading,
  HStack,
  Icon,
  IconButton,
  VStack,
  Badge,
  Text,
  Card,
  CardHeader,
  CardBody,
  Flex,
  Checkbox,
  Tag,
  Button,
  Input,
  InputGroup,
  Menu,
  Spinner,
  Separator,
  Code,
  Link,
  List,
  SimpleGrid,
} from '@chakra-ui/react';
import {
  LuBookmark,
  LuX,
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
  LuChevronRight,
  LuSearch,
  LuCheck,
  LuFolder,
  LuTrash2,
  LuBookmarkPlus,
  LuChevronDown,
  LuDownload,
  LuArrowLeft,
} from 'react-icons/lu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CatalogWithVariations, LibraryVariation, LibraryCatalog } from '../../types/github';
import { LibraryCollection } from '../../ipc/library';
import { Project } from '../../ipc';

// Types for selected items
interface SelectedVariation {
  variation: LibraryVariation;
  catalog: LibraryCatalog;
}

interface SelectedCatalog {
  catalog: LibraryCatalog;
  variations: LibraryVariation[];
}

// View state type for single modal navigation
type ModalView = 'collection' | 'variations-picker' | 'variation-preview';

// View context for navigation state
interface ViewContext {
  pickerCatalog?: LibraryCatalog;
  pickerVariations?: LibraryVariation[];
  previewVariation?: LibraryVariation;
  previewCatalog?: LibraryCatalog;
  previewContent?: string;
  previewLoading?: boolean;
  cameFromPicker?: boolean;
}

const artifactTypeIcon: Record<string, React.ReactNode> = {
  kit: <LuPackage />,
  walkthrough: <LuBookOpen />,
  agent: <LuBot />,
  diagram: <LuNetwork />,
};

// Format relative time (e.g., "2 hours ago", "3 days ago")
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

// Variation Preview View - shows markdown content (inline view, not modal)
interface VariationPreviewViewProps {
  variation: LibraryVariation;
  catalog: LibraryCatalog;
  content: string;
  loading: boolean;
}

function VariationPreviewView({
  catalog,
  content,
  loading,
}: VariationPreviewViewProps) {
  // Remove front matter from content for display
  const contentWithoutFrontMatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  // Parse front matter for metadata
  const frontMatter = useMemo(() => {
    const fm: Record<string, any> = {};
    if (content.trim().startsWith('---')) {
      const endIndex = content.indexOf('\n---', 4);
      if (endIndex !== -1) {
        const frontMatterText = content.substring(4, endIndex);
        const lines = frontMatterText.split('\n');
        lines.forEach((line) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            if (key === 'tags' && value.startsWith('[')) {
              fm[key] = value
                .slice(1, -1)
                .split(',')
                .map((t) => t.trim().replace(/['"]/g, ''));
            } else {
              fm[key] = value.replace(/^["']|["']$/g, '');
            }
          }
        });
      }
    }
    return fm;
  }, [content]);

  const displayName = frontMatter.title || frontMatter.name || catalog.name;

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%" minH="400px">
        <VStack gap={4}>
          <Spinner size="lg" />
          <Text color="text.secondary">Loading content...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box h="100%" display="flex" flexDirection="column">
      {/* Scrollable Content */}
      <Box
        flex="1"
        overflow="auto"
        borderRadius="12px"
        css={{
          background: 'rgba(255, 255, 255, 0.1)',
          _dark: {
            background: 'rgba(255, 255, 255, 0.03)',
          },
        }}
      >
        <Box p={6}>
          <VStack align="stretch" gap={6}>
            {/* Header */}
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
              {frontMatter.description && (
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
                  {frontMatter.description}
                </Text>
              )}

              {/* Metadata Tags */}
              <HStack gap={2} flexWrap="wrap" mt={4}>
                {frontMatter.tags && frontMatter.tags.map((tag: string) => (
                  <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                    <Tag.Label>{tag}</Tag.Label>
                  </Tag.Root>
                ))}
                {frontMatter.version && (
                  <Tag.Root size="sm" variant="outline">
                    <Tag.Label>v{frontMatter.version}</Tag.Label>
                  </Tag.Root>
                )}
              </HStack>
            </Box>

            <Separator />

            {/* Markdown Content */}
            <Box
              css={{
                '& > *': { mb: 4 },
                '& > *:last-child': { mb: 0 },
                '& h1': { fontSize: '2xl', fontWeight: 'bold', mt: 6, mb: 4 },
                '& h2': { fontSize: '2xl', fontWeight: 'semibold', mt: 5, mb: 3, color: 'primary.500' },
                '& h3': { fontSize: 'lg', fontWeight: 'semibold', mt: 4, mb: 2 },
                '& h4, & h5, & h6': { fontSize: 'md', fontWeight: 'semibold', mt: 3, mb: 2 },
                '& p': { lineHeight: '1.75', color: 'text.primary' },
                '& ul, & ol': { pl: 4, mb: 4 },
                '& li': { mb: 2 },
                '& pre': { mb: 4 },
                '& code': { fontSize: '0.9em' },
                '& a': { color: 'primary.500', textDecoration: 'underline' },
                '& a:hover': { color: 'primary.600' },
                '& blockquote': { borderLeft: '4px solid', borderColor: 'border.emphasized', pl: 4, py: 2, my: 4, fontStyle: 'italic' },
                '& table': { width: '100%', borderCollapse: 'collapse', mb: 4 },
                '& th, & td': { border: '1px solid', borderColor: 'border.subtle', px: 3, py: 2 },
                '& th': { fontWeight: 'semibold' },
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <Heading as="h1" size="2xl" mt={6} mb={4}>
                      {children}
                    </Heading>
                  ),
                  h2: ({ children }) => (
                    <Heading as="h2" size="2xl" mt={5} mb={3} color="primary.500">
                      {children}
                    </Heading>
                  ),
                  h3: ({ children }) => (
                    <Heading as="h3" size="lg" mt={4} mb={2}>
                      {children}
                    </Heading>
                  ),
                  h4: ({ children }) => (
                    <Heading as="h4" size="md" mt={3} mb={2}>
                      {children}
                    </Heading>
                  ),
                  p: ({ children }) => (
                    <Text mb={4} lineHeight="1.75" color="text.primary">
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
                        <Code px={1.5} py={0.5} borderRadius="sm" fontSize="0.9em" {...props}>
                          {children}
                        </Code>
                      );
                    }

                    return (
                      <Box
                        as="pre"
                        p={4}
                        borderRadius="md"
                        overflow="auto"
                        mb={4}
                        css={{
                          background: 'rgba(0, 0, 0, 0.1)',
                          _dark: {
                            background: 'rgba(0, 0, 0, 0.3)',
                          },
                        }}
                      >
                        <Code display="block" whiteSpace="pre" fontSize="sm">
                          {codeString}
                        </Code>
                      </Box>
                    );
                  },
                  a: ({ href, children }) => (
                    <Link
                      href={href}
                      color="primary.500"
                      textDecoration="underline"
                      _hover={{ color: 'primary.600' }}
                    >
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
                      fontStyle="italic"
                    >
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
      </Box>
    </Box>
  );
}

// Variations Picker View - shows when a catalog has multiple variations (inline view)
interface VariationsPickerViewProps {
  catalog: LibraryCatalog;
  variations: LibraryVariation[];
  selectedVariationIds: Map<string, SelectedVariation>;
  onVariationClick: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
}

function VariationsPickerView({
  catalog,
  variations,
  selectedVariationIds,
  onVariationClick,
  onVariationToggle,
}: VariationsPickerViewProps) {
  const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;

  const getVersionLabel = (variation: LibraryVariation, index: number): string => {
    if (variation.version_tag) return variation.version_tag;
    return `v${variations.length - index}`;
  };

  return (
    <VStack align="stretch" gap={4}>
      {catalog.description && (
        <Text fontSize="md" color="text.secondary">
          {catalog.description}
        </Text>
      )}
      
      <Text fontSize="sm" color="text.tertiary">
        Select a version to view its content
      </Text>

      <VStack align="stretch" gap={2}>
        {variations.map((v, index) => {
          const publishDate = new Date(v.published_at * 1000);
          const timeAgo = formatTimeAgo(publishDate);
          const isVariationSelected = selectedVariationIds.has(v.id);
          const versionLabel = getVersionLabel(v, index);

          return (
            <HStack
              key={v.id}
              justify="space-between"
              align="center"
              py={3}
              px={4}
              borderRadius="12px"
              cursor="pointer"
              transition="all 0.15s"
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                _dark: {
                  background: 'rgba(255, 255, 255, 0.05)',
                },
                _hover: {
                  background: 'rgba(255, 255, 255, 0.25)',
                  _dark: {
                    background: 'rgba(255, 255, 255, 0.1)',
                  },
                },
              }}
              onClick={() => onVariationClick(v, catalog)}
              gap={3}
            >
              <HStack gap={3} flex={1}>
                <Icon boxSize={5} color="primary.500">
                  {icon}
                </Icon>
                <VStack align="start" gap={0}>
                  <Text fontSize="md" fontWeight="medium">
                    {versionLabel}
                  </Text>
                  <HStack gap={2}>
                    <Text fontSize="sm" color="text.tertiary">
                      {timeAgo}
                    </Text>
                    {v.publisher_name && (
                      <Text fontSize="sm" color="text.tertiary">
                        by {v.publisher_name}
                      </Text>
                    )}
                  </HStack>
                </VStack>
              </HStack>
              <HStack gap={3}>
                <Icon color="text.tertiary">
                  <LuChevronRight />
                </Icon>
                <Checkbox.Root
                  checked={isVariationSelected}
                  colorPalette="primary"
                  onCheckedChange={() => {
                    onVariationToggle(v, catalog);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  cursor="pointer"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control
                    cursor="pointer"
                    css={{
                      width: '20px',
                      height: '20px',
                      borderWidth: '2px',
                      borderColor: isVariationSelected ? 'primary.500' : 'border.emphasized',
                      background: isVariationSelected
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(255, 255, 255, 0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      boxShadow: isVariationSelected
                        ? '0 0 0 2px rgba(59, 130, 246, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)'
                        : '0 1px 2px rgba(0, 0, 0, 0.05)',
                      _dark: {
                        background: isVariationSelected
                          ? 'rgba(59, 130, 246, 0.25)'
                          : 'rgba(255, 255, 255, 0.1)',
                        borderColor: isVariationSelected ? 'primary.400' : 'border.emphasized',
                        boxShadow: isVariationSelected
                          ? '0 0 0 2px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3)'
                          : '0 1px 2px rgba(0, 0, 0, 0.2)',
                      },
                      _hover: {
                        background: isVariationSelected
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(255, 255, 255, 0.4)',
                        _dark: {
                          background: isVariationSelected
                            ? 'rgba(59, 130, 246, 0.3)'
                            : 'rgba(255, 255, 255, 0.15)',
                        },
                      },
                    }}
                  >
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Root>
              </HStack>
            </HStack>
          );
        })}
      </VStack>
    </VStack>
  );
}

// Collection Catalog Card component
interface CollectionCatalogCardProps {
  catalogWithVariations: CatalogWithVariations;
  isSelected: boolean;
  onCatalogToggle: () => void;
  onVariationClick: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  selectedVariationIds: Map<string, SelectedVariation>;
  onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  onOpenVariationsPicker: (catalog: LibraryCatalog, variations: LibraryVariation[]) => void;
}

function CollectionCatalogCard({
  catalogWithVariations,
  isSelected,
  onCatalogToggle,
  onVariationClick,
  selectedVariationIds,
  onVariationToggle,
  onOpenVariationsPicker,
}: CollectionCatalogCardProps) {
  const { catalog, variations } = catalogWithVariations;
  const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;
  const tags = catalog.tags ? JSON.parse(catalog.tags) : [];
  const hasSingleVariation = variations.length === 1;

  const handleCardClick = () => {
    if (hasSingleVariation) {
      // Single variation - open it directly
      onVariationClick(variations[0], catalog);
    } else {
      // Multiple variations - open picker view
      onOpenVariationsPicker(catalog, variations);
    }
  };

  return (
    <Card.Root
      borderRadius="16px"
      borderWidth="1px"
      cursor="pointer"
      onClick={handleCardClick}
      transition="all 0.2s ease-in-out"
      css={{
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderColor: isSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(0, 0, 0, 0.08)',
        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.06)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.2)',
          borderColor: isSelected ? 'var(--chakra-colors-primary-500)' : 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        },
        _hover: {
          transform: 'scale(1.01)',
          borderColor: isSelected ? 'var(--chakra-colors-primary-600)' : 'var(--chakra-colors-primary-400)',
        },
      }}
    >
      <CardHeader pb={2}>
        <Flex justify="space-between" align="center">
          <HStack gap={2} flex={1}>
            <Icon color="primary.500">{icon}</Icon>
            <Heading size="sm">{catalog.name}</Heading>
            {!hasSingleVariation && (
              <Badge
                size="sm"
                colorPalette="gray"
                bg="transparent"
                _dark={{ bg: "transparent" }}
              >
                {variations.length}
              </Badge>
            )}
          </HStack>
          <Checkbox.Root
            checked={isSelected}
            colorPalette="primary"
            onCheckedChange={onCatalogToggle}
            onClick={(e) => e.stopPropagation()}
            cursor="pointer"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control
              cursor="pointer"
              css={{
                width: '20px',
                height: '20px',
                borderWidth: '2px',
                borderColor: isSelected ? 'primary.500' : 'border.emphasized',
                background: isSelected
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: isSelected
                  ? '0 0 0 2px rgba(59, 130, 246, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)'
                  : '0 1px 2px rgba(0, 0, 0, 0.05)',
                _dark: {
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.25)'
                    : 'rgba(255, 255, 255, 0.1)',
                  borderColor: isSelected ? 'primary.400' : 'border.emphasized',
                  boxShadow: isSelected
                    ? '0 0 0 2px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3)'
                    : '0 1px 2px rgba(0, 0, 0, 0.2)',
                },
                _hover: {
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'rgba(255, 255, 255, 0.4)',
                  _dark: {
                    background: isSelected
                      ? 'rgba(59, 130, 246, 0.3)'
                      : 'rgba(255, 255, 255, 0.15)',
                  },
                },
              }}
            >
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Root>
        </Flex>
      </CardHeader>
      <CardBody pt={0}>
        {catalog.description && (
          <Text fontSize="sm" color="text.secondary" mb={2}>
            {catalog.description}
          </Text>
        )}
        {tags.length > 0 && (
          <HStack gap={2} flexWrap="wrap">
            {tags.map((tag: string, index: number) => (
              <Tag.Root key={`${catalog.id}-${tag}-${index}`} size="sm" variant="subtle" colorPalette="primary">
                <Tag.Label>{tag}</Tag.Label>
              </Tag.Root>
            ))}
          </HStack>
        )}
      </CardBody>
    </Card.Root>
  );
}

// Modal Pull Button component (renders inline, no Portal)
interface ModalPullButtonProps {
  projects: Project[];
  onBulkPull: (projects: Project[]) => void;
  loading: boolean;
}

function ModalPullButton({ projects, onBulkPull, loading }: ModalPullButtonProps) {
  const [isPullMenuOpen, setIsPullMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPullMenuOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isPullMenuOpen]);

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleConfirmPull = () => {
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    onBulkPull(selectedProjects);
    setIsPullMenuOpen(false);
    setSelectedProjectIds(new Set());
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const truncatePath = (path: string, maxLength: number = 40): string => {
    if (path.length <= maxLength) return path;
    return `...${path.slice(-(maxLength - 3))}`;
  };

  return (
    <Menu.Root
      closeOnSelect={false}
      open={isPullMenuOpen}
      onOpenChange={(e) => setIsPullMenuOpen(e.open)}
    >
      <Menu.Trigger asChild>
        <Button
          variant="solid"
          colorPalette="primary"
          size="sm"
          disabled={loading}
        >
          <HStack gap={2}>
            <LuDownload />
            <Text>Pull</Text>
          </HStack>
        </Button>
      </Menu.Trigger>
      <Menu.Positioner zIndex={3000}>
        <Menu.Content width="400px" maxH="500px">
          {/* Header */}
          <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
            <Text fontSize="sm" fontWeight="semibold">
              Pull to Project
            </Text>
          </Box>

          {/* Search Input */}
          <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
            <InputGroup startElement={<LuSearch />}>
              <Input
                ref={searchInputRef}
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </InputGroup>
          </Box>

          {/* Project List */}
          <Box maxH="300px" overflowY="auto">
            {filteredProjects.length === 0 ? (
              <Box textAlign="center" py={4} px={3}>
                <Text fontSize="sm" color="text.secondary">
                  {searchQuery ? 'No projects match your search.' : 'No projects found.'}
                </Text>
              </Box>
            ) : (
              filteredProjects.map((project) => {
                const isSelected = selectedProjectIds.has(project.id);
                return (
                  <Menu.Item
                    key={project.id}
                    value={project.id}
                    onSelect={() => toggleProject(project.id)}
                  >
                    <HStack gap={2} justify="space-between" width="100%" minW={0}>
                      <HStack gap={2} flex="1" minW={0} overflow="hidden">
                        <Icon flexShrink={0}>
                          <LuFolder />
                        </Icon>
                        <VStack align="start" gap={0} flex="1" minW={0} overflow="hidden">
                          <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                            {project.name}
                          </Text>
                          <Text fontSize="xs" color="text.secondary" title={project.path}>
                            {truncatePath(project.path, 35)}
                          </Text>
                        </VStack>
                      </HStack>
                      {isSelected && (
                        <Icon color="primary.500" flexShrink={0}>
                          <LuCheck />
                        </Icon>
                      )}
                    </HStack>
                  </Menu.Item>
                );
              })
            )}
          </Box>

          {/* Footer with Confirm Button */}
          <Box
            px={3}
            py={2}
            borderTopWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
            opacity={selectedProjectIds.size > 0 ? 1 : 0.5}
          >
            <Button
              variant="solid"
              colorPalette="primary"
              size="sm"
              width="100%"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmPull();
              }}
              disabled={loading || selectedProjectIds.size === 0}
            >
              {loading ? (
                <HStack gap={2}>
                  <Spinner size="xs" />
                  <Text>Pulling...</Text>
                </HStack>
              ) : (
                `Pull to ${selectedProjectIds.size} Project${selectedProjectIds.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

interface CollectionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: LibraryCollection | null;
  catalogs: CatalogWithVariations[];
  selectedVariations: Map<string, SelectedVariation>;
  selectedCatalogs: Map<string, SelectedCatalog>;
  onCatalogToggle: (catalogWithVariations: CatalogWithVariations) => void;
  onVariationClick: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  onDeleteCollection: () => void;
  onMoveToCollection: (collectionId: string) => void;
  onRemoveFromCollection: () => void;
  onCreateCollection: () => void;
  onBulkPull: (projects: Project[]) => void;
  clearVariationSelection: () => void;
  clearCatalogSelection: () => void;
  projects: Project[];
  bulkPulling: boolean;
  allCollections: LibraryCollection[];
  // New props for fetching variation content
  onFetchVariationContent?: (variation: LibraryVariation, catalog: LibraryCatalog) => Promise<string>;
}

export default function CollectionViewModal({
  isOpen,
  onClose,
  collection,
  catalogs,
  selectedVariations,
  selectedCatalogs,
  onCatalogToggle,
  onVariationClick,
  onVariationToggle,
  onDeleteCollection,
  onMoveToCollection,
  onRemoveFromCollection,
  onCreateCollection,
  onBulkPull,
  clearVariationSelection,
  clearCatalogSelection,
  projects,
  bulkPulling,
  allCollections,
  onFetchVariationContent,
}: CollectionViewModalProps) {
  // View state for single modal navigation
  const [currentView, setCurrentView] = useState<ModalView>('collection');
  const [viewContext, setViewContext] = useState<ViewContext>({});
  const [showExitWarning, setShowExitWarning] = useState(false);

  // Check if there are any selections
  const hasSelections = selectedVariations.size > 0 || selectedCatalogs.size > 0;

  // Handle close with exit warning if selections exist
  const handleClose = () => {
    if (hasSelections) {
      setShowExitWarning(true);
    } else {
      onClose();
    }
  };

  // Confirm close and clear selections
  const handleConfirmClose = () => {
    clearVariationSelection();
    setShowExitWarning(false);
    onClose();
  };

  const selectedVariationsArray = useMemo(() => {
    return Array.from(selectedVariations.values());
  }, [selectedVariations]);

  const selectedCatalogsArray = useMemo(() => {
    return Array.from(selectedCatalogs.values());
  }, [selectedCatalogs]);

  // Reset view state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('collection');
      setViewContext({});
    }
  }, [isOpen]);

  // Handle variation click - navigate to preview view
  const handleVariationClick = async (variation: LibraryVariation, catalog: LibraryCatalog, fromPicker: boolean = false) => {
    setCurrentView('variation-preview');
    setViewContext(prev => ({
      ...prev,
      previewVariation: variation,
      previewCatalog: catalog,
      previewContent: '',
      previewLoading: true,
      cameFromPicker: fromPicker,
    }));

    try {
      if (onFetchVariationContent) {
        const content = await onFetchVariationContent(variation, catalog);
        setViewContext(prev => ({
          ...prev,
          previewContent: content,
          previewLoading: false,
        }));
      } else {
        // Fallback: call the original onVariationClick and show placeholder
        onVariationClick(variation, catalog);
        setViewContext(prev => ({
          ...prev,
          previewContent: '# ' + catalog.name + '\n\nContent loading is not available in this context.',
          previewLoading: false,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch variation content:', error);
      setViewContext(prev => ({
        ...prev,
        previewContent: '# Error\n\nFailed to load content.',
        previewLoading: false,
      }));
    }
  };

  // Open variations picker view
  const openVariationsPicker = (catalog: LibraryCatalog, variations: LibraryVariation[]) => {
    setCurrentView('variations-picker');
    setViewContext(prev => ({
      ...prev,
      pickerCatalog: catalog,
      pickerVariations: variations,
    }));
  };

  // Handle back navigation
  const handleBack = () => {
    if (currentView === 'variation-preview' && viewContext.cameFromPicker) {
      // Go back to variations picker
      setCurrentView('variations-picker');
      setViewContext(prev => ({
        ...prev,
        previewVariation: undefined,
        previewCatalog: undefined,
        previewContent: undefined,
        previewLoading: undefined,
      }));
    } else {
      // Go back to collection view
      setCurrentView('collection');
      setViewContext({});
    }
  };

  // Get header title based on current view
  const getHeaderTitle = () => {
    if (currentView === 'variations-picker' && viewContext.pickerCatalog) {
      return viewContext.pickerCatalog.name;
    }
    if (currentView === 'variation-preview' && viewContext.previewCatalog) {
      return viewContext.previewCatalog.name;
    }
    return collection?.name || 'Collection';
  };

  // Get breadcrumb for navigation
  const getBreadcrumb = () => {
    const parts: { label: string; onClick?: () => void }[] = [
      { label: collection?.name || 'Collection', onClick: () => { setCurrentView('collection'); setViewContext({}); } }
    ];

    if (currentView === 'variations-picker' && viewContext.pickerCatalog) {
      parts.push({ label: viewContext.pickerCatalog.name });
    } else if (currentView === 'variation-preview') {
      if (viewContext.cameFromPicker && viewContext.pickerCatalog) {
        parts.push({ 
          label: viewContext.pickerCatalog.name, 
          onClick: () => {
            setCurrentView('variations-picker');
            setViewContext(prev => ({
              ...prev,
              previewVariation: undefined,
              previewCatalog: undefined,
              previewContent: undefined,
              previewLoading: undefined,
            }));
          }
        });
      } else if (viewContext.previewCatalog) {
        // Direct navigation (single variation) - show catalog name
        parts.push({ label: viewContext.previewCatalog.name });
      }
    }

    return parts;
  };

  if (!collection) return null;

  const icon = currentView === 'collection' 
    ? <LuBookmark /> 
    : artifactTypeIcon[viewContext.pickerCatalog?.artifact_type || viewContext.previewCatalog?.artifact_type || 'kit'] || <LuPackage />;

  const breadcrumb = getBreadcrumb();

  return (
    <>
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="90vw"
            maxH="90vh"
            w="1200px"
            h="85vh"
            borderRadius="16px"
            css={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(30px) saturate(180%)',
              WebkitBackdropFilter: 'blur(30px) saturate(180%)',
              borderColor: 'rgba(0, 0, 0, 0.08)',
              boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.06)',
              _dark: {
                background: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
              },
            }}
          >
            <Dialog.Header borderBottomWidth="1px" borderColor="border.subtle">
              <HStack gap={2} align="center" flex={1}>
                {/* Back button when not on collection view */}
                {currentView !== 'collection' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    px={2}
                  >
                    <LuArrowLeft />
                  </Button>
                )}
                
                {/* Breadcrumb navigation */}
                <HStack gap={1} align="center" flex={1}>
                  {breadcrumb.map((part, index) => (
                    <HStack key={index} gap={1}>
                      {index > 0 && (
                        <Icon color="text.tertiary" boxSize={4}>
                          <LuChevronRight />
                        </Icon>
                      )}
                      {part.onClick && index < breadcrumb.length - 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={part.onClick}
                          px={2}
                          fontWeight="normal"
                          color="text.secondary"
                          _hover={{ color: 'primary.500' }}
                        >
                          {index === 0 && (
                            <Icon boxSize={4} color={collection.color || 'blue.500'} mr={1}>
                              <LuBookmark />
                            </Icon>
                          )}
                          {part.label}
                        </Button>
                      ) : (
                        <HStack gap={1}>
                          {index === 0 && currentView === 'collection' && (
                            <Icon boxSize={5} color={collection.color || 'blue.500'}>
                              <LuBookmark />
                            </Icon>
                          )}
                          {index > 0 && currentView !== 'collection' && index === breadcrumb.length - 1 && (
                            <Icon boxSize={4} color="primary.500">
                              {icon}
                            </Icon>
                          )}
                          <Dialog.Title fontSize={index === breadcrumb.length - 1 ? 'lg' : 'md'}>
                            {part.label}
                          </Dialog.Title>
                        </HStack>
                      )}
                    </HStack>
                  ))}
                  
                  {/* Badge for collection view */}
                  {currentView === 'collection' && (
                    <Badge
                      size="sm"
                      colorPalette="gray"
                      bg="transparent"
                      _dark={{ bg: "transparent" }}
                    >
                      {catalogs.length}
                    </Badge>
                  )}
                  
                  {/* Badge for variations picker */}
                  {currentView === 'variations-picker' && viewContext.pickerVariations && (
                    <Badge
                      size="sm"
                      colorPalette="gray"
                      bg="transparent"
                      _dark={{ bg: "transparent" }}
                    >
                      {viewContext.pickerVariations.length} versions
                    </Badge>
                  )}
                </HStack>
              </HStack>
              
              {/* Action buttons */}
              <HStack gap={2} align="center">
                {currentView === 'variation-preview' && viewContext.previewVariation && (
                  <>
                    {(() => {
                      const isSelected = selectedVariations.has(viewContext.previewVariation!.id);
                      return (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            if (viewContext.previewVariation && viewContext.previewCatalog) {
                              onVariationToggle(viewContext.previewVariation, viewContext.previewCatalog);
                            }
                          }}
                          borderWidth="1px"
                          borderRadius="lg"
                          css={isSelected ? {
                            background: 'rgba(59, 130, 246, 0.15)',
                            backdropFilter: 'blur(20px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                            boxShadow: '0 2px 8px 0 rgba(59, 130, 246, 0.1)',
                            color: 'var(--chakra-colors-primary-600)',
                            _dark: {
                              background: 'rgba(59, 130, 246, 0.2)',
                              borderColor: 'rgba(59, 130, 246, 0.4)',
                              boxShadow: '0 4px 16px 0 rgba(59, 130, 246, 0.2)',
                              color: 'var(--chakra-colors-primary-400)',
                            },
                          } : {
                            background: 'rgba(255, 255, 255, 0.25)',
                            backdropFilter: 'blur(20px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                            borderColor: 'rgba(0, 0, 0, 0.08)',
                            boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                            _dark: {
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderColor: 'rgba(255, 255, 255, 0.15)',
                              boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                            },
                          }}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </Button>
                      );
                    })()}
                    <Button
                      variant="solid"
                      colorPalette="primary"
                      size="xs"
                      mr={4}
                    >
                      <HStack gap={1.5}>
                        <LuDownload />
                        <Text>Pull</Text>
                      </HStack>
                    </Button>
                  </>
                )}
                <Dialog.CloseTrigger asChild>
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label="Close"
                  >
                    <LuX />
                  </IconButton>
                </Dialog.CloseTrigger>
              </HStack>
            </Dialog.Header>

            <Dialog.Body overflow="auto" position="relative" p={currentView === 'variation-preview' ? 4 : undefined}>
              {/* Collection View */}
              {currentView === 'collection' && (
                <VStack align="stretch" gap={4}>
                  {/* Catalogs List */}
                  {catalogs.length > 0 ? (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                      {catalogs.map((catWithVars) => (
                        <CollectionCatalogCard
                          key={catWithVars.catalog.id}
                          catalogWithVariations={catWithVars}
                          isSelected={selectedCatalogs.has(catWithVars.catalog.id)}
                          onCatalogToggle={() => onCatalogToggle(catWithVars)}
                          onVariationClick={(variation, catalog) => handleVariationClick(variation, catalog, false)}
                          selectedVariationIds={selectedVariations}
                          onVariationToggle={onVariationToggle}
                          onOpenVariationsPicker={openVariationsPicker}
                        />
                      ))}
                    </SimpleGrid>
                  ) : (
                    <Box textAlign="center" py={12}>
                      <Text color="text.secondary">No catalogs yet</Text>
                    </Box>
                  )}
                </VStack>
              )}

              {/* Variations Picker View */}
              {currentView === 'variations-picker' && viewContext.pickerCatalog && viewContext.pickerVariations && (
                <VariationsPickerView
                  catalog={viewContext.pickerCatalog}
                  variations={viewContext.pickerVariations}
                  selectedVariationIds={selectedVariations}
                  onVariationClick={(variation, catalog) => handleVariationClick(variation, catalog, true)}
                  onVariationToggle={onVariationToggle}
                />
              )}

              {/* Variation Preview View */}
              {currentView === 'variation-preview' && viewContext.previewVariation && viewContext.previewCatalog && (
                <VariationPreviewView
                  variation={viewContext.previewVariation}
                  catalog={viewContext.previewCatalog}
                  content={viewContext.previewContent || ''}
                  loading={viewContext.previewLoading || false}
                />
              )}
            </Dialog.Body>

            {/* Modal Action Bar Footer - only shown when there are selections */}
            {hasSelections && currentView === 'collection' && (
              <Dialog.Footer
                borderTopWidth="1px"
                borderColor="border.subtle"
                py={3}
                px={4}
                css={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  _dark: {
                    background: 'rgba(0, 0, 0, 0.3)',
                  },
                }}
              >
                <VStack align="stretch" gap={2} width="100%">
                  {/* Selection summary */}
                  <HStack gap={1.5} justify="center" wrap="wrap">
                    <Text fontSize="xs" color="text.secondary">
                      {selectedVariations.size} item{selectedVariations.size !== 1 ? 's' : ''} selected
                    </Text>
                  </HStack>

                  {/* Action buttons */}
                  <HStack gap={2} justify="center" wrap="wrap">
                    {/* Clear selection */}
                    <Button
                      variant="surface"
                      colorPalette="red"
                      size="sm"
                      onClick={clearVariationSelection}
                      disabled={bulkPulling}
                    >
                      <HStack gap={2}>
                        <LuX />
                        <Text>Clear</Text>
                      </HStack>
                    </Button>

                    <Separator orientation="vertical" height="20px" />

                    {/* Remove from Collection */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRemoveFromCollection}
                      disabled={bulkPulling}
                    >
                      <HStack gap={2}>
                        <LuTrash2 />
                        <Text>Remove</Text>
                      </HStack>
                    </Button>

                    <Separator orientation="vertical" height="20px" />

                    {/* Move to Collection */}
                    <Menu.Root>
                      <Menu.Trigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bulkPulling}
                        >
                          <HStack gap={2}>
                            <LuBookmark />
                            <Text>Move</Text>
                            <LuChevronDown />
                          </HStack>
                        </Button>
                      </Menu.Trigger>
                      <Menu.Positioner zIndex={3000}>
                        <Menu.Content>
                          {allCollections.length === 0 ? (
                            <Box px={3} py={2}>
                              <Text fontSize="sm" color="text.secondary">No collections yet</Text>
                            </Box>
                          ) : (
                            allCollections.map((col) => (
                              <Menu.Item
                                key={col.id}
                                value={col.id}
                                onSelect={() => onMoveToCollection(col.id)}
                              >
                                <HStack gap={2}>
                                  <Icon color={col.color || 'blue.500'}>
                                    <LuBookmark />
                                  </Icon>
                                  <Text>{col.name}</Text>
                                </HStack>
                              </Menu.Item>
                            ))
                          )}
                          <Menu.Separator />
                          <Menu.Item value="new" onSelect={onCreateCollection}>
                            <HStack gap={2}>
                              <Icon color="primary.500">
                                <LuBookmarkPlus />
                              </Icon>
                              <Text>Create New</Text>
                            </HStack>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Positioner>
                    </Menu.Root>

                    <Separator orientation="vertical" height="20px" />

                    {/* Pull button */}
                    <ModalPullButton
                      projects={projects}
                      onBulkPull={onBulkPull}
                      loading={bulkPulling}
                    />
                  </HStack>
                </VStack>
              </Dialog.Footer>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>

    {/* Exit Warning Dialog */}
    <Dialog.Root open={showExitWarning} onOpenChange={(e) => !e.open && setShowExitWarning(false)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="400px" borderRadius="16px">
            <Dialog.Header>
              <Dialog.Title>Leave Collection?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                You have {selectedVariations.size} item{selectedVariations.size !== 1 ? 's' : ''} selected.
                Leaving will clear your selection.
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button
                variant="outline"
                onClick={() => setShowExitWarning(false)}
              >
                Stay
              </Button>
              <Button
                colorPalette="red"
                onClick={handleConfirmClose}
              >
                Leave
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
    </>
  );
}
