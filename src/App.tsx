import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import CreateBlueprintPage from './pages/CreateBlueprintPage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import GlobalActionBar from './components/GlobalActionBar';

interface BlueprintData {
  name: string;
  description: string;
}

type View = 'welcome' | 'home' | 'create-blueprint';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [blueprintData, setBlueprintData] = useState<BlueprintData | null>(null);

  const handleGetStarted = () => {
    setCurrentView('home');
  };

  const handleCreateBlueprint = (name: string, description: string) => {
    setBlueprintData({ name, description });
    setCurrentView('create-blueprint');
  };

  const handleBackFromBlueprint = () => {
    setCurrentView('home');
    setBlueprintData(null);
  };

  return (
    <ColorModeProvider>
      <SelectionProvider>
        {currentView === 'welcome' ? (
          <WelcomeScreen onGetStarted={handleGetStarted} />
        ) : currentView === 'create-blueprint' && blueprintData ? (
          <CreateBlueprintPage
            blueprintName={blueprintData.name}
            blueprintDescription={blueprintData.description}
            onBack={handleBackFromBlueprint}
          />
        ) : (
          <HomePage onCreateBlueprint={handleCreateBlueprint} />
        )}
        <GlobalActionBar />
      </SelectionProvider>
    </ColorModeProvider>
  );
}

export default App;
