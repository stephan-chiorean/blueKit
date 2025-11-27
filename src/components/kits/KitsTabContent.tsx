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

interface KitsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: KitFile) => void;
}

export default function KitsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
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

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {kits.map((kit) => {
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
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}

