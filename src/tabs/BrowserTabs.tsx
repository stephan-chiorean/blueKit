import { Fragment, ReactNode, useState, useRef, useEffect } from 'react';
import { Box, Flex, IconButton, Icon, Portal, Text } from '@chakra-ui/react';
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
  onReorder?: (fromIndex: number, toIndex: number) => void;
  colorMode: 'light' | 'dark';
  children?: ReactNode;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

interface DragState {
  isDragging: boolean;
  draggedTabId: string;
  draggedTabIndex: number;
  draggedTabLabel: string;
  dropTargetIndex: number | null;
  cursorX: number;
  cursorY: number;
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
  onReorder,
  colorMode,
  children,
  onToggleSidebar,
  isSidebarCollapsed,
}: BrowserTabsProps) {
  const colors = getTabColors(colorMode);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  console.log('[BrowserTabs] Render:', {
    tabsCount: tabs.length,
    selectedId,
    hasChildren: !!children,
    sidebarCollapsed: isSidebarCollapsed
  });

  // Handle drag start
  const handleDragStart = (tabId: string, tabIndex: number, e: React.MouseEvent) => {
    if (!onReorder) return;

    const tab = tabs[tabIndex];
    setDragState({
      isDragging: true,
      draggedTabId: tabId,
      draggedTabIndex: tabIndex,
      draggedTabLabel: tab.label,
      dropTargetIndex: tabIndex,
      cursorX: e.clientX,
      cursorY: e.clientY,
    });
  };

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragState?.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !tabBarRef.current) return;

      // Update cursor position
      setDragState(prev => prev ? { ...prev, cursorX: e.clientX, cursorY: e.clientY } : null);

      // Calculate drop target index based on cursor position
      const tabElements = tabBarRef.current.querySelectorAll('.tab-container');
      const cursorX = e.clientX;

      let dropIndex = 0;

      // Check each tab to find where cursor is positioned
      for (let i = 0; i < tabElements.length; i++) {
        const tabElement = tabElements[i] as HTMLElement;
        const rect = tabElement.getBoundingClientRect();
        const tabCenter = rect.left + rect.width / 2;

        if (cursorX < tabCenter) {
          dropIndex = i;
          break;
        } else if (i === tabElements.length - 1) {
          // After last tab
          dropIndex = tabElements.length;
        }
      }

      if (dropIndex !== dragState.dropTargetIndex) {
        setDragState(prev => prev ? { ...prev, dropTargetIndex: dropIndex } : null);
      }
    };

    const handleMouseUp = () => {
      if (!dragState) return;

      // Perform reorder if position changed
      if (dragState.dropTargetIndex !== null &&
          dragState.dropTargetIndex !== dragState.draggedTabIndex &&
          onReorder) {
        onReorder(dragState.draggedTabIndex, dragState.dropTargetIndex);
      }

      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, tabs, onReorder]);

  // Determine if a divider should be shown before a tab
  const shouldShowDivider = (index: number): boolean => {
    // During drag, show all dividers to indicate possible drop positions
    if (dragState?.isDragging) {
      return true;
    }

    // Normal mode: dividers only between two unselected tabs
    if (index === 0) return false; // Never before first tab

    const currentTab = tabs[index];
    const previousTab = tabs[index - 1];

    const isCurrentSelected = currentTab.id === selectedId;
    const isPreviousSelected = previousTab.id === selectedId;

    // Show divider only if both tabs are unselected
    return !isCurrentSelected && !isPreviousSelected;
  };

  // Determine if a divider should be highlighted (drop target during drag)
  const isDividerHighlighted = (index: number): boolean => {
    if (!dragState?.isDragging || dragState.dropTargetIndex === null) return false;
    return index === dragState.dropTargetIndex;
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
      {/* Tab Bar - uses sectionHeight for spacing from top, tabs sit at bottom */}
      <Flex
        ref={tabBarRef}
        h={TAB_SPECS.sectionHeight}
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
              <TabDivider
                colorMode={colorMode}
                isHighlighted={isDividerHighlighted(index)}
              />
            )}
            <BrowserTab
              tab={tab}
              isSelected={tab.id === selectedId}
              colorMode={colorMode}
              onSelect={() => onSelect(tab.id)}
              onClose={tab.closable && onClose ? () => onClose(tab.id) : undefined}
              onDragStart={(e) => handleDragStart(tab.id, index, e)}
              isDragging={dragState?.draggedTabId === tab.id}
            />
            {/* Show divider after last tab during drag */}
            {dragState?.isDragging && index === tabs.length - 1 && (
              <TabDivider
                colorMode={colorMode}
                isHighlighted={isDividerHighlighted(tabs.length)}
              />
            )}
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

      {/* Drag Tooltip - follows cursor */}
      {dragState?.isDragging && (
        <Portal>
          <Box
            position="fixed"
            left={`${dragState.cursorX + 12}px`}
            top={`${dragState.cursorY + 12}px`}
            pointerEvents="none"
            zIndex={10000}
            px={3}
            py={1.5}
            borderRadius="md"
            fontSize="xs"
            fontWeight="medium"
            color={colorMode === 'light' ? 'gray.700' : 'gray.100'}
            css={{
              background: colorMode === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(20, 20, 25, 0.7)',
              backdropFilter: 'blur(12px) saturate(180%)',
              WebkitBackdropFilter: 'blur(12px) saturate(180%)',
              border: colorMode === 'light'
                ? '1px solid rgba(0, 0, 0, 0.08)'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: colorMode === 'light'
                ? '0 6px 18px rgba(0, 0, 0, 0.12)'
                : '0 8px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <Text>{dragState.draggedTabLabel}</Text>
          </Box>
        </Portal>
      )}
    </Box>
  );
}

export type { Tab };
