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

// Color palette array - colors are assigned sequentially to classes
// Each entry is a light/dark color pair
const CLASS_COLOR_PALETTE: Array<{ light: string; dark: string }> = [
  // Architecture layers
  { light: '#e3f2fd', dark: '#0c4a6e' },
  { light: '#fff3e0', dark: '#7c2d12' },
  { light: '#f3e5f5', dark: '#581c87' },
  { light: '#e8f5e9', dark: '#14532d' },
  { light: '#fff9c4', dark: '#78350f' },
  { light: '#fce4ec', dark: '#831843' },
  { light: '#e0f2f1', dark: '#134e4a' },
  { light: '#f5f5f5', dark: '#1f2937' },
  { light: '#e1f5fe', dark: '#0c4a6e' },
  { light: '#ffebee', dark: '#7f1d1d' },
  
  // Common component types
  { light: '#dbeafe', dark: '#1e40af' },
  { light: '#bfdbfe', dark: '#3b82f6' },
  { light: '#e0e7ff', dark: '#4338ca' },
  
  // Data flow
  { light: '#dcfce7', dark: '#166534' },
  { light: '#fef3c7', dark: '#92400e' },
  { light: '#e0e7ff', dark: '#4338ca' },
  
  // Status/State
  { light: '#dcfce7', dark: '#166534' },
  { light: '#f3f4f6', dark: '#374151' },
  { light: '#fee2e2', dark: '#991b1b' },
  { light: '#fef3c7', dark: '#92400e' },
  { light: '#d1fae5', dark: '#065f46' },
  
  // Process types
  { light: '#e0f2fe', dark: '#0c4a6e' },
  { light: '#f3e8ff', dark: '#6b21a8' },
  { light: '#fef3c7', dark: '#92400e' },
  { light: '#e0f2f1', dark: '#134e4a' },
  
  // Generic categories
  { light: '#eff6ff', dark: '#1e3a8a' },
  { light: '#f3f4f6', dark: '#374151' },
  { light: '#f9fafb', dark: '#1f2937' },
];

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

  // Mermaid is now initialized globally in ColorModeContext
  // No need to initialize here - it's already done when color mode changes

  useEffect(() => {
    if (!diagramRef.current || !content) {
      console.log('MermaidDiagramViewer: Missing ref or content', { hasRef: !!diagramRef.current, hasContent: !!content });
      return;
    }

    // When color mode changes, Mermaid needs to be re-initialized in ColorModeContext
    // Add a small delay to ensure Mermaid is fully re-initialized before rendering
    const renderTimeout = setTimeout(() => {
      if (!diagramRef.current) return;

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

            // Apply class-based colors from front matter or palette
            const frontMatterClasses = (diagram.frontMatter as any)?.classes;
            console.log('MermaidDiagramViewer: Checking for class colors', {
              hasFrontMatter: !!diagram.frontMatter,
              frontMatterKeys: diagram.frontMatter ? Object.keys(diagram.frontMatter) : [],
              rawClasses: frontMatterClasses,
              isArray: Array.isArray(frontMatterClasses),
            });
            
            // Build class color map: assign colors sequentially from palette based on array order
            const classColorMap: Record<string, { light: string; dark: string }> = {};
            
            if (frontMatterClasses && Array.isArray(frontMatterClasses)) {
              frontMatterClasses.forEach((className: string, index: number) => {
                const colorIndex = index % CLASS_COLOR_PALETTE.length;
                classColorMap[className] = CLASS_COLOR_PALETTE[colorIndex];
              });
            }
            
            console.log('MermaidDiagramViewer: Built classColorMap', { classColorMap, colorMode });
            
            if (Object.keys(classColorMap).length > 0) {
              console.log('MermaidDiagramViewer: Processing class colors', Object.keys(classColorMap));
              
              Object.entries(classColorMap).forEach(([className, colors]) => {
                const color = colorMode === 'dark' ? colors.dark : colors.light;
                console.log(`MermaidDiagramViewer: Processing class "${className}"`, { color, colors, colorMode });
                
                if (color) {
                  // Find all elements with this class
                  // Mermaid applies classes to g elements and their children
                  const classElements = svg.querySelectorAll(`.${className}`);
                  console.log(`MermaidDiagramViewer: Found ${classElements.length} elements with class "${className}"`);
                  
                  if (classElements.length === 0) {
                    // Try alternative selectors - Mermaid might use different class naming
                    const allClasses = Array.from(svg.querySelectorAll('[class]')).map(el => el.getAttribute('class'));
                    console.log(`MermaidDiagramViewer: All classes found in SVG:`, allClasses);
                    
                    // Try with different class name formats
                    const altSelectors = [
                      `.node-${className}`,
                      `[class*="${className}"]`,
                      `[class~="${className}"]`,
                    ];
                    
                    altSelectors.forEach(selector => {
                      const altElements = svg.querySelectorAll(selector);
                      if (altElements.length > 0) {
                        console.log(`MermaidDiagramViewer: Found ${altElements.length} elements with selector "${selector}"`);
                      }
                    });
                  }
                  
                  classElements.forEach((element, index) => {
                    console.log(`MermaidDiagramViewer: Processing element ${index} for class "${className}"`, {
                      tagName: element.tagName,
                      className: element.getAttribute('class'),
                      currentFill: element.getAttribute('fill'),
                    });
                    
                    if (element instanceof SVGElement) {
                      // Apply fill to the element itself if it's a shape
                      if (element.tagName === 'rect' || element.tagName === 'circle' || 
                          element.tagName === 'ellipse' || element.tagName === 'polygon' || 
                          element.tagName === 'path') {
                        const existingFill = element.getAttribute('fill');
                        // Only apply if it's not explicitly set to none/transparent
                        if (existingFill !== 'none' && existingFill !== 'transparent') {
                          console.log(`MermaidDiagramViewer: Applying fill "${color}" to ${element.tagName}`);
                          element.setAttribute('fill', color);
                        }
                      }
                      
                      // Also apply to child rect, circle, ellipse, polygon, path elements
                      const shapes = element.querySelectorAll('rect, circle, ellipse, polygon, path');
                      console.log(`MermaidDiagramViewer: Found ${shapes.length} child shapes in element ${index}`);
                      
                      shapes.forEach((shape, shapeIndex) => {
                        const fill = shape.getAttribute('fill');
                        const stroke = shape.getAttribute('stroke');
                        const width = shape.getAttribute('width');
                        const height = shape.getAttribute('height');
                        
                        // Get computed style to see what's actually being applied
                        const computedStyle = window.getComputedStyle(shape as Element);
                        const computedFill = computedStyle.fill;
                        
                        console.log(`MermaidDiagramViewer: Child shape ${shapeIndex}`, {
                          tagName: shape.tagName,
                          currentFill: fill,
                          computedFill: computedFill,
                          stroke: stroke,
                          width: width,
                          height: height,
                          currentStyle: shape.getAttribute('style'),
                        });
                        
                        // For rects, apply to background rects (ones without stroke, or the larger one)
                        if (shape.tagName === 'rect') {
                          // Skip border rects that have stroke
                          if (stroke && stroke !== 'none' && stroke !== 'transparent') {
                            console.log(`MermaidDiagramViewer: Skipping border rect ${shapeIndex} (has stroke: ${stroke})`);
                            return;
                          }
                        }
                        
                        // Apply fill color - apply to all shapes that aren't explicitly transparent
                        // Even if fill is null, we should apply it (it's using CSS/default)
                        if (fill !== 'none' && fill !== 'transparent') {
                          console.log(`MermaidDiagramViewer: Applying fill "${color}" to child ${shape.tagName} (was: ${fill || 'null/default'}, computed: ${computedFill})`);
                          // Set both fill attribute and style attribute for maximum specificity
                          shape.setAttribute('fill', color);
                          // Get existing style and append/override fill
                          const existingStyle = shape.getAttribute('style') || '';
                          // Remove any existing fill from style
                          const styleWithoutFill = existingStyle.replace(/fill:\s*[^;]+;?/gi, '').trim();
                          const newStyle = styleWithoutFill ? `${styleWithoutFill}; fill: ${color};` : `fill: ${color};`;
                          shape.setAttribute('style', newStyle);
                          
                          // Verify it was applied
                          const afterFill = shape.getAttribute('fill');
                          const afterStyle = shape.getAttribute('style');
                          const afterComputed = window.getComputedStyle(shape as Element).fill;
                          console.log(`MermaidDiagramViewer: After applying - fill: ${afterFill}, style: ${afterStyle}, computed: ${afterComputed}`);
                        } else {
                          console.log(`MermaidDiagramViewer: Skipping child ${shape.tagName} - fill is ${fill}`);
                        }
                      });
                    }
                  });
                } else {
                  console.log(`MermaidDiagramViewer: No color found for class "${className}" in ${colorMode} mode`);
                }
              });
            } else {
              console.log('MermaidDiagramViewer: No classColors found in front matter');
            }
          }
        }
      }).catch((error) => {
        console.error('MermaidDiagramViewer: Error rendering mermaid diagram:', error);
        if (diagramRef.current) {
          diagramRef.current.innerHTML = `<p style="color: red;">Error rendering diagram: ${error.message}</p>`;
        }
      });
    }, 100); // Small delay to ensure Mermaid is re-initialized when color mode changes

    return () => {
      clearTimeout(renderTimeout);
    };
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
