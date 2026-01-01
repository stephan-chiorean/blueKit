import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Dialog,
  Portal,
  CloseButton,
  Heading,
  HStack,
  Icon,
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
  ActionBar,
  Input,
  InputGroup,
  Menu,
  Spinner,
} from '@chakra-ui/react';
import {
  LuBookmark,
  LuX,
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
  LuChevronRight,
  LuFolderPlus,
  LuSearch,
  LuCheck,
  LuFolder,
  LuTrash2,
  LuBookmarkPlus,
  LuChevronDown,
} from 'react-icons/lu';
import { LibraryCollection, CatalogWithVariations, LibraryVariation, LibraryCatalog } from '../../types/github';
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

// Collection Catalog Card component
interface CollectionCatalogCardProps {
  catalogWithVariations: CatalogWithVariations;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected: boolean;
  onCatalogToggle: () => void;
  onVariationClick: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
  selectedVariationIds: Map<string, SelectedVariation>;
  onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
}

function CollectionCatalogCard({
  catalogWithVariations,
  isExpanded,
  onToggleExpand,
  isSelected,
  onCatalogToggle,
  onVariationClick,
  selectedVariationIds,
  onVariationToggle,
}: CollectionCatalogCardProps) {
  const { catalog, variations } = catalogWithVariations;
  const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;
  const tags = catalog.tags ? JSON.parse(catalog.tags) : [];

  // Get default version label (v1, v2, etc.) based on index - sorted by published_at descending
  const getVersionLabel = (variation: LibraryVariation, index: number): string => {
    if (variation.version_tag) return variation.version_tag;
    // Index 0 is most recent, so we reverse the numbering
    return `v${variations.length - index}`;
  };

  return (
    <Card.Root
      variant="subtle"
      borderWidth={isSelected ? "2px" : "1px"}
      borderColor={isSelected ? "primary.500" : "border.subtle"}
      _hover={{ borderColor: isSelected ? "primary.600" : "primary.400" }}
      transition="all 0.2s"
    >
      <CardHeader pb={2}>
        <Flex justify="space-between" align="center">
          <HStack gap={2} flex={1} cursor="pointer" onClick={onToggleExpand}>
            <Icon
              transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
              transition="transform 0.2s"
            >
              <LuChevronRight />
            </Icon>
            <Icon color="primary.500">{icon}</Icon>
            <Heading size="sm">{catalog.name}</Heading>
            <Badge size="sm" colorPalette="gray">
              {variations.length}
            </Badge>
          </HStack>
          <Checkbox.Root
            checked={isSelected}
            colorPalette="primary"
            onCheckedChange={onCatalogToggle}
            onClick={(e) => e.stopPropagation()}
            cursor="pointer"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control cursor="pointer">
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
          <HStack gap={1} mb={2} wrap="wrap">
            {tags.map((tag: string) => (
              <Tag.Root key={tag} size="sm" colorPalette="gray" variant="subtle">
                <Tag.Label>{tag}</Tag.Label>
              </Tag.Root>
            ))}
          </HStack>
        )}

        <Box
          display="grid"
          css={{
            gridTemplateRows: isExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
          }}
          opacity={isExpanded ? 1 : 0}
          overflow="hidden"
        >
          <Box minHeight={0}>
            <VStack align="stretch" gap={2} mt={2}>
              {variations.map((v, index) => {
                const publishDate = new Date(v.published_at * 1000);
                const timeAgo = formatTimeAgo(publishDate);
                const isVariationSelected = selectedVariationIds.has(v.id);
                const versionLabel = getVersionLabel(v, index);
                
                return (
                  <Flex
                    key={v.id}
                    justify="space-between"
                    align="center"
                    p={3}
                    bg="bg.subtle"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="transparent"
                    _hover={{ bg: 'bg.muted', borderColor: 'primary.400', cursor: 'pointer' }}
                    transition="all 0.2s"
                    onClick={() => onVariationClick(v, catalog)}
                  >
                    <VStack align="start" gap={0}>
                      <HStack gap={2}>
                        <Text fontSize="sm" fontWeight="medium">
                          {versionLabel}
                        </Text>
                      </HStack>
                      <HStack gap={2}>
                        <Text fontSize="xs" color="text.tertiary">
                          {timeAgo}
                        </Text>
                        {v.publisher_name && (
                          <Text fontSize="xs" color="text.tertiary">
                            • by {v.publisher_name}
                          </Text>
                        )}
                      </HStack>
                    </VStack>
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
                      <Checkbox.Control cursor="pointer">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Root>
                  </Flex>
                );
              })}
            </VStack>
          </Box>
        </Box>
      </CardBody>
    </Card.Root>
  );
}

// Variation Action Bar component
interface VariationActionBarProps {
  selectedVariations: SelectedVariation[];
  hasSelection: boolean;
  clearSelection: () => void;
  projects: Project[];
  onBulkPull: (projects: Project[]) => void;
  loading: boolean;
}

