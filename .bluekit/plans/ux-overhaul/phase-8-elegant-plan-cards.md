# Phase 8: Elegant Plan Cards with Progress & Milestones

## Problem Statement

The current plan cards lack the refined, table-like aesthetic that the rest of the application uses (via `ElegantList`). Plans are complex entities with progress, milestones, phases, and tasks, but the current UI doesn't effectively communicate this information in a visually organized way.

**Desired Outcome:**
- Plan cards that match the `ElegantList` style/vibe (clean, table-like, professional)
- Expanded to show plan-specific data: progress bars, milestones, phases
- Consistent hover states, selection behavior, and interaction patterns
- Responsive design that works across different screen sizes

## Design Reference

**Base Component:** `src/shared/components/ElegantList.tsx`

**Key Style Characteristics:**
- Clean header row with column labels (uppercase, subtle text)
- Row-based layout with consistent padding/spacing
- Hover states with subtle background changes
- Border-based separation (subtle borders, not heavy dividers)
- Icon + text combinations with proper spacing
- Badge usage for metadata (tags, status)
- Responsive column visibility (`display={{ base: "none", md: "block" }}`)
- Selection checkboxes aligned to the right
- Actions column with 3-dot menu or inline buttons

**Currently Used In:**
- `src/views/project/sections/KitsSection.tsx` - Kits listing
- `src/views/project/sections/TasksSection.tsx` - Tasks listing (likely)
- Folder views across the app

## Plan Card Requirements

### Data to Display

**Core Information:**
- Plan name (title)
- Description (truncated with ellipsis)
- Status badge (Active, Completed, Paused, Archived)
- Phase count (e.g., "5 phases")
- Task count (e.g., "12 tasks")
- Completion percentage (e.g., "67%")

**Progress Visualization:**
- Horizontal progress bar showing overall completion
- Color-coded based on status (blue for active, green for completed, gray for paused)
- Percentage label inline with progress bar

**Milestone Information:**
- Next upcoming milestone (if any)
- Last completed milestone (if any)
- Milestone count (e.g., "3 of 5 milestones")

**Metadata:**
- Tags (similar to kits)
- Created date
- Last updated date
- Owner/creator (optional)

**Actions:**
- View/Open plan
- Edit plan
- Archive/Unarchive
- Delete
- Duplicate (optional)
- Export (optional)

## Component Structure

### 1. Create ElegantPlanList Component

**File:** `src/shared/components/ElegantPlanList.tsx`

**Why separate component?**
- Plans have unique data structures (progress, milestones, phases)
- Can extend `ElegantList` patterns while customizing for plan-specific needs
- Keeps `ElegantList` generic and reusable

**Props Interface:**
```typescript
interface ElegantPlanListProps {
    plans: Plan[];
    onPlanClick: (plan: Plan) => void;
    onPlanContextMenu?: (e: React.MouseEvent, plan: Plan) => void;

    // Selection
    selectable?: boolean;
    selectedIds?: Set<string>;
    onSelectionChange?: (ids: Set<string>) => void;

    // Actions
    renderActions?: (plan: Plan) => ReactNode;
    renderInlineActions?: (plan: Plan) => ReactNode;

    // Loading state
    loading?: boolean;

    // Empty state
    emptyMessage?: string;
}
```

**Plan Interface (extend existing or create new):**
```typescript
interface Plan {
    id: string;
    name: string;
    description?: string;
    status: 'active' | 'completed' | 'paused' | 'archived';

    // Progress
    totalTasks: number;
    completedTasks: number;
    progress: number; // 0-100 percentage

    // Phases
    phases: Phase[];
    currentPhaseIndex?: number;

    // Milestones
    milestones: Milestone[];
    nextMilestone?: Milestone;
    lastCompletedMilestone?: Milestone;

    // Metadata
    tags?: string[];
    createdAt: string | number;
    updatedAt: string | number;
    owner?: string;

    // File info (if file-based like kits)
    path?: string;
}

interface Phase {
    id: string;
    name: string;
    description?: string;
    tasks: Task[];
    order: number;
    completed: boolean;
}

interface Milestone {
    id: string;
    name: string;
    description?: string;
    targetDate?: string;
    completedDate?: string;
    phase?: string; // Reference to phase ID
    completed: boolean;
}
```

### 2. Layout Design

**Column Structure:**

