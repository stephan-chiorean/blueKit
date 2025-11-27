import { useState, useMemo } from 'react';
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
  Button,
  IconButton,
  Table,
  VStack,
  Input,
  InputGroup,
  Field,
  Separator,
} from '@chakra-ui/react';
import { ImTree } from 'react-icons/im';
import { LuLayoutGrid, LuTable, LuSearch, LuX, LuFilter } from 'react-icons/lu';
import { KitFile } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';

interface KitsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: KitFile) => void;
}

type ViewMode = 'card' | 'table';

export default function KitsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
}: KitsTabContentProps) {
  const { toggleItem, isSelected } = useSelection();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Get all unique tags from kits
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    kits.forEach(kit => {
      kit.frontMatter?.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [kits]);

  // Filter kits based on name and selected tags
  const filteredKits = useMemo(() => {
    return kits.filter(kit => {
      const displayName = kit.frontMatter?.alias || kit.name;
      const matchesName = !nameFilter || 
        displayName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        kit.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(selectedTag =>
          kit.frontMatter?.tags?.some(tag => 
            tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );
      
      return matchesName && matchesTags;
    });
  }, [kits, nameFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleKitToggle = (kit: KitFile) => {
    const itemToToggle = {
      id: kit.path,
      name: kit.name,
      type: 'Kit' as const,
      path: kit.path,
    };
    toggleItem(itemToToggle);
  };

  const handleViewKit = (kit: KitFile) => {
    onViewKit(kit);
  };

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading kits...
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

  if (kits.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No kits found in any linked project's .bluekit directory.
      </Box>
    );
  }

  const renderCardView = () => (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {filteredKits.map((kit) => {
        const kitSelected = isSelected(kit.path);
        const displayName = kit.frontMatter?.alias || kit.name;
        const description = kit.frontMatter?.description || kit.path;
        const isBase = kit.frontMatter?.is_base === true;
        return (
          <Card.Root 
            key={kit.path} 
            variant="subtle"
            borderWidth={kitSelected ? "2px" : "1px"}
            borderColor={kitSelected ? "primary.500" : "border.subtle"}
            bg={kitSelected ? "primary.50" : undefined}
            position="relative"
            cursor="pointer"
            onClick={() => handleViewKit(kit)}
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
                  checked={kitSelected}
                  colorPalette="blue"
                  onCheckedChange={() => {
                    handleKitToggle(kit);
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
              {kit.frontMatter?.tags && kit.frontMatter.tags.length > 0 && (
                <HStack gap={2} flexWrap="wrap" mt="auto">
                  {kit.frontMatter.tags.map((tag) => (
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
              checked={filteredKits.length > 0 && filteredKits.every(kit => isSelected(kit.path))}
              onCheckedChange={(changes) => {
                filteredKits.forEach(kit => {
                  if (changes.checked && !isSelected(kit.path)) {
                    handleKitToggle(kit);
                  } else if (!changes.checked && isSelected(kit.path)) {
                    handleKitToggle(kit);
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
        {filteredKits.map((kit) => {
          const kitSelected = isSelected(kit.path);
          const displayName = kit.frontMatter?.alias || kit.name;
          const description = kit.frontMatter?.description || kit.path;
          const isBase = kit.frontMatter?.is_base === true;
          return (
            <Table.Row
              key={kit.path}
              cursor="pointer"
              onClick={() => handleViewKit(kit)}
              _hover={{ bg: "bg.subtle" }}
              data-selected={kitSelected ? "" : undefined}
            >
              <Table.Cell>
                <Checkbox.Root
                  size="sm"
                  checked={kitSelected}
                  onCheckedChange={() => {
                    handleKitToggle(kit);
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
                <Text fontSize="sm" color="text.secondary" noOfLines={1}>
                  {description}
                </Text>
              </Table.Cell>
              <Table.Cell>
                {kit.frontMatter?.tags && kit.frontMatter.tags.length > 0 ? (
                  <HStack gap={1} flexWrap="wrap">
                    {kit.frontMatter.tags.map((tag) => (
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
      {/* Main Content */}
      <VStack align="stretch" gap={4}>
        <Flex justify="space-between" align="center">
          {/* Filter Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            leftIcon={<LuFilter />}
          >
            Filter
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
        {filteredKits.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No kits match the current filters.
          </Box>
        ) : (
          viewMode === 'card' ? renderCardView() : renderTableView()
        )}
      </VStack>
    </Box>
  );
}

