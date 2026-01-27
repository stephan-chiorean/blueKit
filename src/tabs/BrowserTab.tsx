import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';
import { getTabColors, TAB_SPECS } from './tabStyles';
import InvertedCorner from './InvertedCorner';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  closable?: boolean;
}

interface BrowserTabProps {
  tab: Tab;
  isSelected: boolean;
  colorMode: 'light' | 'dark';
  onSelect: () => void;
  onClose?: () => void;
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
}: BrowserTabProps) {
  const colors = getTabColors(colorMode);

  return (
    <Box
      position="relative"
      h="100%"
      display="flex"
      alignItems="flex-end"
    >
      <Flex
        onClick={onSelect}
        alignItems="center"
        gap={TAB_SPECS.iconGap}
        h={TAB_SPECS.barHeight}
        minW={TAB_SPECS.tabMinWidth}
        maxW={TAB_SPECS.tabMaxWidth}
        px={TAB_SPECS.tabPaddingX}
        py={TAB_SPECS.tabPaddingY}
        borderTopLeftRadius={TAB_SPECS.borderRadius}
        borderTopRightRadius={TAB_SPECS.borderRadius}
        borderBottomLeftRadius={0}
        borderBottomRightRadius={0}
        bg={isSelected ? colors.selectedBg : colors.unselectedBg}
        color={isSelected ? colors.selectedText : colors.unselectedText}
        fontSize={TAB_SPECS.fontSize}
        fontWeight={TAB_SPECS.fontWeight}
        cursor="pointer"
        transition={`all ${TAB_SPECS.hoverTransition}`}
        position="relative"
        zIndex={isSelected ? 1 : 0}
        border="none"
        outline="none"
        role="tab"
        tabIndex={0}
        aria-selected={isSelected}
        _hover={
          isSelected
            ? {}
            : {
                bg: colors.hoverBg,
                color: colors.selectedText,
              }
        }
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
        css={
          isSelected
            ? {
                // Bottom extension to cover any gap with content
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: '-1px',
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: colors.selectedBg,
                },
              }
            : undefined
        }
      >
        {/* Tab Icon */}
        {tab.icon && (
          <Icon
            as={tab.icon}
            boxSize={TAB_SPECS.iconSize}
            color={isSelected ? colors.iconSelected : colors.iconUnselected}
            flexShrink={0}
          />
        )}

        {/* Tab Label */}
        <Text
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          flex={1}
          textAlign="left"
        >
          {tab.label}
        </Text>

        {/* Close Button */}
        {tab.closable && onClose && (
          <Box
            as="span"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w={TAB_SPECS.closeSize}
            h={TAB_SPECS.closeSize}
            borderRadius="sm"
            ml={1}
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
              '[data-parent]:hover &': {
                opacity: 0.5,
              },
            }}
          >
            <Icon as={LuX} boxSize="10px" />
          </Box>
        )}
      </Flex>

      {/* Inverted corners for selected tab */}
      {isSelected && (
        <>
          <InvertedCorner colorMode={colorMode} position="left" />
          <InvertedCorner colorMode={colorMode} position="right" />
        </>
      )}
    </Box>
  );
}
