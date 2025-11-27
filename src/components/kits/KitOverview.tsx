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
  IconButton,
} from '@chakra-ui/react';
import { LuArrowLeft, LuSave, LuCopy, LuCheck, LuTrash2 } from 'react-icons/lu';
import { KitFile, invokeGetProjectRegistry } from '../../ipc';

interface KitOverviewProps {
  kit: KitFile;
  onBack?: () => void;
}

interface PreviousNote {
  id: string;
  content: string;
  timestamp: number;
}

export default function KitOverview({ kit, onBack }: KitOverviewProps) {
  // Extract project path from kit path
  const projectPath = kit.path.split('/.bluekit/')[0] || kit.path;
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [previousNotes, setPreviousNotes] = useState<PreviousNote[]>([]);

  // Generate unique keys for localStorage based on kit path
  const notesKey = `bluekit-notes-${kit.path}`;
  const previousNotesKey = `bluekit-previous-notes-${kit.path}`;

  // Load notes and previous notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(notesKey);
    if (savedNotes !== null) {
      setNotes(savedNotes);
    }

    const savedPreviousNotes = localStorage.getItem(previousNotesKey);
    if (savedPreviousNotes !== null) {
      try {
        const parsed = JSON.parse(savedPreviousNotes);
        setPreviousNotes(parsed);
      } catch (error) {
        console.error('Failed to parse previous notes:', error);
        // Generate mock previous notes if none exist
        const mockNotes: PreviousNote[] = [
          {
            id: '1',
            content: 'Remember to check the authentication flow implementation. The token refresh mechanism needs attention.',
            timestamp: Date.now() - 86400000, // 1 day ago
          },
          {
            id: '2',
            content: 'The database schema has been updated. Need to run migrations before deploying.',
            timestamp: Date.now() - 172800000, // 2 days ago
          },
          {
            id: '3',
            content: 'Found a bug in the error handling. The catch block should log the error before rethrowing.',
            timestamp: Date.now() - 259200000, // 3 days ago
          },
        ];
        setPreviousNotes(mockNotes);
        localStorage.setItem(previousNotesKey, JSON.stringify(mockNotes));
      }
    } else {
      // Generate mock previous notes if none exist
      const mockNotes: PreviousNote[] = [
        {
          id: '1',
          content: 'Remember to check the authentication flow implementation. The token refresh mechanism needs attention.',
          timestamp: Date.now() - 86400000, // 1 day ago
        },
        {
          id: '2',
          content: 'The database schema has been updated. Need to run migrations before deploying.',
          timestamp: Date.now() - 172800000, // 2 days ago
        },
        {
          id: '3',
          content: 'Found a bug in the error handling. The catch block should log the error before rethrowing.',
          timestamp: Date.now() - 259200000, // 3 days ago
        },
      ];
      setPreviousNotes(mockNotes);
      localStorage.setItem(previousNotesKey, JSON.stringify(mockNotes));
    }
  }, [notesKey, previousNotesKey]);

  // Auto-save current notes to localStorage (doesn't add to Previous)
  const autoSaveNotes = useCallback(() => {
    try {
      localStorage.setItem(notesKey, notes);
    } catch (error) {
      console.error('Failed to auto-save notes:', error);
    }
  }, [notes, notesKey]);

  // Save notes to Previous section and clear the field (only called on button click)
  const saveNotes = useCallback(async () => {
    if (notes.trim() === '') return;
    
    setIsSaving(true);
    try {
      // Add to previous notes
      const newNote: PreviousNote = {
        id: Date.now().toString(),
        content: notes,
        timestamp: Date.now(),
      };
      const updatedPreviousNotes = [newNote, ...previousNotes].slice(0, 10); // Keep last 10 notes
      setPreviousNotes(updatedPreviousNotes);
      localStorage.setItem(previousNotesKey, JSON.stringify(updatedPreviousNotes));
      
      // Clear the notes field
      setNotes('');
      localStorage.setItem(notesKey, '');
      
      // Small delay to show save feedback
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [notes, notesKey, previousNotes, previousNotesKey]);

  // Copy notes to clipboard
  const copyNotes = useCallback(async (content: string, noteId?: string) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      if (noteId) {
        setCopiedNoteId(noteId);
        setTimeout(() => setCopiedNoteId(null), 2000);
      } else {
        setCopiedNoteId('current');
        setTimeout(() => setCopiedNoteId(null), 2000);
      }
    } catch (error) {
      console.error('Failed to copy notes:', error);
    }
  }, []);

  // Delete a previous note
  const deleteNote = useCallback((noteId: string) => {
    const updatedPreviousNotes = previousNotes.filter((note) => note.id !== noteId);
    setPreviousNotes(updatedPreviousNotes);
    localStorage.setItem(previousNotesKey, JSON.stringify(updatedPreviousNotes));
  }, [previousNotes, previousNotesKey]);


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
    <Box h="100%" overflow="auto" bg="bg.subtle">
      <Card.Root 
        variant="elevated" 
        h="100%" 
        borderRadius={0}
        borderWidth={0}
        bg="bg.subtle"
      >
        <CardBody p={6}>
          <VStack align="stretch" gap={6}>
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
            
            {/* Project Status */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="text.secondary">
                Project Status
              </Text>
              <Status.Root
                colorPalette={isLinked === true ? 'green' : isLinked === false ? 'red' : 'gray'}
              >
                <Status.Indicator />
                {isLinked === true ? 'Linked' : isLinked === false ? 'Disconnected' : 'Checking...'}
              </Status.Root>
            </Box>
            
            {/* File Information */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="text.secondary">
                File Information
              </Text>
              <VStack align="stretch" gap={2}>
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={1}>
                    Name
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="text">
                    {kit.name}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={1}>
                    Path
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="text" wordBreak="break-all">
                    {kit.path}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={1}>
                    Project
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="text" wordBreak="break-all">
                    {projectPath}
                  </Text>
                </Box>
              </VStack>
            </Box>

            {/* Notepad */}
            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontSize="sm" fontWeight="semibold" color="text.secondary">
                  Notes
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={saveNotes}
                  loading={isSaving}
                  loadingText="Saving..."
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuSave />
                    </Icon>
                    <Text>Save</Text>
                  </HStack>
                </Button>
              </Flex>
              <Box position="relative">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Jot down your notes here..."
                  minH="200px"
                  resize="vertical"
                  fontSize="sm"
                />
                <IconButton
                  size="xs"
                  variant="ghost"
                  position="absolute"
                  top={2}
                  right={2}
                  onClick={() => copyNotes(notes)}
                  disabled={!notes}
                  aria-label="Copy notes"
                  colorPalette={copiedNoteId === 'current' ? 'green' : undefined}
                >
                  <Icon>
                    {copiedNoteId === 'current' ? <LuCheck /> : <LuCopy />}
                  </Icon>
                </IconButton>
              </Box>
            </Box>

            {/* Previous Notes */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="text.secondary">
                Previous
              </Text>
              <VStack align="stretch" gap={3}>
                {previousNotes.length === 0 ? (
                  <Text fontSize="xs" color="text.tertiary" fontStyle="italic">
                    No previous notes
                  </Text>
                ) : (
                  previousNotes.map((note) => (
                    <Box
                      key={note.id}
                      position="relative"
                      p={3}
                      bg="bg.subtle"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="border.subtle"
                      transition="transform 0.2s ease-in-out"
                      _hover={{
                        transform: 'scale(1.02)',
                      }}
                      css={{
                        '& .copy-button, & .delete-button': {
                          opacity: 0,
                          transition: 'opacity 0.2s ease-in-out',
                        },
                        '&:hover .copy-button, &:hover .delete-button': {
                          opacity: 1,
                        },
                      }}
                    >
                      <HStack
                        position="absolute"
                        top={2}
                        right={2}
                        gap={1}
                      >
                        <IconButton
                          className="copy-button"
                          size="xs"
                          variant="ghost"
                          onClick={() => copyNotes(note.content, note.id)}
                          aria-label="Copy note"
                          colorPalette={copiedNoteId === note.id ? 'green' : undefined}
                        >
                          <Icon>
                            {copiedNoteId === note.id ? <LuCheck /> : <LuCopy />}
                          </Icon>
                        </IconButton>
                        <IconButton
                          className="delete-button"
                          size="xs"
                          variant="ghost"
                          onClick={() => deleteNote(note.id)}
                          aria-label="Delete note"
                          colorPalette="red"
                        >
                          <Icon>
                            <LuTrash2 />
                          </Icon>
                        </IconButton>
                      </HStack>
                      <Text fontSize="sm" color="text" pr={16}>
                        {note.content}
                      </Text>
                      <Text fontSize="xs" color="text.tertiary" mt={2}>
                        {new Date(note.timestamp).toLocaleDateString()}
                      </Text>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>
          </VStack>
        </CardBody>
      </Card.Root>
    </Box>
  );
}

