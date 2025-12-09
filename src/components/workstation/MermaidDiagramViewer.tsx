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
import { useColorMode } from '../../contexts/ColorModeContext';

interface MermaidDiagramViewerProps {
  diagram: ArtifactFile;
  content: string;
}

export default function MermaidDiagramViewer({ diagram, content }: MermaidDiagramViewerProps) {
  const { colorMode } = useColorMode();
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
    // Define custom BlueKit theme variables
    // BlueKit primary blue: #4287f5
    const bluekitPrimary = '#4287f5';
    const bluekitPrimaryLight = '#60a5fa';
    const bluekitPrimaryDark = '#2563eb';
    
    if (colorMode === 'dark') {
      // Dark mode theme with BlueKit blue and darker backgrounds
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'dark',
        themeVariables: {
          // Primary colors - BlueKit blue
          primaryColor: '#1e293b',
          primaryTextColor: '#bfdbfe',
          primaryBorderColor: bluekitPrimary,
          lineColor: bluekitPrimary,
          arrowheadColor: bluekitPrimary,
          
          // Backgrounds - darker for better contrast
          background: '#0f172a',
          mainBkg: '#1e293b',
          secondBkg: '#334155',
          tertiaryBkg: '#475569',
          
          // Text colors - lighter for visibility
          textColor: '#bfdbfe',
          secondaryTextColor: '#93c5fd',
          tertiaryTextColor: '#60a5fa',
          lineTextColor: '#bfdbfe',
          labelColor: '#bfdbfe',
          
          // Borders - BlueKit blue
          border1: bluekitPrimary,
          border2: bluekitPrimaryLight,
          
          // Actor/Node colors - darker blue backgrounds
          actorBorder: bluekitPrimary,
          actorBkg: '#1e3a8a',
          actorTextColor: '#bfdbfe',
          actorLineColor: bluekitPrimary,
          
          // Signal/Flow colors
          signalColor: bluekitPrimary,
          signalTextColor: '#bfdbfe',
          
          // Label boxes
          labelBoxBkgColor: '#1e293b',
          labelBoxBorderColor: bluekitPrimary,
          labelTextColor: '#bfdbfe',
          labelBackground: '#1e293b',
          
          // Notes - darker blue background
          noteBorderColor: bluekitPrimary,
          noteBkgColor: '#1e3a8a',
          noteTextColor: '#bfdbfe',
          
          // Activation boxes - darker blue background
          activationBorderColor: bluekitPrimary,
          activationBkgColor: '#1e3a8a',
          sequenceNumberColor: '#bfdbfe',
          
          // Sections - darker blue background
          sectionBkgColor: '#1e3a8a',
          altBkgColor: '#334155',
          exclBkgColor: '#991b1b',
          
          // Tasks - darker blue background
          taskBorderColor: bluekitPrimary,
          taskBkgColor: '#1e3a8a',
          taskTextColor: '#bfdbfe',
          taskTextLightColor: '#bfdbfe',
          taskTextDarkColor: '#bfdbfe',
          taskTextOutsideColor: '#bfdbfe',
          taskTextClickableColor: bluekitPrimaryLight,
          activeTaskBorderColor: bluekitPrimaryLight,
          activeTaskBkgColor: '#172554',
          doneTaskBkgColor: '#065f46',
          doneTaskBorderColor: '#10b981',
          critBorderColor: '#dc2626',
          critBkgColor: '#991b1b',
          
          // Other
          gridColor: bluekitPrimary,
          todayLineColor: '#ef4444',
          errorBkgColor: '#7f1d1d',
          errorTextColor: '#fca5a5',
          loopTextColor: '#bfdbfe',
        },
      });
    } else {
      // Light mode theme with BlueKit blue
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        themeVariables: {
          // Primary colors - BlueKit blue
          primaryColor: '#ffffff',
          primaryTextColor: '#1f2937',
          primaryBorderColor: bluekitPrimary,
          lineColor: bluekitPrimary,
          arrowheadColor: bluekitPrimary,
          
          // Backgrounds
          background: '#ffffff',
          mainBkg: '#ffffff',
          secondBkg: '#f3f4f6',
          tertiaryBkg: '#e5e7eb',
          
          // Text colors
          textColor: '#1f2937',
          secondaryTextColor: '#4b5563',
          tertiaryTextColor: '#6b7280',
          lineTextColor: '#1f2937',
          labelColor: '#1f2937',
          
          // Borders - BlueKit blue
          border1: bluekitPrimary,
          border2: bluekitPrimaryDark,
          
          // Actor/Node colors
          actorBorder: bluekitPrimary,
          actorBkg: '#eff6ff',
          actorTextColor: '#1f2937',
          actorLineColor: bluekitPrimary,
          
          // Signal/Flow colors
          signalColor: bluekitPrimary,
          signalTextColor: '#1f2937',
          
          // Label boxes
          labelBoxBkgColor: '#ffffff',
          labelBoxBorderColor: bluekitPrimary,
          labelTextColor: '#1f2937',
          labelBackground: '#ffffff',
          
          // Notes
          noteBorderColor: bluekitPrimary,
          noteBkgColor: '#eff6ff',
          noteTextColor: '#1f2937',
          
          // Activation boxes
          activationBorderColor: bluekitPrimary,
          activationBkgColor: '#dbeafe',
          sequenceNumberColor: '#ffffff',
          
          // Sections
          sectionBkgColor: '#eff6ff',
          altBkgColor: '#f3f4f6',
          exclBkgColor: '#fee2e2',
          
          // Tasks
          taskBorderColor: bluekitPrimary,
          taskBkgColor: '#eff6ff',
          taskTextColor: '#1f2937',
          taskTextLightColor: '#ffffff',
          taskTextDarkColor: '#1f2937',
          taskTextOutsideColor: '#1f2937',
          taskTextClickableColor: bluekitPrimaryDark,
          activeTaskBorderColor: bluekitPrimaryDark,
          activeTaskBkgColor: '#dbeafe',
          doneTaskBkgColor: '#d1fae5',
          doneTaskBorderColor: '#10b981',
          critBorderColor: '#ef4444',
          critBkgColor: '#fee2e2',
          
          // Other
          gridColor: bluekitPrimary,
          todayLineColor: '#ef4444',
          errorBkgColor: '#fee2e2',
          errorTextColor: '#dc2626',
          loopTextColor: '#1f2937',
        },
      });
    }
  }, [colorMode]);

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
        
        // Apply BlueKit blue to arrows and lines after render
        // This ensures all diagram types use the correct colors
        const svg = diagramRef.current.querySelector('svg');
        if (svg) {
          const bluekitBlue = '#4287f5';
          
          // Style arrows (marker elements)
          const markers = svg.querySelectorAll('marker');
          markers.forEach((marker) => {
            const path = marker.querySelector('path');
            if (path) {
              path.setAttribute('fill', bluekitBlue);
              path.setAttribute('stroke', bluekitBlue);
            }
          });
          
          // Style lines and paths (arrows, connectors)
          const paths = svg.querySelectorAll('path[stroke]');
          paths.forEach((path) => {
            const stroke = path.getAttribute('stroke');
            // Only change if it's a line/arrow color (not text or other elements)
            if (stroke && stroke !== 'none' && !stroke.includes('rgb(0,0,0)') && !stroke.includes('#000')) {
              path.setAttribute('stroke', bluekitBlue);
            }
          });
          
          // Style polyline arrows
          const polylines = svg.querySelectorAll('polyline[stroke]');
          polylines.forEach((polyline) => {
            const stroke = polyline.getAttribute('stroke');
            if (stroke && stroke !== 'none' && !stroke.includes('rgb(0,0,0)') && !stroke.includes('#000')) {
              polyline.setAttribute('stroke', bluekitBlue);
            }
          });
          
          // Make text more visible in dark mode
          if (colorMode === 'dark') {
            const textElements = svg.querySelectorAll('text');
            textElements.forEach((text) => {
              const fill = text.getAttribute('fill');
              // Only update if it's dark text that would be hard to see
              if (!fill || fill === '#000' || fill === 'rgb(0,0,0)' || fill === '#333' || fill === '#1f2937') {
                text.setAttribute('fill', '#bfdbfe');
              }
            });
            
            // Darken background rectangles for better contrast
            const rects = svg.querySelectorAll('rect[fill]');
            rects.forEach((rect) => {
              const fill = rect.getAttribute('fill');
              if (!fill || fill === 'none') return;
              
              // White/very light backgrounds -> darker blue
              if (fill === '#fff' || fill === '#ffffff' || fill === 'rgb(255,255,255)' || 
                  fill.includes('rgb(255,255,255)') || fill === '#f9fafb' || fill === '#f3f4f6') {
                rect.setAttribute('fill', '#1e3a8a');
              }
              // Light gray backgrounds -> darker gray
              else if (fill === '#e5e7eb' || fill === '#d1d5db' || fill.includes('rgb(229')) {
                rect.setAttribute('fill', '#334155');
              }
              // Light blue backgrounds (#eff6ff, #dbeafe, #bfdbfe, #93c5fd, #60a5fa, #1e40af) -> darker blue
              else if (fill === '#eff6ff' || fill === '#dbeafe' || fill === '#bfdbfe' || 
                       fill === '#93c5fd' || fill === '#60a5fa' || fill === '#1e40af' ||
                       fill.includes('rgb(239,246,255)') || fill.includes('rgb(219,234,254)') ||
                       fill.includes('rgb(191,219,254)') || fill.includes('rgb(147,197,253)') ||
                       fill.includes('rgb(96,165,250)') || fill.includes('rgb(30,64,175)')) {
                rect.setAttribute('fill', '#1e3a8a');
              }
              // Light green backgrounds -> darker green
              else if (fill === '#d1fae5' || fill === '#a7f3d0' || fill === '#6ee7b7' ||
                       fill === '#34d399' || fill === '#10b981' || fill === '#059669' ||
                       fill.includes('rgb(209,250,229)') || fill.includes('rgb(167,243,208)') ||
                       fill.includes('rgb(110,231,183)') || fill.includes('rgb(52,211,153)') ||
                       fill.includes('rgb(16,185,129)') || fill.includes('rgb(5,150,105)')) {
                rect.setAttribute('fill', '#065f46');
              }
              // Light red/pink backgrounds -> darker red
              else if (fill === '#fee2e2' || fill === '#fecaca' || fill === '#fca5a5' ||
                       fill === '#f87171' || fill === '#ef4444' || fill === '#dc2626' ||
                       fill === '#7f1d1d' || fill.includes('rgb(254,226,226)') ||
                       fill.includes('rgb(254,202,202)') || fill.includes('rgb(252,165,165)') ||
                       fill.includes('rgb(248,113,113)') || fill.includes('rgb(239,68,68)') ||
                       fill.includes('rgb(220,38,38)') || fill.includes('rgb(127,29,29)')) {
                rect.setAttribute('fill', '#991b1b');
              }
              // Light purple backgrounds -> darker purple
              else if (fill === '#f3e8ff' || fill === '#e9d5ff' || fill === '#ddd6fe' ||
                       fill === '#c4b5fd' || fill === '#a78bfa' || fill === '#8b5cf6' ||
                       fill.includes('rgb(243,232,255)') || fill.includes('rgb(233,213,255)') ||
                       fill.includes('rgb(221,214,254)') || fill.includes('rgb(196,181,253)') ||
                       fill.includes('rgb(167,139,250)') || fill.includes('rgb(139,92,246)')) {
                rect.setAttribute('fill', '#6b21a8');
              }
              // Light yellow/orange backgrounds -> darker orange
              else if (fill === '#fef3c7' || fill === '#fde68a' || fill === '#fcd34d' ||
                       fill === '#fbbf24' || fill === '#f59e0b' || fill === '#d97706' ||
                       fill.includes('rgb(254,243,199)') || fill.includes('rgb(253,230,138)') ||
                       fill.includes('rgb(252,211,77)') || fill.includes('rgb(251,191,36)') ||
                       fill.includes('rgb(245,158,11)') || fill.includes('rgb(217,119,6)')) {
                rect.setAttribute('fill', '#92400e');
              }
            });
            
            // Also darken polygons (used for some shapes)
            const polygons = svg.querySelectorAll('polygon[fill]');
            polygons.forEach((polygon) => {
              const fill = polygon.getAttribute('fill');
              if (!fill || fill === 'none') return;
              
              // Apply same darkening logic as rectangles
              if (fill === '#fff' || fill === '#ffffff' || fill === 'rgb(255,255,255)') {
                polygon.setAttribute('fill', '#1e3a8a');
              } else if (fill === '#eff6ff' || fill === '#dbeafe' || fill === '#1e40af' ||
                         fill.includes('rgb(239,246,255)') || fill.includes('rgb(219,234,254)') ||
                         fill.includes('rgb(30,64,175)')) {
                polygon.setAttribute('fill', '#1e3a8a');
              } else if (fill === '#d1fae5' || fill.includes('rgb(209,250,229)')) {
                polygon.setAttribute('fill', '#065f46');
              } else if (fill === '#fee2e2' || fill === '#7f1d1d' || fill.includes('rgb(254,226,226)')) {
                polygon.setAttribute('fill', '#991b1b');
              }
            });
          }
        }
      }
    }).catch((error) => {
      console.error('MermaidDiagramViewer: Error rendering mermaid diagram:', error);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = `<p style="color: red;">Error rendering diagram: ${error.message}</p>`;
      }
    });
  }, [content, diagram.path, colorMode]);

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
          bg="bg.surface"
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

