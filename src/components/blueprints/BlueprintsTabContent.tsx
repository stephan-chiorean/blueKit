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
} from '@chakra-ui/react';
import { ImTree } from 'react-icons/im';
import { KitFile } from '../../ipc';
import { useSelection } from '../../contexts/SelectionContext';

interface BlueprintsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: KitFile) => void;
}

export default function BlueprintsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
}: BlueprintsTabContentProps) {
  const { toggleItem, isSelected } = useSelection();

  const handleBlueprintToggle = (blueprint: KitFile) => {
    const itemToToggle = {
      id: blueprint.path,
      name: blueprint.name,
      type: 'Kit' as const,
      path: blueprint.path,
    };
    toggleItem(itemToToggle);
  };

  const handleViewBlueprint = (blueprint: KitFile) => {
    onViewKit(blueprint);
  };

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading blueprints...
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

  // Filter kits to only show those with type: blueprint in front matter
  const blueprints = kits.filter(kit => kit.frontMatter?.type === 'blueprint');

  if (blueprints.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No blueprints found in any linked project's .bluekit directory.
      </Box>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {blueprints.map((blueprint) => {
        const blueprintSelected = isSelected(blueprint.path);
        const displayName = blueprint.frontMatter?.alias || blueprint.name;
        const description = blueprint.frontMatter?.description || blueprint.path;
        const isBase = blueprint.frontMatter?.is_base === true;
        return (
          <Card.Root 
            key={blueprint.path} 
            variant="subtle"
            borderWidth={blueprintSelected ? "2px" : "1px"}
            borderColor={blueprintSelected ? "primary.500" : "border.subtle"}
            bg={blueprintSelected ? "primary.50" : undefined}
            position="relative"
            cursor="pointer"
            onClick={() => handleViewBlueprint(blueprint)}
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
                  checked={blueprintSelected}
                  colorPalette="blue"
                  onCheckedChange={() => {
                    handleBlueprintToggle(blueprint);
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
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}
