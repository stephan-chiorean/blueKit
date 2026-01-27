/**
 * WalkthroughNotes component - Notes section in sidebar (like plan notes)
 */
import { useState, useRef, useEffect } from 'react';
import {
    VStack,
    HStack,
    Box,
    Text,
    Icon,
    IconButton,
    Textarea,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuStickyNote, LuPlus, LuTrash2, LuChevronDown } from 'react-icons/lu';
import type { WalkthroughNote } from '@/types/walkthrough';

const MotionBox = motion.create(Box);

interface WalkthroughNotesProps {
    notes: WalkthroughNote[];
    onAdd: (content: string) => void;
    onUpdate: (noteId: string, content: string) => void;
    onDelete: (noteId: string) => void;
}

export default function WalkthroughNotes({
    notes,
    onAdd,
    onUpdate,
    onDelete,
}: WalkthroughNotesProps) {
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleAddNote = () => {
        if (!newNoteContent.trim()) return;
        onAdd(newNoteContent.trim());
        setNewNoteContent('');
    };

    const handleStartEdit = (note: WalkthroughNote) => {
        setEditingNoteId(note.id);
        setEditContent(note.content);
    };

    const handleSaveEdit = () => {
        if (editingNoteId && editContent.trim()) {
            onUpdate(editingNoteId, editContent.trim());
        }
        setEditingNoteId(null);
        setEditContent('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (editingNoteId) {
                handleSaveEdit();
            } else {
                handleAddNote();
            }
        }
        if (e.key === 'Escape' && editingNoteId) {
            setEditingNoteId(null);
            setEditContent('');
        }
    };

    // Format date for display
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    return (
        <VStack align="stretch" gap={4}>
            <Box
                borderRadius="16px"
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
                overflow="hidden"
            >
                <HStack
                    justify="space-between"
                    p={4}
                    cursor="pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                    _hover={{ bg: 'bg.muted' }}
                    transition="background 0.2s ease"
                >
                    <HStack gap={3}>
                        <Box
                            p={2}
                            borderRadius="10px"
                            bg="blue.100"
                            _dark={{ bg: 'blue.900/30' }}
                        >
                            <Icon boxSize={4} color="blue.500">
                                <LuStickyNote />
                            </Icon>
                        </Box>
                        <VStack align="start" gap={0}>
                            <Text fontSize="sm" fontWeight="semibold">
                                Notes
                            </Text>
                            <Text fontSize="xs" color="text.tertiary">
                                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                            </Text>
                        </VStack>
                    </HStack>
                    <Icon
                        transform={isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}
                        transition="transform 0.2s ease"
                        color="text.tertiary"
                    >
                        <LuChevronDown />
                    </Icon>
                </HStack>

                <AnimatePresence>
                    {isExpanded && (
                        <MotionBox
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            overflow="hidden"
                        >
                            <VStack align="stretch" gap={3} px={4} pb={4}>
                                {/* Add Note Input */}
                                <VStack align="stretch" gap={2}>
                                    <Textarea
                                        ref={inputRef}
                                        value={newNoteContent}
                                        onChange={(e) => setNewNoteContent(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Add a note... (⌘+Enter to save)"
                                        size="sm"
                                        rows={2}
                                        css={{
                                            borderRadius: '10px',
                                            resize: 'none',
                                            _focus: {
                                                borderColor: 'blue.400',
                                            },
                                        }}
                                    />
                                    {newNoteContent.trim() && (
                                        <HStack justify="flex-end">
                                            <IconButton
                                                aria-label="Add note"
                                                onClick={handleAddNote}
                                                colorPalette="blue"
                                                variant="solid"
                                                size="sm"
                                                css={{ borderRadius: '8px' }}
                                            >
                                                <Icon>
                                                    <LuPlus />
                                                </Icon>
                                            </IconButton>
                                        </HStack>
                                    )}
                                </VStack>

                                {/* Notes List */}
                                <VStack align="stretch" gap={2}>
                                    <AnimatePresence>
                                        {notes.map((note) => (
                                            <MotionBox
                                                key={note.id}
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.2 }}
                                                role="group"
                                            >
                                                <Box
                                                    p={3}
                                                    borderRadius="10px"
                                                    bg="bg.muted"
                                                    borderWidth="1px"
                                                    borderColor="border.subtle"
                                                    _hover={{ borderColor: 'blue.200', _dark: { borderColor: 'blue.700/50' } }}
                                                    transition="all 0.2s ease"
                                                >
                                                    {editingNoteId === note.id ? (
                                                        <Textarea
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            onBlur={handleSaveEdit}
                                                            autoFocus
                                                            size="sm"
                                                            rows={3}
                                                            css={{ resize: 'none', borderRadius: '8px' }}
                                                        />
                                                    ) : (
                                                        <>
                                                            <Text
                                                                fontSize="sm"
                                                                whiteSpace="pre-wrap"
                                                                cursor="pointer"
                                                                onClick={() => handleStartEdit(note)}
                                                            >
                                                                {note.content}
                                                            </Text>
                                                            <HStack justify="space-between" mt={2}>
                                                                <Text fontSize="xs" color="text.tertiary">
                                                                    {formatDate(note.createdAt)}
                                                                </Text>
                                                                <IconButton
                                                                    aria-label="Delete note"
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    colorPalette="red"
                                                                    onClick={() => onDelete(note.id)}
                                                                    css={{
                                                                        opacity: 0,
                                                                        transition: 'opacity 0.15s ease',
                                                                        '[role="group"]:hover &': {
                                                                            opacity: 1,
                                                                        },
                                                                    }}
                                                                >
                                                                    <Icon>
                                                                        <LuTrash2 />
                                                                    </Icon>
                                                                </IconButton>
                                                            </HStack>
                                                        </>
                                                    )}
                                                </Box>
                                            </MotionBox>
                                        ))}
                                    </AnimatePresence>
                                </VStack>

                                {notes.length === 0 && (
                                    <Box
                                        p={4}
                                        textAlign="center"
                                        borderRadius="10px"
                                        borderWidth="1px"
                                        borderStyle="dashed"
                                        borderColor="border.subtle"
                                    >
                                        <Text fontSize="xs" color="text.tertiary">
                                            No notes yet. Add thoughts and observations here.
                                        </Text>
                                    </Box>
                                )}
                            </VStack>
                        </MotionBox>
                    )}
                </AnimatePresence>
            </Box>
        </VStack>
    );
}
