import {
  Box,
  Flex,
  HStack,
  IconButton,
  Heading,
  Text,
  Icon,
  Switch,
  Input,
} from "@chakra-ui/react";
import {
  LuBell,
  LuNotebookPen,
  LuMenu,
  LuSearch,
} from "react-icons/lu";
import { Project } from "../ipc";
import QuickTaskPopover from "./tasks/QuickTaskPopover";
import { useColorMode } from "../contexts/ColorModeContext";
import { useNotepad } from "../contexts/NotepadContext";
import { useTimer } from "../contexts/TimerContext";
import { useQuickTaskPopover } from "../contexts/QuickTaskPopoverContext";
import TimerPopover from "./shared/TimerPopover";
import UserProfileButton from "./shared/UserProfileButton";
import { FaMoon, FaSun } from "react-icons/fa";
import { ActiveLogo as BlueKitLogo } from "./logo";

import NavigationMenu from "./NavigationDrawer";

interface HeaderProps {
  currentProject?: Project;
  onNavigateToTasks?: () => void;
  hideNavigation?: boolean;
}

export default function Header({
  currentProject,
  onNavigateToTasks,
  hideNavigation = false,
}: HeaderProps = {}) {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen: isNotepadOpen, toggleNotepad } = useNotepad();
  const { isPinned, elapsedTime, formatTime } = useTimer();
  const {
    isOpen: isPopoverOpen,
    setOpen: setPopoverOpen,
    popoverOptions,
    closePopover,
  } = useQuickTaskPopover();

  // Glass styling for light/dark mode
  const headerBg =
    colorMode === "light"
      ? "rgba(255, 255, 255, 0.3)"
      : "rgba(20, 20, 25, 0.15)";

  // Determine search placeholder based on context
  const searchPlaceholder = currentProject
    ? "Search Project... "
    : "Search Vault...";

  return (
    <Box
      pl={3}
      pr={6}
      py={2}
      position="sticky"
      top={0}
      zIndex={10}
      style={{
        background: headerBg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <Flex align="center" justify="space-between" gap={4}>
        {/* blueKit branding on the left with navigation menu */}
        <HStack gap={1} flex="1">
          {!hideNavigation && (
            <NavigationMenu>
              {({ onOpen }) => (
                <IconButton
                  variant="ghost"
                  size="md"
                  aria-label="Open navigation menu"
                  onClick={onOpen}
                  _hover={{ bg: "transparent" }}
                  ml={-2}
                >
                  <LuMenu />
                </IconButton>
              )}
            </NavigationMenu>
          )}
          <BlueKitLogo size={28} />
          <Heading size="xl">
            <Text
              as="span"
              color="primary.500"
              css={{
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                _dark: {
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                },
              }}
            >
              blue
            </Text>
            <Text
              as="span"
              css={{
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                _dark: {
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                },
              }}
            >
              Kit
            </Text>
          </Heading>
        </HStack>

        {/* Center Search Bar */}
        <Box
          flex="2"
          display="flex"
          justifyContent="center"
          maxW="600px"
          px={4}
        >
          <Box position="relative" width="100%" maxW="400px">
            <Box
              position="absolute"
              left={4}
              top="50%"
              transform="translateY(-50%)"
              pointerEvents="none"
              zIndex={2}
              color="gray.400"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={LuSearch} fontSize="lg" />
            </Box>
            <Input
              pl={12}
              placeholder={searchPlaceholder}
              variant="subtle"
              size="lg"
              borderRadius="xl"
              bg={colorMode === "light" ? "whiteAlpha.600" : "blackAlpha.300"}
              border="1px solid"
              borderColor={
                colorMode === "light" ? "whiteAlpha.400" : "whiteAlpha.100"
              }
              fontSize="md"
              _placeholder={{ color: "gray.500" }}
              _hover={{
                bg: colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400",
                borderColor:
                  colorMode === "light" ? "whiteAlpha.400" : "whiteAlpha.100",
              }}
              _focus={{
                bg: colorMode === "light" ? "white" : "blackAlpha.500",
                borderColor:
                  colorMode === "light" ? "whiteAlpha.400" : "whiteAlpha.100",
                boxShadow: "none",
                outline: "none",
              }}
              css={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                transition: "all 0.2s",
              }}
            />
          </Box>
        </Box>

        {/* Right side icons */}
        <HStack gap={2} flex="1" justify="flex-end">
          {/* Pinned Timer Display */}
          {isPinned && (
            <Text
              fontSize="sm"
              fontWeight="medium"
              fontFamily="mono"
              color="primary.500"
              letterSpacing="0.05em"
              px={2}
              py={1}
            >
              {formatTime(elapsedTime)}
            </Text>
          )}

          {/* Dark Mode Toggle */}
          <Switch.Root
            checked={colorMode === "dark"}
            onCheckedChange={toggleColorMode}
            colorPalette="blue"
            size="lg"
            cursor="pointer"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
              <Switch.Indicator
                fallback={<Icon as={FaSun} color="orange.400" />}
              >
                <Icon as={FaMoon} color="yellow.400" />
              </Switch.Indicator>
            </Switch.Control>
          </Switch.Root>

          <QuickTaskPopover
            currentProject={currentProject}
            onNavigateToTasks={onNavigateToTasks}
            open={isPopoverOpen}
            onOpenChange={(open) => {
              setPopoverOpen(open);
              if (!open) {
                closePopover();
              }
            }}
            defaultView={popoverOptions.defaultView}
            defaultProjectId={popoverOptions.defaultProjectId}
            onTaskCreated={popoverOptions.onTaskCreated}
          />

          <TimerPopover />

          <IconButton
            variant="ghost"
            size="sm"
            aria-label={isNotepadOpen ? "Close notepad" : "Open notepad"}
            onClick={toggleNotepad}
            _hover={{ bg: "transparent" }}
          >
            <LuNotebookPen />
          </IconButton>

          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Notifications"
            _hover={{ bg: "transparent" }}
          >
            <LuBell />
          </IconButton>

          {/* User Profile / Auth */}
          <UserProfileButton />
        </HStack>
      </Flex>
    </Box>
  );
}
