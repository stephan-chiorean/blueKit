import { Box, Flex } from '@chakra-ui/react';
import {
    LuListTodo,
    LuMap,
    LuPackage,
    LuNetwork,
    LuGitBranch,
    LuNotebook,
    LuBot,
    LuBookOpen,
    LuExternalLink,
    LuBookmark,
    LuGithub,
    LuPalette,
    LuFolder,
    LuWorkflow
} from 'react-icons/lu';
import { BsStack } from 'react-icons/bs'; // For Blueprints
import { useState, useCallback } from 'react';
import { Menu, Portal, IconButton, HStack, Text, Tooltip } from '@chakra-ui/react';
import { invokeOpenProjectInEditor } from '../../ipc';
import { toaster } from '../ui/toaster';
import SidebarSection from './SidebarSection';
import SidebarMenuItem from './SidebarMenuItem';
import NotebookTree from './NotebookTree';
import NotebookToolbar from './NotebookToolbar';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useColorMode } from '../../contexts/ColorModeContext';
import { FileTreeNode } from '../../ipc/fileTree';

export type ViewType =
    | 'projects' // Library view
    | 'workflows' // Library view
    | 'tasks'
    | 'plans'
    | 'kits'
    | 'walkthroughs'
    | 'diagrams'
    | 'git'
    | 'bookmarks'
    | 'scrapbook'
    | 'blueprints'
    | 'agents'
    | 'file'; // When a file is selected in the tree

interface SidebarContentProps {
    activeView: ViewType;
    onViewChange: (view: ViewType) => void;
    collapsed?: boolean;
    projectPath?: string;
    onFileSelect?: (node: FileTreeNode) => void;
    selectedFileId?: string;
    fileTreeVersion?: number;
    onTreeRefresh?: () => void;
    /** Called when a new file is created (for opening in edit mode) */
    onNewFileCreated?: (node: FileTreeNode) => void;
    /** Path of node in title-edit mode (visual highlight only) */
    titleEditPath?: string | null;
    /** External title to display for titleEditPath node (synced from editor) */
    editingTitle?: string;
    projectName?: string;
    onHandlersReady?: (handlers: { onNewFile: (folderPath: string) => void; onNewFolder: (folderPath: string) => void }) => void;
    isVault?: boolean;
}

