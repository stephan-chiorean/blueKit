import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectView from './pages/ProjectView';

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

  if (currentView === 'welcome') {
    return <WelcomeScreen onGetStarted={handleGetStarted} />;
  }

  if (currentView === 'project' && selectedProject) {
    return <ProjectView project={selectedProject} onBack={handleBackToHome} />;
  }

  return <HomePage onViewProject={handleViewProject} />;
}

export default App;
