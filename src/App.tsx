import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import PlansPage from './pages/PlansPage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { ResourceProvider } from './contexts/ResourceContext';
import { ProjectEntry } from './ipc';
import GlobalActionBar from './components/shared/GlobalActionBar';

type View = 'welcome' | 'home' | 'project-detail' | 'plans';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<ProjectEntry | null>(null);
  const [plansSource, setPlansSource] = useState<'claude' | 'cursor' | null>(null);

  const handleGetStarted = () => {
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

  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <ResourceProvider>
          <SelectionProvider>
            {currentView === 'welcome' ? (
              <WelcomeScreen onGetStarted={handleGetStarted} />
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

export default App;
