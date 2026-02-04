import { Box, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { createPortal } from 'react-dom';
import { LuArrowRight, LuX } from 'react-icons/lu';
import { Task } from '@/types/task';

interface DragTooltipProps {
  task: Task;
  targetSection: 'in_progress' | 'backlog' | null;
  position: { x: number; y: number };
  isValidDrop: boolean;
}

export default function DragTooltip({ task, targetSection, position, isValidDrop }: DragTooltipProps) {
  const targetLabel = targetSection === 'in_progress' ? 'In Progress' :
                      targetSection === 'backlog' ? 'Backlog' : 'Invalid';
  const colorPalette = isValidDrop ? 'blue' : 'red';

  return createPortal(
    <Box
      position="fixed"
      left={position.x + 15}
      top={position.y + 15}
      zIndex={9999}
      pointerEvents="none"
      py={2}
      px={3}
      borderRadius="md"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.emphasized"
      boxShadow="lg"
      maxW="300px"
    >
      <VStack gap={1} align="start">
        <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
          {task.title}
        </Text>
        <HStack gap={2}>
          <Icon color={`${colorPalette}.500`}>
            {isValidDrop ? <LuArrowRight /> : <LuX />}
          </Icon>
          <Text fontSize="xs" color={`${colorPalette}.600`}>
            {isValidDrop ? `Move to ${targetLabel}` : 'Cannot drop here'}
          </Text>
        </HStack>
      </VStack>
    </Box>,
    document.body
  );
}
