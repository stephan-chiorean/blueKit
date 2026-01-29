import { Fragment, ReactNode } from 'react';
import { Box, Flex, IconButton, Icon } from '@chakra-ui/react';
import { LuPanelLeft, LuPlus } from 'react-icons/lu';
import BrowserTab, { Tab } from './BrowserTab';
import TabDivider from './TabDivider';
import { getTabColors, TAB_SPECS } from './tabStyles';

interface BrowserTabsProps {
  tabs: Tab[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  onAddTab?: () => void;
  colorMode: 'light' | 'dark';
  children?: ReactNode;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
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
  onAddTab,
  colorMode,
  children,
  onToggleSidebar,
  isSidebarCollapsed,
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
    <Box
      position="relative"
      h="100%"
      display="flex"
      flexDirection="column"
      bg={colors.tabBarBg}
      css={{
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Tab Bar */}
      <Flex
        h={TAB_SPECS.barHeight}
        alignItems="flex-end"
        flexShrink={0}
        position="relative" // Ensure z-index works for tabs overlapping border
        zIndex={1}
      >
        {/* Start Spacer - provides border before first tab */}
        <Box
          w={`${TAB_SPECS.barPaddingX * 4}px`} // Convert chakra spacing (4px per unit)
          h="100%"
          borderBottom={`1px solid ${colors.borderColor}`}
        />

        {/* Sidebar Toggle - only show when sidebar is collapsed */}
        {onToggleSidebar && isSidebarCollapsed && (
          <Box
            h="100%"
            display="flex"
            alignItems="center"
            borderBottom={`1px solid ${colors.borderColor}`}
            pr={2}
          >
            <IconButton
              aria-label="Expand Sidebar"
              size="xs"
              variant="ghost"
              onClick={onToggleSidebar}
              color={colors.selectedText}
              _hover={{ bg: colors.hoverBg, color: colors.selectedText }}
              alignSelf="center"
            >
              <Icon fontSize="16px">
                <LuPanelLeft />
              </Icon>
            </IconButton>
          </Box>
        )}

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

        {/* Add Tab Button */}
        {onAddTab && (
          <>
            {/* Divider only shows if last tab is unselected */}
            {tabs.length > 0 && tabs[tabs.length - 1].id !== selectedId && (
              <TabDivider colorMode={colorMode} />
            )}
            <Box
              h="100%"
              display="flex"
              alignItems="center"
              borderBottom={`1px solid ${colors.borderColor}`}
              px={1}
            >
              <IconButton
                aria-label="New tab"
                size="xs"
                variant="ghost"
                onClick={onAddTab}
                color={colors.unselectedText}
                _hover={{ bg: colors.hoverBg, color: colors.selectedText }}
                w={TAB_SPECS.addButtonSize}
                h={TAB_SPECS.addButtonSize}
                minW={TAB_SPECS.addButtonSize}
              >
                <Icon fontSize="14px">
                  <LuPlus />
                </Icon>
              </IconButton>
            </Box>
          </>
        )}

        {/* End Spacer - fills remaining space with border */}
        <Box
          flex={1}
          h="100%"
          borderBottom={`1px solid ${colors.borderColor}`}
        />
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
          borderLeft: colorMode === 'light'
            ? '1px solid rgba(0, 0, 0, 0.08)'
            : '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export type { Tab };
