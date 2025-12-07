import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  EmptyState,
  Highlight,
  Icon,
  HStack,
  Text,
  Flex,
  VStack,
  Box,
  Field,
  Input,
  Textarea,
  Separator,
  Tag,
} from '@chakra-ui/react';
import { LuLibrary, LuPlus } from 'react-icons/lu';
import { Collection } from './AddCollectionDialog';
import CollectionItemsSelector from './CollectionItemsSelector';
import { ArtifactFile } from '../../ipc';

interface CollectionsTabContentProps {
  collections: Collection[];
  onAddCollection: (collection: Collection, selectedItemIds: string[]) => void;
  onUpdateCollection: (collection: Collection, selectedItemIds: string[]) => void;
  kits: ArtifactFile[];
  kitsLoading: boolean;
}

type ViewMode = 'list' | 'create' | 'edit';

export default function CollectionsTabContent({
  collections,
  onAddCollection,
  onUpdateCollection,
  kits,
  kitsLoading,
}: CollectionsTabContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const isSelected = (itemId: string) => {
    return selectedItemIds.has(itemId);
  };

  const handleStartCreate = () => {
    setCollectionName('');
    setCollectionDescription('');
    setSelectedItemIds(new Set());
    setViewMode('create');
  };

  const handleCancel = () => {
    setViewMode('list');
    setCollectionName('');
    setCollectionDescription('');
    setSelectedItemIds(new Set());
    setEditingCollection(null);
  };

  const handleCreate = () => {
    if (collectionName.trim()) {
      const newCollection: Collection = {
        id: `collection-${Date.now()}`,
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
      };
      onAddCollection(newCollection, Array.from(selectedItemIds));
      handleCancel();
    }
  };

  const handleSave = () => {
    if (collectionName.trim() && editingCollection) {
      const updatedCollection: Collection = {
        ...editingCollection,
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
      };
      onUpdateCollection(updatedCollection, Array.from(selectedItemIds));
      handleCancel();
    }
  };

  // Update form fields when editing collection changes
  useEffect(() => {
    if (editingCollection && viewMode === 'edit') {
      setCollectionName(editingCollection.name);
      setCollectionDescription(editingCollection.description || '');
      const fullCollection = collections.find(c => c.id === editingCollection.id);
      const itemIds = (fullCollection as any)?.selectedItemIds || [];
      setSelectedItemIds(new Set(itemIds));
    }
  }, [editingCollection, viewMode, collections]);

  const handleViewCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setCollectionName(collection.name);
    setCollectionDescription(collection.description || '');
    // Get selected item IDs from the collection if available
    // We need to find the collection in the collections array to get its selectedItemIds
    const fullCollection = collections.find(c => c.id === collection.id);
    const itemIds = (fullCollection as any)?.selectedItemIds || [];
    setSelectedItemIds(new Set(itemIds));
    setViewMode('edit');
  };

  if (viewMode === 'create') {
    return (
      <VStack align="stretch" gap={6}>
        <Box>
          <Field.Root mb={4}>
            <Field.Label>Collection Name</Field.Label>
            <Input
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Enter collection name"
              autoFocus
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Description</Field.Label>
            <Textarea
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              placeholder="Enter collection description (optional)"
              rows={3}
            />
          </Field.Root>
        </Box>

        <Separator />

        <CollectionItemsSelector
          kits={kits}
          kitsLoading={kitsLoading}
          selectedItemIds={selectedItemIds}
          onToggleItem={handleToggleItem}
          isSelected={isSelected}
          mode="add"
        />

        <Flex justify="flex-end" gap={2}>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!collectionName.trim()}
            colorPalette="primary"
          >
            Create Collection
          </Button>
        </Flex>
      </VStack>
    );
  }

  if (viewMode === 'edit' && editingCollection) {
    return (
      <VStack align="stretch" gap={6}>
        <Box>
          <Field.Root mb={4}>
            <Field.Label>Collection Name</Field.Label>
            <Input
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Enter collection name"
              autoFocus
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Description</Field.Label>
            <Textarea
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              placeholder="Enter collection description (optional)"
              rows={3}
            />
          </Field.Root>
        </Box>

        <Separator />

        <CollectionItemsSelector
          kits={kits}
          kitsLoading={kitsLoading}
          selectedItemIds={selectedItemIds}
          onToggleItem={handleToggleItem}
          isSelected={isSelected}
          mode="edit"
        />

        <Flex justify="flex-end" gap={2}>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!collectionName.trim()}
            colorPalette="primary"
          >
            Save Collection
          </Button>
        </Flex>
      </VStack>
    );
  }
  if (collections.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="primary.500">
              <LuLibrary />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>
            <Highlight
              query={['kits', 'templates', 'resources']}
              styles={{
                px: '1',
                py: '0.5',
                bg: 'primary.100',
                color: 'primary.700',
                borderRadius: 'sm',
              }}
            >
              Save and organize your kits, templates, and resources into collections
            </Highlight>
          </EmptyState.Title>
          <Button
            colorPalette="primary"
            onClick={handleStartCreate}
            mt={4}
          >
            <HStack gap={2}>
              <LuPlus />
              <Text>Add Collection</Text>
            </HStack>
          </Button>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Box>
      <Flex mb={4}>
        <Tag.Root
          cursor="pointer"
          colorPalette="primary"
          variant="subtle"
          onClick={handleStartCreate}
          _hover={{ bg: 'primary.100' }}
        >
          <Tag.Label>Add Collection</Tag.Label>
        </Tag.Root>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {collections.map((collection) => (
          <Card.Root key={collection.id} variant="subtle">
            <CardHeader>
              <Heading size="md">{collection.name}</Heading>
            </CardHeader>
            <CardBody>
              <Text fontSize="sm" color="text.secondary" mb={4}>
                Collection
              </Text>
              <Flex gap={2} justify="flex-end">
                <Button 
                  size="sm" 
                  variant="subtle"
                  onClick={() => handleViewCollection(collection)}
                >
                  View
                </Button>
                <Button size="sm" variant="outline">
                  Select
                </Button>
              </Flex>
            </CardBody>
          </Card.Root>
        ))}
      </SimpleGrid>
    </Box>
  );
}

