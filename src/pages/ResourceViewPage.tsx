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
import PlanWorkspace from '../components/plans/PlanWorkspace';
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
  onPlanDeleted?: () => void | Promise<void>;
}

export default function ResourceViewPage({ resource, resourceContent, resourceType, viewMode, onBack, onPlanDeleted }: ResourceViewPageProps) {
  const { setSelectedResource, clearSelectedResource } = useResource();
  const hasInitialized = useRef(false);
  const resourcePathRef = useRef<string | null>(null);
  const viewModeRef = useRef(viewMode);
  const clearSelectedResourceRef = useRef(clearSelectedResource);

  // Keep refs in sync with latest values
  useEffect(() => {
    viewModeRef.current = viewMode;
    clearSelectedResourceRef.current = clearSelectedResource;
  }, [viewMode, clearSelectedResource]);

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
  // Use empty dependency array so this only runs on mount/unmount
  // Access clearSelectedResource via ref to always use latest version
  useEffect(() => {
    return () => {
      // Only clear if we're not in plan mode (plan mode manages its own document selection)
      if (viewModeRef.current !== 'plan') {
        clearSelectedResourceRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diagrams use a different layout (full-screen viewer without split view)
  if (resourceType === 'diagram') {
    return (
      <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
        {/* Header above everything */}
        <Box flexShrink={0} bg="transparent">
          <Header />
        </Box>

        {/* Back button */}
        <Box p={4} borderBottomWidth="1px" borderColor="border.subtle" bg="transparent">
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
          <MermaidDiagramViewer diagram={resource} content={resourceContent} />
        </Box>
      </VStack>
    );
  }

  // Plan mode uses PlanWorkspace for unified experience
  if (viewMode === 'plan') {
    return (
      <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
        {/* Header above everything */}
        <Box flexShrink={0} bg="transparent">
          <Header />
        </Box>

        {/* Plan Workspace below header - matches ProjectDetailPage content styling */}
        <Box
          flex="1"
          minH={0}
          overflow="hidden"
          bg="transparent"
        >
          <PlanWorkspace plan={resource} onBack={onBack} onPlanDeleted={onPlanDeleted} />
        </Box>
      </VStack>
    );
  }

  // All other resource types use the split view layout (overview + workstation)
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
          defaultSize={[30, 70]}
          panels={[
            { id: 'overview', minSize: 25, maxSize: 50 },
            { id: 'workstation', minSize: 30 },
          ]}
          h="100%"
          orientation="horizontal"
        >
          {/* Overview Panel */}
          <Splitter.Panel id="overview" bg="transparent">
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
