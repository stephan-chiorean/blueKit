import { Box, Flex, Text, Icon, Tooltip, Portal } from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';
import { getTabColors, TAB_SPECS } from './tabStyles';
import { useState, useEffect, useRef } from 'react';


export interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  iconColor?: string;
  closable?: boolean;
}

interface BrowserTabProps {
  tab: Tab;
  isSelected: boolean;
  colorMode: 'light' | 'dark';
  onSelect: () => void;
  onClose?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

/**
 * Individual browser-style tab with selected/unselected states,
 * hover effects, icons, and optional close button.
 */
export default function BrowserTab({
  tab,
  isSelected,
  colorMode,
  onSelect,
  onClose,
  onDragStart,
  isDragging = false,
}: BrowserTabProps) {
  const colors = getTabColors(colorMode);
  const [isDragCandidate, setIsDragCandidate] = useState(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingDragEventRef = useRef<React.MouseEvent | null>(null);

  const DRAG_THRESHOLD = 5; // pixels of movement required to start drag

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only on left click and not on close button
    if (e.button === 0 && onDragStart && !(e.target as HTMLElement).closest('.close-button')) {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      pendingDragEventRef.current = e;
      setIsDragCandidate(true);
    }
  };

  // Listen for mouse movement to detect drag threshold
  useEffect(() => {
    if (!isDragCandidate) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDownPosRef.current || !pendingDragEventRef.current) return;

      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved beyond threshold, start drag
      if (distance > DRAG_THRESHOLD && onDragStart) {
        onDragStart(pendingDragEventRef.current);
        cleanup();
      }
    };

    const handleMouseUp = () => {
      // Mouse released before threshold - treat as normal click
      cleanup();
    };

    const cleanup = () => {
      setIsDragCandidate(false);
      mouseDownPosRef.current = null;
      pendingDragEventRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragCandidate, onDragStart]);

  return (
    <Flex
      onClick={onSelect}
      onMouseDown={handleMouseDown}
      alignItems="center"
      w={TAB_SPECS.tabWidth}
      minW={TAB_SPECS.tabMinWidth}
      maxW={TAB_SPECS.tabMaxWidth}
      flex="1 1 auto"
      px={1}
      py={1}
      borderTopLeftRadius={TAB_SPECS.borderRadius}
      borderTopRightRadius={TAB_SPECS.borderRadius}
      borderBottomLeftRadius={0}
      borderBottomRightRadius={0}
      bg={isSelected ? colors.selectedBg : colors.unselectedBg}
      color={isSelected ? colors.selectedText : colors.unselectedText}
      fontSize={TAB_SPECS.fontSize}
      fontWeight={TAB_SPECS.fontWeight}
      cursor={isDragging ? 'grabbing' : 'pointer'}
      position="relative"
      zIndex={isSelected ? 2 : 1}
      marginBottom="0px"
      outline="none"
      opacity={isDragging ? 0.5 : 1}
      transition={`opacity ${TAB_SPECS.hoverTransition}`}
      role="tab"
      tabIndex={0}
      aria-selected={isSelected}
      borderTop={`1px solid ${isSelected ? colors.borderColor : 'transparent'}`}
      borderLeft={`1px solid ${isSelected ? colors.borderColor : 'transparent'}`}
      borderRight={`1px solid ${isSelected ? colors.borderColor : 'transparent'}`}
      borderBottom={`1px solid ${isSelected ? colors.selectedBg : colors.borderColor}`}
      _focus={{
        outline: 'none',
        boxShadow: 'none',
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="tab-container"
    >
      {/* Inner hover pill - only this gets background on hover */}
      <Flex
        alignItems="center"
        gap={TAB_SPECS.iconGap}
        px={TAB_SPECS.tabPaddingX}
        py={TAB_SPECS.tabPaddingY}
        borderRadius="md"
        transition={`all ${TAB_SPECS.hoverTransition}`}
        bg="transparent"
        flex={1}
        minW={0}
        _hover={isSelected ? {} : { bg: colors.hoverBg }}
        className="tab-inner-hover"
      >
        {/* Tab Icon */}
        {tab.icon && (
          <Icon
            as={tab.icon}
            boxSize={TAB_SPECS.iconSize}
            color={tab.iconColor ? tab.iconColor : (isSelected ? colors.iconSelected : colors.iconUnselected)}
            flexShrink={0}
          />
        )}

        {/* Tab Label - takes remaining space, truncates */}
        <Tooltip.Root openDelay={230} closeDelay={100} positioning={{ placement: 'bottom', gutter: 8 }}>
          <Tooltip.Trigger asChild>
            <Text
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              flex={1}
              minW={0}
              textAlign="left"
            >
              {tab.label}
            </Text>
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner zIndex={1500}>
              <Tooltip.Content
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
                {tab.label}
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip.Root>

        {/* Close Button - always in DOM, visible on hover or when selected */}
        {tab.closable && onClose && (
          <Box
            as="span"
            className="close-button"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w={TAB_SPECS.closeSize}
            h={TAB_SPECS.closeSize}
            borderRadius="sm"
            flexShrink={0}
            opacity={isSelected ? 0.7 : 0}
            transition={`all ${TAB_SPECS.hoverTransition}`}
            _hover={{
              opacity: 1,
              bg: colors.closeHover,
            }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onClose();
            }}
            css={{
              '.tab-container:hover &': {
                opacity: 0.5,
              },
            }}
          >
            <Icon as={LuX} boxSize="10px" />
          </Box>
        )}
      </Flex>
    </Flex>
  );
}
