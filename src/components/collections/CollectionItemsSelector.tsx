import { useState } from 'react';
import {
  Button,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  Icon,
  Separator,
  Text,
  VStack,
  Box,
  Flex,
} from '@chakra-ui/react';
import { LuPackage, LuLayers, LuBookOpen } from 'react-icons/lu';
import { KitFile } from '../../ipc';

type Category = 'Kits' | 'Templates' | 'Walkthroughs' | null;

interface CollectionItemsSelectorProps {
  kits: KitFile[];
  kitsLoading: boolean;
  selectedItemIds: Set<string>;
  onToggleItem: (itemId: string) => void;
  isSelected: (itemId: string) => boolean;
  mode?: 'add' | 'edit';
}

export default function CollectionItemsSelector({
  kits,
  kitsLoading,
  selectedItemIds,
  onToggleItem,
  isSelected,
  mode = 'add',
}: CollectionItemsSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>(null);

  const categories = [
    { name: 'Kits', icon: LuPackage, type: 'Kit' as const },
    { name: 'Templates', icon: LuLayers, type: 'Template' as const },
    { name: 'Walkthroughs', icon: LuBookOpen, type: 'Collection' as const },
  ] as const;

  // Count selected items by category type
  const getSelectedCount = (type: 'Kit' | 'Template' | 'Collection') => {
    if (type === 'Kit') {
      return kits.filter(kit => selectedItemIds.has(kit.path)).length;
    }
    return 0;
  };

  if (!selectedCategory) {
    return (
      <Box>
        <Heading size="sm" mb={4}>
          {mode === 'edit' ? 'Edit Items' : 'Add Items'}
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
                onClick={() => setSelectedCategory(category.name as Category)}
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
    );
  }

  if (selectedCategory === 'Kits') {
    return (
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
                        onClick={() => onToggleItem(kit.path)}
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
    );
  }

  return (
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
  );
}






