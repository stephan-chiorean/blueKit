import { useState } from 'react';
import { Box, Spinner } from '@chakra-ui/react';
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
import { GitHubAuthProvider, GitHubAuthScreen, useGitHubAuth } from './auth/github';
import { Project } from './ipc';
import GlobalActionBar from './components/shared/GlobalActionBar';
import DraggableNotepad from './components/workstation/DraggableNotepad';
import { useNotepad } from './contexts/NotepadContext';

type View = 'welcome' | 'github-auth' | 'home' | 'project-detail' | 'plans';

function AppContent() {
  const { isAuthenticated, isLoading } = useGitHubAuth();
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [plansSource, setPlansSource] = useState<'claude' | 'cursor' | null>(null);

  // Check if this is a preview window
  const isPreviewWindow = window.location.pathname === '/preview';

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setCurrentView('home');
    } else {
      setCurrentView('github-auth');
    }
  };

  const handleAuthSuccess = () => {
    setCurrentView('home');
  };

  const handleSkipAuth = () => {
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
          <ResourceProvider>
            <PreviewWindowPage />
          </ResourceProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <ColorModeProvider>
        <FeatureFlagsProvider>
          <ResourceProvider>
            <SelectionProvider>
              <Box display="flex" justifyContent="center" alignItems="center" h="100vh">
                <Spinner size="xl" />
              </Box>
            </SelectionProvider>
          </ResourceProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }

  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <ResourceProvider>
          <SelectionProvider>
            {currentView === 'welcome' ? (
              <WelcomeScreen onGetStarted={handleGetStarted} />
            ) : currentView === 'github-auth' ? (
              <GitHubAuthScreen onSuccess={handleAuthSuccess} onSkip={handleSkipAuth} />
            ) : currentView === 'project-detail' && selectedProject ? (
              <ProjectDetailPage
                project={selectedProject}
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
            <GlobalActionBar />
            <DraggableNotepad
              isOpen={isNotepadOpen}
              onClose={toggleNotepad}
            />
          </SelectionProvider>
        </ResourceProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}

function App() {
  return (
    <GitHubAuthProvider>
      <NotepadProvider>
        <TimerProvider>
          <AppContent />
        </TimerProvider>
      </NotepadProvider>
    </GitHubAuthProvider>
  );
}

export default App;
