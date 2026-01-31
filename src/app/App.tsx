import { useState } from 'react';
import { Box } from '@chakra-ui/react';
import WelcomeView from '@/views/home/WelcomeView';
import TabManager from '@/app/TabManager';
import PreviewWindowPage from '@/pages/PreviewWindowPage';
import WorktreeWindowPage from '@/pages/WorktreeWindowPage';
import { SelectionProvider } from '@/shared/contexts/SelectionContext';
import { ColorModeProvider } from '@/shared/contexts/ColorModeContext';
import { FeatureFlagsProvider } from '@/shared/contexts/FeatureFlagsContext';
import { ResourceProvider } from '@/shared/contexts/ResourceContext';
import { NotepadProvider } from '@/shared/contexts/NotepadContext';
import { TimerProvider } from '@/shared/contexts/TimerContext';
import { LibraryCacheProvider } from '@/shared/contexts/LibraryCacheContext';
import { WorkstationProvider } from '@/app/WorkstationContext';
import { ProjectArtifactsProvider } from '@/shared/contexts/ProjectArtifactsContext';
import { QuickTaskPopoverProvider } from '@/shared/contexts/QuickTaskPopoverContext';
import { GitHubIntegrationProvider } from '@/shared/contexts/GitHubIntegrationContext';
import { SupabaseAuthProvider } from '@/shared/contexts/SupabaseAuthContext';

import DraggableNotepad from '@/features/workstation/components/DraggableNotepad';
import { useNotepad } from '@/shared/contexts/NotepadContext';
import GradientBackground from '@/shared/components/GradientBackground';
import GlobalQuickTaskPopover from '@/features/tasks/components/GlobalQuickTaskPopover';

function AppContent() {
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const [showWelcome, setShowWelcome] = useState(true);

  // Check if this is a preview window
  const isPreviewWindow = window.location.pathname === '/preview';
  const isWorktreeWindow = window.location.pathname === '/worktree';

  const handleGetStarted = () => {
    setShowWelcome(false);
  };

  // If this is a preview window, render only the preview page
  if (isPreviewWindow) {
    return (
      <ColorModeProvider>
        <FeatureFlagsProvider>
          <LibraryCacheProvider>
            <ResourceProvider>
              <ProjectArtifactsProvider>
                <GradientBackground />
                <Box position="relative" zIndex={1}>
                  <PreviewWindowPage />
                </Box>
              </ProjectArtifactsProvider>
            </ResourceProvider>
          </LibraryCacheProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }

  // If this is a worktree window, render the worktree page
  if (isWorktreeWindow) {
    return (
      <ColorModeProvider>
        <FeatureFlagsProvider>
          <LibraryCacheProvider>
            <ResourceProvider>
              <ProjectArtifactsProvider>
                <WorktreeWindowPage />
              </ProjectArtifactsProvider>
            </ResourceProvider>
          </LibraryCacheProvider>
        </FeatureFlagsProvider>
      </ColorModeProvider>
    );
  }

  // App opens directly - no auth gate
  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <LibraryCacheProvider>
          <ResourceProvider>
            <ProjectArtifactsProvider>
              <SelectionProvider>
                <GradientBackground />
                <Box position="relative" zIndex={1}>
                  {showWelcome ? (
                    <WelcomeView onGetStarted={handleGetStarted} />
                  ) : (
                    <TabManager />
                  )}

                  <DraggableNotepad
                    isOpen={isNotepadOpen}
                    onClose={toggleNotepad}
                  />

                  <GlobalQuickTaskPopover />
                </Box>
              </SelectionProvider>
            </ProjectArtifactsProvider>
          </ResourceProvider>
        </LibraryCacheProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}

function App() {
  return (
    <SupabaseAuthProvider>
      <GitHubIntegrationProvider>
        <NotepadProvider>
          <TimerProvider>
            <QuickTaskPopoverProvider>
              <WorkstationProvider>
                <AppContent />
              </WorkstationProvider>
            </QuickTaskPopoverProvider>
          </TimerProvider>
        </NotepadProvider>
      </GitHubIntegrationProvider>
    </SupabaseAuthProvider>
  );
}

export default App;
