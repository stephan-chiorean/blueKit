import { useState, useRef } from 'react';
import {
    Dialog,
    Button,
    Input,
    Textarea,
    VStack,
    HStack,
    Portal,
    CloseButton,
    Box,
    Text,
    Icon,
    IconButton,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuPlus, LuX, LuBookOpen, LuLightbulb, LuSparkles } from 'react-icons/lu';
import { invokeCreateWalkthrough } from '@/ipc/walkthroughs';
import { toaster } from '@/shared/components/ui/toaster';

const MotionBox = motion.create(Box);
const MotionVStack = motion.create(VStack);
const MotionHStack = motion.create(HStack);

interface Takeaway {
    id: string;
    title: string;
}

interface CreateWalkthroughDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onWalkthroughCreated: () => void;
    projectId: string;
    projectPath: string;
}

export default function CreateWalkthroughDialog({
    isOpen,
    onClose,
    onWalkthroughCreated,
    projectId,
    projectPath,
}: CreateWalkthroughDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [takeaways, setTakeaways] = useState<Takeaway[]>([]);
    const [newTakeawayTitle, setNewTakeawayTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const takeawayInputRef = useRef<HTMLInputElement>(null);

    const handleAddTakeaway = () => {
        if (!newTakeawayTitle.trim()) return;

        const newTakeaway: Takeaway = {
            id: `takeaway-${Date.now()}`,
            title: newTakeawayTitle.trim(),
        };

        setTakeaways([...takeaways, newTakeaway]);
        setNewTakeawayTitle('');

        // Focus input for quick entry
        setTimeout(() => takeawayInputRef.current?.focus(), 50);
    };

    const handleDeleteTakeaway = (takeawayId: string) => {
        setTakeaways(takeaways.filter((t) => t.id !== takeawayId));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddTakeaway();
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            toaster.create({
                type: 'error',
                title: 'Name required',
                description: 'Please enter a walkthrough name',
                closable: true,
            });
            return;
        }

        if (!projectPath) {
            toaster.create({
                type: 'error',
                title: 'Project not found',
                description: 'Could not determine project path',
                closable: true,
            });
            return;
        }

        setLoading(true);
        try {
            // Convert takeaways to the format expected by the backend: [title, description]
            const initialTakeaways: [string, string | null][] = takeaways.map((t) => [t.title, null]);

            await invokeCreateWalkthrough(
                projectId,
                projectPath,
                name.trim(),
                description.trim() || undefined,
                initialTakeaways
            );

            toaster.create({
                type: 'success',
                title: 'Walkthrough created',
                description: `Created walkthrough: ${name.trim()}`,
            });

            onWalkthroughCreated();
            handleClose();
        } catch (error) {
            console.error('Failed to create walkthrough:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to create walkthrough',
                description: String(error),
                closable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setName('');
            setDescription('');
            setTakeaways([]);
            setNewTakeawayTitle('');
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
                                                    bg="orange.100"
                                                    _dark={{ bg: 'orange.900/30' }}
                                                >
                                                    <Icon boxSize={6} color="orange.500">
                                                        <LuBookOpen />
                                                    </Icon>
                                                </Box>
                                            </MotionBox>
                                            <VStack align="start" gap={0}>
                                                <Dialog.Title fontSize="xl" fontWeight="bold">
                                                    Create Walkthrough
                                                </Dialog.Title>
                                                <Text fontSize="sm" color="text.secondary">
                                                    Track understanding with takeaways
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
                                            {/* Walkthrough Name */}
                                            <MotionBox
                                                variants={{
                                                    hidden: { opacity: 0, y: 10 },
                                                    visible: { opacity: 1, y: 0 },
                                                }}
                                            >
                                                <VStack align="stretch" gap={2}>
                                                    <Text fontSize="sm" fontWeight="medium" color="text.primary">
                                                        Walkthrough Name
                                                    </Text>
                                                    <Input
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        placeholder="e.g., GitHub Authentication Guide"
                                                        size="lg"
                                                        disabled={loading}
                                                        css={{
                                                            borderRadius: '12px',
                                                            fontSize: '16px',
                                                            fontWeight: '500',
                                                            _focus: {
                                                                borderColor: 'orange.400',
                                                                boxShadow: '0 0 0 3px rgba(var(--chakra-colors-orange-400-rgb), 0.2)',
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
                                                        placeholder="What will you learn from this walkthrough?"
                                                        disabled={loading}
                                                        rows={2}
                                                        css={{
                                                            borderRadius: '12px',
                                                            resize: 'none',
                                                        }}
                                                    />
                                                </VStack>
                                            </MotionBox>

                                            {/* Takeaways Section */}
                                            <MotionBox
                                                variants={{
                                                    hidden: { opacity: 0, y: 10 },
                                                    visible: { opacity: 1, y: 0 },
                                                }}
                                            >
                                                <VStack align="stretch" gap={3}>
                                                    <HStack justify="space-between" align="center">
                                                        <HStack gap={2}>
                                                            <Icon color="orange.500" boxSize={4}>
                                                                <LuLightbulb />
                                                            </Icon>
                                                            <Text fontSize="sm" fontWeight="medium" color="text.primary">
                                                                Takeaways
                                                            </Text>
                                                            {takeaways.length > 0 && (
                                                                <Box
                                                                    px={2}
                                                                    py={0.5}
                                                                    borderRadius="full"
                                                                    bg="orange.100"
                                                                    _dark={{ bg: 'orange.900/40' }}
                                                                >
                                                                    <Text fontSize="xs" fontWeight="semibold" color="orange.600" _dark={{ color: 'orange.300' }}>
                                                                        {takeaways.length}
                                                                    </Text>
                                                                </Box>
                                                            )}
                                                        </HStack>
                                                    </HStack>

                                                    {/* Add Takeaway Input */}
                                                    <HStack gap={2}>
                                                        <Input
                                                            ref={takeawayInputRef}
                                                            value={newTakeawayTitle}
                                                            onChange={(e) => setNewTakeawayTitle(e.target.value)}
                                                            onKeyDown={handleKeyDown}
                                                            placeholder="Add a takeaway..."
                                                            size="md"
                                                            disabled={loading}
                                                            css={{
                                                                borderRadius: '10px',
                                                                _focus: {
                                                                    borderColor: 'orange.400',
                                                                },
                                                            }}
                                                        />
                                                        <IconButton
                                                            aria-label="Add takeaway"
                                                            onClick={handleAddTakeaway}
                                                            disabled={!newTakeawayTitle.trim() || loading}
                                                            colorPalette="orange"
                                                            variant="solid"
                                                            size="md"
                                                            css={{
                                                                borderRadius: '10px',
                                                                transition: 'all 0.2s ease',
                                                                _hover: {
                                                                    transform: 'scale(1.05)',
                                                                },
                                                            }}
                                                        >
                                                            <Icon>
                                                                <LuPlus />
                                                            </Icon>
                                                        </IconButton>
                                                    </HStack>

                                                    {/* Takeaway List */}
                                                    <AnimatePresence mode="popLayout">
                                                        {takeaways.length > 0 && (
                                                            <VStack align="stretch" gap={2}>
                                                                {takeaways.map((takeaway, index) => (
                                                                    <MotionHStack
                                                                        key={takeaway.id}
                                                                        initial={{ opacity: 0, x: -20, height: 0 }}
                                                                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                                                                        exit={{ opacity: 0, x: 20, height: 0 }}
                                                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                                                        gap={3}
                                                                        p={3}
                                                                        borderRadius="12px"
                                                                        bg="bg.subtle"
                                                                        borderWidth="1px"
                                                                        borderColor="border.subtle"
                                                                        role="group"
                                                                        css={{
                                                                            _hover: {
                                                                                borderColor: 'orange.200',
                                                                                _dark: {
                                                                                    borderColor: 'orange.800/50',
                                                                                },
                                                                            },
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            w={6}
                                                                            h={6}
                                                                            borderRadius="full"
                                                                            bg="orange.100"
                                                                            display="flex"
                                                                            alignItems="center"
                                                                            justifyContent="center"
                                                                            flexShrink={0}
                                                                            _dark={{ bg: 'orange.900/40' }}
                                                                        >
                                                                            <Text fontSize="xs" fontWeight="semibold" color="orange.600" _dark={{ color: 'orange.300' }}>
                                                                                {index + 1}
                                                                            </Text>
                                                                        </Box>
                                                                        <Text flex="1" fontSize="sm" fontWeight="medium">
                                                                            {takeaway.title}
                                                                        </Text>
                                                                        <IconButton
                                                                            aria-label="Remove takeaway"
                                                                            variant="ghost"
                                                                            size="xs"
                                                                            colorPalette="red"
                                                                            onClick={() => handleDeleteTakeaway(takeaway.id)}
                                                                            css={{
                                                                                opacity: 0,
                                                                                transition: 'opacity 0.15s ease',
                                                                                '[role="group"]:hover &': {
                                                                                    opacity: 1,
                                                                                },
                                                                            }}
                                                                        >
                                                                            <Icon>
                                                                                <LuX />
                                                                            </Icon>
                                                                        </IconButton>
                                                                    </MotionHStack>
                                                                ))}
                                                            </VStack>
                                                        )}
                                                    </AnimatePresence>

                                                    {takeaways.length === 0 && (
                                                        <Box
                                                            p={4}
                                                            borderRadius="12px"
                                                            borderWidth="1px"
                                                            borderStyle="dashed"
                                                            borderColor="border.subtle"
                                                            textAlign="center"
                                                        >
                                                            <VStack gap={1}>
                                                                <Icon color="text.tertiary" boxSize={5}>
                                                                    <LuSparkles />
                                                                </Icon>
                                                                <Text fontSize="sm" color="text.tertiary">
                                                                    Add takeaways to track what you've learned
                                                                </Text>
                                                            </VStack>
                                                        </Box>
                                                    )}
                                                </VStack>
                                            </MotionBox>
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
                                                colorPalette="orange"
                                                onClick={handleSubmit}
                                                loading={loading}
                                                loadingText="Creating..."
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
                                                        <LuPlus />
                                                    </Icon>
                                                    <Text>Create Walkthrough</Text>
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
