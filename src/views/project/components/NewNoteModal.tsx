import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    Button,
    Input,
    VStack,
    HStack,
    Portal,
    CloseButton,
    Box,
    Text,
    Icon,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuFilePlus, LuFile } from 'react-icons/lu';
import { invokeWriteFile } from '@/ipc/files';
import { toaster } from '@/shared/components/ui/toaster';

const MotionBox = motion.create(Box);
const MotionVStack = motion.create(VStack);

interface NewNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentPath: string; // The folder where the note will be created
    onNoteCreated: (fullPath: string) => void;
}

export default function NewNoteModal({
    isOpen,
    onClose,
    parentPath,
    onNoteCreated,
}: NewNoteModalProps) {
    const [fileName, setFileName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setFileName('');
            setIsSubmitting(false);
            // Focus input after a small delay to allow animation to start
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 50);
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!fileName.trim()) return;

        try {
            setIsSubmitting(true);

            // Sanitize filename
            const sanitizedName = fileName.replace(/[/\\:*?"<>|]/g, '-').trim();
            const finalName = sanitizedName.endsWith('.md') ? sanitizedName : `${sanitizedName}.md`;

            // Construct full path
            const separator = parentPath.includes('\\') ? '\\' : '/';
            const cleanParentPath = parentPath.endsWith(separator) ? parentPath.slice(0, -1) : parentPath;
            const fullPath = `${cleanParentPath}${separator}${finalName}`;

            // Create empty file
            const initialContent = '';
            await invokeWriteFile(fullPath, initialContent);

            toaster.create({
                type: 'success',
                title: 'Note created',
                description: `Created ${finalName}`,
            });

            onNoteCreated(fullPath);
            onClose();
        } catch (error) {
            console.error('Failed to create note:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to create note',
                description: error instanceof Error ? error.message : 'Unknown error',
            });
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
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
                                                        <LuFile />
                                                    </Icon>
                                                </Box>
                                            </MotionBox>
                                            <VStack align="start" gap={0}>
                                                <Dialog.Title fontSize="xl" fontWeight="bold">
                                                    New Note
                                                </Dialog.Title>
                                                <Text fontSize="sm" color="text.secondary">
                                                    Create a new markdown note
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
                                            <MotionBox
                                                variants={{
                                                    hidden: { opacity: 0, y: 10 },
                                                    visible: { opacity: 1, y: 0 },
                                                }}
                                            >
                                                <VStack align="stretch" gap={2}>
                                                    <Text fontSize="sm" fontWeight="medium" color="text.primary">
                                                        Title
                                                    </Text>
                                                    <Input
                                                        ref={inputRef}
                                                        value={fileName}
                                                        onChange={(e) => setFileName(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        placeholder="Untitled"
                                                        size="lg"
                                                        disabled={isSubmitting}
                                                        css={{
                                                            borderRadius: '12px',
                                                            fontSize: '16px',
                                                            fontWeight: '500',
                                                            _focus: {
                                                                borderColor: 'transparent',
                                                                boxShadow: 'none',
                                                            },
                                                        }}
                                                    />
                                                    <Text fontSize="xs" color="text.tertiary">
                                                        Creating in: {parentPath.split(/[/\\]/).pop()}
                                                    </Text>
                                                </VStack>
                                            </MotionBox>
                                        </MotionVStack>
                                    </Dialog.Body>

                                    <Dialog.Footer pt={6}>
                                        <HStack gap={3} justify="flex-end" w="100%">
                                            <Button
                                                variant="ghost"
                                                onClick={handleClose}
                                                disabled={isSubmitting}
                                                size="lg"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                colorPalette="primary"
                                                onClick={handleSubmit}
                                                loading={isSubmitting}
                                                loadingText="Creating..."
                                                disabled={!fileName.trim()}
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
                                                <HStack gap={2}>
                                                    <Icon>
                                                        <LuFilePlus />
                                                    </Icon>
                                                    <Text>Create Note</Text>
                                                </HStack>
                                            </Button>
                                        </HStack>
                                    </Dialog.Footer>
                                </MotionBox>
                            </Dialog.Content>
                        </Dialog.Positioner>
                    </Dialog.Root>
                )}
            </AnimatePresence>
        </Portal>
    );
}
