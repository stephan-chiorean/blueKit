import {
    HStack,
    Icon,
    Text,
} from '@chakra-ui/react';
import {
    LuDownload,
    LuFolder,
} from 'react-icons/lu';
import { Project } from '@/ipc';
import { SelectorPopover } from './SelectorPopover';

interface PullButtonProps {
    projects: Project[];
    onConfirmPull: (projects: Project[]) => void;
    loading: boolean;
    label?: string; // Default 'Pull'
    onOpenChange?: (isOpen: boolean) => void;
}

export function PullButton({
    projects,
    onConfirmPull,
    loading,
    label = 'Pull',
    onOpenChange,
}: PullButtonProps) {
    return (
        <SelectorPopover
            items={projects}
            triggerIcon={<LuDownload />}
            triggerLabel={label}
            showArrow={false}
            triggerVariant="subtle"
            triggerColorPalette="green"
            popoverTitle="Pull to Project"
            emptyStateMessage="No Projects Found"
            emptyStateIcon={
                <Icon fontSize="2xl" color="blue.500">
                    <LuFolder />
                </Icon>
            }
            renderItem={(project) => (
                <HStack gap={2} flex="1" minW={0} overflow="hidden">
                    <Icon flexShrink={0} color="blue.500">
                        <LuFolder />
                    </Icon>
                    <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                        {project.name}
                    </Text>
                </HStack>
            )}
            getConfirmLabel={(count) =>
                `Pull to ${count} Project${count !== 1 ? 's' : ''}`
            }
            confirmButtonLabel="Pull"
            confirmButtonColorPalette="green"
            onConfirm={onConfirmPull}
            onOpenChange={onOpenChange}
            loading={loading}
        />
    );
}
