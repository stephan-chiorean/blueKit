import { Box } from '@chakra-ui/react';
import { getTabColors, TAB_SPECS } from './tabStyles';

interface TabDividerProps {
  colorMode: 'light' | 'dark';
  isHighlighted?: boolean;
}

/**
 * Subtle vertical divider between unselected tabs.
 * Should NOT appear adjacent to selected tabs.
 * Can be highlighted during drag-and-drop to show drop target.
 */
export default function TabDivider({ colorMode, isHighlighted = false }: TabDividerProps) {
  const colors = getTabColors(colorMode);

  return (
    <Box
      h={TAB_SPECS.barHeight}
      alignSelf="flex-end"
      display="flex"
      alignItems="center"
    >
      <Box
        w={isHighlighted ? '3px' : TAB_SPECS.dividerWidth}
        h={isHighlighted ? '28px' : TAB_SPECS.dividerHeight}
        bg={isHighlighted ? (colorMode === 'light' ? 'primary.500' : 'primary.400') : colors.divider}
        flexShrink={0}
        transition="all 0.15s ease"
        borderRadius={isHighlighted ? 'full' : '0'}
      />
    </Box>
  );
}
