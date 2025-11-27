import {
  Box,
  Card,
  CardBody,
  Text,
  VStack,
  IconButton,
  Flex,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import { KitFile } from '../../ipc';

interface KitOverviewProps {
  kit: KitFile;
  onBack?: () => void;
}

export default function KitOverview({ kit, onBack }: KitOverviewProps) {
  // Extract project path from kit path
  const projectPath = kit.path.split('/.bluekit/')[0] || kit.path;

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
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Back"
                  onClick={onBack}
                >
                  <LuArrowLeft />
                </IconButton>
              </Flex>
            )}
            
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

