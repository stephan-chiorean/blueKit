import { useState } from 'react';
import {
  Popover,
  Portal,
  Button,
  VStack,
  HStack,
  Text,
  Icon,
  Flex,
  IconButton,
} from '@chakra-ui/react';
import { LuClock, LuPlay, LuPause, LuRotateCcw, LuPin, LuPinOff } from 'react-icons/lu';
import { useTimer } from '../../contexts/TimerContext';

export default function TimerPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    isPinned,
    isRunning,
    elapsedTime,
    togglePin,
    startTimer,
    stopTimer,
    restartTimer,
    formatTime,
  } = useTimer();

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Popover.Trigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          _hover={{ bg: 'transparent' }}
          _active={{ bg: 'transparent' }}
          data-state={isOpen ? 'open' : 'closed'}
          css={{
            '&[data-state="open"]': {
              backgroundColor: 'transparent',
            },
          }}
        >
          <Icon>
            <LuClock />
          </Icon>
        </Button>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner>
          <Popover.Content width="280px">
            <Popover.Header>
              <Flex align="center" justify="space-between" width="full">
                <Text fontWeight="semibold">Timer</Text>
                <IconButton
                  variant="ghost"
                  size="xs"
                  onClick={togglePin}
                  aria-label={isPinned ? 'Unpin timer' : 'Pin timer'}
                  opacity={0.6}
                  _hover={{ opacity: 1 }}
                >
                  <Icon>
                    {isPinned ? <LuPinOff /> : <LuPin />}
                  </Icon>
                </IconButton>
              </Flex>
            </Popover.Header>

            <Popover.Body>
              <VStack gap={4} py={2}>
                {/* Timer Display */}
                <Text
                  fontSize="4xl"
                  fontWeight="bold"
                  fontFamily="mono"
                  color="primary.500"
                  letterSpacing="0.1em"
                >
                  {formatTime(elapsedTime)}
                </Text>

                {/* Control Buttons */}
                <HStack gap={2} width="full" justify="center">
                  {!isRunning ? (
                    <Button
                      colorPalette="primary"
                      size="sm"
                      onClick={startTimer}
                      flex="1"
                    >
                      <HStack gap={2}>
                        <Icon>
                          <LuPlay />
                        </Icon>
                        <Text>Start</Text>
                      </HStack>
                    </Button>
                  ) : (
                    <Button
                      colorPalette="gray"
                      size="sm"
                      onClick={stopTimer}
                      flex="1"
                    >
                      <HStack gap={2}>
                        <Icon>
                          <LuPause />
                        </Icon>
                        <Text>Stop</Text>
                      </HStack>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={restartTimer}
                    disabled={elapsedTime === 0}
                  >
                    <Icon>
                      <LuRotateCcw />
                    </Icon>
                  </Button>
                </HStack>
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
