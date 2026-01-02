import { useEffect } from 'react';
import {
  Box,
  VStack,
  Splitter,
} from '@chakra-ui/react';
import Header from '../components/Header';
import KitOverview from '../components/kits/KitOverview';
import Workstation from '../components/workstation/Workstation';
import { useResource } from '../contexts/ResourceContext';
import { ArtifactFile } from '../ipc';

interface WalkthroughViewPageProps {
  kit: ArtifactFile;
  kitContent: string;
  onBack: () => void;
}

export default function WalkthroughViewPage({ kit, kitContent, onBack }: WalkthroughViewPageProps) {
  const { setSelectedResource, clearSelectedResource } = useResource();

  // Set the selected resource when component mounts
  useEffect(() => {
    setSelectedResource(kit, kitContent, 'walkthrough');
    
    // Cleanup: clear selected resource when component unmounts
    return () => {
      clearSelectedResource();
    };
  }, [kit, kitContent, setSelectedResource, clearSelectedResource]);

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
      {/* Header above everything */}
      <Box flexShrink={0} bg="transparent">
        <Header />
      </Box>
      
      {/* Splitter layout below header */}
      <Box 
        flex="1" 
        minH={0} 
        overflow="hidden"
        bg="transparent"
        css={{
          background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        }}
      >
        <Splitter.Root
          defaultSize={[40, 60]}
          panels={[
            { id: 'overview', minSize: 25, maxSize: 50 },
            { id: 'workstation', minSize: 30 },
          ]}
          h="100%"
          orientation="horizontal"
        >
          {/* Overview Panel */}
          <Splitter.Panel id="overview" bg="transparent">
            <KitOverview kit={kit} onBack={onBack} />
          </Splitter.Panel>

          {/* Resize Trigger */}
          <Splitter.ResizeTrigger id="overview:workstation" />

          {/* Workstation Panel */}
          <Splitter.Panel id="workstation">
            <Workstation />
          </Splitter.Panel>
        </Splitter.Root>
      </Box>
    </VStack>
  );
}

