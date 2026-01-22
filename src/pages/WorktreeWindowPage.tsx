import { useState, useEffect } from 'react';
import { VStack, Spinner, Text } from '@chakra-ui/react';
import ProjectDetailPage from './ProjectDetailPage';
import { ProjectEntry } from '../ipc';
import { useColorMode } from '../contexts/ColorModeContext';

/**
 * Worktree window page - displays worktree info in a standalone window.
 * 
 * Reuses ProjectDetailPage but disables navigation features.
 *
 * URL format: /worktree?path=<path>&branch=<branch>&projectId=<projectId>
 */
export default function WorktreeWindowPage() {
    const { colorMode } = useColorMode();
    const [project, setProject] = useState<ProjectEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Parse URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const path = params.get('path');
        const branch = params.get('branch');
        const projectId = params.get('projectId');

        if (!path || !branch || !projectId) {
            setError('Missing worktree path, branch, or project ID');
            setLoading(false);
            return;
        }

        // Construct a project entry for the worktree
        // We use the original project ID but the worktree path
        // This allows loading plans/tasks for the project while filesystem operations use the worktree
        const worktreeProject: ProjectEntry = {
            id: projectId,
            title: branch,
            description: `Worktree for ${branch}`,
            path: path
        };

        setProject(worktreeProject);
        setLoading(false);
    }, []);

    if (loading) {
        return (
            <VStack align="center" justify="center" h="100vh" bg={colorMode === 'light' ? 'gray.50' : 'gray.900'}>
                <Spinner size="xl" />
                <Text mt={4} color="gray.500">
                    Loading worktree...
                </Text>
            </VStack>
        );
    }

    if (error || !project) {
        return (
            <VStack align="center" justify="center" h="100vh" bg={colorMode === 'light' ? 'gray.50' : 'gray.900'}>
                <Text color="red.500" fontSize="lg">
                    {error || 'Failed to load worktree'}
                </Text>
            </VStack>
        );
    }

    return (
        <ProjectDetailPage
            project={project}
            onBack={() => { }} // No-op for back button (it's hidden anyway)
            isWorktreeView={true}
        />
    );
}
