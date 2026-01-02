import { Box } from '@chakra-ui/react';
import { useColorMode } from '../../contexts/ColorModeContext';
import { keyframes } from '@emotion/react';

// Subtle floating animation for gradient blobs
const float1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
`;

const float2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, 30px) scale(0.95); }
  66% { transform: translate(25px, -40px) scale(1.05); }
`;

const float3 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(35px, 35px) scale(1.02); }
`;

/**
 * GradientBackground - A beautiful mesh gradient background layer
 * 
 * Creates an atmospheric background with multiple gradient blobs that
 * UI elements with glassmorphism can blur into, creating depth and visual interest.
 * 
 * Inspired by modern app designs like Taskapp with warm, sunset-like tones.
 */
export default function GradientBackground() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={-1}
      overflow="hidden"
      bg={isDark 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)'
        : 'linear-gradient(135deg, #fef3e2 0%, #fce7d6 50%, #f8e1e4 100%)'
      }
    >
      {/* Primary blob - warm rose/coral */}
      <Box
        position="absolute"
        top="-20%"
        right="-10%"
        width="70%"
        height="70%"
        borderRadius="50%"
        bg={isDark
          ? 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0) 70%)'
          : 'radial-gradient(circle, rgba(251, 146, 134, 0.5) 0%, rgba(251, 146, 134, 0) 70%)'
        }
        filter="blur(60px)"
        css={{ animation: `${float1} 20s ease-in-out infinite` }}
      />

      {/* Secondary blob - purple/violet */}
      <Box
        position="absolute"
        bottom="-30%"
        left="-20%"
        width="80%"
        height="80%"
        borderRadius="50%"
        bg={isDark
          ? 'radial-gradient(circle, rgba(79, 70, 229, 0.25) 0%, rgba(79, 70, 229, 0) 70%)'
          : 'radial-gradient(circle, rgba(196, 181, 253, 0.6) 0%, rgba(196, 181, 253, 0) 70%)'
        }
        filter="blur(80px)"
        css={{ animation: `${float2} 25s ease-in-out infinite` }}
      />

      {/* Tertiary blob - amber/orange warmth */}
      <Box
        position="absolute"
        top="30%"
        left="50%"
        width="50%"
        height="50%"
        borderRadius="50%"
        bg={isDark
          ? 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0) 70%)'
          : 'radial-gradient(circle, rgba(253, 186, 116, 0.5) 0%, rgba(253, 186, 116, 0) 70%)'
        }
        filter="blur(70px)"
        css={{ animation: `${float3} 18s ease-in-out infinite` }}
      />

      {/* Fourth blob - teal/cyan accent for depth */}
      <Box
        position="absolute"
        bottom="10%"
        right="20%"
        width="40%"
        height="40%"
        borderRadius="50%"
        bg={isDark
          ? 'radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0) 70%)'
          : 'radial-gradient(circle, rgba(153, 246, 228, 0.4) 0%, rgba(153, 246, 228, 0) 70%)'
        }
        filter="blur(60px)"
        css={{ animation: `${float1} 22s ease-in-out infinite reverse` }}
      />

      {/* Fifth blob - deep rose for bottom corner warmth */}
      <Box
        position="absolute"
        bottom="-10%"
        right="-15%"
        width="60%"
        height="60%"
        borderRadius="50%"
        bg={isDark
          ? 'radial-gradient(circle, rgba(244, 63, 94, 0.12) 0%, rgba(244, 63, 94, 0) 70%)'
          : 'radial-gradient(circle, rgba(253, 164, 175, 0.45) 0%, rgba(253, 164, 175, 0) 70%)'
        }
        filter="blur(90px)"
        css={{ animation: `${float2} 28s ease-in-out infinite reverse` }}
      />

      {/* Noise texture overlay for subtle grain */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity={isDark ? 0.03 : 0.02}
        backgroundImage={`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`}
        pointerEvents="none"
      />
    </Box>
  );
}

