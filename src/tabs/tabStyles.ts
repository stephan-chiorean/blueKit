/**
 * Browser-style tab styling constants
 * Colors matched exactly with ProjectSidebar.tsx and ProjectDetailPage.tsx
 */

import { HEADER_HEIGHT, HEADER_SECTION_HEIGHT } from '@/shared/constants/layout';

export const getTabColors = (colorMode: 'light' | 'dark') => ({
  // Tab bar background - matches sidebar exactly
  tabBarBg: colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.3)'
    : 'rgba(20, 20, 25, 0.15)',

  // Selected tab & content - seamless merge with content panel
  selectedBg: colorMode === 'light'
    ? 'rgba(255, 255, 255, 0.45)'
    : 'rgba(20, 20, 25, 0.5)',

  // Unselected tab - transparent (blends with tab bar)
  unselectedBg: 'transparent',

  // Hover state - matches ProjectSidebar project selector background
  hoverBg: colorMode === 'light'
    ? 'rgba(0, 0, 0, 0.04)' // blackAlpha.50
    : 'rgba(255, 255, 255, 0.06)', // whiteAlpha.100

  // Text colors
  selectedText: colorMode === 'light' ? 'gray.900' : 'gray.100',
  unselectedText: colorMode === 'light' ? 'gray.600' : 'gray.400',

  // Divider
  divider: colorMode === 'light'
    ? 'rgba(0, 0, 0, 0.12)'
    : 'rgba(255, 255, 255, 0.15)',

  // Icon colors
  iconSelected: colorMode === 'light' ? 'primary.600' : 'primary.400',
  iconUnselected: colorMode === 'light' ? 'gray.500' : 'gray.500',

  // Close button
  closeHover: colorMode === 'light'
    ? 'rgba(0, 0, 0, 0.1)'
    : 'rgba(255, 255, 255, 0.1)',

  // Border color for tabs and container
  borderColor: colorMode === 'light'
    ? 'rgba(0, 0, 0, 0.08)'
    : 'rgba(255, 255, 255, 0.08)',
});

// Visual specifications
export const TAB_SPECS = {
  // Tab section - outer container height (provides spacing from top)
  sectionHeight: HEADER_SECTION_HEIGHT,
  // Tab bar - actual tab height (centered within section)
  barHeight: HEADER_HEIGHT,
  barPaddingX: 2, // Chakra spacing units

  // Individual tab - consistent sizing
  tabWidth: '200px', // Default tab width
  tabMinWidth: '100px', // Minimum when space is tight
  tabMaxWidth: '240px', // Maximum tab width
  tabPaddingX: 2, // Padding inside tab (Chakra units)
  tabPaddingY: 1.5,
  borderRadius: '8px',

  // Add tab button
  addButtonSize: '28px',

  // Inverted corner
  cornerSize: 8, // pixels

  // Icon
  iconSize: '14px',
  iconGap: '6px',

  // Close button
  closeSize: '14px',

  // Divider
  dividerHeight: '24px',
  dividerWidth: '1px',

  // Animation
  hoverTransition: '150ms ease',

  // Typography
  fontSize: 'sm', // 14px
  fontWeight: 500,
};
