import { Box, Flex, VStack, HStack, Text, Icon, Select, Portal, createListCollection, Avatar, Tooltip } from '@chakra-ui/react';
import { LuFolder, LuArrowLeft, LuNetwork, LuLibrary, LuMoon, LuSun, LuSettings, LuUser } from 'react-icons/lu';
import SidebarContent, { ViewType } from './components/SidebarContent';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import { useSupabaseAuth } from '@/shared/contexts/SupabaseAuthContext';
import { Project, FileTreeNode } from '@/ipc';

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
  activeView: ViewType;
  onBack: () => void;
  onProjectSelect?: (project: Project) => void;
  onViewChange: (view: ViewType) => void;
  projectPath: string;
  onFileSelect: (node: FileTreeNode) => void;
  selectedFileId?: string;
  fileTreeVersion: number;
  onTreeRefresh: () => void;
  onClearResourceView: () => void;
  /** Called when a new file is created (for opening in edit mode) */
  onNewFileCreated?: (node: FileTreeNode) => void;
  /** Path of node in title-edit mode (visual highlight only) */
  titleEditPath?: string | null;
  /** External title to display for titleEditPath node (synced from editor) */
  editingTitle?: string;
  isWorktreeView?: boolean;
  onHandlersReady?: (handlers: { onNewFile: (folderPath: string) => void; onNewFolder: (folderPath: string) => void }) => void;
  isVault?: boolean;
}

export default function ProjectSidebar({
  project,
  allProjects,
  activeView,
  onBack,
  onProjectSelect,
  onViewChange,
  projectPath,
  onFileSelect,
  selectedFileId,
  fileTreeVersion,
  onTreeRefresh,
  onClearResourceView,
  onNewFileCreated,
  titleEditPath,
  editingTitle,
  isWorktreeView = false,
  onHandlersReady,
  isVault = false,
}: ProjectSidebarProps) {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user } = useSupabaseAuth();

  // User display name and avatar derivation
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.user_metadata?.avatar_url;

  // Create collection for Select component
  const projectsCollection = createListCollection({
    items: allProjects,
    itemToString: (item) => item.name,
    itemToValue: (item) => item.id,
  });

  // Handler for project selection from dropdown
  const handleProjectChange = (details: { value: string[] }) => {
    const selectedProjectId = details.value[0];
    const selectedProject = allProjects.find(p => p.id === selectedProjectId);
    if (selectedProject && onProjectSelect) {
      onProjectSelect(selectedProject);
    }
  };

  const handleViewChange = (view: ViewType) => {
    onViewChange(view);
    // Also clear any selected resource when switching main views
    onClearResourceView();
  };

  return (
    <Flex direction="column" h="100%">
      {/* Back button and project selector - Aligned with StandardPageLayout header */}
      <Box
        h="40px"
        px={3}
        pb={1}
        display="flex"
        alignItems="flex-end"
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
            <Select.Root
              collection={projectsCollection}
              value={[project.id]}
              onValueChange={handleProjectChange}
              size="sm"
              width="100%"
            >
              <Select.HiddenSelect />
              <Select.Control
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
                <Select.Trigger
                  flex="1"
                  width="auto"
                  bg="transparent"
                  border="none"
                  h="100%"
                  py={0}
                  _focus={{ boxShadow: "none", outline: "none" }}
                  _hover={{ bg: "transparent" }}
                  _active={{ bg: "transparent" }}
                >
                  <HStack gap={2} alignItems="center" h="100%" flex="1">
                    <Icon boxSize={3.5} color="primary.500">
                      <LuFolder />
                    </Icon>
                    <Select.ValueText placeholder="Select project" fontSize="xs" fontWeight="medium" />
                  </HStack>
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator ml={1} />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content
                    borderWidth="1px"
                    borderRadius="lg"
                    css={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                      borderColor: 'rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.1)',
                      zIndex: 9999,
                      _dark: {
                        background: 'rgba(20, 20, 25, 0.8)',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                      },
                    }}
                  >
                    {projectsCollection.items.map((proj) => (
                      <Select.Item key={proj.id} item={proj}>
                        <HStack gap={2}>
                          <Icon color="primary.500">
                            <LuFolder />
                          </Icon>
                          <Select.ItemText>{proj.name}</Select.ItemText>
                        </HStack>
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
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

      {/* Sidebar Menu Content */}
      <Box
        flex="1"
        overflowX="hidden"
        overflowY="auto"
        pb={1}
        px={2}
      >
        <SidebarContent
          activeView={activeView}
          onViewChange={handleViewChange}
          projectPath={projectPath}
          onFileSelect={onFileSelect}
          selectedFileId={selectedFileId}
          fileTreeVersion={fileTreeVersion}
          onTreeRefresh={onTreeRefresh}
          onNewFileCreated={onNewFileCreated}
          titleEditPath={titleEditPath}
          editingTitle={editingTitle}
          projectName={project.name}
          onHandlersReady={onHandlersReady}
          isVault={isVault}
        />
      </Box>

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
    </Flex>
  );
}
