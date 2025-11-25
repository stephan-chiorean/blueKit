import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import GlobalActionBar from './components/GlobalActionBar';

type View = 'welcome' | 'home';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');

  const handleGetStarted = () => {
    setCurrentView('home');
  };

  const handleCreateBlueprint = (name: string, description: string) => {
    // Blueprint creation is now handled inline in HomePage
    console.log('Blueprint created:', name, description);
  };

  return (
    <ColorModeProvider>
      <SelectionProvider>
        {currentView === 'welcome' ? (
          <WelcomeScreen onGetStarted={handleGetStarted} />
        ) : (
          <HomePage onCreateBlueprint={handleCreateBlueprint} />
        )}
        <GlobalActionBar />
      </SelectionProvider>
    </ColorModeProvider>
  );
}

export default App;
