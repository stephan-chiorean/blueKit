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
        h={TAB_SPECS.tabHeight}
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
      >

        {/* Tab Icon */}
        {tab.icon && (
          <Icon
            as={tab.icon}
            boxSize={TAB_SPECS.iconSize}
            color={isSelected ? colors.iconSelected : colors.iconUnselected}
            flexShrink={0}
            zIndex={2} // Ensure content is above borders
            position="relative"
          />
        )}

        {/* Tab Label */}
        <Text
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          flex={1}
          textAlign="left"
          zIndex={2}
          position="relative"
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
            zIndex={2}
            position="relative"
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


    </Box>
  );
}
