import { useState, useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/dialog';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Text,
  Icon,
  HStack,
  Tag,
  VStack,
  EmptyState,
  Button,
  IconButton,
  Table,
  Flex,
  Input,
  InputGroup,
  Field,
} from '@chakra-ui/react';
import { toaster } from '../ui/toaster';
import { LuGitBranch, LuTag, LuCalendar, LuFilter, LuX, LuLayoutGrid, LuTable, LuFolderPlus } from 'react-icons/lu';
import { CloneMetadata, invokeGetProjectClones, invokeWatchProjectArtifacts, invokeCreateProjectFromClone } from '../../ipc';

interface ClonesTabContentProps {
  projectPath: string;
}

type ViewMode = 'card' | 'table';

export default function ClonesTabContent({
  projectPath,
}: ClonesTabContentProps) {
  const [clones, setClones] = useState<CloneMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Load clones
  const loadClones = async () => {
    try {
      setLoading(true);
      setError(null);
      const clonesData = await invokeGetProjectClones(projectPath);
      setClones(clonesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clones');
      console.error('Error loading clones:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load clones on mount and set up file watcher
  useEffect(() => {
    loadClones();

    // Set up file watcher for this project
    const setupWatcher = async () => {
      try {
        await invokeWatchProjectArtifacts(projectPath);

        // Generate the event name (must match the Rust code)
        const sanitizedPath = projectPath
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .replace(/:/g, '_')
          .replace(/\./g, '_')
          .replace(/ /g, '_');
        const eventName = `project-kits-changed-${sanitizedPath}`;

        // Listen for file change events
        const unlisten = await listen(eventName, () => {
          console.log(`Clones.json changed for ${projectPath}, reloading...`);
          loadClones();
        });

        // Cleanup: unlisten when component unmounts
        return () => {
          unlisten();
        };
      } catch (error) {
        console.error(`Failed to set up file watcher for ${projectPath}:`, error);
      }
    };

    const cleanup = setupWatcher();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [projectPath]);

  // Get all unique tags from clones
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    clones.forEach(clone => {
      clone.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [clones]);

  // Filter clones based on name and selected tags
  const filteredClones = useMemo(() => {
    return clones.filter(clone => {
      const matchesName = !nameFilter || 
        clone.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
        clone.description.toLowerCase().includes(nameFilter.toLowerCase());
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(selectedTag =>
          clone.tags?.some(tag => 
            tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );
      
      return matchesName && matchesTags;
    });
  }, [clones, nameFilter, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  // Helper function to slugify the clone name for directory name
  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  const handleCreateProject = async (clone: CloneMetadata) => {
    try {
      // Open directory picker to select parent directory
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Parent Directory for New Project',
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        // User cancelled
        return;
      }

      // Create a safe directory name from the clone name
      const projectDirName = slugify(clone.name);
      
      // Build the full target path: selectedPath/projectDirName
      const targetPath = `${selectedPath}/${projectDirName}`;

      // Create project from clone
      const result = await invokeCreateProjectFromClone(
        clone.id,
        targetPath,
        clone.name,
        true // Register project automatically
      );

      // Show success toast
      toaster.create({
        type: 'success',
        title: 'Project Created',
        description: result,
      });
    } catch (error) {
      console.error('[ClonesTabContent] Error creating project:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading clones...
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

  if (clones.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Title>No clones found</EmptyState.Title>
            <EmptyState.Description>
              Clones will appear here once they are registered in .bluekit/clones.json.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  const renderCardView = () => (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {filteredClones.map((clone) => (
        <Card.Root
          key={clone.id}
          variant="subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          _hover={{ borderColor: "primary.400", bg: "primary.50" }}
          transition="all 0.2s"
        >
          <CardHeader>
            <Flex justify="space-between" align="start" gap={4} w="100%">
              <VStack align="stretch" gap={2} flex="1">
                <Heading size="md">{clone.name}</Heading>
                <Text fontSize="xs" color="text.secondary">
                  ID: {clone.id}
                </Text>
              </VStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateProject(clone);
                }}
                _hover={{ bg: "bg.subtle" }}
                flexShrink={0}
              >
                <HStack gap={1}>
                  <Icon>
                    <LuFolderPlus />
                  </Icon>
                  <Text fontSize="xs">Build Project</Text>
                </HStack>
              </Button>
            </Flex>
          </CardHeader>
          <CardBody display="flex" flexDirection="column" flex="1">
            <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
              {clone.description}
            </Text>
            
            <VStack align="stretch" gap={2} mb={4}>
              <HStack gap={2} fontSize="xs" color="text.tertiary">
                <Icon>
                  <LuGitBranch />
                </Icon>
                <Text fontFamily="mono" fontSize="xs">
                  {clone.gitBranch || 'detached'}
                </Text>
              </HStack>
              
              {clone.gitTag && (
                <HStack gap={2} fontSize="xs" color="text.tertiary">
                  <Icon>
                    <LuTag />
                  </Icon>
                  <Text fontFamily="mono" fontSize="xs">
                    {clone.gitTag}
                  </Text>
                </HStack>
              )}
              
              <HStack gap={2} fontSize="xs" color="text.tertiary">
                <Icon>
                  <LuCalendar />
                </Icon>
                <Text fontSize="xs">
                  {formatDate(clone.createdAt)}
                </Text>
              </HStack>
              
              <Text fontSize="xs" color="text.tertiary" fontFamily="mono" wordBreak="break-all">
                {clone.gitCommit.substring(0, 7)}
              </Text>
            </VStack>

            {clone.tags && clone.tags.length > 0 && (
              <HStack gap={1} flexWrap="wrap" mt="auto">
                {clone.tags.map((tag) => (
                  <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                    <Tag.Label>{tag}</Tag.Label>
                  </Tag.Root>
                ))}
              </HStack>
            )}
          </CardBody>
        </Card.Root>
      ))}
    </SimpleGrid>
  );

  const renderTableView = () => (
    <Table.Root size="sm" variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Name</Table.ColumnHeader>
          <Table.ColumnHeader>Description</Table.ColumnHeader>
          <Table.ColumnHeader>Git Info</Table.ColumnHeader>
          <Table.ColumnHeader>Tags</Table.ColumnHeader>
          <Table.ColumnHeader>Created</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {filteredClones.map((clone) => (
          <Table.Row
            key={clone.id}
            _hover={{ bg: "bg.subtle" }}
          >
            <Table.Cell>
              <VStack align="start" gap={0}>
                <Text fontWeight="medium">{clone.name}</Text>
                <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                  {clone.id}
                </Text>
              </VStack>
            </Table.Cell>
            <Table.Cell>
              <Text fontSize="sm" color="text.secondary" lineClamp={2}>
                {clone.description}
              </Text>
            </Table.Cell>
            <Table.Cell>
              <VStack align="start" gap={1}>
                <HStack gap={1} fontSize="xs">
                  <Icon boxSize={3}>
                    <LuGitBranch />
                  </Icon>
                  <Text>{clone.gitBranch || 'detached'}</Text>
                </HStack>
                {clone.gitTag && (
                  <HStack gap={1} fontSize="xs">
                    <Icon boxSize={3}>
                      <LuTag />
                    </Icon>
                    <Text>{clone.gitTag}</Text>
                  </HStack>
                )}
                <Text fontSize="xs" fontFamily="mono" color="text.tertiary">
                  {clone.gitCommit.substring(0, 7)}
                </Text>
              </VStack>
            </Table.Cell>
            <Table.Cell>
              {clone.tags && clone.tags.length > 0 ? (
                <HStack gap={1} flexWrap="wrap">
                  {clone.tags.map((tag) => (
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
              <Text fontSize="sm" color="text.secondary">
                {formatDate(clone.createdAt)}
              </Text>
            </Table.Cell>
          </Table.Row>
        ))}
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
        {filteredClones.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No clones match the current filters.
          </Box>
        ) : (
          viewMode === 'card' ? renderCardView() : renderTableView()
        )}
      </VStack>
    </Box>
  );
}

