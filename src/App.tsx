import { useState } from 'react';
import { Box, Spinner } from '@chakra-ui/react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import PlansPage from './pages/PlansPage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { ResourceProvider } from './contexts/ResourceContext';
import { GitHubAuthProvider, GitHubAuthScreen, useGitHubAuth } from './auth/github';
import { ProjectEntry } from './ipc';
import GlobalActionBar from './components/shared/GlobalActionBar';

type View = 'welcome' | 'github-auth' | 'home' | 'project-detail' | 'plans';

function AppContent() {
  const { isAuthenticated, isLoading } = useGitHubAuth();
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<ProjectEntry | null>(null);
  const [plansSource, setPlansSource] = useState<'claude' | 'cursor' | null>(null);

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

  const handleProjectSelect = (project: ProjectEntry) => {
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
              <PlansPage
                plansSource={plansSource}
                onBack={handleBackFromPlans}
              />
            ) : (
              <HomePage onProjectSelect={handleProjectSelect} onNavigateToPlans={handleNavigateToPlans} />
            )}
            <GlobalActionBar />
          </SelectionProvider>
        </ResourceProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}

function App() {
  return (
    <GitHubAuthProvider>
      <AppContent />
    </GitHubAuthProvider>
  );
}

export default App;