| Column | Width | Content | Responsive |
|--------|-------|---------|------------|
| **Name** | `flex: 1` | Icon + Title + Description | Always visible |
| **Progress** | `200px` | Progress bar + percentage | `display: { base: "none", lg: "block" }` |
| **Milestones** | `180px` | Next milestone name + date | `display: { base: "none", md: "block" }` |
| **Status** | `100px` | Status badge | Always visible |
| **Updated** | `100px` | Last updated date | `display: { base: "none", sm: "block" }` |
| **Actions** | `40px` or `auto` | 3-dot menu or inline buttons | Always visible |
| **Checkbox** | `32px` | Selection checkbox | Conditional (if selectable) |

**Example Row Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Name Column (flex)        │ Progress │ Milestones │ Status │ Updated │ Actions │ ☑️ │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ 📋 UX Overhaul            │ ████░░░░ │ Phase 6    │ Active │ Jan 15  │   ⋮    │ ☑️ │
│ Redesign app interface    │ 67%      │ Due Jan 20 │        │         │        │    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3. Name Column (Expanded)

**Structure:**
```tsx
<Flex flex="1" align="center" gap={3} minW={0} pr={4}>
    {/* Icon */}
    <Icon as={getPlanStatusIcon(plan.status)} boxSize={5} color={getPlanStatusColor(plan.status)} />

    <Box minW={0} overflow="hidden" flex={1}>
        <HStack gap={2} align="center">
            {/* Title */}
            <Text fontWeight="medium" fontSize="sm" color="fg" truncate>
                {plan.name}
            </Text>

            {/* Phase/Task count badges */}
            <Badge size="sm" variant="outline" colorPalette="gray">
                {plan.phases.length} phases
            </Badge>
            <Badge size="sm" variant="outline" colorPalette="blue">
                {plan.completedTasks}/{plan.totalTasks} tasks
            </Badge>
        </HStack>

        {/* Description */}
        {plan.description && (
            <Text fontSize="xs" color="text.muted" truncate>
                {plan.description}
            </Text>
        )}

        {/* Tags (if any) */}
        {plan.tags && plan.tags.length > 0 && (
            <HStack gap={1} mt={1}>
                {plan.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} size="xs" variant="subtle" colorPalette="gray">
                        {tag}
                    </Badge>
                ))}
                {plan.tags.length > 3 && (
                    <Text fontSize="xs" color="text.muted">+{plan.tags.length - 3}</Text>
                )}
            </HStack>
        )}
    </Box>
</Flex>
```

### 4. Progress Column

**Structure:**
```tsx
<Box width="200px" display={{ base: "none", lg: "block" }}>
    <VStack gap={1} align="stretch">
        {/* Progress Bar */}
        <Box position="relative" h="6px" bg="bg.subtle" borderRadius="full" overflow="hidden">
            <Box
                position="absolute"
                top={0}
                left={0}
                h="100%"
                w={`${plan.progress}%`}
                bg={getProgressColor(plan.status, plan.progress)}
                borderRadius="full"
                transition="width 0.3s ease"
            />
        </Box>

        {/* Percentage + Count */}
        <HStack justify="space-between">
            <Text fontSize="xs" fontWeight="medium" color="fg">
                {plan.progress}%
            </Text>
            <Text fontSize="xs" color="text.muted">
                {plan.completedTasks} of {plan.totalTasks}
            </Text>
        </HStack>
    </VStack>
</Box>
```

**Progress Color Logic:**
```typescript
function getProgressColor(status: Plan['status'], progress: number): string {
    if (status === 'completed') return 'green.500';
    if (status === 'paused') return 'gray.400';
    if (status === 'archived') return 'gray.300';

    // Active - color code by progress
    if (progress >= 75) return 'blue.500';
    if (progress >= 50) return 'blue.400';
    if (progress >= 25) return 'blue.300';
    return 'blue.200';
}
```

### 5. Milestones Column

**Structure:**
```tsx
<Box width="180px" display={{ base: "none", md: "block" }}>
    {plan.nextMilestone ? (
        <VStack gap={0.5} align="start">
            <HStack gap={1}>
                <Icon as={LuFlag} boxSize={3} color="orange.500" />
                <Text fontSize="xs" fontWeight="medium" color="fg" truncate>
                    {plan.nextMilestone.name}
                </Text>
            </HStack>
            {plan.nextMilestone.targetDate && (
                <Text fontSize="xs" color="text.muted">
                    Due {formatDate(plan.nextMilestone.targetDate)}
                </Text>
            )}
        </VStack>
    ) : plan.lastCompletedMilestone ? (
        <VStack gap={0.5} align="start">
            <HStack gap={1}>
                <Icon as={LuCheckCircle} boxSize={3} color="green.500" />
                <Text fontSize="xs" color="text.muted" truncate>
                    {plan.lastCompletedMilestone.name}
                </Text>
            </HStack>
        </VStack>
    ) : (
        <Text fontSize="xs" color="text.muted">
            No milestones
        </Text>
    )}
</Box>
```

