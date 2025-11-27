import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  Text,
  HStack,
  Tag,
  VStack,
  EmptyState,
  Button,
  Icon,
} from '@chakra-ui/react';
import { LuBot, LuPlus } from 'react-icons/lu';

// Mock agent data structure matching the spec
interface Agent {
  id: string;
  alias: string;
  type: 'agent';
  version: number;
  description: string;
  tags: string[];
  capabilities?: string[];
  executionNotes?: string;
}

// Mock agents data
const mockAgents: Agent[] = [
  {
    id: 'cursor',
    alias: 'Cursor Agent',
    type: 'agent',
    version: 1,
    description: 'Default agent for local code generation using Cursor.',
    tags: ['local', 'coding', 'ide'],
    capabilities: [
      'Full access to local project files',
      'Can run MCP tool calls',
      'Ideal for: UI kits, API kits, utils',
    ],
    executionNotes: 'Use this agent to generate code inside your project. Not a long-running process; each kit is one atomic execution.',
  },
  {
    id: 'frontend',
    alias: 'Frontend Agent',
    type: 'agent',
    version: 1,
    description: 'Specialized agent for frontend development and UI components.',
    tags: ['frontend', 'ui', 'react'],
    capabilities: [
      'React component generation',
      'Styling and theming',
      'Component library integration',
    ],
  },
  {
    id: 'qa-bot',
    alias: 'QA Bot',
    type: 'agent',
    version: 1,
    description: 'Automated testing and quality assurance agent.',
    tags: ['testing', 'qa', 'automation'],
    capabilities: [
      'Test generation',
      'Code quality checks',
      'Automated testing workflows',
    ],
  },
  {
    id: 'backend-ops',
    alias: 'Backend Ops',
    type: 'agent',
    version: 1,
    description: 'Infrastructure and backend operations agent.',
    tags: ['backend', 'infrastructure', 'ops'],
    capabilities: [
      'Database setup',
      'API configuration',
      'Infrastructure provisioning',
    ],
  },
];

interface AgentsTabContentProps {
  // For future: when we connect to real data
  // agents: AgentFile[];
  // agentsLoading: boolean;
  // error: string | null;
}

export default function AgentsTabContent({}: AgentsTabContentProps) {
  // Using mock data for now
  const agents = mockAgents;

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
            Agents will appear here once they are created in your .bluekit/agents/ directory.
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Box>
      <Flex mb={4} justify="flex-end">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<LuPlus />}
          onClick={() => {
            // TODO: Open create agent modal
            console.log('Create agent');
          }}
        >
          Add Agent
        </Button>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {agents.map((agent) => (
          <Card.Root key={agent.id} variant="subtle">
            <CardHeader>
              <VStack align="stretch" gap={2}>
                <HStack justify="space-between" align="start">
                  <Heading size="md">{agent.alias}</Heading>
                  <Tag.Root size="sm" colorPalette="primary" variant="subtle">
                    <Tag.Label>v{agent.version}</Tag.Label>
                  </Tag.Root>
                </HStack>
                <Text fontSize="xs" color="text.secondary">
                  ID: {agent.id}
                </Text>
              </VStack>
            </CardHeader>
            <CardBody display="flex" flexDirection="column" flex="1">
              <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                {agent.description}
              </Text>
              {agent.capabilities && agent.capabilities.length > 0 && (
                <Box mb={3}>
                  <Text fontSize="xs" fontWeight="semibold" mb={2} color="text.primary">
                    Capabilities:
                  </Text>
                  <VStack align="stretch" gap={1}>
                    {agent.capabilities.map((capability, idx) => (
                      <Text key={idx} fontSize="xs" color="text.secondary">
                        • {capability}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              )}
              <HStack gap={1} flexWrap="wrap" mt="auto">
                {agent.tags.map((tag) => (
                  <Tag.Root key={tag} size="sm" variant="subtle">
                    <Tag.Label>{tag}</Tag.Label>
                  </Tag.Root>
                ))}
              </HStack>
            </CardBody>
          </Card.Root>
        ))}
      </SimpleGrid>
    </Box>
  );
}

