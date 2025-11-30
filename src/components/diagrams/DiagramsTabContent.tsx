import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Text,
  Icon,
  HStack,
  EmptyState,
} from '@chakra-ui/react';
import { LuNetwork } from 'react-icons/lu';
import {
  KitFile,
  invokeGetProjectDiagrams,
  invokeReadFile,
} from '../../ipc';
import { parseFrontMatter } from '../../utils/parseFrontMatter';

interface DiagramsTabContentProps {
  projectPath: string;
  onViewDiagram: (diagram: KitFile) => void;
}

export default function DiagramsTabContent({
  projectPath,
  onViewDiagram,
}: DiagramsTabContentProps) {
  const [diagrams, setDiagrams] = useState<KitFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load diagrams
  const loadDiagrams = async () => {
    try {
      setLoading(true);
      setError(null);
      const diagramFiles = await invokeGetProjectDiagrams(projectPath);
      
      // Read file contents and parse front matter for each diagram
      const diagramsWithFrontMatter = await Promise.all(
        diagramFiles.map(async (diagram) => {
          try {
            const content = await invokeReadFile(diagram.path);
            const frontMatter = parseFrontMatter(content);
            return {
              ...diagram,
              frontMatter,
            };
          } catch (err) {
            console.error(`Error reading diagram file ${diagram.path}:`, err);
            return diagram; // Return diagram without front matter if read fails
          }
        })
      );
      
      setDiagrams(diagramsWithFrontMatter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagrams');
      console.error('Error loading diagrams:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking on a diagram
  const handleDiagramClick = async (diagram: KitFile) => {
    try {
      const content = await invokeReadFile(diagram.path);
      const frontMatter = parseFrontMatter(content);
      const diagramFile: KitFile = {
        ...diagram,
        frontMatter,
      };
      onViewDiagram(diagramFile);
    } catch (err) {
      console.error('Error loading diagram:', err);
    }
  };

  // Load diagrams on mount and set up file watcher
  useEffect(() => {
    loadDiagrams();

    // Set up file watcher for this project
    const setupWatcher = async () => {
      try {
        // Generate the event name (must match the Rust code)
        const sanitizedPath = projectPath
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .replace(/:/g, '_')
          .replace(/\./g, '_')
          .replace(/ /g, '_');
        const eventName = `project-kits-changed-${sanitizedPath}`;

        // Listen for file change events
        const unlisten = await listen(eventName, () => {
          console.log(`Diagrams directory changed for ${projectPath}, reloading...`);
          loadDiagrams();
        });

        // Cleanup: unlisten when component unmounts
        return () => {
          unlisten();
        };
      } catch (error) {
        console.error(`Failed to set up file watcher for ${projectPath}:`, error);
      }
    };

    const cleanup = setupWatcher();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [projectPath]);

  if (loading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading diagrams...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  if (diagrams.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon boxSize={12} color="text.tertiary">
                <LuNetwork />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No diagrams found</EmptyState.Title>
            <EmptyState.Description>
              Add .mmd or .mermaid files to .bluekit/diagrams to see them here.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
      {diagrams.map((diagram) => {
        const displayName = diagram.frontMatter?.alias || diagram.name;
        const description = diagram.frontMatter?.description || diagram.path;
        return (
          <Card.Root
            key={diagram.path}
            variant="subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            cursor="pointer"
            onClick={() => handleDiagramClick(diagram)}
            _hover={{ borderColor: "primary.400", bg: "primary.50" }}
            transition="all 0.2s"
          >
            <CardHeader>
              <HStack gap={2} align="center">
                <Icon boxSize={5} color="primary.500">
                  <LuNetwork />
                </Icon>
                <Heading size="md">{displayName}</Heading>
              </HStack>
            </CardHeader>
            <CardBody display="flex" flexDirection="column" flex="1">
              <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                {description}
              </Text>
              <Text fontSize="xs" color="text.tertiary" fontFamily="mono">
                {diagram.path}
              </Text>
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}

