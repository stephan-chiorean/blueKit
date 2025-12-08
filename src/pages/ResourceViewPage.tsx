import { useEffect } from 'react';
import {
  Box,
  VStack,
  Splitter,
  Button,
  HStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import Header from '../components/Header';
import KitOverview from '../components/kits/KitOverview';
import Workstation from '../components/workstation/Workstation';
import MermaidDiagramViewer from '../components/workstation/MermaidDiagramViewer';
import { useResource } from '../contexts/ResourceContext';
import { ResourceFile, ResourceType } from '../types/resource';

interface ResourceViewPageProps {
  resource: ResourceFile;
  resourceContent: string;
  resourceType: ResourceType;
  onBack: () => void;
}

export default function ResourceViewPage({ resource, resourceContent, resourceType, onBack }: ResourceViewPageProps) {
  const { setSelectedResource, clearSelectedResource } = useResource();

  // Set the selected resource when component mounts
  useEffect(() => {
    setSelectedResource(resource, resourceContent, resourceType);

    // Cleanup: clear selected resource when component unmounts
    return () => {
      clearSelectedResource();
    };
  }, [resource, resourceContent, resourceType, setSelectedResource, clearSelectedResource]);

  // Diagrams use a different layout (full-screen viewer without split view)
  if (resourceType === 'diagram') {
    return (
      <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
        {/* Header above everything */}
        <Box flexShrink={0}>
          <Header />
        </Box>

        {/* Back button */}
        <Box p={4} borderBottomWidth="1px" borderColor="border.subtle">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
          >
            <HStack gap={2}>
              <Icon>
                <LuArrowLeft />
              </Icon>
              <Text color="text.primary">Back</Text>
            </HStack>
          </Button>
        </Box>

        {/* Diagram viewer */}
        <Box flex="1" minH={0} overflow="hidden">
          <MermaidDiagramViewer diagram={resource} content={resourceContent} />
        </Box>
      </VStack>
    );
  }

  // All other resource types use the split view layout (overview + workstation)
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
            <KitOverview kit={resource} onBack={onBack} />
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