### 6. Status Column

**Structure:**
```tsx
<Box width="100px">
    <Badge
        size="sm"
        variant="subtle"
        colorPalette={getStatusColorPalette(plan.status)}
    >
        {getStatusLabel(plan.status)}
    </Badge>
</Box>
```

**Status Utilities:**
```typescript
function getStatusColorPalette(status: Plan['status']): string {
    switch (status) {
        case 'active': return 'blue';
        case 'completed': return 'green';
        case 'paused': return 'gray';
        case 'archived': return 'gray';
        default: return 'gray';
    }
}

function getStatusLabel(status: Plan['status']): string {
    switch (status) {
        case 'active': return 'Active';
        case 'completed': return 'Completed';
        case 'paused': return 'Paused';
        case 'archived': return 'Archived';
        default: return 'Unknown';
    }
}

function getPlanStatusIcon(status: Plan['status']): IconType {
    switch (status) {
        case 'active': return LuPlayCircle;
        case 'completed': return LuCheckCircle;
        case 'paused': return LuPauseCircle;
        case 'archived': return LuArchive;
        default: return LuFileText;
    }
}

function getPlanStatusColor(status: Plan['status']): string {
    switch (status) {
        case 'active': return 'blue.500';
        case 'completed': return 'green.500';
        case 'paused': return 'gray.400';
        case 'archived': return 'gray.400';
        default: return 'gray.500';
    }
}
```

## Implementation Steps

### Step 1: Create Base Component

**File:** `src/shared/components/ElegantPlanList.tsx`

1. Copy structure from `ElegantList.tsx` as starting point
2. Modify for plan-specific data structure
3. Add progress bar component
4. Add milestone column component
5. Implement status badge logic
6. Add utility functions for colors/icons

### Step 2: Update Plan Data Structure

