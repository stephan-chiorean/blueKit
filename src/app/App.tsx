import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import WelcomeView from '@/views/home/WelcomeView';
import HomeView from '@/views/home/HomeView';
import ProjectView from '@/views/project/ProjectView';
import EditorPlansPage from '@/pages/EditorPlansPage';
import PreviewWindowPage from '@/pages/PreviewWindowPage';
import WorktreeWindowPage from '@/pages/WorktreeWindowPage';
import { SelectionProvider } from '@/shared/contexts/SelectionContext';
import { ColorModeProvider } from '@/shared/contexts/ColorModeContext';
import { FeatureFlagsProvider } from '@/shared/contexts/FeatureFlagsContext';
import { ResourceProvider } from '@/shared/contexts/ResourceContext';
import { NotepadProvider } from '@/shared/contexts/NotepadContext';
import { TimerProvider } from '@/shared/contexts/TimerContext';
import { LibraryCacheProvider } from '@/shared/contexts/LibraryCacheContext';
import { WorkstationProvider } from '@/app/WorkstationContext';
import { ProjectArtifactsProvider } from '@/shared/contexts/ProjectArtifactsContext';
import { QuickTaskPopoverProvider } from '@/shared/contexts/QuickTaskPopoverContext';
import { GitHubIntegrationProvider } from '@/shared/contexts/GitHubIntegrationContext';
import { SupabaseAuthProvider } from '@/shared/contexts/SupabaseAuthContext';
import { Project } from '@/ipc';

import DraggableNotepad from '@/features/workstation/components/DraggableNotepad';
import { useNotepad } from '@/shared/contexts/NotepadContext';
import GradientBackground from '@/shared/components/GradientBackground';

type View = 'welcome' | 'home' | 'project-detail' | 'plans';

function AppContent() {
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [plansSource, setPlansSource] = useState<'claude' | 'cursor' | null>(null);

  // Check if this is a preview window
  const isPreviewWindow = window.location.pathname === '/preview';
  const isWorktreeWindow = window.location.pathname === '/worktree';

  // Go directly to home - no auth required
  const handleGetStarted = () => {
    setCurrentView('home');
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setCurrentView('project-detail');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedProject(null);
  };

  const handleNavigateToPlans = (source: 'claude' | 'cursor') => {
    setPlansSource(source);
    setCurrentView('plans');
  };

  const handleBackFromPlans = () => {
    setCurrentView('home');
    setPlansSource(null);
  };

  // If this is a preview window, render only the preview page
  if (isPreviewWindow) {
    return (
      <ColorModeProvider>
        <FeatureFlagsProvider>
          <LibraryCacheProvider>
            <ResourceProvider>
              <ProjectArtifactsProvider>
                <GradientBackground />
                <Box position="relative" zIndex={1}>
                  <PreviewWindowPage />
                </Box>
              </ProjectArtifactsProvider>
            </ResourceProvider>
          </LibraryCacheProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }

  // If this is a worktree window, render the worktree page
  if (isWorktreeWindow) {
    return (
      <ColorModeProvider>
        <FeatureFlagsProvider>
          <LibraryCacheProvider>
            <ResourceProvider>
              <ProjectArtifactsProvider>
                <WorktreeWindowPage />
              </ProjectArtifactsProvider>
            </ResourceProvider>
          </LibraryCacheProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }

  // App opens directly - no auth gate
  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <LibraryCacheProvider>
          <ResourceProvider>
            <ProjectArtifactsProvider>
              <SelectionProvider>
                <GradientBackground />
                <Box position="relative" zIndex={1}>
                  {currentView === 'welcome' ? (
                    <WelcomeView onGetStarted={handleGetStarted} />
                  ) : currentView === 'project-detail' && selectedProject ? (
                    <ProjectView
                      project={{
                        id: selectedProject.id,
                        title: selectedProject.name,
                        description: selectedProject.description || '',
                        path: selectedProject.path,
                      }}
                      onBack={handleBackToHome}
                      onProjectSelect={handleProjectSelect}
                    />
                  ) : currentView === 'plans' && plansSource ? (
                    <EditorPlansPage
                      plansSource={plansSource}
                      onBack={handleBackFromPlans}
                    />
                  ) : (
                    <HomeView onProjectSelect={handleProjectSelect} onNavigateToPlans={handleNavigateToPlans} />
                  )}

                  <DraggableNotepad
                    isOpen={isNotepadOpen}
                    onClose={toggleNotepad}
                  />
                </Box>
              </SelectionProvider>
            </ProjectArtifactsProvider>
          </ResourceProvider>
        </LibraryCacheProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}

function App() {
  return (
    <SupabaseAuthProvider>
      <GitHubIntegrationProvider>
        <NotepadProvider>
          <TimerProvider>
            <QuickTaskPopoverProvider>
              <WorkstationProvider>
                <AppContent />
              </WorkstationProvider>
            </QuickTaskPopoverProvider>
          </TimerProvider>
        </NotepadProvider>
      </GitHubIntegrationProvider>
    </SupabaseAuthProvider>
  );
}

export default App;
