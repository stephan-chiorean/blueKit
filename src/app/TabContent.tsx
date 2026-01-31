import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Center, HStack, Text, VStack } from '@chakra-ui/react';
import HomeView from '@/views/home/HomeView';
import ProjectView from '@/views/project/ProjectView';
import EditorPlansPage from '@/pages/EditorPlansPage';
import { invokeGetProjectRegistry, Project } from '@/ipc';
import { useTabContext } from './TabContext';

export default function TabContent() {
  const { tabs, activeTabId, openInNewTab, openInCurrentTab, closeTab, switchContext } = useTabContext();
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Cache project registry to avoid refetching on every tab switch
  const [projectsCache, setProjectsCache] = useState<Project[]>([]);

  const openLibraryTab = useCallback(() => {
    // Switch to library context - loads tabs from disk and restores last active tab
    switchContext('library');
  }, [switchContext]);

  const handleProjectSelectNewTab = useCallback((project: Project) => {
    console.log('[TabContent] handleProjectSelectNewTab called', {
      projectId: project.id,
      projectName: project.name,
      isVault: project.isVault,
      passedView: project.isVault ? 'projects' : 'file',
    });
    openInNewTab(
      {
        type: 'project',
        projectId: project.id,
        view: project.isVault ? 'projects' : 'file',
      },
      { title: project.name }
    );
  }, [openInNewTab]);

  const handleProjectSelectCurrentTab = useCallback((project: Project) => {
    console.log('[TabContent] handleProjectSelectCurrentTab called', {
      projectId: project.id,
      projectName: project.name,
      isVault: project.isVault,
      passedView: project.isVault ? 'projects' : 'file',
    });
    openInCurrentTab(
      {
        type: 'project',
        projectId: project.id,
        view: project.isVault ? 'projects' : 'file',
      },
      { title: project.name }
    );
  }, [openInCurrentTab]);

  useEffect(() => {
    let isActive = true;

    const loadProject = async () => {
      if (!activeTab || activeTab.type === 'library' || activeTab.type === 'editor-plans') {
        setActiveProject(null);
        setProjectError(null);
        setProjectLoading(false);
        return;
      }

      if (!activeTab.resource.projectId) {
        setActiveProject(null);
        setProjectError('Missing project context for this tab.');
        setProjectLoading(false);
        return;
      }

      // First, try to find project in cache
      const cachedProject = projectsCache.find(p => p.id === activeTab.resource.projectId);
      if (cachedProject) {
        // Use cached project immediately - no loading state
        setActiveProject(cachedProject);
        setProjectError(null);
        setProjectLoading(false);
        return;
      }

      try {
        // Only show loading if cache is empty (initial load)
        if (projectsCache.length === 0) {
          setProjectLoading(true);
        }

        const projects = await invokeGetProjectRegistry();
        if (!isActive) return;

        // Update cache
        setProjectsCache(projects);

        const project = projects.find(p => p.id === activeTab.resource.projectId) || null;
        setActiveProject(project);
        setProjectError(project ? null : 'Project not found.');
      } catch (error) {
        if (!isActive) return;
        setProjectError(error instanceof Error ? error.message : 'Failed to load project.');
        setActiveProject(null);
      } finally {
        if (isActive) {
          setProjectLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      isActive = false;
    };
  }, [activeTab, projectsCache]);

  if (!activeTab) {
    // This should never happen since we always create a new tab when closing the last one
    return null;
  }

  if (activeTab.type === 'editor-plans') {
    const plansSource = activeTab.resource.plansSource ?? 'claude';
    return (
      <EditorPlansPage
        plansSource={plansSource}
        onBack={() => closeTab(activeTab.id)}
      />
    );
  }

  if (activeTab.type === 'library') {
    return (
      <HomeView onProjectSelect={handleProjectSelectNewTab} />
    );
  }

  if (projectLoading) {
    return (
      <Center h="100vh">
        <Text color="fg.muted">Loading project...</Text>
      </Center>
    );
  }

  if (projectError || !activeProject) {
    return (
      <Center h="100vh">
        <VStack gap={3}>
          <Text color="fg.muted">
            {projectError ?? 'Unable to load project.'}
          </Text>
          <HStack>
            <Button size="sm" variant="ghost" onClick={openLibraryTab}>
              Go to Library
            </Button>
            <Button size="sm" variant="outline" onClick={() => closeTab(activeTab.id)}>
              Close Tab
            </Button>
          </HStack>
        </VStack>
      </Center>
    );
  }

  return (
    <Box h="100%">
      <ProjectView
        project={activeProject}
        onBack={openLibraryTab}
        onProjectSelect={handleProjectSelectCurrentTab}
        isVault={!!activeProject.isVault}
      />
    </Box>
  );
}
