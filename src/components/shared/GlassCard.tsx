import { Box, BoxProps } from '@chakra-ui/react';
import { ReactNode } from 'react';

// SVG filter for frosted glass noise texture
const GlassFilter = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <filter id="glass-noise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="4"
          stitchTiles="stitch"
          result="noise"
        />
        <feColorMatrix
          type="saturate"
          values="0"
          in="noise"
          result="graynoise"
        />
        <feBlend
          in="SourceGraphic"
          in2="graynoise"
          mode="soft-light"
          result="blend"
        />
      </filter>
    </defs>
  </svg>
);

interface GlassCardProps extends Omit<BoxProps, 'css'> {
  children: ReactNode;
  isSelected?: boolean;
  intensity?: 'light' | 'medium' | 'strong';
}

export function GlassCard({
  children,
  isSelected = false,
  intensity = 'medium',
  ...boxProps
}: GlassCardProps) {
  // Intensity settings for light mode
  const intensitySettings = {
    light: {
      bg: 'rgba(255, 255, 255, 0.35)',
      bgSelected: 'rgba(255, 255, 255, 0.5)',
      blur: '20px',
      noiseOpacity: 0.03,
    },
    medium: {
      bg: 'rgba(255, 255, 255, 0.45)',
      bgSelected: 'rgba(255, 255, 255, 0.6)',
      blur: '24px',
      noiseOpacity: 0.04,
    },
    strong: {
      bg: 'rgba(255, 255, 255, 0.55)',
      bgSelected: 'rgba(255, 255, 255, 0.7)',
      blur: '30px',
      noiseOpacity: 0.05,
    },
  };

  const settings = intensitySettings[intensity];

  return (
    <>
      <GlassFilter />
      <Box
        position="relative"
        borderRadius="16px"
        overflow="hidden"
        transition="transform 0.2s ease-in-out"
        css={{
          // Light mode glass effect
          background: isSelected ? settings.bgSelected : settings.bg,
          backdropFilter: `blur(${settings.blur}) saturate(180%)`,
          WebkitBackdropFilter: `blur(${settings.blur}) saturate(180%)`,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          borderColor: isSelected
            ? 'var(--chakra-colors-primary-500)'
            : 'rgba(255, 255, 255, 0.4)',
          boxShadow: `
            0 4px 16px 0 rgba(0, 0, 0, 0.08),
            0 8px 32px 0 rgba(31, 38, 135, 0.1),
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.5)
          `,
          // Dark mode
          _dark: {
            background: isSelected
              ? 'rgba(30, 30, 30, 0.85)'
              : 'rgba(20, 20, 20, 0.6)',
            borderColor: isSelected
              ? 'var(--chakra-colors-primary-500)'
              : 'rgba(255, 255, 255, 0.1)',
            boxShadow: `
              0 8px 32px 0 rgba(0, 0, 0, 0.4),
              inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)
            `,
          },
          _hover: {
            transform: 'scale(1.02)',
            borderColor: isSelected
              ? 'var(--chakra-colors-primary-600)'
              : 'var(--chakra-colors-primary-400)',
          },
        }}
        {...boxProps}
      >
        {/* Noise texture overlay */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="none"
          opacity={settings.noiseOpacity}
          css={{
            filter: 'url(#glass-noise)',
            mixBlendMode: 'overlay',
          }}
        />
        {/* Content */}
        <Box position="relative" zIndex={1}>
          {children}
        </Box>
      </Box>
    </>
  );
}

export default GlassCard;
