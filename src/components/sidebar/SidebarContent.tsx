import { VStack, Box, Flex } from '@chakra-ui/react';
import {
    LuListTodo,
    LuMap,
    LuPackage,
    LuNetwork,
    LuGitBranch,
    LuNotebook,
    LuBot,
    LuBookOpen
} from 'react-icons/lu';
import { BsStack } from 'react-icons/bs'; // For Blueprints
import { useState, useEffect } from 'react';
import SidebarSection from './SidebarSection';
import SidebarMenuItem from './SidebarMenuItem';
import NotebookTree from './NotebookTree';
import NotebookToolbar from './NotebookToolbar';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { FileTreeNode } from '../../ipc/fileTree';

export type ViewType =
    | 'tasks'
    | 'plans'
    | 'kits'
    | 'walkthroughs'
    | 'diagrams'
    | 'timeline'
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
    editingTitle
}: SidebarContentProps) {
    const { flags } = useFeatureFlags();
    const [treeHandlers, setTreeHandlers] = useState<{
        onNewFile: (folderPath: string) => void;
        onNewFolder: (folderPath: string) => void;
    } | null>(null);

    return (
        <Flex direction="column" width="100%" h="100%" gap={4} pb={4}>
            <SidebarSection title="Toolkit" collapsed={collapsed}>
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
                    label="Timeline"
                    isActive={activeView !== 'file' && activeView === 'timeline'}
                    onClick={() => onViewChange('timeline')}
                    collapsed={collapsed}
                />

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
                            onHandlersReady={setTreeHandlers}
                        />
                    </Box>
                </SidebarSection>
            )}
        </Flex>
    );
}
