import { Box, Flex, VStack, HStack, Text, Icon, Portal, Avatar, Tooltip, IconButton } from '@chakra-ui/react';
import { LuFolder, LuArrowLeft, LuNetwork, LuLibrary, LuMoon, LuSun, LuSettings, LuUser, LuPanelLeft, LuChevronDown } from 'react-icons/lu';
import SidebarContent, { ViewType } from './components/SidebarContent';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { useSupabaseAuth } from '@/shared/contexts/SupabaseAuthContext';
import { Project, FileTreeNode } from '@/ipc';
import { useState } from 'react';
import KeyboardShortcutsModal from '@/shared/components/KeyboardShortcutsModal';
import { HEADER_SECTION_HEIGHT } from '@/shared/constants/layout';
import ProjectSwitcherModal from './components/ProjectSwitcherModal';



// Helper for consistent Tooltip styling matching NotebookToolbar
const TooltipContent = ({ children, colorMode }: { children: React.ReactNode, colorMode: string }) => (
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
          background: colorMode === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(20, 20, 25, 0.7)',
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
        {children}
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Portal>
);


interface ProjectSidebarProps {
  project: Project;
  allProjects: Project[];
  activeView: ViewType | undefined;
  onBack: () => void;
  onProjectSelect?: (project: Project) => void;
  onViewChange: (view: ViewType) => void;
  onOpenViewInNewTab?: (view: ViewType) => void;
  projectPath: string;
  onFileSelect: (node: FileTreeNode) => void;
  selectedFileId?: string;
  fileTreeVersion: number;
  onTreeRefresh: () => void;
  onClearResourceView: () => void;
  /** Called when a new file is created (for opening in edit mode) */
  onNewFileCreated?: (node: FileTreeNode) => void;
  isWorktreeView?: boolean;
  onHandlersReady?: (handlers: { onNewFile: (folderPath: string) => void; onNewFolder: (folderPath: string) => void }) => void;
  isVault?: boolean;
  /** Toggle sidebar collapsed/expanded */
  onToggleSidebar?: () => void;
  onNewNote: (parentPath?: string) => void;
}

