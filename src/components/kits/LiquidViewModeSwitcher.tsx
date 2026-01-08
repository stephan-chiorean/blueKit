import { HStack, Box, Icon, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);


export interface ViewModeConfig {
    id: string;
    label: string;
    icon: React.ElementType;
}

export interface LiquidViewModeSwitcherProps {
    value: string;
    onChange: (mode: string) => void;
    modes: ViewModeConfig[];
}

export function LiquidViewModeSwitcher({
    value,
    onChange,
    modes,
}: LiquidViewModeSwitcherProps) {
    return (
        <HStack
            gap={0}
            p={1}
            borderRadius="full"
            css={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px) saturate(180%)',
                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                _dark: {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                },
            }}
        >
            {modes.map((mode) => {
                const isActive = value === mode.id;

                return (
                    <Box
                        key={mode.id}
                        as="button"
                        onClick={() => onChange(mode.id)}
                        position="relative"
                        px={4}
                        py={1.5}
                        borderRadius="full"
                        cursor="pointer"
                        outline="none"
                        color={isActive ? 'text.success' : 'text.muted'}
                        _hover={{
                            color: isActive ? 'text.success' : 'text.primary',
                        }}
                        transition="color 0.2s"
                    >
                        {isActive && (
                            <MotionBox
                                layoutId="liquid-switcher-active"
                                position="absolute"
                                inset={0}
                                bg="bg.surface"
                                borderRadius="full"
                                boxShadow="sm"
                                initial={false}
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 30,
                                } as any}
                                css={{
                                    background: 'rgba(255, 255, 255, 0.85)',
                                    backdropFilter: 'blur(8px)',
                                    _dark: {
                                        background: 'rgba(255, 255, 255, 0.15)',
                                    }
                                }}
                            />
                        )}
                        <HStack gap={2} position="relative" zIndex={1}>
                            <Icon boxSize={4}>
                                <mode.icon />
                            </Icon>
                            <Text fontSize="sm" fontWeight="medium">
                                {mode.label}
                            </Text>
                        </HStack>
                    </Box>
                );
            })}
        </HStack>
    );
}
