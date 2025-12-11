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
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header />
      </Box>
      
      {/* Splitter layout below header */}
      <Box flex="1" minH={0} overflow="hidden">
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
          <Splitter.Panel id="overview" bg="bg.subtle">
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

