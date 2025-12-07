import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  Text,
  Icon,
  HStack,
  Checkbox,
  Tag,
  IconButton,
  Button,
  Table,
  VStack,
  Input,
  InputGroup,
  Field,
} from '@chakra-ui/react';
import { ImTree } from 'react-icons/im';
import { LuLayoutGrid, LuTable, LuX, LuFilter } from 'react-icons/lu';
import { ArtifactFile } from '../../ipc';
import WalkthroughsActionBar from './WalkthroughsActionBar';

interface WalkthroughsTabContentProps {
  kits: ArtifactFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: ArtifactFile) => void;
}

type ViewMode = 'card' | 'table';

export default function WalkthroughsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
}: WalkthroughsTabContentProps) {
  const [selectedWalkthroughPaths, setSelectedWalkthroughPaths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Clear selection when component mounts (happens when switching tabs due to key prop)
  useEffect(() => {
    setSelectedWalkthroughPaths(new Set());
  }, []);

  const isSelected = (path: string) => selectedWalkthroughPaths.has(path);

  const handleWalkthroughToggle = (walkthrough: ArtifactFile) => {
    setSelectedWalkthroughPaths(prev => {
      const next = new Set(prev);
      if (next.has(walkthrough.path)) {
        next.delete(walkthrough.path);
      } else {
        next.add(walkthrough.path);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedWalkthroughPaths(new Set());
  };

  // Filter kits to only show those with type: walkthrough in front matter
  const walkthroughs = useMemo(() => 
    kits.filter(kit => kit.frontMatter?.type === 'walkthrough'),
    [kits]
  );

  const selectedWalkthroughs = useMemo(() => {
    return walkthroughs.filter(walkthrough => selectedWalkthroughPaths.has(walkthrough.path));
  }, [walkthroughs, selectedWalkthroughPaths]);

  const hasSelection = selectedWalkthroughPaths.size > 0;

  const handleWalkthroughsUpdated = () => {
    // Reload walkthroughs if needed - for now just clear selection
    clearSelection();
  };

  // Get all unique tags from walkthroughs
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    walkthroughs.forEach(walkthrough => {
      walkthrough.frontMatter?.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [walkthroughs]);

  // Filter walkthroughs based on name and selected tags
  const filteredWalkthroughs = useMemo(() => {
    return walkthroughs.filter(walkthrough => {
      const displayName = walkthrough.frontMatter?.alias || walkthrough.name;
      const matchesName = !nameFilter || 
        displayName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        walkthrough.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(selectedTag =>
          walkthrough.frontMatter?.tags?.some(tag => 
            tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );
      
      return matchesName && matchesTags;
    });
  }, [walkthroughs, nameFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleViewWalkthrough = (walkthrough: ArtifactFile) => {
    onViewKit(walkthrough);
  };

  // Refs for filter panel and button to detect outside clicks
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterOpen &&
        filterPanelRef.current &&
        filterButtonRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading walkthroughs...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  if (projectsCount === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No projects linked. Projects are managed via CLI and will appear here automatically.
      </Box>
    );
  }

  if (walkthroughs.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No walkthroughs found in any linked project's .bluekit directory.
      </Box>
    );
  }

  const renderCardView = () => (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {filteredWalkthroughs.map((walkthrough) => {
        const walkthroughSelected = isSelected(walkthrough.path);
        const displayName = walkthrough.frontMatter?.alias || walkthrough.name;
        const description = walkthrough.frontMatter?.description || walkthrough.path;
        const isBase = walkthrough.frontMatter?.is_base === true;
        return (
          <Card.Root 
            key={walkthrough.path} 
            variant="subtle"
            borderWidth={walkthroughSelected ? "2px" : "1px"}
            borderColor={walkthroughSelected ? "primary.500" : "border.subtle"}
            bg={walkthroughSelected ? "primary.50" : undefined}
            position="relative"
            cursor="pointer"
            onClick={() => handleViewWalkthrough(walkthrough)}
            _hover={{ borderColor: "primary.400", bg: "primary.50" }}
          >
            <CardHeader>
              <Flex align="center" justify="space-between" gap={4}>
                <HStack gap={2} align="center">
                  <Heading size="md">{displayName}</Heading>
                  {isBase && (
                    <Icon
                      as={ImTree}
                      boxSize={5}
                      color="primary.500"
                      flexShrink={0}
                    />
                  )}
                </HStack>
                <Checkbox.Root
                  checked={walkthroughSelected}
                  colorPalette="blue"
                  onCheckedChange={() => {
                    handleWalkthroughToggle(walkthrough);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  cursor="pointer"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Root>
              </Flex>
            </CardHeader>
            <CardBody display="flex" flexDirection="column" flex="1">
              <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                {description}
              </Text>
              {walkthrough.frontMatter?.tags && walkthrough.frontMatter.tags.length > 0 && (
                <HStack gap={2} flexWrap="wrap" mt="auto">
                  {walkthrough.frontMatter.tags.map((tag) => (
                    <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                      <Tag.Label>{tag}</Tag.Label>
                    </Tag.Root>
                  ))}
                </HStack>
              )}
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );

  const renderTableView = () => (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w="6">
            <Checkbox.Root
              size="sm"
              colorPalette="blue"
              checked={filteredWalkthroughs.length > 0 && filteredWalkthroughs.every(walkthrough => isSelected(walkthrough.path))}
              onCheckedChange={(changes) => {
                filteredWalkthroughs.forEach(walkthrough => {
                  if (changes.checked && !isSelected(walkthrough.path)) {
                    handleWalkthroughToggle(walkthrough);
                  } else if (!changes.checked && isSelected(walkthrough.path)) {
                    handleWalkthroughToggle(walkthrough);
                  }
                });
              }}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Root>
          </Table.ColumnHeader>
          <Table.ColumnHeader>Name</Table.ColumnHeader>
          <Table.ColumnHeader>Description</Table.ColumnHeader>
          <Table.ColumnHeader>Tags</Table.ColumnHeader>
          <Table.ColumnHeader>Base</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {filteredWalkthroughs.map((walkthrough) => {
          const walkthroughSelected = isSelected(walkthrough.path);
          const displayName = walkthrough.frontMatter?.alias || walkthrough.name;
          const description = walkthrough.frontMatter?.description || walkthrough.path;
          const isBase = walkthrough.frontMatter?.is_base === true;
          return (
            <Table.Row
              key={walkthrough.path}
              cursor="pointer"
              onClick={() => handleViewWalkthrough(walkthrough)}
              _hover={{ bg: "bg.subtle" }}
              data-selected={walkthroughSelected ? "" : undefined}
            >
              <Table.Cell>
                <Checkbox.Root
                  size="sm"
                  colorPalette="blue"
                  checked={walkthroughSelected}
                  onCheckedChange={() => {
                    handleWalkthroughToggle(walkthrough);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Root>
              </Table.Cell>
              <Table.Cell>
                <HStack gap={2}>
                  <Text fontWeight="medium">{displayName}</Text>
                  {isBase && (
                    <Icon
                      as={ImTree}
                      boxSize={4}
                      color="primary.500"
                    />
                  )}
                </HStack>
              </Table.Cell>
              <Table.Cell>
                <Text fontSize="sm" color="text.secondary" lineClamp={1}>
                  {description}
                </Text>
              </Table.Cell>
              <Table.Cell>
                {walkthrough.frontMatter?.tags && walkthrough.frontMatter.tags.length > 0 ? (
                  <HStack gap={1} flexWrap="wrap">
                    {walkthrough.frontMatter.tags.map((tag) => (
                      <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                        <Tag.Label>{tag}</Tag.Label>
                      </Tag.Root>
                    ))}
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="text.tertiary">—</Text>
                )}
              </Table.Cell>
              <Table.Cell>
                {isBase ? (
                  <Tag.Root size="sm" variant="solid" colorPalette="primary">
                    <Tag.Label>Base</Tag.Label>
                  </Tag.Root>
                ) : (
                  <Text fontSize="sm" color="text.tertiary">—</Text>
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );

  return (
    <Box position="relative">
      <WalkthroughsActionBar
        key="walkthroughs-action-bar"
        selectedWalkthroughs={selectedWalkthroughs}
        hasSelection={hasSelection}
        clearSelection={clearSelection}
        onWalkthroughsUpdated={handleWalkthroughsUpdated}
      />
      {/* Main Content */}
      <VStack align="stretch" gap={4}>
        <Flex justify="space-between" align="center">
          {/* Filter Button - with gray subtle background */}
          <Button
            ref={filterButtonRef}
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            bg={isFilterOpen ? "bg.subtle" : "bg.subtle"}
            borderWidth="1px"
            borderColor="border.subtle"
            _hover={{ bg: "bg.subtle" }}
          >
            <HStack gap={2}>
              <Icon>
                <LuFilter />
              </Icon>
              <Text>Filter</Text>
            </HStack>
          </Button>

          {/* View Mode Switcher */}
          <HStack gap={0} borderWidth="1px" borderColor="border.subtle" borderRadius="md" overflow="hidden" bg="bg.subtle">
            <Button
              onClick={() => setViewMode('card')}
              variant="ghost"
              borderRadius={0}
              borderRightWidth="1px"
              borderRightColor="border.subtle"
              bg={viewMode === 'card' ? 'white' : 'transparent'}
              color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
              _hover={{ bg: viewMode === 'card' ? 'white' : 'bg.subtle' }}
            >
              <HStack gap={2}>
                <Icon>
                  <LuLayoutGrid />
                </Icon>
                <Text>Cards</Text>
              </HStack>
            </Button>
            <Button
              onClick={() => setViewMode('table')}
              variant="ghost"
              borderRadius={0}
              bg={viewMode === 'table' ? 'white' : 'transparent'}
              color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
              _hover={{ bg: viewMode === 'table' ? 'white' : 'bg.subtle' }}
            >
              <HStack gap={2}>
                <Icon>
                  <LuTable />
                </Icon>
                <Text>Table</Text>
              </HStack>
            </Button>
          </HStack>
        </Flex>

        {/* Filter Overlay */}
        {isFilterOpen && (
          <Box
            ref={filterPanelRef}
            position="absolute"
            top="50px"
            left={0}
            zIndex={10}
            w="300px"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="md"
            p={4}
            bg="white"
            boxShadow="lg"
          >
            <VStack align="stretch" gap={4}>
              <Field.Root>
                <Field.Label>Name</Field.Label>
                <InputGroup
                  endElement={nameFilter ? (
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Clear name filter"
                      onClick={() => setNameFilter('')}
                    >
                      <Icon>
                        <LuX />
                      </Icon>
                    </IconButton>
                  ) : undefined}
                >
                  <Input
                    placeholder="Filter by name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                </InputGroup>
              </Field.Root>

              {allTags.length > 0 && (
                <Field.Root>
                  <Field.Label>Tags</Field.Label>
                  <HStack gap={1} flexWrap="wrap" mt={2}>
                    {allTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <Tag.Root
                          key={tag}
                          size="sm"
                          variant={isSelected ? 'solid' : 'subtle'}
                          colorPalette={isSelected ? 'primary' : undefined}
                          cursor="pointer"
                          onClick={() => toggleTag(tag)}
                          opacity={isSelected ? 1 : 0.6}
                          _hover={{ opacity: 1 }}
                        >
                          <Tag.Label>{tag}</Tag.Label>
                        </Tag.Root>
                      );
                    })}
                  </HStack>
                </Field.Root>
              )}
            </VStack>
          </Box>
        )}

        {/* Content */}
        {filteredWalkthroughs.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No walkthroughs match the current filters.
          </Box>
        ) : (
          viewMode === 'card' ? renderCardView() : renderTableView()
        )}
      </VStack>
    </Box>
  );
}






