import { useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Field,
  Input,
  InputGroup,
  IconButton,
  Icon,
  Tag,
  Text,
} from '@chakra-ui/react';
import { LuX } from 'react-icons/lu';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nameFilter: string;
  onNameFilterChange: (value: string) => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  filterButtonRef?: React.RefObject<HTMLButtonElement>;
}

/**
 * FilterPanel - Shared filter overlay panel for artifact tabs.
 * 
 * Provides consistent filtering UI with:
 * - Name filter input
 * - Tag selection
 * - Click-outside-to-close behavior
 */
export function FilterPanel({
  isOpen,
  onClose,
  nameFilter,
  onNameFilterChange,
  allTags,
  selectedTags,
  onToggleTag,
  filterButtonRef,
}: FilterPanelProps) {
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        filterPanelRef.current &&
        filterButtonRef &&
        filterButtonRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, filterButtonRef]);

  if (!isOpen) return null;

  return (
    <Box
      ref={filterPanelRef}
      position="absolute"
      top="50px"
      left={0}
      zIndex={10}
      w="300px"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={4}
      bg="white"
      boxShadow="lg"
    >
      <VStack align="stretch" gap={4}>
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <InputGroup
            endElement={nameFilter ? (
              <IconButton
                size="xs"
                variant="ghost"
                aria-label="Clear name filter"
                onClick={() => onNameFilterChange('')}
              >
                <Icon>
                  <LuX />
                </Icon>
              </IconButton>
            ) : undefined}
          >
            <Input
              placeholder="Filter by name..."
              value={nameFilter}
              onChange={(e) => onNameFilterChange(e.target.value)}
            />
          </InputGroup>
        </Field.Root>

        {allTags.length > 0 && (
          <Field.Root>
            <Field.Label>Tags</Field.Label>
            <HStack gap={1} flexWrap="wrap" mt={2}>
              {allTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Tag.Root
                    key={tag}
                    size="sm"
                    variant={isSelected ? 'solid' : 'subtle'}
                    colorPalette={isSelected ? 'primary' : undefined}
                    cursor="pointer"
                    onClick={() => onToggleTag(tag)}
                    opacity={isSelected ? 1 : 0.6}
                    _hover={{ opacity: 1 }}
                  >
                    <Tag.Label>{tag}</Tag.Label>
                  </Tag.Root>
                );
              })}
            </HStack>
          </Field.Root>
        )}
      </VStack>
    </Box>
  );
}

