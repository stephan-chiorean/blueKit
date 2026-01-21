import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import EditorPlansPage from './pages/EditorPlansPage';
import PreviewWindowPage from './pages/PreviewWindowPage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { ResourceProvider } from './contexts/ResourceContext';
import { NotepadProvider } from './contexts/NotepadContext';
import { TimerProvider } from './contexts/TimerContext';
import { LibraryCacheProvider } from './contexts/LibraryCacheContext';
import { WorkstationProvider } from './contexts/WorkstationContext';
import { ProjectArtifactsProvider } from './contexts/ProjectArtifactsContext';
import { QuickTaskPopoverProvider } from './contexts/QuickTaskPopoverContext';
import { GitHubIntegrationProvider } from './contexts/GitHubIntegrationContext';
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';
import { Project } from './ipc';

import DraggableNotepad from './components/workstation/DraggableNotepad';
import { useNotepad } from './contexts/NotepadContext';
import GradientBackground from './components/shared/GradientBackground';

type View = 'welcome' | 'home' | 'project-detail' | 'plans';

function AppContent() {
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [plansSource, setPlansSource] = useState<'claude' | 'cursor' | null>(null);

  // Check if this is a preview window
  const isPreviewWindow = window.location.pathname === '/preview';

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
                    <WelcomeScreen onGetStarted={handleGetStarted} />
                  ) : currentView === 'project-detail' && selectedProject ? (
                    <ProjectDetailPage
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
                    <HomePage onProjectSelect={handleProjectSelect} onNavigateToPlans={handleNavigateToPlans} />
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
