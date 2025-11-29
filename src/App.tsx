import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { WorkstationProvider } from './contexts/WorkstationContext';
import { ProjectEntry } from './ipc';

type View = 'welcome' | 'home' | 'project-detail';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<ProjectEntry | null>(null);

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

  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <WorkstationProvider>
          <SelectionProvider>
            {currentView === 'welcome' ? (
              <WelcomeScreen onGetStarted={handleGetStarted} />
            ) : currentView === 'project-detail' && selectedProject ? (
              <ProjectDetailPage 
                project={selectedProject} 
                onBack={handleBackToHome}
                onProjectSelect={handleProjectSelect}
              />
            ) : (
              <HomePage onProjectSelect={handleProjectSelect} />
            )}
          </SelectionProvider>
        </WorkstationProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}

export default App;
