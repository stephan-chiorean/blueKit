import { HStack, Button, Icon, Text, Flex } from '@chakra-ui/react';
import { LuFilter, LuFolderPlus, LuLayoutGrid, LuTable } from 'react-icons/lu';

interface ArtifactToolbarProps {
  onNewFolder: () => void;
  onToggleFilter: () => void;
  isFilterOpen: boolean;
  viewMode: 'card' | 'table';
  onViewModeChange: (mode: 'card' | 'table') => void;
  showViewModeSwitcher?: boolean;
  filterButtonRef?: React.RefObject<HTMLButtonElement>;
}

/**
 * ArtifactToolbar - Shared toolbar for artifact tabs (kits, walkthroughs, diagrams).
 * 
 * Provides consistent layout with:
 * - Filter button (left)
 * - New Folder button (right)
 * - Optional view mode switcher (card/table)
 * 
 * Note: This is a regular toolbar component, not a Chakra UI ActionBar.
 * For floating action bars that appear on selection, see GlobalActionBar.
 */
export function ArtifactToolbar({
  onNewFolder,
  onToggleFilter,
  isFilterOpen,
  viewMode,
  onViewModeChange,
  showViewModeSwitcher = true,
  filterButtonRef,
}: ArtifactToolbarProps) {
  return (
    <Flex justify="space-between" align="center">
      <HStack gap={2}>
        {/* Filter Button */}
        <Button
          ref={filterButtonRef}
          variant="ghost"
          size="sm"
          onClick={onToggleFilter}
          bg={isFilterOpen ? "bg.subtle" : "bg.subtle"}
          borderWidth="1px"
          borderColor="border.subtle"
          _hover={{ bg: "bg.subtle" }}
        >
          <HStack gap={2}>
            <Icon>
              <LuFilter />
            </Icon>
            <Text>Filter</Text>
          </HStack>
        </Button>

        {/* New Folder Button (next to Filter) */}
        <Button
          size="sm"
          onClick={onNewFolder}
          colorPalette="blue"
          variant="subtle"
        >
          <HStack gap={2}>
            <Icon>
              <LuFolderPlus />
            </Icon>
            <Text>New Folder</Text>
          </HStack>
        </Button>
      </HStack>

      {/* View Mode Switcher (Right) */}
      {showViewModeSwitcher && (
        <HStack gap={0} borderWidth="1px" borderColor="border.subtle" borderRadius="md" overflow="hidden" bg="bg.subtle">
          <Button
            onClick={() => onViewModeChange('card')}
            variant="ghost"
            borderRadius={0}
            borderRightWidth="1px"
            borderRightColor="border.subtle"
            bg={viewMode === 'card' ? 'bg.surface' : 'transparent'}
            color={viewMode === 'card' ? 'text.primary' : 'text.secondary'}
            _hover={{ bg: viewMode === 'card' ? 'bg.surface' : 'bg.subtle' }}
          >
            <HStack gap={2}>
              <Icon>
                <LuLayoutGrid />
              </Icon>
              <Text>Cards</Text>
            </HStack>
          </Button>
          <Button
            onClick={() => onViewModeChange('table')}
            variant="ghost"
            borderRadius={0}
            bg={viewMode === 'table' ? 'bg.surface' : 'transparent'}
            color={viewMode === 'table' ? 'text.primary' : 'text.secondary'}
            _hover={{ bg: viewMode === 'table' ? 'bg.surface' : 'bg.subtle' }}
          >
            <HStack gap={2}>
              <Icon>
                <LuTable />
              </Icon>
              <Text>Table</Text>
            </HStack>
          </Button>
        </HStack>
      )}
    </Flex>
  );
}



