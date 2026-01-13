import { Box, Flex, VStack, HStack, Text, Icon, Select, Portal, createListCollection } from '@chakra-ui/react';
import { LuFolder, LuArrowLeft } from 'react-icons/lu';
import SidebarContent, { ViewType } from './SidebarContent';
import { useColorMode } from '../../contexts/ColorModeContext';
import { Project, ProjectEntry, FileTreeNode } from '../../ipc';
import { ResourceFile } from '../../types/resource';

interface ProjectSidebarProps {
  project: ProjectEntry;
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
}: ProjectSidebarProps) {
  const { colorMode } = useColorMode();

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
    <Flex direction="column" h="100%" pt={2}>
      {/* Back button and project selector */}
      <Box px={3} py={4}>
        <VStack gap={3} align="stretch">
          <HStack>
            <Box as="button" onClick={onBack} title="Back to Projects" cursor="pointer">
              <Icon
                as={LuArrowLeft}
                boxSize={5}
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
                borderWidth="1px"
                borderRadius="lg"
                px={2}
                css={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                  transition: 'none',
                  _dark: {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                  },
                }}
              >
                <Select.Trigger
                  width="100%"
                  bg="transparent"
                  border="none"
                  _focus={{ boxShadow: "none", outline: "none" }}
                  _hover={{ bg: "transparent" }}
                  _active={{ bg: "transparent" }}
                >
                  <HStack gap={2} align="center" flex="1">
                    <Icon boxSize={4} color="primary.500">
                      <LuFolder />
                    </Icon>
                    <Select.ValueText placeholder="Select project" flex="1" />
                  </HStack>
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
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
        </VStack>
      </Box>

      {/* Sidebar Menu Content */}
      <Box
        flex="1"
        overflowX="hidden"
        pb={4}
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
        />
      </Box>
    </Flex>
  );
}

