---
id: react-setup
type: task
version: 1
---

# React Application Setup

Set up React application structure, routing, and entry point with proper TypeScript configuration.

## Requirements

- Completed "TypeScript IPC Wrappers" task
- React and TypeScript dependencies installed

## Steps

### 1. Create React Entry Point

Create `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### 2. Create Main App Component

Create `src/App.tsx`:

```typescript
import { useState } from 'react';
import WelcomeScreen from './components/WelcomeScreen';
import HomePage from './pages/HomePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import { SelectionProvider } from './contexts/SelectionContext';
import { ColorModeProvider } from './contexts/ColorModeContext';

// Define view types
type View = 'welcome' | 'home' | 'project-detail';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const handleGetStarted = () => {
    setCurrentView('home');
  };

  const handleProjectSelect = (project: any) => {
    setSelectedProject(project);
    setCurrentView('project-detail');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setSelectedProject(null);
  };

  return (
    <ColorModeProvider>
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
    </ColorModeProvider>
  );
}

export default App;
```

### 3. Create Basic Page Components

Create `src/pages/HomePage.tsx`:

```typescript
import { Box } from '@chakra-ui/react';

interface HomePageProps {
  onProjectSelect: (project: any) => void;
}

export default function HomePage({ onProjectSelect }: HomePageProps) {
  return (
    <Box p={4}>
      <h1>Home Page</h1>
      {/* Add project list and selection logic here */}
    </Box>
  );
}
```

Create `src/pages/ProjectDetailPage.tsx`:

```typescript
import { Box } from '@chakra-ui/react';

interface ProjectDetailPageProps {
  project: any;
  onBack: () => void;
  onProjectSelect: (project: any) => void;
}

export default function ProjectDetailPage({ 
  project, 
  onBack,
  onProjectSelect 
}: ProjectDetailPageProps) {
  return (
    <Box p={4}>
      <button onClick={onBack}>Back</button>
      <h1>Project: {project?.title || 'Unknown'}</h1>
      {/* Add project details here */}
    </Box>
  );
}
```

### 4. Create Welcome Screen

Create `src/components/WelcomeScreen.tsx`:

```typescript
import { Box, Button, Heading, VStack } from '@chakra-ui/react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <Box p={8}>
      <VStack spacing={4}>
        <Heading>Welcome to Your App</Heading>
        <Button onClick={onGetStarted}>Get Started</Button>
      </VStack>
    </Box>
  );
}
```

## Component Organization

- **pages/**: Top-level page components (HomePage, ProjectDetailPage)
- **components/**: Reusable UI components
- **contexts/**: React context providers
- **utils/**: Utility functions

## Verification

- Run `npm run dev` - React app should render
- Navigate between views - routing should work
- Check browser console for errors

## Next Steps

After completing this task, proceed to "Context Providers" task.