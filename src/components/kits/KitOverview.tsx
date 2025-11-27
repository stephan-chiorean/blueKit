import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  Text,
  VStack,
  Button,
  Flex,
  Status,
  HStack,
  Icon,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import { KitFile, invokeGetProjectRegistry } from '../../ipc';

interface KitOverviewProps {
  kit: KitFile;
  onBack?: () => void;
}

export default function KitOverview({ kit, onBack }: KitOverviewProps) {
  // Extract project path from kit path
  const projectPath = kit.path.split('/.bluekit/')[0] || kit.path;
  const [isLinked, setIsLinked] = useState<boolean | null>(null);

  useEffect(() => {
    const checkProjectStatus = async () => {
      try {
        const projects = await invokeGetProjectRegistry();
        const isProjectLinked = projects.some(
          (project) => project.path === projectPath
        );
        setIsLinked(isProjectLinked);
      } catch (error) {
        console.error('Failed to check project status:', error);
        setIsLinked(false);
      }
    };

    checkProjectStatus();
  }, [projectPath]);

  return (
    <Box h="100%" overflow="auto" bg="bg.subtle">
      <Card.Root 
        variant="elevated" 
        h="100%" 
        borderRadius={0}
        borderWidth={0}
        bg="bg.subtle"
      >
        <CardBody p={6}>
          <VStack align="stretch" gap={6}>
            {/* Back Button */}
            {onBack && (
              <Flex>
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
              </Flex>
            )}
            
            {/* Project Status */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="text.secondary">
                Project Status
              </Text>
              <Status.Root
                colorPalette={isLinked === true ? 'green' : isLinked === false ? 'red' : 'gray'}
              >
                <Status.Indicator />
                {isLinked === true ? 'Linked' : isLinked === false ? 'Disconnected' : 'Checking...'}
              </Status.Root>
            </Box>
            
            {/* File Information */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="text.secondary">
                File Information
              </Text>
              <VStack align="stretch" gap={2}>
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={1}>
                    Name
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="text">
                    {kit.name}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={1}>
                    Path
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="text" wordBreak="break-all">
                    {kit.path}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={1}>
                    Project
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" color="text" wordBreak="break-all">
                    {projectPath}
                  </Text>
                </Box>
              </VStack>
            </Box>
          </VStack>
        </CardBody>
      </Card.Root>
    </Box>
  );
}

