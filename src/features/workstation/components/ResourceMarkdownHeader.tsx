import { useState, useMemo } from 'react';
import { heading1Color } from '@/theme';
import {
  Box,
  Heading,
  Text,
  Separator,
  HStack,
  Tag,
  VStack,
  Link,
  Flex,
  Button,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { ResourceFile, ResourceType } from '@/types/resource';
import { LiquidViewModeSwitcher } from '@/features/kits/components/LiquidViewModeSwitcher';
import { FaEye, FaCode } from 'react-icons/fa';
import { LuChevronDown, LuChevronUp, LuLink } from 'react-icons/lu';
import { useResource } from '@/shared/contexts/ResourceContext';
import { useProjectArtifacts } from '@/shared/contexts/ProjectArtifactsContext';
import { invokeReadFile, ArtifactFile } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import { parseFrontMatter } from '@/shared/utils/parseFrontMatter';
import { extractOutboundLinks, findBacklinks, resolveOutboundLinks } from '@/shared/utils/extractMarkdownLinks';
import path from 'path';

interface ResourceMarkdownHeaderProps {
  resource: ResourceFile;
  content: string;
  viewMode: 'preview' | 'source';
  onViewModeChange: (mode: 'preview' | 'source') => void;
}

export function ResourceMarkdownHeader({
  resource,
  content,
  viewMode,
  onViewModeChange,
}: ResourceMarkdownHeaderProps) {
  const displayName = resource.name.replace(/\.(md|markdown)$/i, '');
  const [linksExpanded, setLinksExpanded] = useState(false);
  const { setSelectedResource } = useResource();
  const { artifacts: allArtifacts } = useProjectArtifacts();

  // Compute outbound links from this resource
  const outboundLinks = useMemo(() => {
    const links = extractOutboundLinks(content);
    return resolveOutboundLinks(resource.path, links);
  }, [content, resource.path]);

  // Compute backlinks to this resource
  const backlinks = useMemo(() => {
    if (!allArtifacts || allArtifacts.length === 0) return [];
    return findBacklinks(resource.path, allArtifacts);
  }, [resource.path, allArtifacts]);

  // Group backlinks by type for organized display
  const groupedBacklinks = useMemo(() => {
    const groups: Record<string, typeof backlinks> = {};
    backlinks.forEach(backlink => {
      const type = backlink.resourceType;
      if (!groups[type]) groups[type] = [];
      groups[type].push(backlink);
    });
    return groups;
  }, [backlinks]);

  return (
    <>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={4}>
        <Box>
          <Heading
            size="xl"
            mb={2}
            css={{
              color: heading1Color.light,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              _dark: {
                color: heading1Color.dark,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              },
            }}
          >
            {displayName}
          </Heading>
          {resource.frontMatter?.description && (
            <Text
              fontSize="lg"
              color="text.secondary"
              mb={4}
              css={{
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                _dark: {
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              {resource.frontMatter.description}
            </Text>
          )}

          {/* Metadata Tags */}
          <HStack gap={2} flexWrap="wrap" mt={4}>
            {resource.frontMatter?.tags && resource.frontMatter.tags.map((tag) => (
              <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                <Tag.Label>{tag}</Tag.Label>
              </Tag.Root>
            ))}
            {resource.frontMatter?.is_base && (
              <Tag.Root size="sm" variant="solid" colorPalette="primary">
                <Tag.Label>Base</Tag.Label>
              </Tag.Root>
            )}
            {resource.frontMatter?.version && (
              <Tag.Root size="sm" variant="outline">
                <Tag.Label>v{resource.frontMatter.version}</Tag.Label>
              </Tag.Root>
            )}
          </HStack>

          <Box mt={4} width="fit-content">
            <LiquidViewModeSwitcher
              value={viewMode}
              onChange={onViewModeChange}
              modes={[
                { id: 'preview', label: 'Preview', icon: FaEye },
                { id: 'source', label: 'Source', icon: FaCode },
              ]}
            />
          </Box>

          {/* Links Button - matches filter button styling */}
          {(outboundLinks.length > 0 || backlinks.length > 0) && (
            <Box mt={4} width="fit-content">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLinksExpanded(!linksExpanded)}
                borderWidth="1px"
                borderRadius="lg"
                css={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
                  transition: 'none',
                  _dark: {
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.3)',
                  },
                }}
              >
                <HStack gap={2}>
                  <Icon>
                    <LuLink />
                  </Icon>
                  <Text>Links</Text>
                  <Badge size="sm" colorPalette="primary" variant="solid">
                    {outboundLinks.length + backlinks.length}
                  </Badge>
                  <Icon>
                    {linksExpanded ? <LuChevronUp /> : <LuChevronDown />}
                  </Icon>
                </HStack>
              </Button>
            </Box>
          )}
        </Box>
      </Flex>

      <Separator />

      {/* Links Section - Collapsible */}
      {linksExpanded && (outboundLinks.length > 0 || backlinks.length > 0) && (
        <>
          <Box>
            <Heading size="sm" mb={3} color="text.secondary">
              Links
            </Heading>

            <VStack align="stretch" gap={4}>
              {/* Outbound Links */}
              {outboundLinks.length > 0 && (
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={2} fontWeight="semibold">
                    Links from this {resource.resourceType || 'kit'}
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    {outboundLinks.map((link, index) => (
                      <Link
                        key={index}
                        onClick={async () => {
                          try {
                            // Load and navigate to target
                            const targetContent = await invokeReadFile(link.absolutePath);
                            const frontMatter = parseFrontMatter(targetContent);
                            const fileName = path.basename(link.absolutePath, path.extname(link.absolutePath));
                            const resourceType: ResourceType = link.absolutePath.endsWith('.mmd') || link.absolutePath.endsWith('.mermaid')
                              ? 'diagram'
                              : (frontMatter?.type as ResourceType) || 'kit';

                            const targetResource: ArtifactFile = {
                              name: fileName,
                              path: link.absolutePath,
                              content: targetContent,
                              frontMatter,
                            };

                            setSelectedResource(targetResource, targetContent, resourceType);
                          } catch (error) {
                            console.error('Failed to navigate:', error);
                            toaster.create({
                              type: 'error',
                              title: 'Failed to open file',
                              description: `Could not load ${link.path}: ${error}`,
                            });
                          }
                        }}
                        cursor="pointer"
                        color="primary.500"
                        fontSize="sm"
                        textDecoration="underline"
                        _hover={{ color: 'primary.600' }}
                      >
                        {link.text}
                      </Link>
                    ))}
                  </HStack>
                </Box>
              )}

              {/* Backlinks */}
              {backlinks.length > 0 && (
                <Box>
                  <Text fontSize="xs" color="text.tertiary" mb={2} fontWeight="semibold">
                    Linked by {backlinks.length} other {backlinks.length === 1 ? 'resource' : 'resources'}
                  </Text>

                  {/* Group by type */}
                  {Object.entries(groupedBacklinks).map(([type, links]) => (
                    <Box key={type} mb={2}>
                      <Text fontSize="xs" color="text.muted" mb={1}>
                        {type}s
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        {links.map((backlink, index) => {
                          const displayName = backlink.source.frontMatter?.alias || backlink.source.name;
                          return (
                            <Link
                              key={index}
                              onClick={async () => {
                                try {
                                  // Navigate to source resource
                                  const sourceContent = backlink.source.content || await invokeReadFile(backlink.source.path);
                                  setSelectedResource(backlink.source, sourceContent, backlink.resourceType);
                                } catch (error) {
                                  console.error('Failed to navigate:', error);
                                  toaster.create({
                                    type: 'error',
                                    title: 'Failed to open file',
                                    description: `Could not load ${backlink.source.name}: ${error}`,
                                  });
                                }
                              }}
                              cursor="pointer"
                              color="primary.500"
                              fontSize="sm"
                              textDecoration="underline"
                              _hover={{ color: 'primary.600' }}
                            >
                              {displayName}
                            </Link>
                          );
                        })}
                      </HStack>
                    </Box>
                  ))}
                </Box>
              )}
            </VStack>
          </Box>

          <Separator />
        </>
      )}
    </>
  );
}