export default function SidebarContent({
    activeView,
    onViewChange,
    collapsed = false,
    projectPath,
    onFileSelect,
    selectedFileId,
    fileTreeVersion,
    onTreeRefresh,
    onNewFileCreated,
    titleEditPath,
    editingTitle,
    projectName,
    onHandlersReady,
    isVault = false
}: SidebarContentProps) {
    const { flags } = useFeatureFlags();
    const { colorMode } = useColorMode();
    const [treeHandlers, setTreeHandlers] = useState<{
        onNewFile: (folderPath: string) => void;
        onNewFolder: (folderPath: string) => void;
    } | null>(null);

    // Handle opening project in external editor
    const handleOpenInEditor = async (editor: 'cursor' | 'vscode' | 'antigravity') => {
        if (!projectPath) return; // Should not happen if button is visible
        try {
            await invokeOpenProjectInEditor(projectPath, editor);
            toaster.create({
                title: `Opened in ${editor.charAt(0).toUpperCase() + editor.slice(1)}`,
                description: projectName ? `${projectName} opened successfully` : 'Project opened successfully',
                type: 'success',
                duration: 2000,
            });
        } catch (error) {
            console.error(`Failed to open project in ${editor}:`, error);
            toaster.create({
                title: `Failed to open in ${editor}`,
                description: error instanceof Error ? error.message : 'Unknown error',
                type: 'error',
                duration: 4000,
            });
        }
    };

    return (
        <Flex direction="column" width="100%" h="100%" gap={1} pb={0}>
            <SidebarSection
                title="Toolkit"
                collapsible={true}
                defaultExpanded={true}
                collapsed={collapsed}
                rightElement={
                    !collapsed && (
                        <HStack gap={2}>
                            {/* Palette Customize Icon */}
                            <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                                <Tooltip.Trigger asChild>
                                    <IconButton
                                        variant="ghost"
                                        size="xs"
                                        aria-label="Customize"
                                        color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                                        _hover={{
                                            color: colorMode === 'light' ? 'black' : 'white',
                                            bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50',
                                        }}
                                        minW={5}
                                        h={5}
                                    >
                                        <LuPalette />
                                    </IconButton>
                                </Tooltip.Trigger>
                                <Portal>
                                    <Tooltip.Positioner zIndex={1500}>
                                        <Tooltip.Content
                                            px={3}
                                            py={1.5}
                                            borderRadius="md"
                                            fontSize="xs"
                                            fontWeight="medium"
                                            color={colorMode === 'light' ? 'gray.700' : 'gray.100'}
                                            css={{
                                                background: colorMode === 'light'
                                                    ? 'rgba(255, 255, 255, 0.75)'
                                                    : 'rgba(20, 20, 25, 0.7)',
                                                backdropFilter: 'blur(12px) saturate(180%)',
                                                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                                border: colorMode === 'light'
                                                    ? '1px solid rgba(0, 0, 0, 0.08)'
                                                    : '1px solid rgba(255, 255, 255, 0.15)',
                                                boxShadow: colorMode === 'light'
                                                    ? '0 6px 18px rgba(0, 0, 0, 0.12)'
                                                    : '0 8px 20px rgba(0, 0, 0, 0.4)',
                                            }}
                                        >
                                            Customize
                                        </Tooltip.Content>
                                    </Tooltip.Positioner>
                                </Portal>
                            </Tooltip.Root>

                            {/* GitHub Repository Icon */}
                            <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                                <Tooltip.Trigger asChild>
                                    <IconButton
                                        variant="ghost"
                                        size="xs"
                                        aria-label="Open Repository"
                                        color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                                        _hover={{
                                            color: colorMode === 'light' ? 'black' : 'white',
                                            bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50',
                                        }}
                                        minW={5}
                                        h={5}
                                    >
                                        <LuGithub />
                                    </IconButton>
                                </Tooltip.Trigger>
                                <Portal>
                                    <Tooltip.Positioner zIndex={1500}>
                                        <Tooltip.Content
                                            px={3}
                                            py={1.5}
                                            borderRadius="md"
                                            fontSize="xs"
                                            fontWeight="medium"
                                            color={colorMode === 'light' ? 'gray.700' : 'gray.100'}
                                            css={{
                                                background: colorMode === 'light'
                                                    ? 'rgba(255, 255, 255, 0.75)'
                                                    : 'rgba(20, 20, 25, 0.7)',
                                                backdropFilter: 'blur(12px) saturate(180%)',
                                                WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                                border: colorMode === 'light'
                                                    ? '1px solid rgba(0, 0, 0, 0.08)'
                                                    : '1px solid rgba(255, 255, 255, 0.15)',
                                                boxShadow: colorMode === 'light'
                                                    ? '0 6px 18px rgba(0, 0, 0, 0.12)'
                                                    : '0 8px 20px rgba(0, 0, 0, 0.4)',
                                            }}
                                        >
                                            Open Repository
                                        </Tooltip.Content>
                                    </Tooltip.Positioner>
                                </Portal>
                            </Tooltip.Root>

                            {/* Open Project Menu */}
                            <Menu.Root>
                                <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                                    <Tooltip.Trigger asChild>
                                        <Box display="inline-flex">
                                            <Menu.Trigger asChild>
                                                <IconButton
                                                    variant="ghost"
                                                    size="xs"
                                                    aria-label="Open Project"
                                                    color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                                                    _hover={{
                                                        color: colorMode === 'light' ? 'black' : 'white',
                                                        bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50',
                                                    }}
                                                    minW={5}
                                                    h={5}
                                                >
                                                    <LuExternalLink />
                                                </IconButton>
                                            </Menu.Trigger>
                                        </Box>
                                    </Tooltip.Trigger>
                                    <Portal>
                                        <Tooltip.Positioner zIndex={1500}>
                                            <Tooltip.Content
                                                px={3}
                                                py={1.5}
                                                borderRadius="md"
                                                fontSize="xs"
                                                fontWeight="medium"
                                                color={colorMode === 'light' ? 'gray.700' : 'gray.100'}
                                                css={{
                                                    background: colorMode === 'light'
                                                        ? 'rgba(255, 255, 255, 0.75)'
                                                        : 'rgba(20, 20, 25, 0.7)',
                                                    backdropFilter: 'blur(12px) saturate(180%)',
                                                    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                                    border: colorMode === 'light'
                                                        ? '1px solid rgba(0, 0, 0, 0.08)'
                                                        : '1px solid rgba(255, 255, 255, 0.15)',
                                                    boxShadow: colorMode === 'light'
                                                        ? '0 6px 18px rgba(0, 0, 0, 0.12)'
                                                        : '0 8px 20px rgba(0, 0, 0, 0.4)',
                                                }}
                                            >
                                                Open project
                                            </Tooltip.Content>
                                        </Tooltip.Positioner>
                                    </Portal>
                                </Tooltip.Root>
                                <Portal>
                                    <Menu.Positioner>
                                        <Menu.Content minW="180px" zIndex={1500}>
                                            <Menu.Item
                                                value="cursor"
                                                onSelect={() => handleOpenInEditor('cursor')}
                                            >
                                                <HStack gap={2}>
                                                    <Text>Open in Cursor</Text>
                                                </HStack>
                                            </Menu.Item>
                                            <Menu.Item
                                                value="vscode"
                                                onSelect={() => handleOpenInEditor('vscode')}
                                            >
                                                <HStack gap={2}>
                                                    <Text>Open in VSCode</Text>
                                                </HStack>
                                            </Menu.Item>
                                            <Menu.Item
                                                value="antigravity"
                                                onSelect={() => handleOpenInEditor('antigravity')}
                                            >
                                                <HStack gap={2}>
                                                    <Text>Open in Antigravity</Text>
                                                </HStack>
                                            </Menu.Item>
                                        </Menu.Content>
                                    </Menu.Positioner>
                                </Portal>
                            </Menu.Root>
                        </HStack>
                    )
                }
            >
                {isVault ? (
                    <>
                        <SidebarMenuItem
                            icon={LuFolder}
                            label="Projects"
                            isActive={activeView !== 'file' && activeView === 'projects'}
                            onClick={() => onViewChange('projects')}
                            collapsed={collapsed}
                        />
                        <SidebarMenuItem
                            icon={LuWorkflow}
                            label="Workflows"
                            isActive={activeView !== 'file' && activeView === 'workflows'}
                            onClick={() => onViewChange('workflows')}
                            collapsed={collapsed}
                        />
                        <SidebarMenuItem
                            icon={LuListTodo}
                            label="Tasks"
                            isActive={activeView !== 'file' && activeView === 'tasks'}
                            onClick={() => onViewChange('tasks')}
                            collapsed={collapsed}
                        />
                    </>
                ) : (
                    <>
                        <SidebarMenuItem
                            icon={LuListTodo}
                            label="Tasks"
                            isActive={activeView !== 'file' && activeView === 'tasks'}
                            onClick={() => onViewChange('tasks')}
                            collapsed={collapsed}
                        />
                        <SidebarMenuItem
                            icon={LuMap}
                            label="Plans"
                            isActive={activeView !== 'file' && activeView === 'plans'}
                            onClick={() => onViewChange('plans')}
                            collapsed={collapsed}
                        />
                        <SidebarMenuItem
                            icon={LuPackage}
                            label="Kits"
                            isActive={activeView !== 'file' && activeView === 'kits'}
                            onClick={() => onViewChange('kits')}
                            collapsed={collapsed}
                        />
                        <SidebarMenuItem
                            icon={LuBookOpen}
                            label="Walkthroughs"
                            isActive={activeView !== 'file' && activeView === 'walkthroughs'}
                            onClick={() => onViewChange('walkthroughs')}
                            collapsed={collapsed}
                        />
                        {flags.diagrams && (
                            <SidebarMenuItem
                                icon={LuNetwork}
                                label="Diagrams"
                                isActive={activeView !== 'file' && activeView === 'diagrams'}
                                onClick={() => onViewChange('diagrams')}
                                collapsed={collapsed}
                            />
                        )}
                        <SidebarMenuItem
                            icon={LuGitBranch}
                            label="Git"
                            isActive={activeView !== 'file' && activeView === 'git'}
                            onClick={() => onViewChange('git')}
                            collapsed={collapsed}
                        />
                        <SidebarMenuItem
                            icon={LuBookmark}
                            label="Bookmarks"
                            isActive={activeView !== 'file' && activeView === 'bookmarks'}
                            onClick={() => onViewChange('bookmarks')}
                            collapsed={collapsed}
                        />
                    </>
                )}

                {(flags.scrapbook || flags.blueprints || flags.agents) && !collapsed && (
                    <SidebarSection title="Extensions" collapsible defaultExpanded={false}>
                        {flags.scrapbook && (
                            <SidebarMenuItem
                                icon={LuNotebook}
                                label="Scrapbook"
                                isActive={activeView !== 'file' && activeView === 'scrapbook'}
                                onClick={() => onViewChange('scrapbook')}
                            />
                        )}
                        {flags.blueprints && (
                            <SidebarMenuItem
                                icon={BsStack}
                                label="Blueprints"
                                isActive={activeView !== 'file' && activeView === 'blueprints'}
                                onClick={() => onViewChange('blueprints')}
                            />
                        )}
                        {flags.agents && (
                            <SidebarMenuItem
                                icon={LuBot}
                                label="Agents"
                                isActive={activeView !== 'file' && activeView === 'agents'}
                                onClick={() => onViewChange('agents')}
                            />
                        )}
                    </SidebarSection>
                )}
            </SidebarSection>

            {/* Notebook Section - Only show when expanded and projectPath is available */}
            {!collapsed && projectPath && onFileSelect && (
                <SidebarSection
                    title="Notebook"
                    flex={true}
                    rightElement={
                        <NotebookToolbar
                            projectPath={projectPath}
                            onNewFile={treeHandlers?.onNewFile}
                            onNewFolder={treeHandlers?.onNewFolder}
                        />
                    }
                >
                    <Box
                        pl={2}
                        flex="1"
                        minH={0}
                        overflowY="auto"
                        overflowX="hidden"
                        css={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            '&::-webkit-scrollbar': {
                                width: '0px',
                                background: 'transparent',
                            },
                            '&:hover': {
                                scrollbarWidth: 'thin',
                                scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
                                '&::-webkit-scrollbar': {
                                    width: '4px',
                                },
                                '&::-webkit-scrollbar-track': {
                                    background: 'transparent',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '2px',
                                    transition: 'background 0.15s ease',
                                },
                                '&::-webkit-scrollbar-thumb:hover': {
                                    background: 'rgba(0, 0, 0, 0.35)',
                                },
                            },
                            _dark: {
                                '&:hover': {
                                    scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
                                    '&::-webkit-scrollbar-thumb': {
                                        background: 'rgba(255, 255, 255, 0.2)',
                                    },
                                    '&::-webkit-scrollbar-thumb:hover': {
                                        background: 'rgba(255, 255, 255, 0.35)',
                                    },
                                },
                            },
                        }}
                    >
                        <NotebookTree
                            projectPath={projectPath}
                            onFileSelect={onFileSelect}
                            selectedFileId={selectedFileId}
                            version={fileTreeVersion}
                            onTreeRefresh={onTreeRefresh}
                            onNewFileCreated={onNewFileCreated}
                            titleEditPath={titleEditPath}
                            editingTitle={editingTitle}
                            onHandlersReady={useCallback((handlers: { onNewFile: (folderPath: string) => void; onNewFolder: (folderPath: string) => void }) => {
                                setTreeHandlers(handlers);
                                if (onHandlersReady) onHandlersReady(handlers);
                            }, [onHandlersReady])}
                        />
                    </Box>
                </SidebarSection>
            )}
        </Flex>
    );
}
