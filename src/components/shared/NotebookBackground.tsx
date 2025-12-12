import { Box } from '@chakra-ui/react';
import { useColorMode } from '../../contexts/ColorModeContext';

export default function NotebookBackground() {
  const { colorMode } = useColorMode();
  
  // BlueKit primary blue colors
  const gridColor = colorMode === 'light' ? '#93c5fd' : '#60a5fa'; // primary.300 / primary.400
  const opacity = colorMode === 'light' ? 0.15 : 0.12;
  
  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
      zIndex={0}
      overflow="hidden"
      width="100%"
      height="100%"
    >
      <Box
        position="absolute"
        top="-100%"
        left="-100%"
        width="800%"
        height="800%"
        style={{
          transform: 'rotate(45deg)',
          transformOrigin: 'center center',
        }}
      >
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          style={{
            opacity,
          }}
        >
          <defs>
            {/* Grid pattern - raw graph paper, huge squares */}
            <pattern
              id="graph-grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke={gridColor}
                strokeWidth="8"
                strokeDasharray="30 12"
              />
            </pattern>
          </defs>
          
          {/* Grid background - pattern naturally repeats, so 100% will cover the full container */}
          <rect width="100%" height="100%" fill="url(#graph-grid)" />
        </svg>
      </Box>
    </Box>
  );
}
