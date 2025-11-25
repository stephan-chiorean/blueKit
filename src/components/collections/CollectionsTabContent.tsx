import { useState } from 'react';
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
import { LuFolderOpen, LuPlus } from 'react-icons/lu';
import { Collection } from './CreateCollectionModal';
import CollectionItemsSelector from './CollectionItemsSelector';
import EditCollectionModal from './EditCollectionModal';
import { KitFile } from '../../ipc';

interface CollectionsTabContentProps {
  collections: Collection[];
  onAddCollection: (collection: Collection, selectedItemIds: string[]) => void;
  onUpdateCollection: (collection: Collection, selectedItemIds: string[]) => void;
  kits: KitFile[];
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const handleViewCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setIsEditModalOpen(true);
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
  if (collections.length === 0) {
    return (
      <>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon size="xl" color="primary.500">
                <LuFolderOpen />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>
              <Highlight
                query={['kits', 'blueprints', 'resources']}
                styles={{
                  px: '1',
                  py: '0.5',
                  bg: 'primary.100',
                  color: 'primary.700',
                  borderRadius: 'sm',
                }}
              >
                Save and organize your kits, blueprints, and resources into collections
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
        {isEditModalOpen && editingCollection && (
          <EditCollectionModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingCollection(null);
            }}
            onSave={(collection, selectedItemIds) => {
              onUpdateCollection(collection, selectedItemIds);
              setIsEditModalOpen(false);
              setEditingCollection(null);
            }}
            collection={editingCollection}
            selectedItemIds={editingCollection.selectedItemIds || []}
            kits={kits}
            kitsLoading={kitsLoading}
          />
        )}
      </>
    );
  }

  return (
    <>
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
      {isEditModalOpen && editingCollection && (
        <EditCollectionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingCollection(null);
          }}
          onSave={(collection, selectedItemIds) => {
            onUpdateCollection(collection, selectedItemIds);
            setIsEditModalOpen(false);
            setEditingCollection(null);
          }}
          collection={editingCollection}
          selectedItemIds={(editingCollection as any).selectedItemIds || []}
          kits={kits}
          kitsLoading={kitsLoading}
        />
      )}
    </>
  );
}

