import { useEffect, useRef } from 'react';
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
import PlanOverview from '../components/plans/PlanOverview';
import Workstation from '../components/workstation/Workstation';
import MermaidDiagramViewer from '../components/workstation/MermaidDiagramViewer';
import { useResource } from '../contexts/ResourceContext';
import { ResourceFile, ResourceType, ResourceViewMode } from '../types/resource';

interface ResourceViewPageProps {
  resource: ResourceFile;
  resourceContent: string;
  resourceType: ResourceType;
  viewMode?: ResourceViewMode;
  onBack: () => void;
}

export default function ResourceViewPage({ resource, resourceContent, resourceType, viewMode, onBack }: ResourceViewPageProps) {
  const { setSelectedResource, clearSelectedResource } = useResource();
  const hasInitialized = useRef(false);
  const resourcePathRef = useRef<string | null>(null);
  const viewModeRef = useRef(viewMode);

  // Keep viewMode ref in sync
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Set the selected resource when component mounts or when resource changes
  // For plan mode, don't set the resource - let documents be selectable
  useEffect(() => {
    // Skip for plan mode - documents handle their own selection
    if (viewMode === 'plan') {
      // Reset initialization flag when switching to plan mode
      hasInitialized.current = false;
      resourcePathRef.current = null;
      return;
    }

    // Only set resource if it's a different resource (by path) or on initial mount
    const currentPath = resource.path;
    if (!hasInitialized.current || resourcePathRef.current !== currentPath) {
      setSelectedResource(resource, resourceContent, resourceType);
      hasInitialized.current = true;
      resourcePathRef.current = currentPath;
    }
  }, [resource.path, resourceContent, resourceType, viewMode, setSelectedResource]);

  // Separate effect for cleanup on unmount only
  useEffect(() => {
    return () => {
      // Only clear if we're not in plan mode (plan mode manages its own document selection)
      if (viewModeRef.current !== 'plan') {
        clearSelectedResource();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectedResource]);

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

  // Plan mode uses PlanOverview instead of KitOverview
  if (viewMode === 'plan') {
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
            {/* Plan Overview Panel */}
            <Splitter.Panel id="overview" bg="bg.subtle">
              <PlanOverview plan={resource} onBack={onBack} />
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
