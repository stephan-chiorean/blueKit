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
import { LuPlus, LuArrowLeft, LuPackage } from 'react-icons/lu';
import AddComponentModal from '../components/AddComponentModal';

interface CreateBlueprintPageProps {
  blueprintName: string;
  blueprintDescription: string;
  onBack: () => void;
}

interface TimelineNode {
  id: string;
  type: 'add-component' | 'custom-input';
  value?: string;
}

export default function CreateBlueprintPage({
  blueprintName,
  blueprintDescription,
  onBack,
}: CreateBlueprintPageProps) {
  // Start with one "add-component" entry
  const [nodes, setNodes] = useState<TimelineNode[]>([{ id: '1', type: 'add-component' }]);
  const [isAddComponentModalOpen, setIsAddComponentModalOpen] = useState(false);

  const handleAddComponent = () => {
    setIsAddComponentModalOpen(true);
  };

  const handleSelectCategory = (category: 'Kits' | 'Collections' | 'Walkthroughs' | 'Custom') => {
    if (category === 'Custom') {
      // Convert first add-component node to custom-input, then add new add-component node
      const updatedNodes = [...nodes];
      const firstAddComponentIndex = updatedNodes.findIndex((n) => n.type === 'add-component');
      
      if (firstAddComponentIndex !== -1) {
        // Convert this add-component to custom-input
        updatedNodes[firstAddComponentIndex] = {
          id: updatedNodes[firstAddComponentIndex].id,
          type: 'custom-input',
          value: '',
        };
        // Add new add-component node after it
        updatedNodes.splice(firstAddComponentIndex + 1, 0, {
          id: `${Date.now()}`,
          type: 'add-component',
        });
      } else {
        // No add-component found, just add a new one
        updatedNodes.push({ id: `${Date.now()}`, type: 'add-component' });
      }
      setNodes(updatedNodes);
    }
  };

  const handleInputChange = (nodeId: string, value: string) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, value } : node))
    );
  };

  const handleAddNewComponent = (nodeId: string) => {
    // Add new add-component node after the current one
    const currentIndex = nodes.findIndex((n) => n.id === nodeId);
    const newNodes = [...nodes];
    newNodes.splice(currentIndex + 1, 0, {
      id: `${Date.now()}`,
      type: 'add-component',
    });
    setNodes(newNodes);
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
            <Heading size="lg">{blueprintName}</Heading>
          </Flex>

          {blueprintDescription && (
            <Text color="gray.500" mb={6}>
              {blueprintDescription}
            </Text>
          )}

          {!hasNodes ? (
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Icon size="xl">
                    <LuPlus />
                  </Icon>
                </EmptyState.Indicator>
                <EmptyState.Title>No components yet</EmptyState.Title>
                <EmptyState.Description>
                  Get started by adding your first component to this blueprint.
                </EmptyState.Description>
                <Button onClick={handleAddComponent} mt={4}>
                  <HStack gap={2}>
                    <LuPlus />
                    <Text>Add Component</Text>
                  </HStack>
                </Button>
              </EmptyState.Content>
            </EmptyState.Root>
          ) : (
            <Timeline.Root maxW="800px">
              {nodes.map((node, index) => (
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
                    {node.type === 'add-component' ? (
                      <Box>
                        <Button variant="outline" onClick={() => handleAddComponent()}>
                          <HStack gap={2}>
                            <LuPlus />
                            <Text>Add Component</Text>
                          </HStack>
                        </Button>
                      </Box>
                    ) : (
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
                    )}
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline.Root>
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

