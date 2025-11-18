import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  const handleGetStarted = () => {
    setShowWelcome(false);
  };

  if (showWelcome) {
    return <WelcomeScreen onGetStarted={handleGetStarted} />;
  }

  return <HomePage />;
}

export default App;
