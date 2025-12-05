import { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Text,
  HStack,
  Tag,
  VStack,
  EmptyState,
  Icon,
  Checkbox,
  Flex,
} from '@chakra-ui/react';
import { LuBot } from 'react-icons/lu';
import { KitFile } from '../../ipc';
import AgentsActionBar from './AgentsActionBar';

interface AgentsTabContentProps {
  kits: KitFile[];
  kitsLoading: boolean;
  error: string | null;
  projectsCount: number;
  onViewKit: (kit: KitFile) => void;
}

export default function AgentsTabContent({
  kits,
  kitsLoading,
  error,
  projectsCount,
  onViewKit,
}: AgentsTabContentProps) {
  const [selectedAgentPaths, setSelectedAgentPaths] = useState<Set<string>>(new Set());

  // Filter kits to only show those with type: agent in front matter
  const agents = useMemo(() => 
    kits.filter(kit => kit.frontMatter?.type === 'agent'),
    [kits]
  );

  const isSelected = (path: string) => selectedAgentPaths.has(path);

  const handleAgentToggle = (agent: KitFile) => {
    setSelectedAgentPaths(prev => {
      const next = new Set(prev);
      if (next.has(agent.path)) {
        next.delete(agent.path);
      } else {
        next.add(agent.path);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedAgentPaths(new Set());
  };

  const selectedAgents = useMemo(() => {
    return agents.filter(agent => selectedAgentPaths.has(agent.path));
  }, [agents, selectedAgentPaths]);

  const hasSelection = selectedAgentPaths.size > 0;

  const handleAgentsUpdated = () => {
    clearSelection();
  };

  if (kitsLoading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading agents...
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

  if (agents.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="primary.500">
              <LuBot />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>No agents found</EmptyState.Title>
          <EmptyState.Description>
            Agents will appear here once they are created in your .bluekit directory with type: agent in the front matter.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Box position="relative">
      <AgentsActionBar
        selectedAgents={selectedAgents}
        hasSelection={hasSelection}
        clearSelection={clearSelection}
        onAgentsUpdated={handleAgentsUpdated}
      />
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {agents.map((agent) => {
          const agentSelected = isSelected(agent.path);
          const frontMatter = agent.frontMatter || {};
          const alias = frontMatter.alias || agent.name;
          const id = frontMatter.id || agent.name;
          const version = frontMatter.version || 1;
          const description = frontMatter.description || '';
          
          // Ensure tags is always an array
          const tags = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
          
          // Ensure capabilities is always an array of strings
          let capabilities: string[] = [];
          if (Array.isArray(frontMatter.capabilities)) {
            capabilities = frontMatter.capabilities.filter((cap): cap is string => typeof cap === 'string');
          }

          return (
            <Card.Root 
              key={agent.path} 
              variant="subtle" 
              borderWidth={agentSelected ? "2px" : "1px"}
              borderColor={agentSelected ? "primary.500" : "border.subtle"}
              bg={agentSelected ? "primary.50" : undefined}
              cursor="pointer" 
              onClick={() => onViewKit(agent)} 
              _hover={{ borderColor: "primary.400", bg: "primary.50" }}
            >
              <CardHeader>
                <Flex align="center" justify="space-between" gap={4}>
                  <VStack align="stretch" gap={2} flex="1">
                    <HStack gap={2} align="center">
                      <Heading size="md">{alias}</Heading>
                      <Tag.Root size="sm" colorPalette="primary" variant="subtle">
                        <Tag.Label>v{version}</Tag.Label>
                      </Tag.Root>
                    </HStack>
                    <Text fontSize="xs" color="text.secondary">
                      ID: {id}
                    </Text>
                  </VStack>
                  <Checkbox.Root
                    checked={agentSelected}
                    colorPalette="blue"
                    onCheckedChange={() => {
                      handleAgentToggle(agent);
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
                {capabilities.length > 0 && (
                  <Box mb={3}>
                    <Text fontSize="xs" fontWeight="semibold" mb={2} color="text.primary">
                      Capabilities:
                    </Text>
                    <VStack align="stretch" gap={1}>
                      {capabilities.map((capability, idx) => (
                        <Text key={idx} fontSize="xs" color="text.secondary">
                          • {capability}
                        </Text>
                      ))}
                    </VStack>
                  </Box>
                )}
                {tags.length > 0 && (
                  <HStack gap={1} flexWrap="wrap" mt="auto">
                    {tags.map((tag) => (
                      <Tag.Root key={tag} size="sm" variant="subtle">
                        <Tag.Label>{tag}</Tag.Label>
                      </Tag.Root>
                    ))}
                  </HStack>
                )}
              </CardBody>
            </Card.Root>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}

