import { useState } from 'react';
import {
    Dialog,
    Button,
    VStack,
    HStack,
    Portal,
    CloseButton,
    Box,
    Text,
    Icon,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuTriangleAlert, LuTrash2, LuFolder } from 'react-icons/lu';
import { invokeDeletePlan } from '../../ipc';
import { toaster } from '../ui/toaster';

const MotionBox = motion.create(Box);

interface DeletePlanDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onDeleted?: () => void | Promise<void>;
    planId: string;
    planName: string;
    folderPath: string;
}

export default function DeletePlanDialog({
    isOpen,
    onClose,
    onDeleted,
    planId,
    planName,
    folderPath,
}: DeletePlanDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            await invokeDeletePlan(planId);
            toaster.create({
                type: 'success',
                title: 'Plan deleted',
                description: `"${planName}" and its folder have been removed`,
            });
            if (onDeleted) {
                await onDeleted();
            }
            onClose();
        } catch (error) {
            console.error('Failed to delete plan:', error);
            toaster.create({
                type: 'error',
                title: 'Failed to delete plan',
                description: String(error),
                closable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
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
                                background: 'rgba(0, 0, 0, 0.5)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            <MotionBox
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </Dialog.Backdrop>
                        <Dialog.Positioner>
                            <Dialog.Content
                                asChild
                                maxW="md"
                                css={{
                                    background: 'rgba(255, 240, 240, 0.85)',
                                    backdropFilter: 'blur(40px) saturate(200%)',
                                    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                                    borderWidth: '1px',
                                    borderColor: 'rgba(220, 38, 38, 0.2)',
                                    borderRadius: '20px',
                                    boxShadow: '0 24px 80px -12px rgba(220, 38, 38, 0.25), 0 0 0 1px rgba(220, 38, 38, 0.1)',
                                    _dark: {
                                        background: 'rgba(30, 20, 20, 0.9)',
                                        borderColor: 'rgba(248, 113, 113, 0.25)',
                                        boxShadow: '0 24px 80px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(248, 113, 113, 0.15)',
                                    },
                                }}
                            >
                                <MotionBox
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                >
                                    <Dialog.Header pb={0}>
                                        <HStack gap={3} align="center">
                                            <MotionBox
                                                initial={{ rotate: -10, scale: 0.8 }}
                                                animate={{ rotate: 0, scale: 1 }}
                                                transition={{ delay: 0.1, duration: 0.3, type: 'spring', stiffness: 200 }}
                                            >
                                                <Box
                                                    p={3}
                                                    borderRadius="full"
                                                    bg="red.100"
                                                    _dark={{ bg: 'red.900/30' }}
                                                >
                                                    <Icon boxSize={6} color="red.500">
                                                        <LuTriangleAlert />
                                                    </Icon>
                                                </Box>
                                            </MotionBox>
                                            <VStack align="start" gap={0}>
                                                <Dialog.Title fontSize="lg" fontWeight="semibold">
                                                    Delete Plan
                                                </Dialog.Title>
                                                <Text fontSize="sm" color="text.secondary">
                                                    This action cannot be undone
                                                </Text>
                                            </VStack>
                                        </HStack>
                                        <Dialog.CloseTrigger asChild>
                                            <CloseButton aria-label="Close" size="sm" />
                                        </Dialog.CloseTrigger>
                                    </Dialog.Header>

                                    <Dialog.Body pt={6}>
                                        <VStack align="stretch" gap={4}>
                                            <Text fontSize="md">
                                                Are you sure you want to delete <strong>"{planName}"</strong>?
                                            </Text>

                                            <Box
                                                p={4}
                                                borderRadius="lg"
                                                bg="red.50"
                                                borderWidth="1px"
                                                borderColor="red.100"
                                                _dark={{
                                                    bg: 'red.950/30',
                                                    borderColor: 'red.900/50',
                                                }}
                                            >
                                                <VStack align="stretch" gap={2}>
                                                    <HStack gap={2}>
                                                        <Icon color="red.500" boxSize={4}>
                                                            <LuTrash2 />
                                                        </Icon>
                                                        <Text fontSize="sm" fontWeight="medium" color="red.700" _dark={{ color: 'red.300' }}>
                                                            This will permanently delete:
                                                        </Text>
                                                    </HStack>
                                                    <VStack align="stretch" gap={1} pl={6}>
                                                        <Text fontSize="sm" color="red.600" _dark={{ color: 'red.400' }}>
                                                            • The plan and all milestones
                                                        </Text>
                                                        <Text fontSize="sm" color="red.600" _dark={{ color: 'red.400' }}>
                                                            • All documents in the plan folder
                                                        </Text>
                                                    </VStack>
                                                </VStack>
                                            </Box>

                                            <Box
                                                p={3}
                                                borderRadius="md"
                                                bg="bg.subtle"
                                                borderWidth="1px"
                                                borderColor="border.subtle"
                                            >
                                                <HStack gap={2}>
                                                    <Icon color="text.tertiary" boxSize={4}>
                                                        <LuFolder />
                                                    </Icon>
                                                    <Text fontSize="xs" color="text.secondary" fontFamily="mono" wordBreak="break-all">
                                                        {folderPath}
                                                    </Text>
                                                </HStack>
                                            </Box>
                                        </VStack>
                                    </Dialog.Body>

                                    <Dialog.Footer pt={6}>
                                        <HStack gap={3} justify="flex-end" w="100%">
                                            <Button
                                                variant="ghost"
                                                onClick={handleClose}
                                                disabled={loading}
                                                size="md"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                colorPalette="red"
                                                onClick={handleDelete}
                                                loading={loading}
                                                loadingText="Deleting..."
                                                size="md"
                                                css={{
                                                    transition: 'all 0.2s ease',
                                                    _hover: {
                                                        transform: 'scale(1.02)',
                                                    },
                                                }}
                                            >
                                                <HStack gap={2}>
                                                    <Icon>
                                                        <LuTrash2 />
                                                    </Icon>
                                                    <Text>Delete Plan</Text>
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
