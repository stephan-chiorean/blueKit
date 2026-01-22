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
    Textarea,
    Badge,
    Wrap,
    Button,
} from '@chakra-ui/react';
import { LuPlus, LuX } from 'react-icons/lu';

interface CreateFolderPopoverProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (name: string, description: string, tags: string[]) => Promise<void>;
    trigger: ReactElement;
}

export function CreateFolderPopover({
    isOpen,
    onOpenChange,
    onConfirm,
    trigger,
}: CreateFolderPopoverProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(false);
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // Spotlight logic
    const triggerContainerRef = useRef<HTMLDivElement>(null);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

    // Reset name when opening
    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
            setTags([]);
            setTagInput('');
        }
    }, [isOpen]);

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
        if (!name.trim()) return;
        setLoading(true);
        try {
            await onConfirm(name, description, tags);
            onOpenChange(false);
            setName('');
            setDescription('');
            setTags([]);
            setTagInput('');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
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
                positioning={{ placement: 'bottom-start', gutter: 8 }}
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
                            width="320px"
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
                            <Popover.Body p={4}>
                                <VStack align="stretch" gap={3}>
                                    <Text fontSize="sm" fontWeight="semibold">New Group</Text>

                                    <VStack align="stretch" gap={2}>
                                        <Input
                                            ref={initialFocusRef}
                                            placeholder="Group Name"
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

                                        <Textarea
                                            placeholder="Description (optional)"
                                            size="sm"
                                            variant="subtle"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            disabled={loading}
                                            borderRadius="md"
                                            rows={2}
                                            resize="none"
                                        />

                                        <VStack align="stretch" gap={2}>
                                            <Input
                                                placeholder="Add tags (Enter to add)"
                                                size="sm"
                                                variant="subtle"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={handleTagKeyDown}
                                                disabled={loading}
                                                borderRadius="md"
                                            />
                                            {tags.length > 0 && (
                                                <Wrap gap={1}>
                                                    {tags.map(tag => (
                                                        <Badge
                                                            key={tag}
                                                            size="sm"
                                                            variant="surface"
                                                            colorPalette="blue"
                                                        >
                                                            {tag}
                                                            <Box
                                                                as="span"
                                                                ml={1}
                                                                cursor="pointer"
                                                                onClick={() => handleRemoveTag(tag)}
                                                                _hover={{ opacity: 0.7 }}
                                                            >
                                                                <LuX size={10} />
                                                            </Box>
                                                        </Badge>
                                                    ))}
                                                </Wrap>
                                            )}
                                        </VStack>
                                    </VStack>

                                    <Button
                                        size="sm"
                                        colorPalette="blue"
                                        onClick={handleSubmit}
                                        loading={loading}
                                        disabled={!name.trim()}
                                        width="full"
                                        mt={2}
                                    >
                                        Create Group
                                    </Button>
                                </VStack>
                            </Popover.Body>
                        </Popover.Content>
                    </Popover.Positioner>
                </Portal>
            </Popover.Root>
        </>
    );
}

export default CreateFolderPopover;
