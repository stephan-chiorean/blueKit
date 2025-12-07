import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Text,
  Icon,
  HStack,
  EmptyState,
  Checkbox,
  Flex,
} from '@chakra-ui/react';
import { LuNetwork } from 'react-icons/lu';
import { ArtifactFile } from '../../ipc';
import DiagramsActionBar from './DiagramsActionBar';

interface DiagramsTabContentProps {
  diagrams: ArtifactFile[];
  diagramsLoading: boolean;
  error: string | null;
  onViewDiagram: (diagram: ArtifactFile) => void;
}

export default function DiagramsTabContent({
  diagrams,
  diagramsLoading,
  error,
  onViewDiagram,
}: DiagramsTabContentProps) {
  const [selectedDiagramPaths, setSelectedDiagramPaths] = useState<Set<string>>(new Set());

  // Clear selection when component mounts (happens when switching tabs due to key prop)
  useEffect(() => {
    setSelectedDiagramPaths(new Set());
  }, []);

  const isSelected = (path: string) => selectedDiagramPaths.has(path);

  const handleDiagramToggle = (diagram: ArtifactFile) => {
    setSelectedDiagramPaths(prev => {
      const next = new Set(prev);
      if (next.has(diagram.path)) {
        next.delete(diagram.path);
      } else {
        next.add(diagram.path);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDiagramPaths(new Set());
  };

  const selectedDiagrams = useMemo(() => {
    return diagrams.filter(diagram => selectedDiagramPaths.has(diagram.path));
  }, [diagrams, selectedDiagramPaths]);

  const hasSelection = selectedDiagramPaths.size > 0;

  const handleDiagramsUpdated = () => {
    clearSelection();
  };

  // Handle clicking on a diagram - diagrams already have front matter from parent
  const handleDiagramClick = (diagram: ArtifactFile) => {
    onViewDiagram(diagram);
  };

  if (diagramsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading diagrams...
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

  if (diagrams.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon boxSize={12} color="text.tertiary">
                <LuNetwork />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No diagrams found</EmptyState.Title>
            <EmptyState.Description>
              Add .mmd or .mermaid files to .bluekit/diagrams to see them here.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  return (
    <Box position="relative">
      <DiagramsActionBar
        key="diagrams-action-bar"
        selectedDiagrams={selectedDiagrams}
        hasSelection={hasSelection}
        clearSelection={clearSelection}
        onDiagramsUpdated={handleDiagramsUpdated}
      />
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {diagrams.map((diagram) => {
          const diagramSelected = isSelected(diagram.path);
          const displayName = diagram.frontMatter?.alias || diagram.name;
          const description = diagram.frontMatter?.description || diagram.path;
          return (
            <Card.Root
              key={diagram.path}
              variant="subtle"
              borderWidth={diagramSelected ? "2px" : "1px"}
              borderColor={diagramSelected ? "primary.500" : "border.subtle"}
              bg={diagramSelected ? "primary.50" : undefined}
              cursor="pointer"
              onClick={() => handleDiagramClick(diagram)}
              _hover={{ borderColor: "primary.400", bg: "primary.50" }}
              transition="all 0.2s"
            >
              <CardHeader>
                <Flex align="center" justify="space-between" gap={4}>
                  <HStack gap={2} align="center" flex="1">
                    <Icon boxSize={5} color="primary.500">
                      <LuNetwork />
                    </Icon>
                    <Heading size="md">{displayName}</Heading>
                  </HStack>
                  <Checkbox.Root
                    checked={diagramSelected}
                    colorPalette="blue"
                    onCheckedChange={() => {
                      handleDiagramToggle(diagram);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    cursor="pointer"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control cursor="pointer">
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Root>
                </Flex>
              </CardHeader>
            <CardBody display="flex" flexDirection="column" flex="1">
              <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                {description}
              </Text>
              <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                {diagram.path}
              </Text>
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
    </Box>
  );
}

