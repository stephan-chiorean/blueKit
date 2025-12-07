import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Textarea,
  IconButton,
  HStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { LuCopy, LuCheck, LuX } from 'react-icons/lu';

interface DraggableNotepadProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DraggableNotepad({ isOpen, onClose }: DraggableNotepadProps) {
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const notepadRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const copyNotes = async () => {
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy notes:', error);
    }
  };

  // Handle dragging
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent diagram panning
    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('button')) {
      return; // Don't start drag if clicking on a button
    }
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Handle resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      setSize({
        width: Math.max(300, resizeStart.width + deltaX),
        height: Math.max(200, resizeStart.height + deltaY),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart]);

  if (!isOpen) return null;

  return (
    <Box
      ref={notepadRef}
      position="absolute"
      left={`${position.x}px`}
      top={`${position.y}px`}
      width={`${size.width}px`}
      height={`${size.height}px`}
      bg="white"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      boxShadow="lg"
      zIndex={1000}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      onMouseDown={(e) => e.stopPropagation()} // Prevent diagram panning when clicking on notepad
      css={{
        animation: 'slideIn 0.2s ease-out',
        '@keyframes slideIn': {
          from: {
            opacity: 0,
            transform: 'scale(0.9) translateY(-10px)',
          },
          to: {
            opacity: 1,
            transform: 'scale(1) translateY(0)',
          },
        },
      }}
    >
      {/* Header - draggable */}
      <Box
        ref={headerRef}
        px={3}
        py={2}
        borderBottomWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
        cursor={isDragging ? 'grabbing' : 'grab'}
        onMouseDown={handleHeaderMouseDown}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexShrink={0}
      >
        <Text fontSize="sm" fontWeight="semibold" color="text.secondary">
          Notepad
        </Text>
        <HStack gap={1}>
          <IconButton
            size="xs"
            variant="ghost"
            onClick={copyNotes}
            disabled={!notes}
            aria-label="Copy notes"
            colorPalette={copied ? 'green' : undefined}
          >
            <Icon>
              {copied ? <LuCheck /> : <LuCopy />}
            </Icon>
          </IconButton>
          <IconButton
            size="xs"
            variant="ghost"
            onClick={onClose}
            aria-label="Close notepad"
          >
            <Icon>
              <LuX />
            </Icon>
          </IconButton>
        </HStack>
      </Box>

      {/* Textarea */}
      <Box 
        flex="1" 
        position="relative" 
        overflow="hidden"
        onMouseDown={(e) => e.stopPropagation()} // Prevent diagram panning when clicking in textarea
      >
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jot down your notes here..."
          resize="none"
          fontSize="sm"
          borderWidth={0}
          h="100%"
          _focus={{ boxShadow: 'none' }}
          onMouseDown={(e) => e.stopPropagation()} // Prevent diagram panning
        />
      </Box>

      {/* Resize handle */}
      <Box
        position="absolute"
        bottom={0}
        right={0}
        width="20px"
        height="20px"
        cursor="nwse-resize"
        onMouseDown={(e) => {
          e.stopPropagation(); // Prevent diagram panning
          handleResizeMouseDown(e);
        }}
        css={{
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '0',
            height: '0',
            borderLeft: '8px solid transparent',
            borderBottom: '8px solid',
            borderBottomColor: 'colors.border.subtle',
          },
        }}
      />
    </Box>
  );
}

