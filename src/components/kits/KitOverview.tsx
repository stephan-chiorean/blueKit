import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  HStack,
  VStack,
  Tag,
  Icon,
  Separator,
  Flex,
  IconButton,
} from '@chakra-ui/react';
import { LuArrowLeft, LuPackage, LuBookOpen } from 'react-icons/lu';
import { ImTree } from 'react-icons/im';
import { KitFile } from '../../ipc';

interface KitOverviewProps {
  kit: KitFile;
  onBack?: () => void;
}

export default function KitOverview({ kit, onBack }: KitOverviewProps) {
  const displayName = kit.frontMatter?.alias || kit.name;
  const description = kit.frontMatter?.description || 'No description available';
  const isBase = kit.frontMatter?.is_base === true;
  const isWalkthrough = kit.frontMatter?.type === 'walkthrough';
  
  // Extract project path from kit path
  const projectPath = kit.path.split('/.bluekit/')[0] || kit.path;

  return (
    <Box h="100%" overflow="auto" bg="bg.subtle">
      <Card.Root 
        variant="elevated" 
        h="100%" 
        borderRadius={0}
        borderWidth={0}
      >
        <CardHeader 
          bg="white" 
          borderBottomWidth="1px" 
          borderColor="border.subtle"
          position="sticky"
          top={0}
          zIndex={1}
        >
          <Flex align="center" gap={3}>
            {onBack && (
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Back"
                onClick={onBack}
              >
                <LuArrowLeft />
              </IconButton>
            )}
            <Icon
              as={isWalkthrough ? LuBookOpen : LuPackage}
              boxSize={5}
              color="primary.500"
            />
            <HStack gap={2} align="center" flex="1">
              <Heading size="lg">
                {displayName}
              </Heading>
              {isBase && (
                <Icon
                  as={ImTree}
                  boxSize={5}
                  color="primary.500"
                  flexShrink={0}
                />
              )}
            </HStack>
          </Flex>
        </CardHeader>
        
        <CardBody p={6}>
          <VStack align="stretch" gap={6}>
            {/* Description */}
            <Box>
              <Text fontSize="md" color="text.secondary" lineHeight="1.7">
                {description}
              </Text>
            </Box>

            <Separator />

            {/* Metadata Tags */}
            {(kit.frontMatter?.tags || isBase || kit.frontMatter?.version) && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={3} color="text.secondary">
                  Tags
                </Text>
                <HStack gap={2} flexWrap="wrap">
                  {kit.frontMatter?.tags?.map((tag) => (
                    <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                      <Tag.Label>{tag}</Tag.Label>
                    </Tag.Root>
                  ))}
                  {isBase && (
                    <Tag.Root size="sm" variant="solid" colorPalette="primary">
                      <Icon as={ImTree} mr={1} />
                      <Tag.Label>Base</Tag.Label>
                    </Tag.Root>
                  )}
                  {isWalkthrough && (
                    <Tag.Root size="sm" variant="outline" colorPalette="blue">
                      <Tag.Label>Walkthrough</Tag.Label>
                    </Tag.Root>
                  )}
                  {kit.frontMatter?.version && (
                    <Tag.Root size="sm" variant="outline">
                      <Tag.Label>v{kit.frontMatter.version}</Tag.Label>
                    </Tag.Root>
                  )}
                </HStack>
              </Box>
            )}

            <Separator />

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

