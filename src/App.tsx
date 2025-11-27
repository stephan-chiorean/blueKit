import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { WorkstationProvider } from './contexts/WorkstationContext';
import GlobalActionBar from './components/GlobalActionBar';

type View = 'welcome' | 'home';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');

  const handleGetStarted = () => {
    setCurrentView('home');
  };

  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <WorkstationProvider>
          <SelectionProvider>
            {currentView === 'welcome' ? (
              <WelcomeScreen onGetStarted={handleGetStarted} />
            ) : (
              <HomePage />
            )}
            <GlobalActionBar />
          </SelectionProvider>
        </WorkstationProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}

export default App;
