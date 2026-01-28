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
      h="100%"
      borderBottom={`1px solid ${colors.borderColor}`}
      display="flex"
      alignItems="center"
    >
      <Box
        w={TAB_SPECS.dividerWidth}
        h={TAB_SPECS.dividerHeight}
        bg={colors.divider}
        flexShrink={0}
      />
    </Box>
  );
}
