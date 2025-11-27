import { useState } from 'react';
import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  Icon,
  Field,
  Input,
  Textarea,
  Separator,
  Text,
  VStack,
  Box,
  Flex,
} from '@chakra-ui/react';
import { LuPackage, LuLayers, LuBookOpen } from 'react-icons/lu';
import { KitFile } from '../../ipc';

export interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (collection: Collection, selectedItemIds: string[]) => void;
  kits: KitFile[];
  kitsLoading: boolean;
}

type Category = 'Kits' | 'Templates' | 'Walkthroughs' | null;

export default function CreateCollectionModal({
  isOpen,
  onClose,
  onCreate,
  kits,
  kitsLoading,
}: CreateCollectionModalProps) {
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const categories = [
    { name: 'Kits', icon: LuPackage, type: 'Kit' as const },
    { name: 'Templates', icon: LuLayers, type: 'Template' as const },
    { name: 'Walkthroughs', icon: LuBookOpen, type: 'Collection' as const }, // Using Collection as placeholder for now
  ] as const;

  // Count selected items by category type
  const getSelectedCount = (type: 'Kit' | 'Template' | 'Collection') => {
    // For now, only Kits are implemented, so count kits
    if (type === 'Kit') {
      return kits.filter(kit => selectedItemIds.has(kit.path)).length;
    }
    // For other types, return 0 for now
    return 0;
  };

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

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleCreate = () => {
    if (collectionName.trim()) {
      const newCollection: Collection = {
        id: `collection-${Date.now()}`,
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
      };
      onCreate(newCollection, Array.from(selectedItemIds));
      handleClose();
    }
  };

  const handleClose = () => {
    setCollectionName('');
    setCollectionDescription('');
    setSelectedCategory(null);
    setSelectedItemIds(new Set());
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="1000px" maxH="90vh" display="flex" flexDirection="column">
            <Dialog.Header>
              <Dialog.Title>Create Collection</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body flex="1" overflowY="auto">
              <VStack align="stretch" gap={4}>
                {/* Collection Name and Description */}
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

                {/* Category Selection or Content */}
                {!selectedCategory ? (
                  <Box>
                    <Heading size="sm" mb={4}>
                      Add Items
                    </Heading>
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                      {categories.map((category) => {
                        const selectedCount = getSelectedCount(category.type);
                        return (
                          <Card.Root
                            key={category.name}
                            variant="subtle"
                            cursor="pointer"
                            transition="all 0.2s"
                            _hover={{
                              transform: 'scale(1.02)',
                              bg: 'primary.50',
                            }}
                            onClick={() => handleSelectCategory(category.name as Category)}
                          >
                            <CardHeader>
                              <HStack gap={3}>
                                <Icon size="lg">
                                  <category.icon />
                                </Icon>
                                <Heading size="md">{category.name}</Heading>
                              </HStack>
                            </CardHeader>
                            <CardBody>
                              <Text fontSize="sm" color="text.secondary">
                                {selectedCount > 0 ? `${selectedCount} selected` : 'No items selected'}
                              </Text>
                            </CardBody>
                          </Card.Root>
                        );
                      })}
                    </SimpleGrid>
                  </Box>
                ) : selectedCategory === 'Kits' ? (
                  <Box>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      mb={4}
                    >
                      ← Back
                    </Button>
                    {kitsLoading ? (
                      <Box textAlign="center" py={12} color="text.secondary">
                        Loading kits...
                      </Box>
                    ) : kits.length === 0 ? (
                      <Box textAlign="center" py={12} color="text.secondary">
                        No kits found.
                      </Box>
                    ) : (
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                        {kits.map((kit) => {
                          const kitSelected = isSelected(kit.path);
                          return (
                            <Card.Root
                              key={kit.path}
                              variant="subtle"
                              borderWidth={kitSelected ? "2px" : "1px"}
                              borderColor={kitSelected ? "primary.500" : "border.subtle"}
                              bg={kitSelected ? "primary.50" : undefined}
                            >
                              <CardHeader>
                                <Heading size="md">{kit.name}</Heading>
                              </CardHeader>
                              <CardBody>
                                <Text fontSize="sm" color="text.secondary" mb={4}>
                                  {kit.path}
                                </Text>
                                <Flex gap={2} justify="flex-end">
                                  <Button size="sm" variant="subtle">
                                    View
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant={kitSelected ? "solid" : "outline"}
                                    colorPalette={kitSelected ? "primary" : undefined}
                                    onClick={() => handleToggleItem(kit.path)}
                                  >
                                    {kitSelected ? "Selected" : "Select"}
                                  </Button>
                                </Flex>
                              </CardBody>
                            </Card.Root>
                          );
                        })}
                      </SimpleGrid>
                    )}
                  </Box>
                ) : (
                  <Box>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      mb={4}
                    >
                      ← Back
                    </Button>
                    <Box textAlign="center" py={12} color="text.secondary">
                      {selectedCategory} selection coming soon...
                    </Box>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={handleCreate}
                disabled={!collectionName.trim()}
                colorPalette="primary"
              >
                Create
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

