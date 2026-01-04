import {
    HStack,
    Icon,
    Text,
    VStack,
} from '@chakra-ui/react';
import {
    LuDownload,
    LuFolder,
} from 'react-icons/lu';
import { Project } from '../../ipc';
import { SelectorPopover } from './SelectorPopover';

interface PullButtonProps {
    projects: Project[];
    onConfirmPull: (projects: Project[]) => void;
    loading: boolean;
    label?: string; // Default 'Pull'
}

const truncatePath = (path: string, maxLength: number = 35): string => {
    if (path.length <= maxLength) return path;
    return `...${path.slice(-(maxLength - 3))}`;
};

export function PullButton({
    projects,
    onConfirmPull,
    loading,
    label = 'Pull',
}: PullButtonProps) {
    return (
        <SelectorPopover
            items={projects}
            triggerIcon={<LuDownload />}
            triggerLabel={label}
            showArrow={false}
            triggerVariant="solid"
            triggerColorPalette="primary"
            popoverTitle="Pull to Project"
            searchPlaceholder="Search projects..."
            emptyStateMessage="No projects found."
            noResultsMessage="No projects match your search."
            renderItem={(project) => (
                <HStack gap={2} flex="1" minW={0} overflow="hidden">
                    <Icon flexShrink={0}>
                        <LuFolder />
                    </Icon>
                    <VStack align="start" gap={0} flex="1" minW={0} overflow="hidden">
                        <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                            {project.name}
                        </Text>
                        <Text fontSize="xs" color="text.secondary" title={project.path}>
                            {truncatePath(project.path)}
                        </Text>
                    </VStack>
                </HStack>
            )}
            filterItem={(project, query) =>
                project.name.toLowerCase().includes(query.toLowerCase()) ||
                project.path.toLowerCase().includes(query.toLowerCase())
            }
            getConfirmLabel={(count) =>
                `Pull to ${count} Project${count !== 1 ? 's' : ''}`
            }
            onConfirm={onConfirmPull}
            loading={loading}
        />
    );
}
