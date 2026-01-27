import { useState, useEffect } from 'react';
import { Box, VStack, Spinner, Text } from '@chakra-ui/react';
import Header from '../components/Header';
import ResourceMarkdownViewer from '@/features/workstation/components/ResourceMarkdownViewer';
import { invokeReadFile } from '../ipc/files';
import { ResourceFile, ResourceType } from '../types/resource';

/**
 * Preview window page - displays resource content in a standalone window.
 *
 * URL format: /preview?resourceId=<path>&resourceType=<type>
 */
export default function PreviewWindowPage() {
  const [resource, setResource] = useState<ResourceFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResource = async () => {
      // Parse URL query parameters
      const params = new URLSearchParams(window.location.search);
      const resourceId = params.get('resourceId');
      const resourceType = params.get('resourceType');

      if (!resourceId || !resourceType) {
        setError('Missing resource ID or type');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Read file content
        const fileContent = await invokeReadFile(resourceId);

        // Parse front matter from content (simple YAML extraction)
        let frontMatter: any = {};
        if (fileContent.trim().startsWith('---')) {
          const endIndex = fileContent.indexOf('\n---', 4);
          if (endIndex !== -1) {
            const frontMatterText = fileContent.substring(4, endIndex);
            // Simple key-value parsing (more robust parsing could use yaml library)
            const lines = frontMatterText.split('\n');
            lines.forEach((line) => {
              const colonIndex = line.indexOf(':');
              if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                // Handle arrays (tags)
                if (key === 'tags' && value.startsWith('[')) {
                  frontMatter[key] = value
                    .slice(1, -1)
                    .split(',')
                    .map((t) => t.trim().replace(/['"]/g, ''));
                } else {
                  // Remove quotes from value
                  frontMatter[key] = value.replace(/^["']|["']$/g, '');
                }
              }
            });
          }
        }

        // Extract filename from path
        const fileName = resourceId.split('/').pop() || 'Unknown';
        const name = fileName.replace(/\.(md|markdown)$/, '');

        // Create ResourceFile object
        const resourceFile: ResourceFile = {
          path: resourceId,
          name,
          frontMatter,
          resourceType: resourceType as ResourceType,
        };

        setResource(resourceFile);
        setContent(fileContent);
      } catch (err) {
        console.error('Failed to load resource:', err);
        setError(err instanceof Error ? err.message : 'Failed to load resource');
      } finally {
        setLoading(false);
      }
    };

    loadResource();
  }, []);

  if (loading) {
    return (
      <VStack align="center" justify="center" h="100vh">
        <Spinner size="xl" />
        <Text mt={4} color="text.secondary">
          Loading resource...
        </Text>
      </VStack>
    );
  }

  if (error || !resource || !content) {
    return (
      <VStack align="center" justify="center" h="100vh">
        <Text color="red.500" fontSize="lg">
          {error || 'Failed to load resource'}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header */}
      <Box flexShrink={0}>
        <Header />
      </Box>

      {/* Content */}
      <Box flex="1" minH={0} overflow="auto">
        <ResourceMarkdownViewer resource={resource} content={content} />
      </Box>
    </VStack>
  );
}