function VariationActionBar({
  selectedVariations,
  hasSelection,
  clearSelection,
  projects,
  onBulkPull,
  loading,
}: VariationActionBarProps) {
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasSelection) {
      setSelectedProjectIds(new Set());
      setSearchQuery('');
      setIsAddToProjectOpen(false);
    }
  }, [hasSelection]);

  useEffect(() => {
    if (isAddToProjectOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAddToProjectOpen]);

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
    setIsAddToProjectOpen(false);
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
          <ActionBar.Content>
            <VStack align="stretch" gap={0}>
              <Box pb={1} mt={-0.5}>
                <HStack gap={1.5} justify="center">
                  <Text fontSize="xs" color="text.secondary">
                    {selectedVariations.length} variation{selectedVariations.length !== 1 ? 's' : ''} selected
                  </Text>
                </HStack>
              </Box>
              <HStack gap={2}>
                <Button
                  variant="surface"
                  colorPalette="red"
                  size="sm"
                  onClick={clearSelection}
                  disabled={loading}
                >
                  <HStack gap={2}>
                    <LuX />
                    <Text>Remove</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                <Menu.Root 
                  closeOnSelect={false}
                  open={isAddToProjectOpen}
                  onOpenChange={(e) => setIsAddToProjectOpen(e.open)}
                >
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <HStack gap={2}>
                        <LuFolderPlus />
                        <Text>Add to Project</Text>
                      </HStack>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner zIndex={2000}>
                      <Menu.Content width="400px" maxH="500px" position="relative" zIndex={2000}>
                        <Box px={3} py={2} borderBottomWidth="1px" borderColor="border.subtle">
                          <Text fontSize="sm" fontWeight="semibold">
                            Add to Project
                          </Text>
                        </Box>

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

// Catalog Action Bar component
interface CatalogActionBarProps {
  selectedCatalogs: SelectedCatalog[];
  hasSelection: boolean;
  clearSelection: () => void;
  collections: LibraryCollection[];
  onMoveToCollection: (collectionId: string) => void;
  onRemoveFromCollection: () => void;
  onCreateCollection: () => void;
}

function CatalogActionBar({
  selectedCatalogs,
  hasSelection,
  clearSelection,
  collections,
  onMoveToCollection,
  onRemoveFromCollection,
  onCreateCollection,
}: CatalogActionBarProps) {
  if (!hasSelection) {
    return null;
  }

  return (
    <ActionBar.Root open={hasSelection} closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner zIndex={1000}>
          <ActionBar.Content>
            <VStack align="stretch" gap={0}>
              <Box pb={1} mt={-0.5}>
                <HStack gap={1.5} justify="center">
                  <Text fontSize="xs" color="text.secondary">
                    {selectedCatalogs.length} catalog{selectedCatalogs.length !== 1 ? 's' : ''} selected
                  </Text>
                </HStack>
              </Box>
              <HStack gap={2}>
                <Button
                  variant="surface"
                  colorPalette="red"
                  size="sm"
                  onClick={clearSelection}
                >
                  <HStack gap={2}>
                    <LuX />
                    <Text>Remove</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveFromCollection}
                >
                  <HStack gap={2}>
                    <LuTrash2 />
                    <Text>Remove from Collection</Text>
                  </HStack>
                </Button>

                <ActionBar.Separator />

                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
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
              </HStack>
            </VStack>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}

interface CollectionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: LibraryCollection | null;
  catalogs: CatalogWithVariations[];
  selectedVariations: Map<string, SelectedVariation>;
  selectedCatalogs: Map<string, SelectedCatalog>;
  expandedCatalogs: Set<string>;
  onCatalogExpandToggle: (catalogId: string) => void;
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
}

export default function CollectionViewModal({
  isOpen,
  onClose,
  collection,
  catalogs,
  selectedVariations,
  selectedCatalogs,
  expandedCatalogs,
  onCatalogExpandToggle,
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
}: CollectionViewModalProps) {
  const selectedVariationsArray = useMemo(() => {
    return Array.from(selectedVariations.values());
  }, [selectedVariations]);

  const selectedCatalogsArray = useMemo(() => {
    return Array.from(selectedCatalogs.values());
  }, [selectedCatalogs]);

  if (!collection) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="90vw" maxH="90vh" w="1200px" h="800px">
            <Dialog.Header>
              <HStack gap={2} align="center">
                <Icon boxSize={5} color={collection.color || 'blue.500'}>
                  <LuBookmark />
                </Icon>
                <Dialog.Title>{collection.name}</Dialog.Title>
                <Badge size="sm" colorPalette="gray">
                  {catalogs.length}
                </Badge>
              </HStack>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body overflow="auto" position="relative">
              <VStack align="stretch" gap={4}>
                {/* Variation Action Bar */}
                <VariationActionBar
                  selectedVariations={selectedVariationsArray}
                  hasSelection={selectedVariations.size > 0}
                  clearSelection={clearVariationSelection}
                  projects={projects}
                  onBulkPull={onBulkPull}
                  loading={bulkPulling}
                />

                {/* Catalog Action Bar */}
                <CatalogActionBar
                  selectedCatalogs={selectedCatalogsArray}
                  hasSelection={selectedCatalogs.size > 0}
                  clearSelection={clearCatalogSelection}
                  collections={allCollections}
                  onMoveToCollection={onMoveToCollection}
                  onRemoveFromCollection={onRemoveFromCollection}
                  onCreateCollection={onCreateCollection}
                />

                {/* Catalogs List */}
                {catalogs.length > 0 ? (
                  <VStack align="stretch" gap={4}>
                    {catalogs.map((catWithVars) => (
                      <CollectionCatalogCard
                        key={catWithVars.catalog.id}
                        catalogWithVariations={catWithVars}
                        isExpanded={expandedCatalogs.has(catWithVars.catalog.id)}
                        onToggleExpand={() => onCatalogExpandToggle(catWithVars.catalog.id)}
                        isSelected={selectedCatalogs.has(catWithVars.catalog.id)}
                        onCatalogToggle={() => onCatalogToggle(catWithVars)}
                        onVariationClick={onVariationClick}
                        selectedVariationIds={selectedVariations}
                        onVariationToggle={onVariationToggle}
                      />
                    ))}
                  </VStack>
                ) : (
                  <Box textAlign="center" py={12}>
                    <Text color="text.secondary">No catalogs yet</Text>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

