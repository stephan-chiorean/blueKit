import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  VStack,
  Text,
  Box,
  Heading,
  Code,
  Separator,
  HStack,
  Tag,
  List,
  Link,
  Spinner,
} from '@chakra-ui/react';
import { Blueprint, BlueprintTask } from '../../ipc';
import { invokeGetBlueprintTaskFile } from '../../ipc';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: { blueprint: Blueprint; task: BlueprintTask } | null;
  onViewTask: (blueprintPath: string, taskFile: string, taskDescription: string) => void;
}

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onViewTask,
}: TaskDetailModalProps) {
  const [taskContent, setTaskContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load task content when task changes
  useEffect(() => {
    if (task && isOpen) {
      const loadTaskContent = async () => {
        try {
          setLoading(true);
          setError(null);
          const content = await invokeGetBlueprintTaskFile(
            task.blueprint.path,
            task.task.taskFile
          );
          setTaskContent(content);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load task content');
          console.error('Error loading task content:', err);
        } finally {
          setLoading(false);
        }
      };

      loadTaskContent();
    } else {
      setTaskContent(null);
      setError(null);
    }
  }, [task, isOpen]);

  if (!task) return null;

  const handleViewInMarkdown = () => {
    onViewTask(task.blueprint.path, task.task.taskFile, task.task.description);
    onClose();
  };

  // Remove front matter from content for display
  const contentWithoutFrontMatter = taskContent
    ? taskContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '')
    : '';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="900px" maxH="80vh">
            <Dialog.Header>
              <VStack align="start" gap={2}>
                <Dialog.Title>{task.task.description}</Dialog.Title>
                <HStack gap={2}>
                  <Tag.Root size="sm" variant="subtle">
                    <Tag.Label>{task.task.taskFile}</Tag.Label>
                  </Tag.Root>
                  <Tag.Root size="sm" variant="subtle" colorPalette="primary">
                    <Tag.Label>{task.blueprint.metadata.name}</Tag.Label>
                  </Tag.Root>
                </HStack>
              </VStack>
            </Dialog.Header>
            <Dialog.Body>
              <Box maxH="60vh" overflow="auto">
                {loading ? (
                  <Box textAlign="center" py={8}>
                    <Spinner size="lg" />
                    <Text mt={4} color="text.secondary">
                      Loading task content...
                    </Text>
                  </Box>
                ) : error ? (
                  <Box textAlign="center" py={8}>
                    <Text color="red.500">{error}</Text>
                  </Box>
                ) : taskContent ? (
                  <Box
                    css={{
                      '& > *': {
                        mb: 4,
                      },
                      '& > *:last-child': {
                        mb: 0,
                      },
                      '& h1': {
                        fontSize: '2xl',
                        fontWeight: 'bold',
                        mt: 6,
                        mb: 4,
                      },
                      '& h2': {
                        fontSize: 'xl',
                        fontWeight: 'semibold',
                        mt: 5,
                        mb: 3,
                      },
                      '& h3': {
                        fontSize: 'lg',
                        fontWeight: 'semibold',
                        mt: 4,
                        mb: 2,
                      },
                      '& p': {
                        lineHeight: '1.75',
                        color: 'text.primary',
                      },
                      '& ul, & ol': {
                        pl: 4,
                        mb: 4,
                      },
                      '& li': {
                        mb: 2,
                      },
                      '& pre': {
                        mb: 4,
                      },
                      '& code': {
                        fontSize: '0.9em',
                      },
                      '& a': {
                        color: 'primary.500',
                        textDecoration: 'underline',
                      },
                      '& blockquote': {
                        borderLeft: '4px solid',
                        borderColor: 'border.emphasized',
                        pl: 4,
                        py: 2,
                        my: 4,
                        bg: 'bg.subtle',
                        fontStyle: 'italic',
                      },
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <Heading as="h1" size="2xl" mt={6} mb={4}>{children}</Heading>,
                        h2: ({ children }) => <Heading as="h2" size="xl" mt={5} mb={3}>{children}</Heading>,
                        h3: ({ children }) => <Heading as="h3" size="lg" mt={4} mb={2}>{children}</Heading>,
                        h4: ({ children }) => <Heading as="h4" size="md" mt={3} mb={2}>{children}</Heading>,
                        p: ({ children }) => <Text mb={4} lineHeight="1.75">{children}</Text>,
                        ul: ({ children }) => (
                          <List.Root mb={4} pl={4}>
                            {children}
                          </List.Root>
                        ),
                        ol: ({ children }) => (
                          <List.Root as="ol" mb={4} pl={4}>
                            {children}
                          </List.Root>
                        ),
                        li: ({ children }) => <List.Item mb={2}>{children}</List.Item>,
                        code: ({ className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          const codeString = String(children).replace(/\n$/, '');
                          
                          if (isInline) {
                            return (
                              <Code
                                px={1.5}
                                py={0.5}
                                bg="bg.subtle"
                                borderRadius="sm"
                                fontSize="0.9em"
                                {...props}
                              >
                                {children}
                              </Code>
                            );
                          }
                          
                          return (
                            <Box
                              as="pre"
                              mb={4}
                              p={4}
                              bg="gray.900"
                              color="gray.100"
                              borderRadius="md"
                              overflow="auto"
                              fontSize="sm"
                              fontFamily="mono"
                              lineHeight="1.6"
                              {...props}
                            >
                              <Code
                                as="code"
                                display="block"
                                whiteSpace="pre"
                                color="inherit"
                                bg="transparent"
                                p={0}
                              >
                                {codeString}
                              </Code>
                            </Box>
                          );
                        },
                        a: ({ href, children }) => (
                          <Link href={href} color="primary.500" textDecoration="underline" _hover={{ color: 'primary.600' }}>
                            {children}
                          </Link>
                        ),
                        blockquote: ({ children }) => (
                          <Box
                            as="blockquote"
                            borderLeft="4px solid"
                            borderColor="border.emphasized"
                            pl={4}
                            py={2}
                            my={4}
                            bg="bg.subtle"
                            fontStyle="italic"
                          >
                            {children}
                          </Box>
                        ),
                        hr: () => <Separator my={6} />,
                      }}
                    >
                      {contentWithoutFrontMatter}
                    </ReactMarkdown>
                  </Box>
                ) : null}
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="outline" onClick={handleViewInMarkdown}>
                  View in Markdown
                </Button>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Close</Button>
                </Dialog.ActionTrigger>
              </HStack>
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

