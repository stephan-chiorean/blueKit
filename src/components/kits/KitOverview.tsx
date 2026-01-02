import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardBody,
  Text,
  VStack,
  Button,
  Flex,
  Status,
  HStack,
  Icon,
  Textarea,
} from '@chakra-ui/react';
import { LuArrowLeft, LuCopy, LuCheck } from 'react-icons/lu';
import { ArtifactFile, invokeGetProjectRegistry } from '../../ipc';

interface KitOverviewProps {
  kit: ArtifactFile;
  onBack?: () => void;
}

export default function KitOverview({ kit, onBack }: KitOverviewProps) {
  // Extract project path from kit path
  const projectPath = kit.path.split('/.bluekit/')[0] || kit.path;
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Generate unique key for localStorage based on kit path
  const notesKey = `bluekit-notes-${kit.path}`;

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(notesKey);
    if (savedNotes !== null) {
      setNotes(savedNotes);
    }
  }, [notesKey]);

  // Auto-save current notes to localStorage
  const autoSaveNotes = useCallback(() => {
    try {
      localStorage.setItem(notesKey, notes);
    } catch (error) {
      console.error('Failed to auto-save notes:', error);
    }
  }, [notes, notesKey]);

  // Copy notes to clipboard
  const copyNotes = useCallback(async () => {
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notes);
      setCopiedNoteId('current');
      setTimeout(() => setCopiedNoteId(null), 2000);
    } catch (error) {
      console.error('Failed to copy notes:', error);
    }
  }, [notes]);


  // Auto-save notes to localStorage after user stops typing (debounced)
  // This only saves to localStorage, doesn't add to Previous
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notes !== '') {
        autoSaveNotes();
      }
    }, 1000); // Save 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [notes, autoSaveNotes]);

  useEffect(() => {
    const checkProjectStatus = async () => {
      try {
        const projects = await invokeGetProjectRegistry();
        const isProjectLinked = projects.some(
          (project) => project.path === projectPath
        );
        setIsLinked(isProjectLinked);
      } catch (error) {
        console.error('Failed to check project status:', error);
        setIsLinked(false);
      }
    };

    checkProjectStatus();
  }, [projectPath]);

  return (
    <Box h="100%" overflow="auto" bg="transparent">
      <Card.Root 
        variant="elevated" 
        h="100%" 
        borderRadius={0}
        borderWidth={0}
        bg="transparent"
      >
        <CardBody p={6}>
          <VStack align="stretch" gap={6} h="100%">
            {/* Back Button */}
            {onBack && (
              <Flex>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuArrowLeft />
                    </Icon>
                    <Text>Back</Text>
                  </HStack>
                </Button>
              </Flex>
            )}
            
            {/* Project Status - Glass Bubble */}
            <Box
              p={4}
              borderRadius="16px"
              borderWidth="1px"
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                _dark: {
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                },
              }}
            >
              <Text 
                fontSize="sm" 
                fontWeight="semibold" 
                mb={3} 
                color="text.secondary"
                css={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                  _dark: {
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                  },
                }}
              >
                Project Status
              </Text>
              <Status.Root
                colorPalette={isLinked === true ? 'green' : isLinked === false ? 'red' : 'gray'}
              >
                <Status.Indicator />
                {isLinked === true ? 'Linked' : isLinked === false ? 'Disconnected' : 'Checking...'}
              </Status.Root>
            </Box>
            
            {/* File Information - Glass Bubble */}
            <Box
              p={4}
              borderRadius="16px"
              borderWidth="1px"
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                _dark: {
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                },
              }}
            >
              <Text 
                fontSize="sm" 
                fontWeight="semibold" 
                mb={3} 
                color="text.secondary"
                css={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                  _dark: {
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                  },
                }}
              >
                File Information
              </Text>
              <VStack align="stretch" gap={2}>
                <Box>
                  <Text 
                    fontSize="xs" 
                    color="text.tertiary" 
                    mb={1}
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    Name
                  </Text>
                  <Text 
                    fontSize="sm" 
                    fontFamily="mono" 
                    color="text.primary"
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    {kit.name}
                  </Text>
                </Box>
                <Box>
                  <Text 
                    fontSize="xs" 
                    color="text.tertiary" 
                    mb={1}
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    Path
                  </Text>
                  <Text 
                    fontSize="sm" 
                    fontFamily="mono" 
                    color="text.primary" 
                    wordBreak="break-all"
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    {kit.path}
                  </Text>
                </Box>
                <Box>
                  <Text 
                    fontSize="xs" 
                    color="text.tertiary" 
                    mb={1}
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    Project
                  </Text>
                  <Text 
                    fontSize="sm" 
                    fontFamily="mono" 
                    color="text.primary" 
                    wordBreak="break-all"
                    css={{
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                      _dark: {
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    {projectPath}
                  </Text>
                </Box>
              </VStack>
            </Box>

            {/* Notepad - Glass Bubble */}
            <Box
              p={4}
              borderRadius="16px"
              borderWidth="1px"
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                _dark: {
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                },
              }}
            >
              <Flex justify="space-between" align="center" mb={3}>
                <Text 
                  fontSize="sm" 
                  fontWeight="semibold" 
                  color="text.secondary"
                  css={{
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                    _dark: {
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                    },
                  }}
                >
                  Notes
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={copyNotes}
                  disabled={!notes}
                >
                  <HStack gap={2}>
                    <Icon>
                      {copiedNoteId === 'current' ? <LuCheck /> : <LuCopy />}
                    </Icon>
                    <Text>{copiedNoteId === 'current' ? 'Copied!' : 'Copy'}</Text>
                  </HStack>
                </Button>
              </Flex>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down your notes here..."
                minH="200px"
                resize="vertical"
                fontSize="sm"
                borderWidth={0}
                borderColor="transparent"
                outline="none"
                _focus={{
                  boxShadow: 'none',
                  borderWidth: 0,
                  borderColor: 'transparent',
                  outline: 'none',
                }}
                _focusVisible={{
                  boxShadow: 'none',
                  borderWidth: 0,
                  borderColor: 'transparent',
                  outline: 'none',
                }}
                _hover={{
                  borderWidth: 0,
                  borderColor: 'transparent',
                }}
              />
            </Box>
          </VStack>
        </CardBody>
      </Card.Root>
    </Box>
  );
}

