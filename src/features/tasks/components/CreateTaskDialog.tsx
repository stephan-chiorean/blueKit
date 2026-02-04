import { useState } from 'react';
import {
  Dialog,
  Portal,
  CloseButton,
  Text,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Field,
  Icon,
  SegmentGroup,
  TagsInput,
  Box,
  IconButton,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import {
  LuPin,
  LuArrowUp,
  LuClock,
  LuSparkles,
  LuMinus,
  LuBug,
  LuSearch,
  LuStar,
  LuBrush,
  LuZap,
  LuSquareCheck,
  LuChevronDown,
  LuChevronUp,
  LuListTodo,
} from 'react-icons/lu';
import { TaskPriority, TaskStatus, TaskComplexity, TaskType } from '@/types/task';
import { Project, invokeDbCreateTask } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import ProjectMultiSelect from './ProjectMultiSelect';

const MotionBox = motion.create(Box);
const MotionVStack = motion.create(VStack);

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  defaultProjectId?: string;
  projects: Project[];
}

export default function CreateTaskDialog({
  isOpen,
  onClose,
  onTaskCreated,
  defaultProjectId,
  projects
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  // More details fields
  const [priority, setPriority] = useState<TaskPriority>('standard');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>('');
  const [type, setType] = useState<TaskType | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    defaultProjectId ? [defaultProjectId] : []
  );
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toaster.create({
        type: 'error',
        title: 'Title required',
        description: 'Please enter a task title',
        closable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await invokeDbCreateTask(
        title.trim(),
        description.trim() || undefined,
        priority,
        tags,
        selectedProjectIds,
        status,
        complexity || undefined,
        type || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Task created',
        description: `Created task: ${title}`,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setStatus('backlog');
      setPriority('standard');
      setComplexity('');
      setType('');
      setTags([]);
      setSelectedProjectIds(defaultProjectId ? [defaultProjectId] : []);
      setShowMoreDetails(false);

      if (onTaskCreated) {
        onTaskCreated();
      }

      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create task',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form on close
      setTitle('');
      setDescription('');
      setStatus('backlog');
      setPriority('standard');
      setComplexity('');
      setType('');
      setTags([]);
      setSelectedProjectIds(defaultProjectId ? [defaultProjectId] : []);
      setShowMoreDetails(false);
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop
          asChild
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <MotionBox
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        </Dialog.Backdrop>
        <Dialog.Positioner>
          <Dialog.Content
            asChild
            maxW="lg"
            css={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              borderWidth: '1px',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '24px',
              boxShadow: '0 32px 100px -20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.2)',
              _dark: {
                background: 'rgba(20, 20, 25, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                boxShadow: '0 32px 100px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <MotionBox
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Dialog.Header pb={2}>
                <HStack gap={3} align="center">
                  <MotionBox
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
                  >
                    <Box
                      p={3}
                      borderRadius="16px"
                      bg="primary.100"
                      _dark={{ bg: 'primary.900/30' }}
                    >
                      <Icon boxSize={6} color="primary.500">
                        <LuListTodo />
                      </Icon>
                    </Box>
                  </MotionBox>
                  <VStack align="start" gap={0}>
                    <Dialog.Title fontSize="xl" fontWeight="bold">
                      Create Task
                    </Dialog.Title>
                    <Text fontSize="sm" color="text.secondary">
                      Add a new task to your workflow
                    </Text>
                  </VStack>
                </HStack>
                <Dialog.CloseTrigger asChild>
                  <CloseButton aria-label="Close" size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>

              <Dialog.Body pt={4}>
                <MotionVStack
                  align="stretch"
                  gap={5}
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.08 } },
                  }}
                >
                  {/* Task Title */}
                  <MotionBox
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <VStack align="stretch" gap={2}>
                      <Text fontSize="sm" fontWeight="medium" color="text.primary">
                        Task Title
                      </Text>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Fix authentication bug"
                        size="lg"
                        disabled={loading}
                        autoFocus
                        css={{
                          borderRadius: '12px',
                          fontSize: '16px',
                          fontWeight: '500',
                          _focus: {
                            borderColor: 'primary.400',
                            boxShadow: '0 0 0 3px rgba(var(--chakra-colors-primary-400-rgb), 0.2)',
                          },
                        }}
                      />
                    </VStack>
                  </MotionBox>

                  {/* Description */}
                  <MotionBox
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <VStack align="stretch" gap={2}>
                      <Text fontSize="sm" fontWeight="medium" color="text.primary">
                        Description <Text as="span" color="text.tertiary">(optional)</Text>
                      </Text>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add details about this task..."
                        disabled={loading}
                        rows={2}
                        css={{
                          borderRadius: '12px',
                          resize: 'none',
                        }}
                      />
                    </VStack>
                  </MotionBox>

                  {/* Status */}
                  <MotionBox
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <VStack align="stretch" gap={2}>
                      <Text fontSize="sm" fontWeight="medium" color="text.primary">
                        Status
                      </Text>
                      <SegmentGroup.Root
                        value={status}
                        onValueChange={(e) => setStatus(e.value as TaskStatus)}
                      >
                        <SegmentGroup.Indicator />
                        <SegmentGroup.Items
                          items={[
                            { value: 'backlog', label: 'Backlog' },
                            { value: 'in_progress', label: 'In Progress' },
                            { value: 'blocked', label: 'Blocked' },
                          ]}
                        />
                      </SegmentGroup.Root>
                    </VStack>
                  </MotionBox>

                  {/* More Details Toggle */}
                  <MotionBox
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMoreDetails(!showMoreDetails)}
                      justifyContent="flex-start"
                      color="text.secondary"
                      _hover={{ color: 'text.primary', bg: 'bg.subtle' }}
                      css={{
                        borderRadius: '10px',
                      }}
                    >
                      <HStack gap={2}>
                        <Icon>
                          {showMoreDetails ? <LuChevronUp /> : <LuChevronDown />}
                        </Icon>
                        <Text fontSize="sm" fontWeight="medium">
                          {showMoreDetails ? 'Less details' : 'More details'}
                        </Text>
                      </HStack>
                    </Button>
                  </MotionBox>

                  {/* Expandable More Details Section */}
                  <Box
                    overflow="hidden"
                    maxH={showMoreDetails ? '800px' : '0'}
                    opacity={showMoreDetails ? 1 : 0}
                    transition="all 0.3s ease-in-out"
                  >
                    <VStack gap={4} align="stretch">
                      {/* Priority */}
                      <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="medium" color="text.primary">
                          Priority
                        </Text>
                        <SegmentGroup.Root
                          value={priority}
                          onValueChange={(e) => setPriority(e.value as TaskPriority)}
                          size="sm"
                        >
                          <SegmentGroup.Indicator />
                          <SegmentGroup.Items
                            items={[
                              {
                                value: 'pinned',
                                label: (
                                  <HStack gap={1.5}>
                                    <Icon color="blue.500" size="sm">
                                      <LuPin />
                                    </Icon>
                                    <Text>Pin</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'high',
                                label: (
                                  <HStack gap={1.5}>
                                    <Icon color="red.500" size="sm">
                                      <LuArrowUp />
                                    </Icon>
                                    <Text>High</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'standard',
                                label: (
                                  <HStack gap={1.5}>
                                    <Icon color="orange.500" size="sm">
                                      <LuMinus />
                                    </Icon>
                                    <Text>Std</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'long term',
                                label: (
                                  <HStack gap={1.5}>
                                    <Icon color="purple.500" size="sm">
                                      <LuClock />
                                    </Icon>
                                    <Text>Long</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'nit',
                                label: (
                                  <HStack gap={1.5}>
                                    <Icon color="yellow.500" size="sm">
                                      <LuSparkles />
                                    </Icon>
                                    <Text>Nit</Text>
                                  </HStack>
                                ),
                              },
                            ]}
                          />
                        </SegmentGroup.Root>
                      </VStack>

                      {/* Complexity */}
                      <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="medium" color="text.primary">
                          Complexity <Text as="span" color="text.tertiary">(optional)</Text>
                        </Text>
                        <SegmentGroup.Root
                          value={complexity || undefined}
                          onValueChange={(e) => setComplexity(e.value as TaskComplexity | '')}
                          size="sm"
                        >
                          <SegmentGroup.Indicator />
                          <SegmentGroup.Items
                            items={[
                              { value: 'easy', label: 'Easy' },
                              { value: 'hard', label: 'Hard' },
                              { value: 'deep dive', label: 'Deep dive' },
                            ]}
                          />
                        </SegmentGroup.Root>
                      </VStack>

                      {/* Type */}
                      <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="medium" color="text.primary">
                          Type <Text as="span" color="text.tertiary">(optional)</Text>
                        </Text>
                        <SegmentGroup.Root
                          value={type || undefined}
                          onValueChange={(e) => setType(e.value as TaskType | '')}
                          size="sm"
                        >
                          <SegmentGroup.Indicator />
                          <SegmentGroup.Items
                            items={[
                              {
                                value: 'bug',
                                label: (
                                  <HStack gap={1}>
                                    <Icon color="red.500" size="sm">
                                      <LuBug />
                                    </Icon>
                                    <Text fontSize="xs">Bug</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'feature',
                                label: (
                                  <HStack gap={1}>
                                    <Icon color="blue.500" size="sm">
                                      <LuStar />
                                    </Icon>
                                    <Text fontSize="xs">Feature</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'investigation',
                                label: (
                                  <HStack gap={1}>
                                    <Icon color="purple.500" size="sm">
                                      <LuSearch />
                                    </Icon>
                                    <Text fontSize="xs">Invest</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'cleanup',
                                label: (
                                  <HStack gap={1}>
                                    <Icon color="gray.500" size="sm">
                                      <LuBrush />
                                    </Icon>
                                    <Text fontSize="xs">Clean</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'optimization',
                                label: (
                                  <HStack gap={1}>
                                    <Icon color="yellow.500" size="sm">
                                      <LuZap />
                                    </Icon>
                                    <Text fontSize="xs">Opt</Text>
                                  </HStack>
                                ),
                              },
                              {
                                value: 'chore',
                                label: (
                                  <HStack gap={1}>
                                    <Icon color="green.500" size="sm">
                                      <LuSquareCheck />
                                    </Icon>
                                    <Text fontSize="xs">Chore</Text>
                                  </HStack>
                                ),
                              },
                            ]}
                          />
                        </SegmentGroup.Root>
                      </VStack>

                      {/* Tags */}
                      <VStack align="stretch" gap={2}>
                        <TagsInput.Root
                          value={tags}
                          onValueChange={(details) => setTags(details.value)}
                        >
                          <TagsInput.Label fontSize="sm" fontWeight="medium">
                            Tags <Text as="span" color="text.tertiary">(optional)</Text>
                          </TagsInput.Label>
                          <TagsInput.Control>
                            <TagsInput.Items />
                            <TagsInput.Input placeholder="Add tag..." />
                          </TagsInput.Control>
                          <TagsInput.HiddenInput />
                        </TagsInput.Root>
                      </VStack>

                      {/* Projects */}
                      <ProjectMultiSelect
                        projects={projects}
                        selectedProjectIds={selectedProjectIds}
                        onChange={setSelectedProjectIds}
                      />
                    </VStack>
                  </Box>
                </MotionVStack>
              </Dialog.Body>

              <Dialog.Footer pt={6}>
                <HStack gap={3} justify="flex-end" w="100%">
                  <Button
                    variant="ghost"
                    onClick={handleClose}
                    disabled={loading}
                    size="lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    colorPalette="primary"
                    onClick={handleCreate}
                    loading={loading}
                    loadingText="Creating..."
                    disabled={!title.trim()}
                    size="lg"
                    css={{
                      px: 6,
                      borderRadius: '12px',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      _hover: {
                        transform: 'scale(1.02)',
                      },
                    }}
                  >
                    Create Task
                  </Button>
                </HStack>
              </Dialog.Footer>
            </MotionBox>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
