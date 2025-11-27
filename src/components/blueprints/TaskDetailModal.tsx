import { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  VStack,
  Text,
  Card,
  CardBody,
  HStack,
  Icon,
  Heading,
  NativeSelect,
  Field,
  SimpleGrid,
} from '@chakra-ui/react';
import { LuBot, LuPackage, LuPlus } from 'react-icons/lu';

// Agent interface matching AgentsTabContent
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

// Mock agents data (same as AgentsTabContent)
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

interface BlueprintTask {
  id: string;
  alias: string;
  agent?: string;
  kit: string;
}

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: BlueprintTask | null;
  onUpdateTask?: (taskId: string, agentId: string | undefined) => void;
}

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onUpdateTask,
}: TaskDetailModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(
    task?.agent || undefined
  );
  const [isSelectingAgent, setIsSelectingAgent] = useState(false);

  // Update selected agent when task changes
  useEffect(() => {
    if (task) {
      setSelectedAgentId(task.agent || undefined);
      setIsSelectingAgent(false);
    }
  }, [task]);

  if (!task) return null;

  const selectedAgent = selectedAgentId
    ? mockAgents.find((a) => a.id === selectedAgentId)
    : undefined;

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    setIsSelectingAgent(false);
    if (onUpdateTask && task) {
      onUpdateTask(task.id, agentId);
    }
  };

  const handleAddAgent = () => {
    setIsSelectingAgent(true);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="700px">
            <Dialog.Header>
              <Dialog.Title>{task.alias}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <SimpleGrid columns={2} gap={4}>
                {/* Agent Card */}
                {selectedAgent ? (
                  <Card.Root
                    variant="subtle"
                    borderWidth="1px"
                    cursor="pointer"
                    _hover={{ bg: 'primary.50', borderColor: 'primary.300' }}
                    onClick={() => setIsSelectingAgent(true)}
                    h="100%"
                  >
                    <CardBody>
                      <VStack gap={3} align="center" py={4}>
                        <Icon size="3xl" color="primary.500">
                          <LuBot />
                        </Icon>
                        <Heading size="sm" textAlign="center">
                          {selectedAgent.alias}
                        </Heading>
                      </VStack>
                    </CardBody>
                  </Card.Root>
                ) : isSelectingAgent ? (
                  <Card.Root
                    variant="outline"
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor="border.subtle"
                    h="100%"
                  >
                    <CardBody>
                      <VStack gap={3} align="stretch">
                        <Field.Root>
                          <Field.Label>Select Agent</Field.Label>
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              value={selectedAgentId || ''}
                              onChange={(e) => {
                                const agentId = e.currentTarget.value;
                                if (agentId) {
                                  handleAgentSelect(agentId);
                                } else {
                                  // Remove agent
                                  setSelectedAgentId(undefined);
                                  setIsSelectingAgent(false);
                                  if (onUpdateTask && task) {
                                    onUpdateTask(task.id, undefined);
                                  }
                                }
                              }}
                            >
                              <option value="">-- Select an agent --</option>
                              {mockAgents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.alias}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                        <HStack gap={2}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsSelectingAgent(false);
                              setSelectedAgentId(undefined);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            colorPalette="red"
                            onClick={() => {
                              setSelectedAgentId(undefined);
                              setIsSelectingAgent(false);
                              if (onUpdateTask && task) {
                                onUpdateTask(task.id, undefined);
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card.Root>
                ) : (
                  <Card.Root
                    variant="outline"
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor="border.subtle"
                    cursor="pointer"
                    _hover={{ borderColor: 'primary.300', bg: 'primary.50' }}
                    onClick={handleAddAgent}
                    h="100%"
                  >
                    <CardBody>
                      <VStack gap={3} align="center" py={4}>
                        <Icon size="3xl" color="primary.500">
                          <LuPlus />
                        </Icon>
                        <Text color="primary.500" fontWeight="medium" textAlign="center">
                          Add Agent
                        </Text>
                      </VStack>
                    </CardBody>
                  </Card.Root>
                )}

                {/* Kit Card */}
                <Card.Root variant="subtle" borderWidth="1px" h="100%">
                  <CardBody>
                    <VStack gap={3} align="center" py={4}>
                      <Icon size="3xl" color="primary.500">
                        <LuPackage />
                      </Icon>
                      <Heading size="sm" textAlign="center">
                        {task.kit}
                      </Heading>
                    </VStack>
                  </CardBody>
                </Card.Root>
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Close</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

