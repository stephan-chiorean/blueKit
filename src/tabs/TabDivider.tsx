import { Box } from '@chakra-ui/react';
import { getTabColors, TAB_SPECS } from './tabStyles';

interface TabDividerProps {
  colorMode: 'light' | 'dark';
}

/**
 * Subtle vertical divider between unselected tabs.
 * Should NOT appear adjacent to selected tabs.
 */
export default function TabDivider({ colorMode }: TabDividerProps) {
  const colors = getTabColors(colorMode);

  return (
    <Box
      w={TAB_SPECS.dividerWidth}
      h={TAB_SPECS.dividerHeight}
      alignSelf="center"
      bg={colors.divider}
      flexShrink={0}
    />
  );
}
