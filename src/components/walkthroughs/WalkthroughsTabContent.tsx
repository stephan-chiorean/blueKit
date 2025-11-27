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

interface WalkthroughsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: KitFile) => void;
}

export default function WalkthroughsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
}: WalkthroughsTabContentProps) {
  const { toggleItem, isSelected } = useSelection();

  const handleWalkthroughToggle = (walkthrough: KitFile) => {
    const itemToToggle = {
      id: walkthrough.path,
      name: walkthrough.name,
      type: 'Kit' as const,
      path: walkthrough.path,
    };
    toggleItem(itemToToggle);
  };

  const handleViewWalkthrough = (walkthrough: KitFile) => {
    onViewKit(walkthrough);
  };

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading walkthroughs...
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

  // Filter kits to only show those with type: walkthrough in front matter
  const walkthroughs = kits.filter(kit => kit.frontMatter?.type === 'walkthrough');

  if (walkthroughs.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No walkthroughs found in any linked project's .bluekit directory.
      </Box>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {walkthroughs.map((walkthrough) => {
        const walkthroughSelected = isSelected(walkthrough.path);
        const displayName = walkthrough.frontMatter?.alias || walkthrough.name;
        const description = walkthrough.frontMatter?.description || walkthrough.path;
        const isBase = walkthrough.frontMatter?.is_base === true;
        return (
          <Card.Root 
            key={walkthrough.path} 
            variant="subtle"
            borderWidth={walkthroughSelected ? "2px" : "1px"}
            borderColor={walkthroughSelected ? "primary.500" : "border.subtle"}
            bg={walkthroughSelected ? "primary.50" : undefined}
            position="relative"
            cursor="pointer"
            onClick={() => handleViewWalkthrough(walkthrough)}
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
                  checked={walkthroughSelected}
                  colorPalette="blue"
                  onCheckedChange={() => {
                    handleWalkthroughToggle(walkthrough);
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






