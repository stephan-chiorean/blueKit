import { useState, useRef, useEffect, ReactElement, cloneElement } from 'react';
import {
    Box,
    HStack,
    Icon,
    IconButton,
    Input,
    Popover,
    Portal,
    Text,
    VStack,
} from '@chakra-ui/react';
import { LuCheck } from 'react-icons/lu';

interface RenameFolderPopoverProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentName: string;
    onConfirm: (newName: string) => Promise<void>;
    trigger: ReactElement;
}

export function RenameFolderPopover({
    isOpen,
    onOpenChange,
    currentName,
    onConfirm,
    trigger,
}: RenameFolderPopoverProps) {
    const [name, setName] = useState(currentName);
    const [loading, setLoading] = useState(false);
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // Spotlight logic
    const triggerContainerRef = useRef<HTMLDivElement>(null);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

    // Reset name when opening
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
        }
    }, [isOpen, currentName]);

    // Measure trigger when opening
    useEffect(() => {
        if (isOpen && triggerContainerRef.current) {
            const rect = triggerContainerRef.current.getBoundingClientRect();
            setTriggerRect(rect);
        }
    }, [isOpen]);

    // Handle window resize updating the spotlight position
    useEffect(() => {
        if (!isOpen) return;

        const updateRect = () => {
            if (triggerContainerRef.current) {
                setTriggerRect(triggerContainerRef.current.getBoundingClientRect());
            }
        };

        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!name.trim() || name === currentName) return;
        setLoading(true);
        try {
            await onConfirm(name);
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Blur Backdrop */}
            {isOpen && (
                <Portal>
                    <Box
                        position="fixed"
                        inset={0}
                        zIndex={1300}
                        onClick={() => onOpenChange(false)}
                        bg="blackAlpha.400"
                        css={{
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                        }}
                    />
                </Portal>
            )}

            {/* Visual Clone of Trigger (Spotlight) */}
            {isOpen && triggerRect && (
                <Portal>
                    <Box
                        position="fixed"
                        top={`${triggerRect.top}px`}
                        left={`${triggerRect.left}px`}
                        width={`${triggerRect.width}px`}
                        height={`${triggerRect.height}px`}
                        zIndex={1401}
                        pointerEvents="none"
                    >
                        {cloneElement(trigger, {
                            'data-state': 'open',
                            'aria-expanded': true,
                        } as any)}
                    </Box>
                </Portal>
            )}

            <Popover.Root
                open={isOpen}
                onOpenChange={(e) => onOpenChange(e.open)}
                initialFocusEl={() => initialFocusRef.current}
                positioning={{ placement: 'bottom', gutter: 8 }}
            >
                <Popover.Trigger asChild>
                    {cloneElement(trigger, {
                        ref: (node: HTMLElement) => {
                            (triggerContainerRef as any).current = node;
                            const existingRef = (trigger as any).ref;
                            if (typeof existingRef === 'function') {
                                existingRef(node);
                            } else if (existingRef) {
                                existingRef.current = node;
                            }
                        }
                    } as any)}
                </Popover.Trigger>

                <Portal>
                    <Popover.Positioner zIndex={1400}>
                        <Popover.Content
                            width="280px"
                            borderRadius="xl"
                            css={{
                                background: 'rgba(255, 255, 255, 0.85)',
                                backdropFilter: 'blur(20px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                borderWidth: '1px',
                                borderColor: 'rgba(0, 0, 0, 0.08)',
                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                                _dark: {
                                    background: 'rgba(30, 30, 30, 0.85)',
                                    borderColor: 'rgba(255, 255, 255, 0.15)',
                                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
                                },
                            }}
                        >
                            <Popover.Body p={3}>
                                <VStack align="stretch" gap={3}>
                                    <Text fontSize="sm" fontWeight="semibold">Rename Folder</Text>
                                    <HStack gap={2}>
                                        <Input
                                            ref={initialFocusRef}
                                            placeholder="Folder Name"
                                            size="sm"
                                            variant="subtle"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSubmit();
                                                if (e.key === 'Escape') onOpenChange(false);
                                            }}
                                            disabled={loading}
                                            borderRadius="md"
                                        />
                                        <IconButton
                                            aria-label="Confirm rename"
                                            size="sm"
                                            colorPalette="blue"
                                            onClick={handleSubmit}
                                            loading={loading}
                                            disabled={!name.trim() || name === currentName}
                                            rounded="md"
                                        >
                                            <Icon><LuCheck /></Icon>
                                        </IconButton>
                                    </HStack>
                                </VStack>
                            </Popover.Body>
                        </Popover.Content>
                    </Popover.Positioner>
                </Portal>
            </Popover.Root>
        </>
    );
}

export default RenameFolderPopover;
