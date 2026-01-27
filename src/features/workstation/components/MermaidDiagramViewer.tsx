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
  Icon,
  Code,
  Button,
  Alert,
} from '@chakra-ui/react';
import { ArtifactFile } from '@/ipc';
import { LuMaximize2, LuMinimize2, LuCopy } from 'react-icons/lu';

interface MermaidDiagramViewerProps {
  diagram: ArtifactFile;
  content: string;
}

/**
 * Cleans up orphaned mermaid elements that may have escaped into document.body.
 * Mermaid.js creates temporary elements for rendering, and when errors occur
 * (especially module loading failures), these elements can get orphaned at the
 * document root level instead of being contained within the React component.
 */
function cleanupOrphanedMermaidElements() {
  // Find and remove orphaned mermaid SVGs in document body
  // These are typically created with IDs starting with 'mermaid' or 'd' followed by numbers
  const orphanedElements = document.querySelectorAll(
    'body > svg[id^="mermaid"], body > svg[id^="d"], body > div[id^="dmermaid"], body > div[id^="d"]'
  );

  orphanedElements.forEach((el) => {
    // Check if this looks like a mermaid element
    const isMermaidElement =
      el.id?.includes('mermaid') ||
      el.classList?.contains('mermaid') ||
      (el.tagName === 'SVG' && el.querySelector('.error-icon, .error-text')) ||
      (el.innerHTML?.includes('Syntax error') || el.innerHTML?.includes('Parse error'));

    if (isMermaidElement) {
      console.warn('Removing orphaned mermaid element:', el.id || el.tagName);
      el.remove();
    }
  });

  // Also clean up any floating error elements that mermaid might create
  const errorElements = document.querySelectorAll('body > div.mermaid-error, body > .error');
  errorElements.forEach((el) => el.remove());
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
  const [renderError, setRenderError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Initialize Mermaid with dark theme (similar to ShikiCodeBlock always using github-dark)
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'dark',
      themeVariables: {
        primaryBorderColor: '#4287f5',
        lineColor: '#4287f5',
        arrowheadColor: '#4287f5',
      },
    });
  }, []);

  // Set up MutationObserver to catch and remove any mermaid elements that escape to body
  useEffect(() => {
    // Create observer to watch for mermaid elements being added to body
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element && node.parentElement === document.body) {
              const isMermaidElement =
                (node.id?.includes('mermaid') || node.id?.match(/^d\d/)) &&
                (node.tagName === 'SVG' || node.tagName === 'DIV');

              if (isMermaidElement) {
                console.warn('Caught escaping mermaid element, removing:', node.id);
                node.remove();
              }
            }
          });
        }
      }
    });

    // Observe body for direct children being added
    observerRef.current.observe(document.body, { childList: true });

    return () => {
      observerRef.current?.disconnect();
      // Cleanup any orphaned elements on unmount
      cleanupOrphanedMermaidElements();
    };
  }, []);

  // Color palette mapping for different subgraph types
  // Uses dark colorful fills for both light and dark modes, with light text for readability
  const getClassColor = (className: string): { fill: string; text: string } => {
    // Dark colorful palette - same for both modes
    const palette: Record<string, { fill: string; text: string }> = {
      uiLayer: {
        fill: '#1e3a8a', // Dark blue
        text: '#bfdbfe', // Light blue text
      },
      backendLayer: {
        fill: '#6b21a8', // Dark purple
        text: '#e9d5ff', // Light purple text
      },
      userAction: {
        fill: '#c2410c', // Dark orange
        text: '#fed7aa', // Light orange text
      },
      ipcLayer: {
        fill: '#0f766e', // Dark teal
        text: '#99f6e4', // Light teal text
      },
      fileSystem: {
        fill: '#4c1d95', // Dark indigo
        text: '#ddd6fe', // Light indigo text
      },
      watcher: {
        fill: '#a16207', // Dark amber
        text: '#fde68a', // Light amber text
      },
      uiUpdate: {
        fill: '#155e75', // Dark cyan
        text: '#a7f3d0', // Light cyan text
      },
      // Fallback for other class names
      default: {
        fill: '#374151', // Dark gray
        text: '#f3f4f6', // Light gray text
      },
    };

    // Match class name (case-insensitive) to palette keys
    const classKey = Object.keys(palette).find(
      key => key.toLowerCase() === className.toLowerCase()
    ) || 'default';
    
    // Return the same dark fill and light text regardless of mode
    return palette[classKey];
  };

  // Extract class definitions and node-class mappings from mermaid code
  // Returns both class mappings and classDef fill colors
  const extractClassMappings = (mermaidCode: string): {
    classMap: Map<string, string[]>;
    classDefColors: Map<string, { fill: string; text: string }>;
  } => {
    const classMap = new Map<string, string[]>();
    const classDefColors = new Map<string, { fill: string; text: string }>();
    
    // Extract classDef statements: classDef className fill:#color,stroke:#color,...
    // Pattern matches: classDef uiLayer fill:#1e3a8a,stroke:#333,stroke-width:2px
    const classDefRegex = /classDef\s+(\w+)\s+([^\n]+)/g;
    let classDefMatch;
    
    while ((classDefMatch = classDefRegex.exec(mermaidCode)) !== null) {
      const className = classDefMatch[1].trim();
      const styleString = classDefMatch[2].trim();
      
      // Extract fill color from style string
      // Matches: fill:#1e3a8a or fill:#1e3a8a, or fill:#1e3a8a,stroke:...
      const fillMatch = styleString.match(/fill:([^,]+)/);
      const fillColor = fillMatch ? fillMatch[1].trim() : null;
      
      if (fillColor) {
        console.log('MermaidDiagramViewer: Found classDef', { className, fillColor });
        // Determine appropriate text color based on fill color brightness
        // For dark fills, use light text; for light fills, use dark text
        // Since we're using dark fills, default to light text
        let textColor = '#bfdbfe'; // Default light text for dark fills
        
        // If fill is a hex color, try to determine if it's dark or light
        if (fillColor.startsWith('#')) {
          const hex = fillColor.replace('#', '');
          if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            // Calculate brightness (0-255)
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            // If bright (light fill), use dark text; if dark fill, use light text
            textColor = brightness > 128 ? '#1f2937' : '#bfdbfe';
            console.log('MermaidDiagramViewer: Determined textColor', { className, fillColor, textColor });
          }
        }
        
        classDefColors.set(className, {
          fill: fillColor,
          text: textColor,
        });
        console.log('MermaidDiagramViewer: Added classDef to classDefColors', { className, fillColor, textColor });
      }
    }
    
    // Extract class assignments: class NodeA,NodeB className
    const classAssignRegex = /class\s+([\w,]+)\s+(\w+)/g;
    let match;
    
    while ((match = classAssignRegex.exec(mermaidCode)) !== null) {
      const nodeIds = match[1].split(',').map(id => id.trim());
      const className = match[2].trim();
      
      nodeIds.forEach(nodeId => {
        if (!classMap.has(nodeId)) {
          classMap.set(nodeId, []);
        }
        classMap.get(nodeId)!.push(className);
      });
    }
    
    return { classMap, classDefColors };
  };

  // Apply class-based colors to SVG elements
  // Uses classDefColors if available (from mermaid code), otherwise falls back to getClassColor palette
  // Colors are the same for both light and dark modes (dark fills with light text)
  const applyClassColors = (
    svg: SVGElement, 
    classMap: Map<string, string[]>, 
    classDefColors?: Map<string, { fill: string; text: string }>
  ) => {
    // Find all node groups in the SVG (Mermaid typically wraps nodes in <g> elements with class="node")
    const nodeGroups = svg.querySelectorAll('g.node');
    
    // Collect all found node IDs for debugging
    const foundNodeIds: string[] = [];
    
    let nodesMatched = 0;
    
    nodeGroups.forEach((group) => {
      // Try multiple methods to find the node ID
      let nodeId = '';
      
      // Method 1: Check title element (most common in Mermaid)
      const titleElement = group.querySelector('title');
      if (titleElement) {
        nodeId = titleElement.textContent?.trim() || '';
      }
      
      // Method 2: Check id attribute on the group
      if (!nodeId && group.id) {
        nodeId = group.id;
      }
      
      // Method 3: Check for id in the group's attributes
      if (!nodeId) {
        const idAttr = group.getAttribute('id');
        if (idAttr) {
          nodeId = idAttr;
        }
      }
      
      // Method 4: Check for data attributes
      if (!nodeId) {
        const dataId = (group as HTMLElement).dataset?.id;
        if (dataId) {
          nodeId = dataId;
        }
      }
      
      // Method 5: Try to extract from the group's class or other attributes
      // Mermaid sometimes uses classes like "node-id-NodeName"
      if (!nodeId) {
        const classList = Array.from(group.classList);
        for (const cls of classList) {
          if (cls.startsWith('node-') || cls.includes('id-')) {
            const match = cls.match(/id-([\w]+)/);
            if (match) {
              nodeId = match[1];
              break;
            }
          }
        }
      }
      
      if (nodeId) {
        foundNodeIds.push(nodeId);
      }
      
      if (!nodeId) {
        return;
      }
      
      // Get classes for this node
      let classes = classMap.get(nodeId) || [];
      
      // If no direct match, try alternative matching strategies
      if (classes.length === 0) {
        // Strategy 1: Case-insensitive matching
        for (const [mapNodeId, mapClasses] of classMap.entries()) {
          if (mapNodeId.toLowerCase() === nodeId.toLowerCase()) {
            classes = mapClasses;
            break;
          }
        }
        
        // Strategy 2: Try to match by text content (extract first word from node text)
        if (classes.length === 0) {
          const textElements = group.querySelectorAll('text');
          for (const textEl of textElements) {
            const textContent = textEl.textContent?.trim() || '';
            // Try to match the first significant word from the text
            const firstWord = textContent.split(/\s+/)[0];
            if (firstWord && classMap.has(firstWord)) {
              classes = classMap.get(firstWord)!;
              break;
            }
          }
        }
        
        // Strategy 3: Try partial matching (nodeId contains mapNodeId or vice versa)
        if (classes.length === 0) {
          for (const [mapNodeId, mapClasses] of classMap.entries()) {
            if (nodeId.includes(mapNodeId) || mapNodeId.includes(nodeId)) {
              classes = mapClasses;
              break;
            }
          }
        }
      }
      
      if (classes.length === 0) {
        return;
      }
      
      nodesMatched++;
      
      // Use the first class found (nodes can have multiple classes, but we'll use the first)
      const className = classes[0];
      // Use classDefColors if available (from mermaid code), otherwise use palette
      const colors = classDefColors?.get(className) || getClassColor(className);
      
      // Find all shape elements within this node group
      const shapes = group.querySelectorAll('rect, circle, ellipse, polygon, path');
      
      shapes.forEach((shape) => {
        const element = shape as SVGElement;
        const currentFill = element.getAttribute('fill') || element.style.fill || '';
        
        // Only skip if it's a gradient or pattern (url(...))
        // Otherwise, always apply our class-based colors
        if (currentFill && currentFill.startsWith('url(')) {
          // Don't override gradients or patterns
          return;
        }
        
        // Apply the class-based fill color
        element.setAttribute('fill', colors.fill);
        element.style.fill = colors.fill;
      });
      
      // Update text colors for better contrast
      // Use querySelectorAll with descendant selector to find text elements even in nested groups
      const textElements = group.querySelectorAll('text');
      console.log('MermaidDiagramViewer: Found text elements', { textElements, nodeId, className, textColor: colors.text });
      textElements.forEach((textEl) => {
        const element = textEl as SVGElement;
        // Set both attribute and style with !important to override Mermaid theme
        element.setAttribute('fill', colors.text);
        element.style.setProperty('fill', colors.text, 'important');
        // Also remove any conflicting fill attributes from parent elements
        const parent = element.parentElement;
        if (parent && parent instanceof SVGElement) {
          const parentFill = parent.getAttribute('fill');
          if (parentFill && parentFill !== colors.text) {
            // Clear parent fill if it conflicts
            parent.removeAttribute('fill');
          }
        }
      });
    });
    
    // If no nodes were matched, log a warning
    if (nodesMatched === 0 && nodeGroups.length > 0) {
      console.warn('MermaidDiagramViewer: No nodes matched! This suggests a node ID mismatch issue.', {
        foundNodeIds,
        expectedNodeIds: Array.from(classMap.keys()),
        suggestion: 'Check if Mermaid is transforming node IDs differently than expected'
      });
    }
  };

  // Parse Mermaid error message to extract useful information
  const parseMermaidError = (errorMessage: string): string => {
    if (!errorMessage) {
      return 'Syntax error in Mermaid diagram';
    }
    
    // Split by newlines to handle multi-line error messages
    const lines = errorMessage.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Extract line number if present
    const lineMatch = errorMessage.match(/line (\d+)/i);
    const lineNumber = lineMatch ? lineMatch[1] : null;
    
    // Extract what was expected vs got
    const expectedMatch = errorMessage.match(/Expecting[^,]+/i);
    const gotMatch = errorMessage.match(/got ['"]([^'"]+)['"]/i);
    
    // Check for common error patterns
    if (errorMessage.toLowerCase().includes('syntax error in text')) {
      // This is a generic syntax error - try to provide more context
      const versionMatch = errorMessage.match(/mermaid\s+version\s+([\d.]+)/i);
      const versionInfo = versionMatch ? ` (Mermaid ${versionMatch[1]})` : '';
      
      if (lineNumber) {
        return `Syntax error on line ${lineNumber}${versionInfo}\n\nPlease check your Mermaid diagram syntax. Common issues include:\n- Missing or incorrect arrow syntax\n- Unclosed brackets or quotes\n- Invalid node or edge definitions`;
      }
      return `Syntax error in Mermaid diagram${versionInfo}\n\nPlease check your Mermaid diagram syntax.`;
    }
    
    // Build parsed error message
    let parsed = '';
    if (lineNumber || expectedMatch || gotMatch) {
      parsed = `Parse error${lineNumber ? ` on line ${lineNumber}` : ''}`;
      if (expectedMatch) {
        parsed += `: ${expectedMatch[0]}`;
      }
      if (gotMatch) {
        parsed += `, got '${gotMatch[1]}'`;
      }
    } else {
      // Use the first meaningful line, or the whole message if it's short
      parsed = lines.length > 0 ? lines[0] : errorMessage;
    }
    
    // Add version info if present and not already included
    if (!parsed.includes('mermaid version') && errorMessage.includes('mermaid version')) {
      const versionMatch = errorMessage.match(/mermaid\s+version\s+([\d.]+)/i);
      if (versionMatch) {
        parsed += `\n\nMermaid version: ${versionMatch[1]}`;
      }
    }
    
    return parsed || 'Syntax error in Mermaid diagram';
  };

  // Extract mermaid diagram code from content
  // Handles both raw mermaid code and markdown-wrapped code
  const extractMermaidCode = (content: string): string => {
    if (!content) {
      console.warn('MermaidDiagramViewer: No content provided');
      return '';
    }
    
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

  // Apply BlueKit blue styling to SVG elements (arrows, lines, etc.)
  const applyBlueKitBlueStyling = (svg: SVGElement) => {
    const bluekitPrimary = '#4287f5';
    
    // Generic colors that should be replaced with BlueKit blue
    const genericColors = [
      '#333', '#333333', 'rgb(51, 51, 51)', 'rgb(51,51,51)',
      '#000', '#000000', 'rgb(0, 0, 0)', 'rgb(0,0,0)',
      '#666', '#666666', 'rgb(102, 102, 102)', 'rgb(102,102,102)',
      '#999', '#999999', 'rgb(153, 153, 153)', 'rgb(153,153,153)',
    ];
    
    // Check if a color is already BlueKit blue (or close to it)
    const isBlueKitBlue = (color: string): boolean => {
      if (!color) return false;
      const lower = color.toLowerCase();
      return lower === bluekitPrimary.toLowerCase() ||
             lower === '#4287f5' ||
             lower.includes('4287f5') ||
             lower === 'rgb(66, 135, 245)' ||
             lower === 'rgb(66,135,245)';
    };
    
    const isGenericColor = (color: string): boolean => {
      if (!color) return true;
      return genericColors.some(gc => color.toLowerCase() === gc.toLowerCase());
    };
    
    // Style marker elements (arrows) - always apply blue
    const markers = svg.querySelectorAll('marker');
    markers.forEach((marker) => {
      const path = marker.querySelector('path');
      if (path) {
        path.setAttribute('fill', bluekitPrimary);
        path.setAttribute('stroke', bluekitPrimary);
        path.style.fill = bluekitPrimary;
        path.style.stroke = bluekitPrimary;
      }
      // Also check for polygon in markers (some arrow styles use polygon)
      const polygon = marker.querySelector('polygon');
      if (polygon) {
        polygon.setAttribute('fill', bluekitPrimary);
        polygon.setAttribute('stroke', bluekitPrimary);
        polygon.style.fill = bluekitPrimary;
        polygon.style.stroke = bluekitPrimary;
      }
    });
    
    // Style all path elements - be more aggressive in identifying edges
    const allPaths = svg.querySelectorAll('path');
    allPaths.forEach((path) => {
      const element = path as SVGElement;
      const id = element.getAttribute('id') || '';
      const classList = Array.from(element.classList);
      const parent = element.parentElement;
      const parentClassList = parent ? Array.from(parent.classList) : [];
      
      // Check if this is an edge/line path (not a node shape)
      // Paths are edges if:
      // 1. They have edge/flow/link in id or class
      // 2. They're inside a group with edge/flow/link class
      // 3. They're not inside a node group and don't form a closed shape
      const isEdge = id.includes('edge') || 
                     id.includes('flow') || 
                     id.includes('link') ||
                     classList.some(cls => cls.includes('edge') || cls.includes('flow') || cls.includes('link')) ||
                     parentClassList.some(cls => cls.includes('edge') || cls.includes('flow') || cls.includes('link')) ||
                     (!parentClassList.some(cls => cls.includes('node')) && 
                      !classList.some(cls => cls.includes('node')) &&
                      element.getAttribute('d')?.includes('M'));
      
      if (isEdge) {
        const currentStroke = element.getAttribute('stroke') || element.style.stroke || '';
        // Apply BlueKit blue unless it's already blue
        if (!isBlueKitBlue(currentStroke) && (isGenericColor(currentStroke) || !currentStroke)) {
          element.setAttribute('stroke', bluekitPrimary);
          element.style.stroke = bluekitPrimary;
        }
      }
    });
    
    // Style polyline elements (alternative line representation)
    const polylines = svg.querySelectorAll('polyline');
    polylines.forEach((polyline) => {
      const element = polyline as SVGElement;
      const currentStroke = element.getAttribute('stroke') || element.style.stroke || '';
      if (!isBlueKitBlue(currentStroke) && (isGenericColor(currentStroke) || !currentStroke)) {
        element.setAttribute('stroke', bluekitPrimary);
        element.style.stroke = bluekitPrimary;
      }
    });
    
    // Style line elements (straight lines)
    const lines = svg.querySelectorAll('line');
    lines.forEach((line) => {
      const element = line as SVGElement;
      const currentStroke = element.getAttribute('stroke') || element.style.stroke || '';
      if (!isBlueKitBlue(currentStroke) && (isGenericColor(currentStroke) || !currentStroke)) {
        element.setAttribute('stroke', bluekitPrimary);
        element.style.stroke = bluekitPrimary;
      }
    });
  };

  useEffect(() => {
    if (!diagramRef.current || !content) {
      return;
    }

    // Mermaid is initialized with dark theme in this component
    // Add a small delay to ensure Mermaid is fully initialized before rendering
    const renderTimeout = setTimeout(() => {
      if (!diagramRef.current) return;

      // Clear previous content
      diagramRef.current.innerHTML = '';

      // Extract the mermaid code
      const mermaidCode = extractMermaidCode(content);

      if (!mermaidCode) {
        console.warn('MermaidDiagramViewer: No mermaid code found in content');
        if (diagramRef.current) {
          diagramRef.current.innerHTML = '<p style="color: red;">No mermaid diagram code found</p>';
        }
        return;
      }

      // Create a unique ID for this diagram
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Clear any previous errors
      setRenderError(null);

      // Clean up any orphaned elements before rendering
      cleanupOrphanedMermaidElements();

      // Render the diagram
      mermaid.render(id, mermaidCode).then((result) => {
        // Clean up after successful render (in case mermaid left temp elements)
        cleanupOrphanedMermaidElements();
        if (diagramRef.current) {
          diagramRef.current.innerHTML = result.svg;
          
          // Immediately check for errors in the rendered SVG before applying any styling
          const svg = diagramRef.current.querySelector('svg');
          if (svg) {
            // Quick check for error indicators
            const svgText = svg.textContent || '';
            const hasErrorIndicators = /syntax\s+error|parse\s+error|error\s+in\s+text/i.test(svgText);
            
            if (hasErrorIndicators) {
              console.error('MermaidDiagramViewer: Error detected immediately in rendered SVG');
              // Clear the SVG and show error
              diagramRef.current.innerHTML = '';
              const parsedError = parseMermaidError(svgText);
              setRenderError(parsedError);
              return; // Stop processing, error found
            }
          }
          
          // Extract class mappings and classDef colors from mermaid code
          const { classMap, classDefColors } = extractClassMappings(mermaidCode);

          console.log('MermaidDiagramViewer: Extracted class mappings and classDef colors', { classMap, classDefColors });
          // Apply colors function that can be called multiple times
          const applyColorsToSVG = () => {
            if (!diagramRef.current) return;
            
            const svg = diagramRef.current.querySelector('svg');
            if (!svg) return;
            
            // First, apply BlueKit blue styling to arrows, lines, etc.
            try {
              applyBlueKitBlueStyling(svg);
            } catch (error) {
              console.warn('MermaidDiagramViewer: Error applying BlueKit blue styling', error);
            }
            
            // Then apply class-based colors if any classes are defined
            if (classMap.size > 0) {
              try {
                applyClassColors(svg, classMap, classDefColors);
              } catch (error) {
                console.warn('MermaidDiagramViewer: Error applying class colors', error);
              }
            }
          };
          
          // Apply colors immediately using requestAnimationFrame for better timing
          requestAnimationFrame(() => {
            applyColorsToSVG();
            
            // Also apply after a small delay as a fallback (in case SVG isn't fully ready)
            setTimeout(() => {
              applyColorsToSVG();
            }, 50);
            
            // One more fallback for edge cases where SVG might not be fully rendered
            setTimeout(() => {
              applyColorsToSVG();
            }, 200);
            
            // Additional pass to override Mermaid theme colors that might be applied later
            setTimeout(() => {
              applyColorsToSVG();
            }, 500);
          });
          
          // Check if the SVG contains error messages (Mermaid sometimes renders errors into SVG)
          // Check immediately and also after a short delay to catch errors that render asynchronously
          const checkForErrors = () => {
            if (!diagramRef.current) {
              return;
            }
            
            // Check for Mermaid error elements (they often have specific classes or text)
            const svg = diagramRef.current.querySelector('svg');
            
            if (svg) {
              // Look for text elements containing "Syntax error" or "error"
              const textElements = svg.querySelectorAll('text');
              
              let foundError = false;
              let errorText = '';
              let versionText = '';
              
              // Define specific error patterns that indicate actual Mermaid errors
              const errorPatterns = [
                /syntax\s+error/i,
                /parse\s+error/i,
                /error\s+in\s+text/i,
                /^error:/i,
                /^error\s+at/i,
                /rendering\s+error/i,
                /diagram\s+error/i,
              ];
              
              const isErrorText = (text: string): boolean => {
                return errorPatterns.some(pattern => pattern.test(text));
              };
              
              // Collect all text content to check for error patterns
              const allTextContent: string[] = [];
              
              textElements.forEach((textEl) => {
                const textContent = textEl.textContent || '';
                allTextContent.push(textContent);
                
                // Check for version info (often appears with errors)
                if (textContent.includes('mermaid version')) {
                  versionText = textContent.trim();
                }
                
                if (isErrorText(textContent)) {
                  foundError = true;
                  errorText = textContent.trim();
                }
              });
              
              // Also check for foreignObject elements (Mermaid sometimes uses these for errors)
              const foreignObjects = svg.querySelectorAll('foreignObject');
              
              foreignObjects.forEach((fo) => {
                const textContent = fo.textContent || '';
                allTextContent.push(textContent);
                
                if (isErrorText(textContent)) {
                  foundError = true;
                  if (!errorText) {
                    errorText = textContent.trim();
                  }
                }
              });
              
              // Check if any text contains both error indicators and version info (common error pattern)
              const combinedText = allTextContent.join(' ').toLowerCase();
              if (combinedText.includes('syntax error') && combinedText.includes('mermaid version')) {
                foundError = true;
                if (!errorText) {
                  // Extract the error message from combined text
                  const errorMatch = combinedText.match(/(syntax\s+error[^.]*)/i);
                  if (errorMatch) {
                    errorText = errorMatch[1].trim();
                  }
                }
              }
              
              if (foundError) {
                console.error('MermaidDiagramViewer: Error detected in rendered SVG', { 
                  errorText, 
                  versionText,
                  allTextContent: allTextContent.slice(0, 5) // Log first 5 for debugging
                });
                // Clear the SVG and show error
                diagramRef.current.innerHTML = '';
                // Combine error text with version info if available
                const fullErrorText = errorText + (versionText ? `\n${versionText}` : '');
                const parsedError = parseMermaidError(fullErrorText);
                setRenderError(parsedError);
                return true; // Indicate error was found
              }
            }
            return false; // No error found
          };
          
          // Check immediately
          if (checkForErrors()) {
            return; // Error found, stop processing
          }
          
          // Also check after a short delay in case errors render asynchronously
          setTimeout(() => {
            checkForErrors();
          }, 50);
        }
      }).catch((error) => {
        console.error('MermaidDiagramViewer: Error rendering mermaid diagram:', {
          error,
          errorMessage: error?.message,
          errorStack: error?.stack,
          errorName: error?.name,
          mermaidCodeLength: mermaidCode.length,
          mermaidCodePreview: mermaidCode.substring(0, 200),
        });

        // CRITICAL: Clean up orphaned elements after error
        // This is where mermaid often leaves elements at document.body
        cleanupOrphanedMermaidElements();

        // Also clean up after a short delay since mermaid may create elements asynchronously
        setTimeout(cleanupOrphanedMermaidElements, 50);
        setTimeout(cleanupOrphanedMermaidElements, 200);

        // Parse error message to extract useful information
        const errorMessage = error?.message || error?.toString() || 'Unknown error';

        // Check for module loading failures (Vite dev server issues)
        if (errorMessage.includes('module script failed') || errorMessage.includes('Failed to fetch')) {
          setRenderError('Failed to load Mermaid diagram module. Try refreshing the page.');
        } else {
          const parsed = parseMermaidError(errorMessage);
          setRenderError(parsed);
        }

        if (diagramRef.current) {
          diagramRef.current.innerHTML = '';
        }
      });
    }, 100); // Small delay to ensure Mermaid is fully initialized

    return () => {
      clearTimeout(renderTimeout);
      // Clean up on effect cleanup
      cleanupOrphanedMermaidElements();
    };
  }, [content, diagram.path]);

  // Clear error when content changes
  useEffect(() => {
    setRenderError(null);
  }, [content]);

  // Smooth transform update using requestAnimationFrame
  const updateTransform = (isTransforming = true) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const diagram = diagramRef.current;
      if (!diagram) {
        return;
      }

      const { x, y } = positionRef.current;
      const scale = scaleRef.current;
      diagram.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      diagram.style.willChange = isTransforming ? 'transform' : 'auto';
    });
  };

  // Handle zoom with wheel/trackpad
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

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
    <Box p={6} maxW="100%" overflow="auto" bg="transparent">
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

        {/* Error Alert */}
        {renderError && (
          <Alert.Root status="error" variant="subtle">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Mermaid Syntax Error</Alert.Title>
              <Alert.Description>
                <VStack align="stretch" gap={3} mt={2}>
                  <Code
                    fontSize="xs"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                    p={3}
                    bg="bg.subtle"
                    borderRadius="sm"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    maxH="150px"
                    overflowY="auto"
                    display="block"
                  >
                    {renderError}
                  </Code>
                  <HStack>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(renderError);
                        } catch (err) {
                          console.error('Failed to copy:', err);
                        }
                      }}
                    >
                      <HStack gap={1}>
                        <LuCopy size={14} />
                        <Text>Copy Error</Text>
                      </HStack>
                    </Button>
                  </HStack>
                </VStack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

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
            colorPalette="primary"
          >
            <Icon color="primary.600">
              {isFullscreen ? <LuMinimize2 /> : <LuMaximize2 />}
            </Icon>
          </IconButton>
          <Box
            ref={diagramRef}
            style={{
              transformOrigin: 'center',
            }}
          />
        </Box>
      </VStack>
    </Box>
  );
}
