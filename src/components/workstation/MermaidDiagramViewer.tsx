import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import {
  Box,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';
import { KitFile } from '../../ipc';

interface MermaidDiagramViewerProps {
  diagram: KitFile;
  content: string;
}

export default function MermaidDiagramViewer({ diagram, content }: MermaidDiagramViewerProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const displayName = diagram.frontMatter?.alias || diagram.name;

  // Extract mermaid diagram code from content
  // Handles both raw mermaid code and markdown-wrapped code
  const extractMermaidCode = (content: string): string => {
    // Remove front matter if present
    let cleaned = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
    
    // Remove markdown code fences (```mermaid ... ```)
    cleaned = cleaned.replace(/```mermaid\s*\n?/gi, '');
    cleaned = cleaned.replace(/```\s*$/gm, '');
    
    // Also handle if it's wrapped in ``` without mermaid tag
    cleaned = cleaned.replace(/^```\s*\n?/gm, '');
    cleaned = cleaned.replace(/```\s*$/gm, '');
    
    return cleaned.trim();
  };

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });
  }, []);

  useEffect(() => {
    if (!diagramRef.current || !content) return;

    // Clear previous content
    diagramRef.current.innerHTML = '';

    // Extract the mermaid code
    const mermaidCode = extractMermaidCode(content);
    
    if (!mermaidCode) {
      if (diagramRef.current) {
        diagramRef.current.innerHTML = '<p style="color: red;">No mermaid diagram code found</p>';
      }
      return;
    }

    // Create a unique ID for this diagram
    const id = `mermaid-${diagram.path.replace(/[^a-zA-Z0-9]/g, '-')}`;

    // Render the diagram
    mermaid.render(id, mermaidCode).then((result) => {
      if (diagramRef.current) {
        diagramRef.current.innerHTML = result.svg;
      }
    }).catch((error) => {
      console.error('Error rendering mermaid diagram:', error);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = `<p style="color: red;">Error rendering diagram: ${error.message}</p>`;
      }
    });
  }, [content, diagram.path]);

  return (
    <Box p={6} maxW="100%" h="100%" overflow="auto" bg="transparent">
      <VStack align="stretch" gap={6}>
        {/* Header */}
        <Box bg="transparent">
          <Heading size="xl" mb={2}>
            {displayName}
          </Heading>
          {diagram.frontMatter?.description && (
            <Text fontSize="lg" color="text.secondary" mb={4}>
              {diagram.frontMatter.description}
            </Text>
          )}
        </Box>

        {/* Diagram */}
        <Box
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          p={4}
          bg="white"
          overflow="auto"
        >
          <Box ref={diagramRef} />
        </Box>
      </VStack>
    </Box>
  );
}

