import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Tag,
  IconButton,
} from '@chakra-ui/react';
import { ArtifactFile } from '../../ipc';
import { LuMaximize2, LuMinimize2, LuStickyNote } from 'react-icons/lu';
import DraggableNotepad from './DraggableNotepad';

interface MermaidDiagramViewerProps {
  diagram: ArtifactFile;
  content: string;
}

export default function MermaidDiagramViewer({ diagram, content }: MermaidDiagramViewerProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayName = diagram.frontMatter?.alias || diagram.name;
  const scaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // Extract mermaid diagram code from content
  // Handles both raw mermaid code and markdown-wrapped code
  const extractMermaidCode = (content: string): string => {
    if (!content) return '';
    
    // Remove front matter if present (matches YAML front matter between --- markers)
    let cleaned = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
    
    // Try to match mermaid code block: ```mermaid ... ``` (non-greedy, handles trailing whitespace)
    const mermaidBlockMatch = cleaned.match(/```mermaid\s*\n([\s\S]*?)\n?```\s*$/m);
    if (mermaidBlockMatch && mermaidBlockMatch[1]) {
      return mermaidBlockMatch[1].trim();
    }
    
    // Try to match generic code block: ``` ... ``` (non-greedy, handles trailing whitespace)
    const genericBlockMatch = cleaned.match(/```\s*\n([\s\S]*?)\n?```\s*$/m);
    if (genericBlockMatch && genericBlockMatch[1]) {
      return genericBlockMatch[1].trim();
    }
    
    // If no code fences found, assume the entire remaining content is mermaid code
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
    if (!diagramRef.current || !content) {
      console.log('MermaidDiagramViewer: Missing ref or content', { hasRef: !!diagramRef.current, hasContent: !!content });
      return;
    }

    // Clear previous content
    diagramRef.current.innerHTML = '';

    // Extract the mermaid code
    const mermaidCode = extractMermaidCode(content);
    console.log('MermaidDiagramViewer: Extracted code', {
      contentLength: content.length,
      mermaidCodeLength: mermaidCode.length,
      mermaidCodePreview: mermaidCode.substring(0, 100)
    });

    if (!mermaidCode) {
      console.warn('MermaidDiagramViewer: No mermaid code found in content');
      if (diagramRef.current) {
        diagramRef.current.innerHTML = '<p style="color: red;">No mermaid diagram code found</p>';
      }
      return;
    }

    // Create a unique ID for this diagram
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Render the diagram
    console.log('MermaidDiagramViewer: Attempting to render diagram', { id, codeLength: mermaidCode.length });
    mermaid.render(id, mermaidCode).then((result) => {
      console.log('MermaidDiagramViewer: Render successful', { svgLength: result.svg?.length });
      if (diagramRef.current) {
        diagramRef.current.innerHTML = result.svg;
      }
    }).catch((error) => {
      console.error('MermaidDiagramViewer: Error rendering mermaid diagram:', error);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = `<p style="color: red;">Error rendering diagram: ${error.message}</p>`;
      }
    });
  }, [content, diagram.path]);

  // Smooth transform update using requestAnimationFrame
  const updateTransform = (isTransforming = true) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const diagram = diagramRef.current;
      if (!diagram) return;

      const { x, y } = positionRef.current;
      const scale = scaleRef.current;
      diagram.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      diagram.style.willChange = isTransforming ? 'transform' : 'auto';
    });
  };

  // Handle zoom with wheel/trackpad
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let wheelTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      // Check if this is a pinch gesture (ctrlKey is set for pinch on trackpad)
      if (e.ctrlKey) {
        e.preventDefault();

        const delta = -e.deltaY;
        const scaleChange = delta > 0 ? 1.02 : 0.98;
        scaleRef.current = Math.min(Math.max(1.0, scaleRef.current * scaleChange), 5);

        updateTransform(true);

        // Clear will-change after transform is done
        if (wheelTimeout) clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => updateTransform(false), 150);
      } else {
        // Regular trackpad scroll for panning
        e.preventDefault();
        positionRef.current = {
          x: positionRef.current.x - e.deltaX,
          y: positionRef.current.y - e.deltaY,
        };

        updateTransform(true);

        // Clear will-change after transform is done
        if (wheelTimeout) clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => updateTransform(false), 150);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelTimeout) clearTimeout(wheelTimeout);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle panning with mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    startPanRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    positionRef.current = {
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y,
    };
    updateTransform(true);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    updateTransform(false);
  };

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
          
          {/* Metadata Tags */}
          {diagram.frontMatter?.tags && diagram.frontMatter.tags.length > 0 && (
            <HStack gap={2} flexWrap="wrap" mt={4}>
              {diagram.frontMatter.tags.map((tag) => (
                <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="primary">
                  <Tag.Label>{tag}</Tag.Label>
                </Tag.Root>
              ))}
            </HStack>
          )}
        </Box>

        {/* Diagram */}
        <Box
          ref={containerRef}
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          p={4}
          bg="white"
          overflow="hidden"
          position={isFullscreen ? 'fixed' : 'relative'}
          top={isFullscreen ? 0 : undefined}
          left={isFullscreen ? 0 : undefined}
          right={isFullscreen ? 0 : undefined}
          bottom={isFullscreen ? 0 : undefined}
          minHeight={isFullscreen ? undefined : "70vh"}
          zIndex={isFullscreen ? 9999 : undefined}
          cursor={isPanning ? 'grabbing' : 'grab'}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <IconButton
            position="absolute"
            top={4}
            right={4}
            zIndex={10}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={() => setIsFullscreen(!isFullscreen)}
            size="sm"
            variant="ghost"
          >
            {isFullscreen ? <LuMinimize2 /> : <LuMaximize2 />}
          </IconButton>
          <IconButton
            position="absolute"
            top={4}
            right={isFullscreen ? 16 : 16}
            transform={isFullscreen ? 'translateX(-40px)' : 'translateX(-40px)'}
            zIndex={10}
            aria-label={isNotepadOpen ? 'Close notepad' : 'Open notepad'}
            onClick={() => setIsNotepadOpen(!isNotepadOpen)}
            size="sm"
            variant="ghost"
          >
            <LuStickyNote />
          </IconButton>
          <Box
            ref={diagramRef}
            style={{
              transformOrigin: 'center',
            }}
          />
          {/* Draggable Notepad */}
          <DraggableNotepad
            isOpen={isNotepadOpen}
            onClose={() => setIsNotepadOpen(false)}
          />
        </Box>
      </VStack>
    </Box>
  );
}