export default function ProjectSidebar({
  project,
  allProjects,
  activeView,
  onBack,
  onProjectSelect,
  onViewChange,
  onOpenViewInNewTab,
  projectPath,
  onFileSelect,
  selectedFileId,
  fileTreeVersion,
  onTreeRefresh,
  onClearResourceView,
  onNewFileCreated,
  isWorktreeView = false,
  onHandlersReady,
  isVault = false,
  onToggleSidebar,
  onNewNote,
}: ProjectSidebarProps) {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user } = useSupabaseAuth();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);

  // Handle opening project in external editor


  // User display name and avatar derivation
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.user_metadata?.avatar_url;

  const handleViewChange = (view: ViewType) => {
    onViewChange(view);
    // Also clear any selected resource when switching main views
    onClearResourceView();
  };

  return (
    <Flex direction="column" h="100%">
      {/* Back button and project selector - Must match BrowserTabs section height */}
      <Box
        h={HEADER_SECTION_HEIGHT}
        px={3}
        display="flex"
        alignItems="center"
      >
        {isVault ? (
          <HStack w="100%" h="34px" gap={2} alignItems="center">
            <Box
              w="100%"
              cursor="pointer"
              borderWidth="0"
              borderRadius="md"
              px={2}
              h="28px"
              minH="28px"
              bg={colorMode === 'light' ? "blackAlpha.50" : "whiteAlpha.100"}
              display="flex"
              alignItems="center"
              _hover={{ bg: colorMode === 'light' ? "blackAlpha.100" : "whiteAlpha.200" }}
              css={{
                transition: 'all 0.2s',
              }}
            >
              <HStack gap={2} alignItems="center" h="100%" flex="1">
                <Icon boxSize={3.5} color="primary.500">
                  <LuLibrary />
                </Icon>
                <Text fontSize="xs" fontWeight="medium" truncate>
                  {project.name}
                </Text>
              </HStack>
            </Box>
            {/* Panel toggle icon - collapses sidebar */}
            {onToggleSidebar && (
              <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                <Tooltip.Trigger asChild>
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label="Collapse Sidebar"
                    onClick={onToggleSidebar}
                    color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                    _hover={{
                      color: colorMode === 'light' ? 'black' : 'white',
                      bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50',
                    }}
                    minW={5}
                    h={5}
                  >
                    <LuPanelLeft />
                  </IconButton>
                </Tooltip.Trigger>
                <TooltipContent colorMode={colorMode}>
                  Collapse sidebar
                </TooltipContent>
              </Tooltip.Root>
            )}
          </HStack>
        ) : !isWorktreeView ? (
          <HStack w="100%" h="34px" gap={2} alignItems="center">
            <Box as="button" onClick={onBack} title="Back to Projects" cursor="pointer" display="flex" alignItems="center">
              <Icon
                as={LuArrowLeft}
                boxSize={4}
                color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                _hover={{ color: colorMode === 'light' ? 'black' : 'white' }}
              />
            </Box>
            <Box
              as="button"
              onClick={() => setIsProjectSwitcherOpen(true)}
              cursor="pointer"
              borderWidth="0"
              borderRadius="md"
              px={2}
              h="28px"
              minH="28px"
              bg={colorMode === 'light' ? "blackAlpha.50" : "whiteAlpha.100"}
              display="flex"
              alignItems="center"
              flex="1"
              _hover={{ bg: colorMode === 'light' ? "blackAlpha.100" : "whiteAlpha.200" }}
              css={{
                transition: 'all 0.2s',
              }}
            >
              <HStack gap={2} alignItems="center" h="100%" flex="1" overflow="hidden">
                <Icon boxSize={3.5} color="primary.500" flexShrink={0}>
                  <LuFolder />
                </Icon>
                <Text fontSize="xs" fontWeight="medium" truncate>
                  {project.name}
                </Text>
              </HStack>
              <Box flexShrink={0}>
                <Icon color="text.muted" size="xs"><LuChevronDown /></Icon>
              </Box>
            </Box>
            <ProjectSwitcherModal
              isOpen={isProjectSwitcherOpen}
              onClose={() => setIsProjectSwitcherOpen(false)}
              projects={allProjects}
              currentProject={project}
              onProjectSelect={(p) => {
                if (onProjectSelect) onProjectSelect(p);
                // No need to set isOpen to false here as modal handles it or we do it transparently
              }}
            />
            {/* Panel toggle icon - collapses sidebar */}
            {onToggleSidebar && (
              <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                <Tooltip.Trigger asChild>
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label="Collapse Sidebar"
                    onClick={onToggleSidebar}
                    color={colorMode === 'light' ? 'gray.500' : 'gray.400'}
                    _hover={{
                      color: colorMode === 'light' ? 'black' : 'white',
                      bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.50',
                    }}
                    minW={5}
                    h={5}
                  >
                    <LuPanelLeft />
                  </IconButton>
                </Tooltip.Trigger>
                <TooltipContent colorMode={colorMode}>
                  Collapse sidebar
                </TooltipContent>
              </Tooltip.Root>
            )}
          </HStack>
        ) : (
          <HStack gap={2} px={1} h="34px" alignItems="center">
            <Icon boxSize={4} color="primary.500">
              <LuNetwork />
            </Icon>
            <Text fontWeight="semibold" fontSize="sm" truncate>
              {project.name}
            </Text>
          </HStack>
        )}
      </Box>

      {/* Sidebar Menu Content - with border separator */}
      <Flex
        direction="column"
        flex="1"
        minH={0}
        overflowX="hidden"
        overflowY="hidden"
        pb={1}
        px={3}
        pt={2}
      >
        <SidebarContent
          activeView={activeView}
          onViewChange={handleViewChange}
          onOpenViewInNewTab={onOpenViewInNewTab}
          projectPath={projectPath}
          onFileSelect={onFileSelect}
          selectedFileId={selectedFileId}
          fileTreeVersion={fileTreeVersion}
          onTreeRefresh={onTreeRefresh}
          onNewFileCreated={onNewFileCreated}
          projectName={project.name}
          onHandlersReady={onHandlersReady}
          isVault={isVault}
          onNewNote={onNewNote}
        />
      </Flex>

      {/* Modern Footer: User Profile & Actions */}
      {!isWorktreeView && (
        <Box px={3} py={3}>
          <HStack
            w="100%"
            p={2}
            borderRadius="xl"
            justify="space-between"
            css={{
              background: 'rgba(255, 255, 255, 0.35)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 12px 0 rgba(31, 38, 135, 0.05)',
              transition: 'all 0.2s ease',
              _hover: {
                background: 'rgba(255, 255, 255, 0.45)',
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 16px 0 rgba(31, 38, 135, 0.08)',
              },
              _dark: {
                background: 'rgba(20, 20, 25, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.2)',
                _hover: {
                  background: 'rgba(20, 20, 25, 0.5)',
                  boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.3)',
                }
              }
            }}
          >
            {/* User Profile - Tooltip for Name */}
            <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top-start', gutter: 10 }}>
              <Tooltip.Trigger asChild>
                <Box
                  cursor="pointer"
                  onClick={() => {
                    if (isVault) {
                      handleViewChange('projects');
                    } else {
                      onBack();
                    }
                  }}
                  _hover={{ opacity: 0.8 }}
                  transition="opacity 0.2s"
                >
                  <Avatar.Root size="xs" colorPalette="primary">
                    {userAvatar && <Avatar.Image src={userAvatar} />}
                    <Avatar.Fallback>
                      <LuUser />
                    </Avatar.Fallback>
                  </Avatar.Root>
                </Box>
              </Tooltip.Trigger>
              <TooltipContent colorMode={colorMode}>
                <VStack gap={0} align="start">
                  <Text fontWeight="semibold">{userName}</Text>
                  <Text fontSize="xx-small" color="text.muted" opacity={0.8}>
                    {isVault ? 'Switch to Projects' : 'Switch to Library'}
                  </Text>
                </VStack>
              </TooltipContent>
            </Tooltip.Root>

            {/* Actions: Settings & Theme */}
            <HStack gap={3}>
              <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                <Tooltip.Trigger asChild>
                  <Box
                    as="button"
                    cursor="pointer"
                    p={1.5}
                    borderRadius="md"
                    color="text.muted"
                    transition="all 0.2s"
                    _hover={{
                      bg: colorMode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
                      color: "text.primary"
                    }}
                    onClick={toggleColorMode}
                  >
                    <Icon boxSize={4}>
                      {colorMode === 'light' ? <LuMoon /> : <LuSun />}
                    </Icon>
                  </Box>
                </Tooltip.Trigger>
                <TooltipContent colorMode={colorMode}>
                  Switch to {colorMode === 'light' ? 'dark' : 'light'} mode
                </TooltipContent>
              </Tooltip.Root>

              <Tooltip.Root openDelay={150} closeDelay={100} positioning={{ placement: 'top', gutter: 8 }}>
                <Tooltip.Trigger asChild>
                  <Box
                    as="button"
                    cursor="pointer"
                    p={1.5}
                    borderRadius="md"
                    color="text.muted"
                    transition="all 0.2s"
                    _hover={{
                      bg: colorMode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
                      color: "text.primary"
                    }}
                    onClick={() => setShowShortcuts(true)}
                  >
                    <Icon boxSize={4}>
                      <LuSettings />
                    </Icon>
                  </Box>
                </Tooltip.Trigger>
                <TooltipContent colorMode={colorMode}>Settings</TooltipContent>
              </Tooltip.Root>
            </HStack>
          </HStack>
        </Box>
      )}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </Flex>
  );
}
