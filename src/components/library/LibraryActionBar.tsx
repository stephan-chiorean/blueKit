import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Button,
  HStack,
  Icon,
  Input,
  InputGroup,
  Menu,
  Portal,
  Spinner,
  Text,
  VStack,
  ActionBar,
} from '@chakra-ui/react';
import {
  LuX,
  LuTrash2,
  LuBookmark,
  LuBookmarkPlus,
  LuChevronDown,
  LuDownload,
  LuSearch,
  LuFolder,
  LuCheck,
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
} from 'react-icons/lu';
import { LibraryVariation, LibraryCatalog } from '../../types/github';
import { LibraryCollection } from '../../ipc/library';
import { Project } from '../../ipc';

// Selected variation with its catalog info
interface SelectedVariation {
  variation: LibraryVariation;
  catalog: LibraryCatalog;
}

interface LibraryActionBarProps {
  selectedVariations: SelectedVariation[];
  onPull: (projects: Project[]) => void;
  onMoveToCollection: (collectionId: string) => void;
  onRemoveFromCollection: () => void;
  onClearSelection: () => void;
  onCreateCollection: () => void;
  collections: LibraryCollection[];
  projects: Project[];
  loading: boolean;
}

const artifactTypeIcon: Record<string, React.ReactNode> = {
  kit: <LuPackage />,
  walkthrough: <LuBookOpen />,
  agent: <LuBot />,
  diagram: <LuNetwork />,
};

export default function LibraryActionBar({
  selectedVariations,
  onPull,
  onMoveToCollection,
  onRemoveFromCollection,
  onClearSelection,
  onCreateCollection,
  collections,
  projects,
  loading,
}: LibraryActionBarProps) {
  const [isPullMenuOpen, setIsPullMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasSelection = selectedVariations.length > 0;

  // Reset when action bar closes
  useEffect(() => {
    if (!hasSelection) {
      setSelectedProjectIds(new Set());
      setSearchQuery('');
      setIsPullMenuOpen(false);
    }
  }, [hasSelection]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isPullMenuOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isPullMenuOpen]);

  // Build selection summary with icons (like GlobalActionBar)
  const selectionSummary = useMemo(() => {
    const typeCounts: Record<string, number> = {};

    for (const { catalog } of selectedVariations) {
      const type = catalog.artifact_type || 'kit';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }

    const parts: { count: number; type: string; icon: React.ReactNode }[] = [];

    if (typeCounts['kit']) {
      parts.push({ count: typeCounts['kit'], type: 'kit', icon: artifactTypeIcon['kit'] });
    }
    if (typeCounts['walkthrough']) {
      parts.push({ count: typeCounts['walkthrough'], type: 'walkthrough', icon: artifactTypeIcon['walkthrough'] });
    }
    if (typeCounts['agent']) {
      parts.push({ count: typeCounts['agent'], type: 'agent', icon: artifactTypeIcon['agent'] });
    }
    if (typeCounts['diagram']) {
      parts.push({ count: typeCounts['diagram'], type: 'diagram', icon: artifactTypeIcon['diagram'] });
    }

    return parts;
  }, [selectedVariations]);

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
    onPull(selectedProjects);
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

  if (!hasSelection) {
    return null;
  }

  return (
    <ActionBar.Root open={hasSelection} closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner zIndex={1000}>
          <ActionBar.Content
            css={{
              animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '@keyframes slideUp': {
                from: {
                  opacity: 0,
                  transform: 'translateY(100%)',
                },
                to: {
                  opacity: 1,
                  transform: 'translateY(0)',
                },
              },
            }}
          >
            <VStack align="stretch" gap={0}>
              {/* Selection summary with icons */}
              <Box pb={1} mt={-0.5}>
                <HStack gap={1.5} justify="center" wrap="wrap">
                  {selectionSummary.map((part, index) => (
                    <HStack key={part.type} gap={1}>
                      {index > 0 && (
                        <Text fontSize="xs" color="text.secondary">
                          •
                        </Text>
                      )}
                      <Text fontSize="xs" color="text.secondary">
                        {part.count}
                      </Text>
                      <Icon fontSize="xs" color="text.secondary">
                        {part.icon}
                      </Icon>
                    </HStack>
                  ))}
                  <Text fontSize="xs" color="text.secondary">
                    selected
                  </Text>
                </HStack>
              </Box>

              {/* Action buttons */}
              <HStack gap={2}>
                {/* Clear selection */}
                <Button
                  variant="surface"
                  colorPalette="red"
                  size="sm"
                  onClick={onClearSelection}
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuX />
                    <Text>Clear</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                {/* Remove from Collection */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveFromCollection}
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuTrash2 />
                    <Text>Remove from Collection</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                {/* Move to Collection menu */}
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <HStack gap={2}>
                        <LuBookmark />
                        <Text>Move to Collection</Text>
                        <LuChevronDown />
                      </HStack>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner zIndex={2000}>
                      <Menu.Content>
                        {collections.length === 0 ? (
                          <Box px={3} py={2}>
                            <Text fontSize="sm" color="text.secondary">No collections yet</Text>
                          </Box>
                        ) : (
                          collections.map((collection) => (
                            <Menu.Item
                              key={collection.id}
                              value={collection.id}
                              onSelect={() => onMoveToCollection(collection.id)}
                            >
                              <HStack gap={2}>
                                <Icon color={collection.color || 'blue.500'}>
                                  <LuBookmark />
                                </Icon>
                                <Text>{collection.name}</Text>
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
                            <Text>Create New Collection</Text>
                          </HStack>
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>

                <ActionBar.Separator />

                {/* Pull button with project picker */}
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
                  <Portal>
                    <Menu.Positioner zIndex={2000}>
                      <Menu.Content width="400px" maxH="500px" position="relative" zIndex={2000}>
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
                  </Portal>
                </Menu.Root>
              </HStack>
            </VStack>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
