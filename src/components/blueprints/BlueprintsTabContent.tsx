import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  Text,
  VStack,
  Textarea,
  Field,
  Input,
  Separator,
  Tag,
} from '@chakra-ui/react';
import CollectionItemsSelector from '../collections/CollectionItemsSelector';
import { KitFile } from '../../ipc';

interface Blueprint {
  id: string;
  name: string;
  description: string;
}

interface BlueprintsTabContentProps {
  blueprints: Blueprint[];
  onCreateBlueprint: (name: string, description: string) => void;
  initialCreateMode?: boolean;
  onCancelCreate?: () => void;
  kits: KitFile[];
  kitsLoading: boolean;
}

export default function BlueprintsTabContent({
  blueprints,
  onCreateBlueprint,
  initialCreateMode = false,
  onCancelCreate,
  kits,
  kitsLoading,
}: BlueprintsTabContentProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create'>(initialCreateMode ? 'create' : 'list');
  const [blueprintName, setBlueprintName] = useState('');
  const [blueprintDescription, setBlueprintDescription] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialCreateMode && viewMode === 'list') {
      setViewMode('create');
    }
  }, [initialCreateMode]);

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

  const handleCancel = () => {
    setViewMode('list');
    setBlueprintName('');
    setBlueprintDescription('');
    setSelectedItemIds(new Set());
    onCancelCreate?.();
  };

  const handleCreate = () => {
    if (blueprintName.trim()) {
      onCreateBlueprint(blueprintName.trim(), blueprintDescription.trim());
      handleCancel();
    }
  };

  if (viewMode === 'create') {
    return (
      <VStack align="stretch" gap={6}>
        <Box>
          <Field.Root mb={4}>
            <Field.Label>Blueprint Name</Field.Label>
            <Input
              value={blueprintName}
              onChange={(e) => setBlueprintName(e.target.value)}
              placeholder="Enter blueprint name"
              autoFocus
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Description</Field.Label>
            <Textarea
              value={blueprintDescription}
              onChange={(e) => setBlueprintDescription(e.target.value)}
              placeholder="Enter blueprint description (optional)"
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
            disabled={!blueprintName.trim()}
            colorPalette="primary"
          >
            Create Blueprint
          </Button>
        </Flex>
      </VStack>
    );
  }

  if (blueprints.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        <Text>No blueprints yet.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex mb={4}>
        <Tag.Root
          cursor="pointer"
          colorPalette="primary"
          variant="subtle"
          onClick={() => setViewMode('create')}
          _hover={{ bg: 'primary.100' }}
        >
          <Tag.Label>Add Blueprint</Tag.Label>
        </Tag.Root>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {blueprints.map((blueprint) => (
          <Card.Root key={blueprint.id} variant="subtle">
            <CardHeader>
              <Heading size="md">{blueprint.name}</Heading>
            </CardHeader>
            <CardBody>
              <Text fontSize="sm" color="text.secondary" mb={4}>
                {blueprint.description}
              </Text>
              <Flex gap={2} justify="flex-end">
                <Button size="sm" variant="subtle">
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

