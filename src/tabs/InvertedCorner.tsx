import { Box } from '@chakra-ui/react';
import { getTabColors, TAB_SPECS } from './tabStyles';

interface InvertedCornerProps {
  colorMode: 'light' | 'dark';
  position: 'left' | 'right';
}

/**
 * SVG-based inverted corner that creates the smooth "merged" effect
 * between the selected tab and the content area below.
 *
 * The SVG path creates a quarter-circle cutout that matches the
 * border-radius of the tab, creating a seamless visual transition.
 */
export default function InvertedCorner({ colorMode, position }: InvertedCornerProps) {
  const colors = getTabColors(colorMode);
  const size = TAB_SPECS.cornerSize;

  // The path draws a quarter circle:
  // For left: starts at bottom-right, goes up, curves to bottom-left
  // For right: mirrored version
  const pathD = position === 'left'
    ? `M${size} ${size} L${size} 0 Q${size} ${size} 0 ${size} Z`
    : `M0 ${size} L0 0 Q0 ${size} ${size} ${size} Z`;

  return (
    <Box
      position="absolute"
      bottom={0}
      {...(position === 'left' ? { left: `-${size}px` } : { right: `-${size}px` })}
      w={`${size}px`}
      h={`${size}px`}
      overflow="hidden"
      pointerEvents="none"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block' }}
      >
        <path
          d={pathD}
          fill={colors.selectedBg}
        />
      </svg>
    </Box>
  );
}
