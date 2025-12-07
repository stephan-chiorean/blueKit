---
id: draggable-notepad
alias: Draggable Notepad Component
type: kit
is_base: false
version: 1
tags:
  - react
  - chakra-ui
  - draggable
description: A draggable and resizable notepad overlay component with copy-to-clipboard functionality and smooth animations
---
# Draggable Notepad Component

A fully interactive notepad component that can be dragged around and resized. Perfect for overlaying on diagrams, images, or any content where users need to take notes without interfering with underlying interactions.

## Features

- **Drag to Move**: Click and drag the header to reposition the notepad
- **Resizable**: Drag the bottom-right corner to resize (minimum 300x200px)
- **Copy to Clipboard**: One-click copy button with visual feedback
- **Smooth Animations**: Slide-in animation when opening
- **Event Isolation**: Prevents underlying content interactions (e.g., diagram panning)
- **No Persistence**: Notes are stored in component state only (no saving)

## Component Structure

```typescript
interface DraggableNotepadProps {
  isOpen: boolean;
  onClose: () => void;
}
```

## Implementation

### State Management

The component manages several pieces of state:

- `notes`: The text content of the notepad
- `copied`: Boolean flag for copy button feedback
- `position`: Current x, y position of the notepad
- `size`: Current width and height
- `isDragging`: Whether the notepad is being dragged
- `isResizing`: Whether the notepad is being resized
- `dragStart`: Initial mouse position when dragging starts
- `resizeStart`: Initial size and position when resizing starts

### Drag Functionality

1. **Header Mouse Down**: 
   - Stops event propagation to prevent underlying interactions
   - Sets `isDragging` to true
   - Records initial mouse position relative to notepad position

2. **Mouse Move Handler**:
   - Updates position based on mouse movement
   - Uses document-level event listeners for smooth dragging

3. **Mouse Up Handler**:
   - Cleans up event listeners
   - Resets `isDragging` state

### Resize Functionality

1. **Resize Handle Mouse Down**:
   - Stops event propagation
   - Sets `isResizing` to true
   - Records initial size and mouse position

2. **Mouse Move Handler**:
   - Calculates delta from initial position
   - Updates size with minimum constraints (300x200px)

3. **Mouse Up Handler**:
   - Cleans up event listeners
   - Resets `isResizing` state

### Copy to Clipboard

Uses the Clipboard API to copy notes text:

```typescript
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
```

### Event Isolation

Critical for preventing interference with underlying content:

- `onMouseDown={(e) => e.stopPropagation()}` on the notepad container
- `e.stopPropagation()` in all drag and resize handlers
- Prevents diagram panning, canvas interactions, etc.

## Usage Example

```typescript
import DraggableNotepad from './DraggableNotepad';

function DiagramViewer() {
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);

  return (
    <Box position="relative">
      <IconButton
        onClick={() => setIsNotepadOpen(!isNotepadOpen)}
        aria-label="Toggle notepad"
      >
        <LuStickyNote />
      </IconButton>
      
      <DraggableNotepad
        isOpen={isNotepadOpen}
        onClose={() => setIsNotepadOpen(false)}
      />
    </Box>
  );
}
```

## Styling

- Uses Chakra UI components for consistent styling
- Absolute positioning for overlay behavior
- Box shadow for depth
- Smooth CSS animations for open/close
- Resize handle uses CSS pseudo-element for visual indicator

## Dependencies

- React (useState, useRef, useEffect)
- Chakra UI (Box, Textarea, IconButton, HStack, Text, Icon)
- React Icons (LuCopy, LuCheck, LuX)

## Customization Points

- Initial position: Change default `{ x: 100, y: 100 }`
- Initial size: Change default `{ width: 400, height: 300 }`
- Minimum size: Adjust `Math.max(300, ...)` and `Math.max(200, ...)`
- Animation: Modify CSS keyframes in the `css` prop
- Placeholder text: Change "Jot down your notes here..."
- Header label: Change "Notepad" to any text

## Best Practices

1. **Always stop propagation** on mouse events to prevent underlying interactions
2. **Use document-level listeners** for drag/resize to work outside component bounds
3. **Clean up event listeners** in useEffect cleanup functions
4. **Provide visual feedback** for interactive states (cursor changes, copy confirmation)
5. **Set minimum constraints** to prevent unusably small sizes
6. **Use refs** for DOM elements that need direct access

## Integration Notes

- Position the notepad within a relatively positioned container
- Ensure parent container has appropriate z-index stacking context
- Works well with overlays, modals, and interactive content
- Can be extended with persistence, auto-save, or additional features