**File:** `src/types/plan.ts` (create if doesn't exist)

1. Define `Plan`, `Phase`, `Milestone` interfaces
2. Add type guards (`isPlan`, `isPhase`, etc.)
3. Export utility functions for calculating progress
4. Add date formatting helpers

### Step 3: Integrate into PlansSection

**File:** `src/views/project/sections/PlansSection.tsx` (or wherever plans are displayed)

1. Import `ElegantPlanList`
2. Replace existing plan cards/list with new component
3. Wire up event handlers (onClick, onContextMenu, etc.)
4. Add selection state management (similar to KitsSection)
5. Add actions menu with plan-specific actions

### Step 4: Add Selection Footer (Optional)

**File:** `src/views/project/sections/components/PlansSelectionFooter.tsx`

Similar to `KitsSelectionFooter`, create footer for bulk plan actions:
- Archive selected plans
- Delete selected plans
- Export selected plans
- Change status in bulk

## Advanced Features (Future Enhancements)

### Expandable Rows

Allow rows to expand and show:
- List of phases with mini progress bars
- Timeline visualization
- Recent activity/changes
- Assigned team members (if applicable)

**Trigger:** Click chevron icon on left side of row

**Implementation:**
```tsx
const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());

// In row render:
<Icon
    as={expandedPlanIds.has(plan.id) ? LuChevronDown : LuChevronRight}
    onClick={(e) => {
        e.stopPropagation();
        toggleExpanded(plan.id);
    }}
/>

{expandedPlanIds.has(plan.id) && (
    <Box p={4} bg="bg.subtle" borderTop="1px solid" borderColor="border.subtle">
        <PlanDetailsExpanded plan={plan} />
    </Box>
)}
```

### Inline Editing

Double-click plan name to edit inline (similar to folder renaming):
- Show input field in place of title
- Save on Enter or blur
- Cancel on Escape

### Drag-and-Drop Reordering

Similar to task reordering:
- Allow dragging plans to reorder
- Show drop indicator line
- Persist order to backend

### Filtering & Sorting

Add filter panel (like KitsSection):
- Filter by status (Active, Completed, etc.)
- Filter by tags
- Filter by date range
- Sort by name, progress, updated date

### Grouping

Group plans by:
- Status
- Phase count
- Tags
- Date created (This week, This month, Older)

## Visual Design Details

### Color Palette

**Progress Colors:**
- Active (high): `blue.500` (#3182CE)
- Active (medium): `blue.400` (#4299E1)
- Active (low): `blue.200` (#90CDF4)
- Completed: `green.500` (#38A169)
- Paused: `gray.400` (#A0AEC0)
- Archived: `gray.300` (#CBD5E0)

**Status Badge Colors:**
- Active: `blue.50` bg, `blue.700` text (light mode)
- Completed: `green.50` bg, `green.700` text (light mode)
- Paused: `gray.100` bg, `gray.700` text (light mode)
- Archived: `gray.100` bg, `gray.600` text (light mode)

### Spacing & Sizing

**Row Height:**
- Collapsed: `py={3}` (~48px total with borders)
- Expanded: Variable based on content

**Icon Sizes:**
- Plan status icon: `boxSize={5}` (20px)
- Milestone icon: `boxSize={3}` (12px)
- Chevron (expandable): `boxSize={4}` (16px)

**Progress Bar:**
- Height: `6px` (collapsed) or `8px` (if larger variant needed)
- Border radius: `full` (pill shape)
- Transition: `width 0.3s ease` for smooth updates

### Hover & Interaction States

**Row Hover:**
```tsx
_hover={{
    bg: isSelected ? selectedBg : hoverBg,
    '& [data-action-buttons]': { opacity: 1 }, // Show inline actions on hover
}}
```

**Progress Bar Hover:**
- Show tooltip with exact counts: "45 of 67 tasks completed"
- Slight glow effect on bar

**Milestone Hover:**
- Show tooltip with full milestone details
- Phase assignment (if any)
- Target vs actual completion dates

## Accessibility

### Keyboard Navigation

- **Tab**: Move between rows
- **Enter**: Open selected plan
- **Space**: Toggle selection checkbox
- **Arrow Up/Down**: Navigate rows
- **Arrow Right/Left**: Expand/collapse row (if expandable)

### Screen Reader Support

- Proper ARIA labels on all interactive elements
- Progress bar uses `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Status badges use `aria-label` with full status text
- Action buttons have descriptive `aria-label`

### Focus Indicators

- Visible focus ring on all interactive elements
- Focus trap in context menus
- Keyboard shortcuts documented

## Testing Checklist

- [ ] Plan list renders correctly with 0 plans (empty state)
- [ ] Plan list renders correctly with 1 plan
- [ ] Plan list renders correctly with 100+ plans (performance)
- [ ] Progress bar displays correct percentage
- [ ] Progress bar updates smoothly when plan changes
- [ ] Milestone column shows next milestone correctly
- [ ] Milestone column shows last completed when no upcoming
- [ ] Status badge displays correct color for each status
- [ ] Selection checkboxes work correctly (individual + select all)
- [ ] Context menu opens on right-click
- [ ] Inline actions appear on hover
- [ ] Responsive columns hide/show at correct breakpoints
- [ ] Hover states work correctly (row highlight, action reveal)
- [ ] Click on row opens plan detail view
- [ ] Click on checkbox toggles selection (doesn't open plan)
- [ ] Drag-and-drop works for plan reordering (if implemented)
- [ ] Keyboard navigation works correctly
- [ ] Screen reader announces plan information correctly
- [ ] Dark mode styling matches light mode quality

## Success Criteria

✅ Plan cards match the aesthetic quality of `ElegantList` (clean, professional, table-like)
✅ Progress information is clearly communicated via progress bar + percentage
✅ Milestone information is visible at a glance
✅ Status is color-coded and immediately recognizable
✅ Responsive design works on mobile, tablet, and desktop
✅ Selection and bulk actions work smoothly
✅ Performance is good with 100+ plans
✅ Accessibility standards are met (WCAG 2.1 AA)

## Example Usage

```tsx
import { ElegantPlanList } from '@/shared/components/ElegantPlanList';
import { Plan } from '@/types/plan';

function PlansSection() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    return (
        <ElegantPlanList
            plans={plans}
            selectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onPlanClick={(plan) => navigate(`/plans/${plan.id}`)}
            renderActions={(plan) => (
                <>
                    <Menu.Item onClick={() => handleEdit(plan)}>Edit</Menu.Item>
                    <Menu.Item onClick={() => handleArchive(plan)}>Archive</Menu.Item>
                    <Menu.Item color="fg.error" onClick={() => handleDelete(plan)}>Delete</Menu.Item>
                </>
            )}
        />
    );
}
```

## Related Files

**Components:**
- `src/shared/components/ElegantList.tsx` - Base pattern reference
- `src/shared/components/ElegantPlanList.tsx` - New component to create
- `src/views/project/sections/PlansSection.tsx` - Integration point

**Types:**
- `src/types/plan.ts` - Plan, Phase, Milestone interfaces

**Utilities:**
- `src/shared/utils/planUtils.ts` - Helper functions for progress calculation, date formatting, etc.

**Styles:**
- Inherits from Chakra UI theme
- No custom CSS needed (uses Chakra props)
