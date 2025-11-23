import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Tabs,
  Flex,
  VStack,
  Text,
  HStack,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import NavigationMenu, { MenuButton } from '../components/NavigationDrawer';
import Header from '../components/Header';
import { invokeGetProjectKits, KitFile } from '../ipc';

interface ProjectData {
  id: string;
  title: string;
  description: string;
  path: string;
}

interface ProjectViewProps {
  project: ProjectData;
  onBack: () => void;
}

export default function ProjectView({ project, onBack }: ProjectViewProps) {
  const [kits, setKits] = useState<KitFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadKits = async () => {
      try {
        setLoading(true);
        setError(null);
        const projectKits = await invokeGetProjectKits(project.path);
        setKits(projectKits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load kits');
        console.error('Error loading kits:', err);
      } finally {
        setLoading(false);
      }
    };

    loadKits();
  }, [project.path]);

  return (
    <Box position="relative" minH="100vh" bg="main.bg">
      <VStack align="stretch" gap={0}>
        <Header />
        
        <Box flex="1" p={6} position="relative">
          <NavigationMenu>
            {({ onOpen }) => <MenuButton onClick={onOpen} />}
          </NavigationMenu>
          <Flex align="center" gap={4} mb={6}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
            >
              <HStack gap={2}>
                <LuArrowLeft />
                <Text>Back</Text>
              </HStack>
            </Button>
            <Heading size="lg">{project.title}</Heading>
          </Flex>

          <Tabs.Root defaultValue="kits" variant="enclosed">
            <Flex justify="center" mb={6}>
              <Tabs.List>
                <Tabs.Trigger value="kits">Kits</Tabs.Trigger>
                <Tabs.Trigger value="blueprints">Blueprints</Tabs.Trigger>
                <Tabs.Trigger value="configuration">Configuration</Tabs.Trigger>
              </Tabs.List>
            </Flex>

            <Tabs.Content value="kits">
              {loading ? (
                <Box textAlign="center" py={12} color="gray.500">
                  Loading kits...
                </Box>
              ) : error ? (
                <Box textAlign="center" py={12} color="red.500">
                  Error: {error}
                </Box>
              ) : kits.length === 0 ? (
                <Box textAlign="center" py={12} color="gray.500">
                  No kits found in .bluekit directory.
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                  {kits.map((kit) => (
                    <Card.Root key={kit.path} variant="subtle">
                      <CardHeader>
                        <Heading size="md">{kit.name}</Heading>
                      </CardHeader>
                      <CardBody>
                        <Text fontSize="sm" color="gray.500" mb={4}>
                          {kit.path}
                        </Text>
                        <Flex gap={2}>
                          <Button size="sm" variant="subtle">
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            Use
                          </Button>
                        </Flex>
                      </CardBody>
                    </Card.Root>
                  ))}
                </SimpleGrid>
              )}
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <Box textAlign="center" py={12} color="gray.500">
                Blueprints content coming soon...
              </Box>
            </Tabs.Content>
            <Tabs.Content value="configuration">
              <Box textAlign="center" py={12} color="gray.500">
                Configuration content coming soon...
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </VStack>
    </Box>
  );
}

