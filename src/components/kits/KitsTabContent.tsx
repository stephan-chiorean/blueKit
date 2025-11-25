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
} from '@chakra-ui/react';
import { KitFile } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';

interface KitsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
}

export default function KitsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
}: KitsTabContentProps) {
  const { toggleItem, isSelected } = useSelection();

  const handleKitToggle = (kit: KitFile) => {
    const itemToToggle = {
      id: kit.path,
      name: kit.name,
      type: 'Kit' as const,
      path: kit.path,
    };
    toggleItem(itemToToggle);
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

  return (
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
                  onClick={() => handleKitToggle(kit)}
                >
                  {kitSelected ? "Selected" : "Select"}
                </Button>
              </Flex>
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}

