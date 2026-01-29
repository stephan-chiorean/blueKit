import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';
import { getTabColors, TAB_SPECS } from './tabStyles';


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
    <Flex
      onClick={onSelect}
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
      cursor="pointer"
      position="relative"
      zIndex={isSelected ? 2 : 1}
      marginBottom="0px"
      outline="none"
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
            color={isSelected ? colors.iconSelected : colors.iconUnselected}
            flexShrink={0}
          />
        )}

        {/* Tab Label - takes remaining space, truncates */}
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

        {/* Close Button - always in DOM, visible on hover or when selected */}
        {tab.closable && onClose && (
          <Box
            as="span"
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
