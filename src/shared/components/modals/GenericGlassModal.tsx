import {
    Dialog,
    Portal,
    CloseButton,
    Box,
    VStack,
    HStack,
    Text,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionBox = motion.create(Box);

export interface GenericGlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    accentColor?: string; // e.g., "primary", "blue", "orange"
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    isBusy?: boolean;
    bodyPadding?: number | string;
}

export default function GenericGlassModal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    accentColor = 'primary',
    children,
    footer,
    size = 'lg',
    isBusy = false,
    bodyPadding = 4,
}: GenericGlassModalProps) {

    const handleClose = () => {
        if (!isBusy) {
            onClose();
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size={size}>
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
                                    {icon && (
                                        <MotionBox
                                            initial={{ rotate: -15, scale: 0.8 }}
                                            animate={{ rotate: 0, scale: 1 }}
                                            transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
                                        >
                                            <Box
                                                p={3}
                                                borderRadius="16px"
                                                bg={`${accentColor}.100`}
                                                _dark={{ bg: `${accentColor}.900/30` }}
                                            >
                                                <Box color={`${accentColor}.500`} css={{ '& > svg': { width: '24px', height: '24px' } }}>
                                                    {icon}
                                                </Box>
                                            </Box>
                                        </MotionBox>
                                    )}
                                    <VStack align="start" gap={0}>
                                        <Dialog.Title fontSize="xl" fontWeight="bold">
                                            {title}
                                        </Dialog.Title>
                                        {subtitle && (
                                            <Text fontSize="sm" color="text.secondary">
                                                {subtitle}
                                            </Text>
                                        )}
                                    </VStack>
                                    <Dialog.CloseTrigger asChild>
                                        <CloseButton aria-label="Close" size="sm" disabled={isBusy} />
                                    </Dialog.CloseTrigger>
                                </HStack>
                            </Dialog.Header>

                            <Dialog.Body pt={bodyPadding} px={bodyPadding}>
                                {children}
                            </Dialog.Body>

                            {footer && (
                                <Dialog.Footer pt={6}>
                                    {footer}
                                </Dialog.Footer>
                            )}
                        </MotionBox>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
