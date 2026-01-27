import { Fragment } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import BrowserTab, { Tab } from './BrowserTab';
import TabDivider from './TabDivider';
import { getTabColors, TAB_SPECS } from './tabStyles';

interface BrowserTabsProps {
  tabs: Tab[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  colorMode: 'light' | 'dark';
  children?: React.ReactNode;
}

/**
 * Browser-style tabs container with sophisticated styling.
 *
 * Features:
 * - Selected tab merges seamlessly with content via inverted corners
 * - Dividers only appear between unselected adjacent tabs
 * - Hover states with smooth transitions
 * - Tab icons with state-based coloring
 */
export default function BrowserTabs({
  tabs,
  selectedId,
  onSelect,
  onClose,
  colorMode,
  children,
}: BrowserTabsProps) {
  const colors = getTabColors(colorMode);

  // Determine if a divider should be shown before a tab
  // Dividers only appear between two unselected tabs
  const shouldShowDivider = (index: number): boolean => {
    if (index === 0) return false; // Never before first tab

    const currentTab = tabs[index];
    const previousTab = tabs[index - 1];

    const isCurrentSelected = currentTab.id === selectedId;
    const isPreviousSelected = previousTab.id === selectedId;

    // Show divider only if both tabs are unselected
    return !isCurrentSelected && !isPreviousSelected;
  };

  return (
    <Box position="relative" h="100%" display="flex" flexDirection="column">
      {/* Tab Bar */}
      <Flex
        h={TAB_SPECS.barHeight}
        px={TAB_SPECS.barPaddingX}
        alignItems="flex-end"
        bg={colors.tabBarBg}
        flexShrink={0}
        css={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {tabs.map((tab, index) => (
          <Fragment key={tab.id}>
            {shouldShowDivider(index) && (
              <TabDivider colorMode={colorMode} />
            )}
            <BrowserTab
              tab={tab}
              isSelected={tab.id === selectedId}
              colorMode={colorMode}
              onSelect={() => onSelect(tab.id)}
              onClose={tab.closable && onClose ? () => onClose(tab.id) : undefined}
            />
          </Fragment>
        ))}
      </Flex>

      {/* Content Area - seamlessly connected to selected tab */}
      <Box
        flex={1}
        bg={colors.selectedBg}
        overflow="hidden"
        position="relative"
        css={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export type { Tab };
