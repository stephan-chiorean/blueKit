import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectView from './pages/ProjectView';
import { SelectionProvider } from './contexts/SelectionContext';
import GlobalActionBar from './components/GlobalActionBar';

interface ProjectData {
  id: string;
  title: string;
  description: string;
  path: string;
}

type View = 'welcome' | 'home' | 'project';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);

  const handleGetStarted = () => {
    setCurrentView('home');
  };

  const handleViewProject = (project: ProjectData) => {
    setSelectedProject(project);
    setCurrentView('project');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedProject(null);
  };

  return (
    <SelectionProvider>
      {currentView === 'welcome' ? (
        <WelcomeScreen onGetStarted={handleGetStarted} />
      ) : currentView === 'project' && selectedProject ? (
        <ProjectView project={selectedProject} onBack={handleBackToHome} />
      ) : (
        <HomePage onViewProject={handleViewProject} />
      )}
      <GlobalActionBar />
    </SelectionProvider>
  );
}

export default App;
