import { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Heading,
  Timeline,
  Textarea,
  Field,
  Flex,
  HStack,
  Text,
  EmptyState,
  Icon,
} from '@chakra-ui/react';
import { LuPlus, LuArrowLeft, LuPackage, LuArrowRight, LuPuzzle } from 'react-icons/lu';
import AddComponentModal from '../components/AddComponentModal';

interface CreateBlueprintPageProps {
  blueprintName: string;
  blueprintDescription?: string;
  onBack: () => void;
}

interface TimelineNode {
  id: string;
  type: 'add-component' | 'custom-input';
  value?: string;
}

export default function CreateBlueprintPage({
  blueprintName,
  onBack,
}: CreateBlueprintPageProps) {
  // Start with empty nodes array
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [isAddComponentModalOpen, setIsAddComponentModalOpen] = useState(false);

  const handleAddComponent = () => {
    setIsAddComponentModalOpen(true);
  };

  const handleSelectCategory = (category: 'Kits' | 'Collections' | 'Walkthroughs' | 'Custom') => {
    if (category === 'Custom') {
      // Add a new custom-input node
      setNodes([...nodes, { id: `${Date.now()}`, type: 'custom-input', value: '' }]);
    }
    setIsAddComponentModalOpen(false);
  };

  const handleAddStep = () => {
    setIsAddComponentModalOpen(true);
  };

  const handleInputChange = (nodeId: string, value: string) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, value } : node))
    );
  };

  const hasNodes = nodes.length > 0;

  return (
    <Box position="relative" minH="100vh" bg="main.bg">
      <VStack align="stretch" gap={0}>
        <Box flex="1" p={6} position="relative">
          <Flex align="center" gap={4} mb={6}>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <HStack gap={2}>
                <LuArrowLeft />
                <Text>Back</Text>
              </HStack>
            </Button>
          </Flex>

          <Heading size="lg" mb={6}>
            {blueprintName}
          </Heading>

          {!hasNodes ? (
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <HStack gap={4} align="center">
                    <Icon size="xl" color="primary.500">
                      <LuPuzzle />
                    </Icon>
                    <Icon size="xl" color="primary.500">
                      <LuPuzzle />
                    </Icon>
                    <Icon size="xl" color="primary.500">
                      <LuPuzzle />
                    </Icon>
                    <Icon size="xl" color="primary.500">
                      <LuArrowRight />
                    </Icon>
                    <Icon size="xl" color="primary.500">
                      <LuPackage />
                    </Icon>
                  </HStack>
                </EmptyState.Indicator>
                <EmptyState.Title>Arrange kits and context together to create recipes for your agent</EmptyState.Title>
                <Button onClick={handleAddComponent} mt={4}>
                  <HStack gap={2}>
                    <LuPlus />
                    <Text>Add Component</Text>
                  </HStack>
                </Button>
              </EmptyState.Content>
            </EmptyState.Root>
          ) : (
            <Box>
              <Timeline.Root maxW="800px">
                {nodes.filter((node) => node.type === 'custom-input').map((node) => (
                  <Timeline.Item key={node.id}>
                    <Timeline.Connector>
                      <Timeline.Separator />
                      <Timeline.Indicator>
                        <Icon color="primary.500">
                          <LuPackage />
                        </Icon>
                      </Timeline.Indicator>
                    </Timeline.Connector>
                    <Timeline.Content>
                      <Box>
                        <Field.Root>
                          <Field.Label>Input Context</Field.Label>
                          <Textarea
                            value={node.value || ''}
                            onChange={(e) => handleInputChange(node.id, e.target.value)}
                            placeholder="Enter your input context here..."
                            rows={6}
                          />
                        </Field.Root>
                      </Box>
                    </Timeline.Content>
                  </Timeline.Item>
                ))}
              </Timeline.Root>
              <Button colorPalette="primary" onClick={handleAddStep} mt={6}>
                <HStack gap={2}>
                  <LuPlus />
                  <Text>Add Step</Text>
                </HStack>
              </Button>
            </Box>
          )}

          <AddComponentModal
            isOpen={isAddComponentModalOpen}
            onClose={() => setIsAddComponentModalOpen(false)}
            onSelectCategory={handleSelectCategory}
          />
        </Box>
      </VStack>
    </Box>
  );
}

