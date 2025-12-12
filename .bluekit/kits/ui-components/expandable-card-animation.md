---
id: expandable-card-animation
alias: Expandable Card Animation
type: kit
is_base: false
version: 1
tags:
  - animation
  - ui-components
  - css-grid
description: Smooth expandable card component pattern using CSS Grid animations that allows cards to expand independently without affecting adjacent cards
---
# Expandable Card Animation Pattern

A reusable pattern for creating smooth, independent expandable cards that push content below them down without affecting adjacent cards. Uses CSS Grid `grid-template-rows` transitions for performant animations.

## Key Features

- **Smooth CSS Grid animations** - Uses `grid-template-rows` transitions instead of `max-height` for better performance
- **Independent expansion** - Each card expands individually without stretching adjacent cards
- **Natural content flow** - Expanding cards push content below them down smoothly
- **No layout shifts** - Cards maintain their width and align to the top

## Core Technique

### CSS Grid Animation

Instead of animating `max-height` (which can cause janky animations), we use CSS Grid's `grid-template-rows` property:

```css
.container {
  display: grid;
  grid-template-rows: 0fr; /* Collapsed */
  transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.container.expanded {
  grid-template-rows: 1fr; /* Expanded */
}

.content {
  min-height: 0; /* Critical: allows grid to shrink */
  overflow: hidden;
}
```

### Grid Layout Alignment

To prevent adjacent cards from stretching when one expands:

```css
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  align-items: start; /* Cards align to top, not stretch */
  gap: 1rem;
}

.card {
  height: fit-content; /* Size to content */
  align-self: start; /* Align to top of grid cell */
}
```

## Implementation

### Card Component Structure

```tsx
interface ExpandableCardProps {
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}

function ExpandableCard({ isExpanded, onToggle, title, children }: ExpandableCardProps) {
  return (
    <Card.Root
      variant='subtle'
      borderWidth='1px'
      borderColor='border.subtle'
      cursor='pointer'
      onClick={onToggle}
      position='relative'
      overflow='hidden'
      width='100%'
      height='fit-content'
      alignSelf='start'
    >
      <CardHeader>
        <Heading>{title}</Heading>
        <Icon
          transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
          transition='transform 0.2s'
        >
          <ChevronRight />
        </Icon>
      </CardHeader>
      
      <CardBody>
        {/* Expandable content */}
        <Box
          display='grid'
          css={{
            gridTemplateRows: isExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
          }}
          opacity={isExpanded ? 1 : 0}
          overflow='hidden'
        >
          <Box minHeight={0}>
            {children}
          </Box>
        </Box>
      </CardBody>
    </Card.Root>
  );
}
```

### Grid Container

```tsx
function CardGrid({ cards }: { cards: CardData[] }) {
  return (
    <SimpleGrid 
      columns={{ base: 1, md: 2, lg: 3 }} 
      gap={4}
      css={{
        alignItems: 'start', // Critical: prevents stretching
      }}
    >
      {cards.map((card) => (
        <ExpandableCard
          key={card.id}
          isExpanded={card.isExpanded}
          onToggle={() => toggleCard(card.id)}
          title={card.title}
        >
          {card.content}
        </ExpandableCard>
      ))}
    </SimpleGrid>
  );
}
```

## Key Properties Explained

### `grid-template-rows: 0fr` vs `1fr`
- `0fr` = 0 fractional units = collapsed (no height)
- `1fr` = 1 fractional unit = expanded (full content height)
- Smoothly transitions between states

### `min-height: 0` on Content
- Critical for CSS Grid to properly shrink
- Without it, grid items won't collapse below their content size
- Allows the grid row to shrink to 0fr

### `align-items: start` on Grid
- Prevents grid items from stretching to match tallest item
- Each card maintains its own height
- Cards align to the top of their grid cell

### `height: fit-content` on Card
- Card sizes to its content, not stretching
- Works with `align-self: start` for proper alignment

### `overflow: hidden` on Container
- Clips content during animation
- Prevents content from showing outside bounds
- Essential for smooth collapse animation

## Animation Timing

```tsx
transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out'
```

- **0.4s duration** - Smooth but not slow
- **cubic-bezier(0.4, 0, 0.2, 1)** - Material Design easing (smooth acceleration/deceleration)
- **Opacity transition** - Fades content in/out for polish

## Nested Expandable Sections

For nested expandable content (like subfolders), apply the same pattern:

```tsx
<Box
  display='grid'
  css={{
    gridTemplateRows: isNestedExpanded ? '1fr' : '0fr',
    transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
  }}
  opacity={isNestedExpanded ? 1 : 0}
  overflow='hidden'
  pl={4}
  mt={1}
>
  <Box minHeight={0}>
    {/* Nested content */}
  </Box>
</Box>
```

## Complete Example

```tsx
import { Box, Card, CardHeader, CardBody, Heading, SimpleGrid } from '@chakra-ui/react';
import { useState } from 'react';

interface CardData {
  id: string;
  title: string;
  content: React.ReactNode;
}

function ExpandableCardGrid() {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const cards: CardData[] = [
    { id: '1', title: 'Card 1', content: <div>Content 1</div> },
    { id: '2', title: 'Card 2', content: <div>Content 2</div> },
    { id: '3', title: 'Card 3', content: <div>Content 3</div> },
  ];

  return (
    <SimpleGrid 
      columns={{ base: 1, md: 2, lg: 3 }} 
      gap={4}
      css={{ alignItems: 'start' }}
    >
      {cards.map((card) => {
        const isExpanded = expandedCards.has(card.id);
        return (
          <Card.Root
            key={card.id}
            variant='subtle'
            borderWidth='1px'
            cursor='pointer'
            onClick={() => toggleCard(card.id)}
            overflow='hidden'
            width='100%'
            height='fit-content'
            alignSelf='start'
          >
            <CardHeader>
              <Heading>{card.title}</Heading>
            </CardHeader>
            <CardBody>
              <Box
                display='grid'
                css={{
                  gridTemplateRows: isExpanded ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
                }}
                opacity={isExpanded ? 1 : 0}
                overflow='hidden'
              >
                <Box minHeight={0}>
                  {card.content}
                </Box>
              </Box>
            </CardBody>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}
```

## Benefits Over max-height Approach

1. **Better Performance** - Animates actual layout space, not arbitrary large values
2. **Smoother Animation** - Browser can optimize grid transitions better
3. **Natural Flow** - Content pushes down naturally as layout space expands
4. **No Jank** - No need to guess max-height values or deal with animation stuttering

## Browser Support

- CSS Grid: Supported in all modern browsers
- `grid-template-rows` transitions: Supported in all modern browsers
- Fallback: For older browsers, can use `max-height` as fallback

## Usage Tips

1. Always include `minHeight: 0` on the content wrapper inside the grid
2. Use `align-items: start` on the grid container to prevent stretching
3. Set `height: fit-content` and `align-self: start` on individual cards
4. Use `overflow: hidden` on both the grid container and card
5. Apply the same pattern recursively for nested expandable sections

## Customization Tokens

- `{{animation-duration}}` - Animation duration (default: 0.4s)
- `{{easing-function}}` - Easing function (default: cubic-bezier(0.4, 0, 0.2, 1))
- `{{grid-columns}}` - Grid column configuration (default: { base: 1, md: 2, lg: 3 })
- `{{gap-size}}` - Gap between cards (default: 4)
