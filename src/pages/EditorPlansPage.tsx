import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Text,
  Icon,
  HStack,
  Button,
  Heading,
  Flex,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import Header from '../components/Header';
import EditorPlansContent from '@/features/plans/components/EditorPlansContent';
import ResourceViewPage from './ResourceViewPage';
import { invokeGetPlansFiles, invokeReadFile, ArtifactFile } from '../ipc';
import { parseFrontMatter, extractFirstHeading } from '@/shared/utils/parseFrontMatter';
import { ResourceFile, ResourceType } from '../types/resource';

interface EditorPlansPageProps {
  plansSource: 'claude' | 'cursor';
  onBack: () => void;
}

export default function EditorPlansPage({ plansSource, onBack }: EditorPlansPageProps) {
  const [plans, setPlans] = useState<ArtifactFile[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generic resource view state - for viewing any resource type
  const [viewingResource, setViewingResource] = useState<ResourceFile | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);

  // Load plans from the appropriate directory
  const loadPlans = async () => {
    try {
      setPlansLoading(true);
      setError(null);

      console.log(`Loading plans from ${plansSource}...`);
      const plansFiles = await invokeGetPlansFiles(plansSource);

      // Read file contents and parse front matter for each plan
      const plansWithFrontMatter = await Promise.all(
        plansFiles.map(async (plan) => {
          try {
            const content = await invokeReadFile(plan.path);
            const frontMatter = parseFrontMatter(content);
            
            // Extract first heading from markdown if no title/alias in front matter
            // This works for both Claude and Cursor plans
            if (!frontMatter?.title && !frontMatter?.alias) {
              const firstHeading = extractFirstHeading(content);
              if (firstHeading) {
                // Set the extracted heading as the title in front matter
                return {
                  ...plan,
                  frontMatter: {
                    ...frontMatter,
                    title: firstHeading,
                  },
                };
              }
            }
            
            return {
              ...plan,
              frontMatter,
            };
          } catch (err) {
            console.error(`Error reading plan file ${plan.path}:`, err);
            return plan; // Return plan without front matter if read fails
          }
        })
      );

      setPlans(plansWithFrontMatter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
      console.error('Error loading plans:', err);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    // Load plans on mount
    loadPlans();
  }, [plansSource]);

  // Generic handler to view any resource type
  const handleViewPlan = async (plan: ArtifactFile) => {
    try {
      const content = await invokeReadFile(plan.path);
      setViewingResource(plan);
      setResourceContent(content);
      setResourceType('kit'); // Plans are treated as kits for viewing purposes
    } catch (error) {
      console.error('Failed to load plan content:', error);
    }
  };

  // Handler to go back from resource view
  const handleBackFromResourceView = () => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
  };

  // If viewing a plan, show the generic resource view page
  if (viewingResource && resourceContent && resourceType) {
    return (
      <ResourceViewPage
        resource={viewingResource}
        resourceContent={resourceContent}
        resourceType={resourceType}
        onBack={handleBackFromResourceView}
      />
    );
  }

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden" bg="transparent">
      {/* Header above everything */}
      <Box flexShrink={0} bg="transparent">
        <Header />
      </Box>
      
      {/* Full screen content area */}
      <Box flex="1" minH={0} overflow="hidden" bg="transparent">
        <Box 
          h="100%" 
          p={6} 
          position="relative" 
          overflow="auto"
          css={{
            background: { _light: 'rgba(255, 255, 255, 0.1)', _dark: 'rgba(0, 0, 0, 0.15)' },
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          }}
        >
          {/* Back button and title */}
          <Flex align="center" gap={4} mb={6} mt={3}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
            >
              <HStack gap={2}>
                <Icon>
                  <LuArrowLeft />
                </Icon>
                <Text>Back</Text>
              </HStack>
            </Button>
            <Heading size="lg">
              <Text as="span" textTransform="capitalize">
                {plansSource}
              </Text>
              <Text as="span"> Plans</Text>
            </Heading>
          </Flex>

          {/* Plans Content */}
          <EditorPlansContent
            plans={plans}
            plansLoading={plansLoading}
            error={error}
            onViewPlan={handleViewPlan}
            plansSource={plansSource}
            onReload={loadPlans}
          />
        </Box>
      </Box>
    </VStack>
  );
}
