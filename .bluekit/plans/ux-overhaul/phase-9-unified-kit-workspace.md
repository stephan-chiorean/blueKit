# Phase 9: Unified Kit Workspace with Reminders

## Problem Statement

Currently, when clicking on a kit in `KitsSection.tsx`, the UX doesn't match the polished, workspace-style experience that Plans and Walkthroughs provide. Plans use `PlanWorkspace.tsx` and Walkthroughs use `WalkthroughWorkspace.tsx`, both featuring:
- Two-panel layout (main content + sidebar)
- Right-side overview panel with metadata and interactive features
- Toggleable sidebar
- Consistent styling and interaction patterns

Kits lack this unified experience and don't have an equivalent to Walkthrough's "Takeaways" feature for capturing quick reminders or key points about a kit.

**Desired Outcome:**
- Create `KitWorkspace` component following the same pattern as `PlanWorkspace` and `WalkthroughWorkspace`
- Add "Reminders" feature for kits (analogous to Walkthrough's "Takeaways")
- Database-backed reminders with similar schema to `walkthrough_takeaways`
- Consistent visual styling across all three workspace types (Plans, Walkthroughs, Kits)

## Design Reference

**Pattern Reference:**
- `src/features/plans/components/PlanWorkspace.tsx` - Two-panel layout pattern
- `src/features/walkthroughs/components/WalkthroughWorkspace.tsx` - Workspace structure
- `src/features/walkthroughs/components/WalkthroughOverviewPanel.tsx` - Sidebar panel with takeaways

**Database Reference:**
- `src-tauri/src/db/entities/walkthrough.rs` - Parent entity pattern
- `src-tauri/src/db/entities/walkthrough_takeaway.rs` - Child entity pattern for reminders

## Architecture Overview

### Component Structure

```
KitWorkspace (NEW)
├── KitDocViewPage (NEW)
│   └── Markdown rendering + navigation controls
└── KitOverviewPanel (NEW)
    ├── Kit metadata (name, description, tags)
    ├── Reminders section (add, toggle, delete)
    └── Notes section (localStorage, similar to walkthroughs)
```

### Database Structure

**New Tables:**

1. **`kits` table** - Parent entity
2. **`kit_reminders` table** - Child entity (like `walkthrough_takeaways`)

## Implementation Steps

### Step 1: Database Schema (Rust Backend)

#### 1.1 Create Kit Entity

**File:** `src-tauri/src/db/entities/kit.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "kits")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<String>, // JSON array as string
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::kit_reminder::Entity")]
    Reminders,
}

impl Related<super::kit_reminder::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Reminders.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
```

#### 1.2 Create Kit Reminder Entity

**File:** `src-tauri/src/db/entities/kit_reminder.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "kit_reminders")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[serde(rename = "kitId")]
    pub kit_id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
    pub completed: i32, // SQLite boolean (0 or 1)
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::kit::Entity",
        from = "Column::KitId",
        to = "super::kit::Column::Id"
    )]
    Kit,
}

impl Related<super::kit::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Kit.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
```

#### 1.3 Update Entity Module

**File:** `src-tauri/src/db/entities/mod.rs`

Add:
```rust
pub mod kit;
pub mod kit_reminder;
```

#### 1.4 Create Migration

**File:** `src-tauri/src/db/migrations.rs`

Add migration to create both tables:

```rust
async fn create_kits_tables(db: &DatabaseConnection) -> Result<(), DbErr> {
    let manager = SchemaManager::new(db);

    // Create kits table
    manager
        .create_table(
            Table::create()
                .table(kit::Entity)
                .if_not_exists()
                .col(ColumnDef::new(kit::Column::Id).string().not_null().primary_key())
                .col(ColumnDef::new(kit::Column::ProjectId).string().not_null())
                .col(ColumnDef::new(kit::Column::FilePath).string().not_null())
                .col(ColumnDef::new(kit::Column::Name).string().not_null())
                .col(ColumnDef::new(kit::Column::Description).string())
                .col(ColumnDef::new(kit::Column::Tags).string())
                .col(ColumnDef::new(kit::Column::CreatedAt).big_integer().not_null())
                .col(ColumnDef::new(kit::Column::UpdatedAt).big_integer().not_null())
                .to_owned(),
        )
        .await?;

    // Create kit_reminders table
    manager
        .create_table(
            Table::create()
                .table(kit_reminder::Entity)
                .if_not_exists()
                .col(ColumnDef::new(kit_reminder::Column::Id).string().not_null().primary_key())
                .col(ColumnDef::new(kit_reminder::Column::KitId).string().not_null())
                .col(ColumnDef::new(kit_reminder::Column::Title).string().not_null())
                .col(ColumnDef::new(kit_reminder::Column::Description).string())
                .col(ColumnDef::new(kit_reminder::Column::SortOrder).integer().not_null())
                .col(ColumnDef::new(kit_reminder::Column::Completed).integer().not_null().default(0))
                .col(ColumnDef::new(kit_reminder::Column::CompletedAt).big_integer())
                .col(ColumnDef::new(kit_reminder::Column::CreatedAt).big_integer().not_null())
                .foreign_key(
                    ForeignKey::create()
                        .name("fk_kit_reminder_kit")
                        .from(kit_reminder::Entity, kit_reminder::Column::KitId)
                        .to(kit::Entity, kit::Column::Id)
                        .on_delete(ForeignKeyAction::Cascade)
                )
                .to_owned(),
        )
        .await?;

    Ok(())
}
```

#### 1.5 Create Kit Operations

**File:** `src-tauri/src/db/kit_operations.rs`

Similar to `walkthrough_operations.rs`, implement:
- `get_kit_by_id(kit_id: String) -> Result<kit::Model, String>`
- `get_kit_details(kit_id: String) -> Result<KitDetails, String>`
- `create_kit(project_id, file_path, name, description, tags) -> Result<kit::Model, String>`
- `update_kit(kit_id, ...) -> Result<kit::Model, String>`
- `delete_kit(kit_id) -> Result<(), String>`

**Reminder operations:**
- `add_kit_reminder(kit_id, title) -> Result<kit_reminder::Model, String>`
- `toggle_reminder_complete(reminder_id) -> Result<kit_reminder::Model, String>`
- `delete_kit_reminder(reminder_id) -> Result<(), String>`
- `reorder_reminders(kit_id, reminder_ids) -> Result<(), String>`

#### 1.6 Create IPC Commands

**File:** `src-tauri/src/commands/kits.rs` (NEW)

```rust
#[tauri::command]
pub async fn get_kit_details(
    kit_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<KitDetails, String> {
    let db = &state.db;
    kit_operations::get_kit_details(db, kit_id).await
}

#[tauri::command]
pub async fn add_kit_reminder(
    kit_id: String,
    title: String,
    state: tauri::State<'_, AppState>,
) -> Result<kit_reminder::Model, String> {
    let db = &state.db;
    kit_operations::add_kit_reminder(db, kit_id, title).await
}

#[tauri::command]
pub async fn toggle_reminder_complete(
    reminder_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<kit_reminder::Model, String> {
    let db = &state.db;
    kit_operations::toggle_reminder_complete(db, reminder_id).await
}

#[tauri::command]
pub async fn delete_kit_reminder(
    reminder_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = &state.db;
    kit_operations::delete_kit_reminder(db, reminder_id).await
}
```

Register in `main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    get_kit_details,
    add_kit_reminder,
    toggle_reminder_complete,
    delete_kit_reminder,
])
```

### Step 2: TypeScript Types (Frontend)

#### 2.1 Create Kit Types

**File:** `src/types/kit.ts` (NEW)

```typescript
export interface Kit {
    id: string;
    projectId: string;
    filePath: string;
    name: string;
    description?: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface KitReminder {
    id: string;
    kitId: string;
    title: string;
    description?: string;
    sortOrder: number;
    completed: boolean;
    completedAt?: number;
    createdAt: number;
}

export interface KitDetails extends Kit {
    reminders: KitReminder[];
    progress: number; // 0-100 percentage of completed reminders
}
```

#### 2.2 Create IPC Wrappers

**File:** `src/ipc/kits.ts` (NEW)

```typescript
import { invokeWithTimeout } from './timeout';
import type { KitDetails, KitReminder } from '@/types/kit';

export async function invokeGetKitDetails(kitId: string): Promise<KitDetails> {
    return invokeWithTimeout<KitDetails>('get_kit_details', { kitId }, 5000);
}

export async function invokeAddKitReminder(
    kitId: string,
    title: string
): Promise<KitReminder> {
    return invokeWithTimeout<KitReminder>(
        'add_kit_reminder',
        { kitId, title },
        5000
    );
}

export async function invokeToggleReminderComplete(
    reminderId: string
): Promise<KitReminder> {
    return invokeWithTimeout<KitReminder>(
        'toggle_reminder_complete',
        { reminderId },
        5000
    );
}

export async function invokeDeleteKitReminder(
    reminderId: string
): Promise<void> {
    return invokeWithTimeout<void>('delete_kit_reminder', { reminderId }, 5000);
}
```

### Step 3: Frontend Components

#### 3.1 Create ReminderItem Component

**File:** `src/features/kits/components/ReminderItem.tsx` (NEW)

Similar to `TakeawayItem.tsx`, create a component for individual reminders:
- Checkbox for completion
- Title text (editable on double-click, optional for v1)
- Delete button (on hover)
- Completed state styling (strikethrough, muted color)
- Framer motion for animations

```typescript
import { motion } from 'framer-motion';
import { HStack, Icon, Text, IconButton, Checkbox } from '@chakra-ui/react';
import { LuTrash2 } from 'react-icons/lu';
import type { KitReminder } from '@/types/kit';

interface ReminderItemProps {
    reminder: KitReminder;
    onToggle: (reminderId: string) => void;
    onDelete: (reminderId: string) => void;
    showDelete?: boolean;
}

export default function ReminderItem({
    reminder,
    onToggle,
    onDelete,
    showDelete = true,
}: ReminderItemProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
        >
            <HStack
                gap={2}
                p={2}
                borderRadius="10px"
                _hover={{ bg: 'bg.subtle' }}
                transition="all 0.2s ease"
                group
            >
                <Checkbox
                    checked={reminder.completed}
                    onCheckedChange={() => onToggle(reminder.id)}
                    colorPalette="blue"
                />
                <Text
                    flex={1}
                    fontSize="sm"
                    color={reminder.completed ? 'text.tertiary' : 'text.primary'}
                    textDecoration={reminder.completed ? 'line-through' : 'none'}
                >
                    {reminder.title}
                </Text>
                {showDelete && (
                    <IconButton
                        aria-label="Delete reminder"
                        variant="ghost"
                        size="xs"
                        colorPalette="red"
                        onClick={() => onDelete(reminder.id)}
                        opacity={0}
                        _groupHover={{ opacity: 1 }}
                        transition="opacity 0.2s ease"
                    >
                        <Icon>
                            <LuTrash2 />
                        </Icon>
                    </IconButton>
                )}
            </HStack>
        </motion.div>
    );
}
```

#### 3.2 Create KitOverviewPanel Component

**File:** `src/features/kits/components/KitOverviewPanel.tsx` (NEW)

Mirror `WalkthroughOverviewPanel.tsx` structure:
- Collapsible main card with kit name, tags, description
- Reminders section with add input, list, and completion tracking
- Progress bar (percentage of completed reminders)
- Notes section (localStorage-backed)
- Open in editor button

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Card,
    CardBody,
    Text,
    VStack,
    Button,
    Flex,
    HStack,
    Icon,
    Textarea,
    IconButton,
    Badge,
    Progress,
    Box,
    Center,
    Input,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LuCopy,
    LuCheck,
    LuChevronDown,
    LuPackage,
    LuPlus,
    LuExternalLink,
    LuBell,
} from 'react-icons/lu';
import type { KitDetails, KitReminder } from '@/types/kit';
import { invokeOpenFileInEditor } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import { useColorMode } from '@/shared/contexts/ColorModeContext';
import ReminderItem from './ReminderItem';

interface KitOverviewPanelProps {
    details: KitDetails | null;
    loading: boolean;
    onToggleReminder: (reminderId: string) => void;
    onAddReminder: (title: string) => void;
    onDeleteReminder: (reminderId: string) => void;
}

export default function KitOverviewPanel({
    details,
    loading,
    onToggleReminder,
    onAddReminder,
    onDeleteReminder,
}: KitOverviewPanelProps) {
    const { colorMode } = useColorMode();
    const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
    const [isUnifiedExpanded, setIsUnifiedExpanded] = useState(true);
    const [hideCompleted, setHideCompleted] = useState(false);

    // Reminder input state
    const [newReminderTitle, setNewReminderTitle] = useState('');
    const reminderInputRef = useRef<HTMLInputElement>(null);

    // Note state
    const [notes, setNotes] = useState<string>('');
    const notesKey = details ? `bluekit-kit-notes-${details.id}` : null;

    // Load notes from localStorage
    useEffect(() => {
        if (!notesKey) return;
        const savedNotes = localStorage.getItem(notesKey);
        setNotes(savedNotes ?? '');
    }, [notesKey]);

    const panelStyles = {
        background: colorMode === 'light'
            ? '#EBEFF7'
            : 'rgba(255, 255, 255, 0.05)',
        borderWidth: '0px',
        borderLeftWidth: '1px',
        borderColor: colorMode === 'light'
            ? 'rgba(0, 0, 0, 0.06)'
            : 'rgba(255, 255, 255, 0.08)',
        borderRadius: '0px',
        boxShadow: 'none',
        transition: 'all 0.2s ease',
    };

    const filePath = details?.filePath;

    // Handle add reminder
    const handleAddReminder = useCallback(() => {
        if (!newReminderTitle.trim()) return;
        onAddReminder(newReminderTitle.trim());
        setNewReminderTitle('');
        setTimeout(() => reminderInputRef.current?.focus(), 50);
    }, [newReminderTitle, onAddReminder]);

    const handleReminderKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddReminder();
        }
    };

    // Handle notes save
    const handleNotesChange = useCallback((value: string) => {
        setNotes(value);
        if (!notesKey) return;
        try {
            localStorage.setItem(notesKey, value);
        } catch (error) {
            console.error('Failed to save notes:', error);
        }
    }, [notesKey]);

    // Copy notes to clipboard
    const copyNotes = useCallback(async () => {
        if (!notes) return;
        try {
            await navigator.clipboard.writeText(notes);
            setCopiedNoteId('current');
            setTimeout(() => setCopiedNoteId(null), 2000);
        } catch (error) {
            console.error('Failed to copy notes:', error);
        }
    }, [notes]);

    // Open in editor
    const handleOpenInEditor = useCallback(async () => {
        if (!filePath) return;
        try {
            await invokeOpenFileInEditor(filePath, 'cursor');
        } catch (error) {
            console.error('Failed to open file:', error);
            toaster.create({ type: 'error', title: 'Failed to open file in editor' });
        }
    }, [filePath]);

    if (loading || !details) {
        return (
            <Box h="100%" position="relative" display="flex" flexDirection="column" css={panelStyles}>
                <VStack className="kit-overview-scroll" flex="1" minH={0} p={4} align="stretch" gap={4} overflowY="auto">
                    <Text color="text.secondary">
                        {loading ? 'Loading kit details...' : 'Kit not found'}
                    </Text>
                </VStack>
            </Box>
        );
    }

    // Calculate progress
    const completedCount = details.reminders.filter((r) => r.completed).length;
    const totalCount = details.reminders.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Filter reminders
    const visibleReminders = hideCompleted
        ? details.reminders.filter((r) => !r.completed)
        : details.reminders;

    const cardStyle = {
        background: 'transparent',
        borderWidth: '0px',
        borderRadius: '16px',
        boxShadow: 'none',
        transition: 'all 0.2s ease',
    };

    return (
        <Box h="100%" position="relative" display="flex" flexDirection="column" css={panelStyles}>
            <VStack
                className="kit-overview-scroll"
                flex="1"
                minH={0}
                p={4}
                align="stretch"
                gap={4}
                overflowY="auto"
            >
                {/* Main Unified Card */}
                <Card.Root variant="subtle" css={cardStyle}>
                    <CardBody>
                        <VStack align="stretch" gap={0}>
                            {/* Collapsed Header Area */}
                            <VStack
                                align="stretch"
                                gap={3}
                                cursor="pointer"
                                onClick={() => setIsUnifiedExpanded(!isUnifiedExpanded)}
                                py={1}
                            >
                                <Flex justify="space-between" align="start">
                                    <VStack align="start" gap={1} flex="1">
                                        <HStack gap={2}>
                                            <Icon boxSize={5} color="blue.500">
                                                <LuPackage />
                                            </Icon>
                                            <Text fontWeight="semibold" fontSize="md" lineClamp={2}>
                                                {details.name}
                                            </Text>
                                        </HStack>
                                        <Text fontSize="xs" color="text.secondary">
                                            {completedCount} / {totalCount} reminders
                                            {progress > 0 && ` · ${Math.round(progress)}%`}
                                        </Text>
                                    </VStack>
                                    <IconButton
                                        aria-label="Open in editor"
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenInEditor();
                                        }}
                                        css={{ borderRadius: '10px' }}
                                    >
                                        <Icon>
                                            <LuExternalLink />
                                        </Icon>
                                    </IconButton>
                                </Flex>

                                {totalCount > 0 && (
                                    <Progress.Root
                                        value={progress}
                                        size="sm"
                                        colorPalette={progress >= 100 ? 'green' : 'blue'}
                                        css={{
                                            '& [data-part="range"]': {
                                                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important',
                                                background: progress >= 100
                                                    ? 'linear-gradient(90deg, var(--chakra-colors-green-400), var(--chakra-colors-green-500))'
                                                    : 'linear-gradient(90deg, var(--chakra-colors-blue-400), var(--chakra-colors-blue-500))',
                                            },
                                            '& [data-part="track"]': {
                                                overflow: 'hidden',
                                                borderRadius: '999px',
                                            },
                                        }}
                                    >
                                        <Progress.Track>
                                            <Progress.Range />
                                        </Progress.Track>
                                    </Progress.Root>
                                )}

                                <Center pt={1}>
                                    <Icon
                                        color="text.tertiary"
                                        size="lg"
                                        transform={isUnifiedExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}
                                        transition="transform 0.2s ease"
                                    >
                                        <LuChevronDown />
                                    </Icon>
                                </Center>
                            </VStack>

                            {/* Expanded Content */}
                            <AnimatePresence>
                                {isUnifiedExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <VStack align="stretch" gap={4} pt={4}>
                                            <Box h="1px" bg="border.subtle" />

                                            {/* Reminders Section */}
                                            <VStack align="stretch" gap={3}>
                                                <Flex justify="space-between" align="center">
                                                    <HStack gap={2} color="text.secondary">
                                                        <Icon size="sm">
                                                            <LuBell />
                                                        </Icon>
                                                        <Text fontSize="sm" fontWeight="medium">
                                                            Reminders
                                                        </Text>
                                                        <Badge size="sm" variant="subtle" colorPalette="blue">
                                                            {completedCount}/{totalCount}
                                                        </Badge>
                                                    </HStack>
                                                    {details.reminders.some(r => r.completed) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setHideCompleted(!hideCompleted);
                                                            }}
                                                            css={{ fontSize: '11px' }}
                                                        >
                                                            {hideCompleted ? 'Show completed' : 'Hide completed'} ({details.reminders.filter(r => r.completed).length})
                                                        </Button>
                                                    )}
                                                </Flex>

                                                {/* Add Reminder Input */}
                                                <HStack gap={2} onClick={(e) => e.stopPropagation()}>
                                                    <Input
                                                        ref={reminderInputRef}
                                                        value={newReminderTitle}
                                                        onChange={(e) => setNewReminderTitle(e.target.value)}
                                                        onKeyDown={handleReminderKeyDown}
                                                        placeholder="Add a reminder..."
                                                        size="sm"
                                                        css={{
                                                            borderRadius: '10px',
                                                            _focus: {
                                                                borderColor: 'blue.400',
                                                            },
                                                        }}
                                                    />
                                                    <Button
                                                        colorPalette="blue"
                                                        variant="solid"
                                                        size="sm"
                                                        onClick={handleAddReminder}
                                                        disabled={!newReminderTitle.trim()}
                                                        css={{ borderRadius: '10px' }}
                                                    >
                                                        <HStack gap={1}>
                                                            <Icon>
                                                                <LuPlus />
                                                            </Icon>
                                                            <Text>Add</Text>
                                                        </HStack>
                                                    </Button>
                                                </HStack>

                                                {/* Reminders List */}
                                                <VStack align="stretch" gap={1} onClick={(e) => e.stopPropagation()}>
                                                    <AnimatePresence>
                                                        {visibleReminders.map((reminder) => (
                                                            <ReminderItem
                                                                key={reminder.id}
                                                                reminder={reminder}
                                                                onToggle={onToggleReminder}
                                                                onDelete={onDeleteReminder}
                                                                showDelete
                                                            />
                                                        ))}
                                                    </AnimatePresence>
                                                </VStack>

                                                {details.reminders.length === 0 && (
                                                    <Box
                                                        p={4}
                                                        textAlign="center"
                                                        borderRadius="10px"
                                                        borderWidth="1px"
                                                        borderStyle="dashed"
                                                        borderColor="border.subtle"
                                                    >
                                                        <Text fontSize="xs" color="text.tertiary">
                                                            No reminders yet. Add key points to remember about this kit.
                                                        </Text>
                                                    </Box>
                                                )}
                                            </VStack>
                                        </VStack>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </VStack>
                    </CardBody>
                </Card.Root>

                {/* Notes Card */}
                <Card.Root variant="subtle" css={cardStyle}>
                    <CardBody>
                        <VStack align="stretch" gap={3}>
                            <Flex justify="space-between" align="center">
                                <HStack gap={2} color="text.secondary">
                                    <Icon size="sm">
                                        <LuPackage />
                                    </Icon>
                                    <Text fontSize="sm" fontWeight="medium">Notes</Text>
                                </HStack>
                                <IconButton
                                    aria-label="Copy notes"
                                    variant="ghost"
                                    size="xs"
                                    onClick={copyNotes}
                                    disabled={!notes}
                                >
                                    <Icon>
                                        {copiedNoteId === 'current' ? <LuCheck /> : <LuCopy />}
                                    </Icon>
                                </IconButton>
                            </Flex>
                            <VStack align="stretch" gap={1}>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => handleNotesChange(e.target.value)}
                                    placeholder="Take notes about this kit..."
                                    rows={6}
                                    resize="vertical"
                                    css={{
                                        borderRadius: '10px',
                                        fontSize: '13px',
                                    }}
                                />
                                <Text fontSize="xs" color="text.tertiary" textAlign="right">
                                    Auto-saved
                                </Text>
                            </VStack>
                        </VStack>
                    </CardBody>
                </Card.Root>
            </VStack>
        </Box>
    );
}
```

#### 3.3 Create KitDocViewPage Component

**File:** `src/features/kits/components/KitDocViewPage.tsx` (NEW)

Similar to `WalkthroughDocViewPage.tsx`, display kit markdown content:
- Markdown rendering
- Toggle sidebar button
- Back button (optional)
- Toolbar for actions (edit, copy, etc.)

```typescript
import { Box, Flex, IconButton, Icon } from '@chakra-ui/react';
import { LuPanelRightOpen, LuPanelRightClose } from 'react-icons/lu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface KitDocViewPageProps {
    content: string;
    isPanelOpen: boolean;
    onTogglePanel: () => void;
}

export default function KitDocViewPage({
    content,
    isPanelOpen,
    onTogglePanel,
}: KitDocViewPageProps) {
    return (
        <Box h="100%" position="relative">
            {/* Toggle sidebar button (top-right) */}
            <Box position="absolute" top={4} right={4} zIndex={10}>
                <IconButton
                    aria-label={isPanelOpen ? 'Close panel' : 'Open panel'}
                    variant="ghost"
                    size="sm"
                    onClick={onTogglePanel}
                    css={{ borderRadius: '10px' }}
                >
                    <Icon>
                        {isPanelOpen ? <LuPanelRightClose /> : <LuPanelRightOpen />}
                    </Icon>
                </IconButton>
            </Box>

            {/* Markdown content */}
            <Box
                p={8}
                maxW="900px"
                mx="auto"
                overflowY="auto"
                h="100%"
                css={{
                    '& h1': { fontSize: '2xl', fontWeight: 'bold', mt: 6, mb: 4 },
                    '& h2': { fontSize: 'xl', fontWeight: 'bold', mt: 5, mb: 3 },
                    '& h3': { fontSize: 'lg', fontWeight: 'semibold', mt: 4, mb: 2 },
                    '& p': { mb: 4, lineHeight: 1.7 },
                    '& code': {
                        bg: 'bg.subtle',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 'sm',
                        fontSize: 'sm',
                    },
                    '& pre': {
                        bg: 'bg.subtle',
                        p: 4,
                        borderRadius: 'md',
                        overflow: 'auto',
                        mb: 4,
                    },
                }}
            >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                </ReactMarkdown>
            </Box>
        </Box>
    );
}
```

#### 3.4 Create KitWorkspace Component

**File:** `src/features/kits/components/KitWorkspace.tsx` (NEW)

Main container following the exact pattern of `PlanWorkspace` and `WalkthroughWorkspace`:

```typescript
import { useState, useCallback, useEffect } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import type { KitDetails } from '@/types/kit';
import { ArtifactFile } from '@/ipc';
import {
    invokeGetKitDetails,
    invokeToggleReminderComplete,
    invokeAddKitReminder,
    invokeDeleteKitReminder,
} from '@/ipc/kits';
import { invokeReadFile } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import KitOverviewPanel from './KitOverviewPanel';
import KitDocViewPage from './KitDocViewPage';

// Sidebar constants
const SIDEBAR_WIDTH = 480; // Fixed width in pixels

interface KitWorkspaceProps {
    kit: ArtifactFile;
    onBack?: () => void;
}

export default function KitWorkspace({ kit, onBack }: KitWorkspaceProps) {
    const [details, setDetails] = useState<KitDetails | null>(null);
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    const kitId = kit.frontMatter?.id || kit.path; // Use frontmatter ID or fallback to path

    // Toggle sidebar
    const togglePanel = useCallback(() => {
        setIsPanelOpen(prev => !prev);
    }, []);

    // Load kit details and content
    const loadKit = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const kitDetails = await invokeGetKitDetails(kitId);

            // Only update details if they changed
            setDetails(prev => {
                if (JSON.stringify(prev) === JSON.stringify(kitDetails)) return prev;
                return kitDetails;
            });

            // Load markdown content
            const fileContent = await invokeReadFile(kitDetails.filePath);
            setContent(prev => prev !== fileContent ? fileContent : prev);
        } catch (error) {
            console.error('Failed to load kit:', error);
            if (!isSilent) {
                toaster.create({
                    type: 'error',
                    title: 'Failed to load kit',
                    description: String(error),
                });
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [kitId]);

    // Initial load and polling for updates
    useEffect(() => {
        loadKit(); // Initial load (shows spinner)

        // Poll for updates every 2 seconds
        const intervalId = setInterval(() => {
            loadKit(true); // Silent load (no spinner)
        }, 2000);

        return () => clearInterval(intervalId);
    }, [loadKit]);

    // Reminder handlers
    const handleToggleReminder = useCallback(async (reminderId: string) => {
        try {
            const updated = await invokeToggleReminderComplete(reminderId);
            setDetails((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    reminders: prev.reminders.map((r) =>
                        r.id === reminderId ? updated : r
                    ),
                    progress: calculateProgress(
                        prev.reminders.map((r) => (r.id === reminderId ? updated : r))
                    ),
                };
            });
        } catch (error) {
            console.error('Failed to toggle reminder:', error);
            toaster.create({ type: 'error', title: 'Failed to update reminder' });
        }
    }, []);

    const handleAddReminder = useCallback(async (title: string) => {
        if (!details) return;
        try {
            const newReminder = await invokeAddKitReminder(kitId, title);
            setDetails((prev) => {
                if (!prev) return prev;
                const newReminders = [...prev.reminders, newReminder];
                return {
                    ...prev,
                    reminders: newReminders,
                    progress: calculateProgress(newReminders),
                };
            });
        } catch (error) {
            console.error('Failed to add reminder:', error);
            toaster.create({ type: 'error', title: 'Failed to add reminder' });
        }
    }, [details, kitId]);

    const handleDeleteReminder = useCallback(async (reminderId: string) => {
        try {
            await invokeDeleteKitReminder(reminderId);
            setDetails((prev) => {
                if (!prev) return prev;
                const newReminders = prev.reminders.filter((r) => r.id !== reminderId);
                return {
                    ...prev,
                    reminders: newReminders,
                    progress: calculateProgress(newReminders),
                };
            });
        } catch (error) {
            console.error('Failed to delete reminder:', error);
            toaster.create({ type: 'error', title: 'Failed to delete reminder' });
        }
    }, []);

    // Helper function
    const calculateProgress = (reminders: any[]): number => {
        if (reminders.length === 0) return 0;
        const completed = reminders.filter((r) => r.completed).length;
        return (completed / reminders.length) * 100;
    };

    if (!loading && !details) {
        return (
            <Box p={8}>
                <Text color="text.secondary">Kit not found</Text>
            </Box>
        );
    }

    return (
        <Flex h="100%" w="100%" overflow="hidden">
            {/* Main Content Area - matches tab content styling */}
            <Box
                flex="1"
                h="100%"
                minH={0}
                overflowY="auto"
                overflowX="hidden"
                position="relative"
            >
                {loading ? (
                    <Box h="100%" display="flex" alignItems="center" justifyContent="center">
                        Loading...
                    </Box>
                ) : details ? (
                    <KitDocViewPage
                        content={content}
                        isPanelOpen={isPanelOpen}
                        onTogglePanel={togglePanel}
                    />
                ) : null}
            </Box>

            {/* Sidebar Panel - No extra blur since we're inside BrowserTabs content */}
            {isPanelOpen && (
                <Box
                    w={`${SIDEBAR_WIDTH}px`}
                    h="100%"
                    overflow="hidden"
                    css={{
                        // Transparent - inherits from parent's blur
                        background: 'transparent',
                    }}
                >
                    <KitOverviewPanel
                        details={details}
                        loading={loading}
                        onToggleReminder={handleToggleReminder}
                        onAddReminder={handleAddReminder}
                        onDeleteReminder={handleDeleteReminder}
                    />
                </Box>
            )}
        </Flex>
    );
}
```

### Step 4: Integration with KitsSection

#### 4.1 Update KitsSection to use KitWorkspace

**File:** `src/views/project/sections/KitsSection.tsx`

Currently, `onViewKit` is passed as a prop. We need to integrate `KitWorkspace` as the view when a kit is selected.

**Option A: Navigate to dedicated page** (recommended)
- Create a route like `/project/:projectId/kit/:kitId`
- Navigate using router when kit is clicked
- Full-screen workspace experience

**Option B: Render in place** (simpler)
- Replace `KitsSection` content with `KitWorkspace` when kit selected
- Back button returns to kit list
- Similar to how `FolderView` works

**Implementation (Option B):**

```typescript
// Add state at top of KitsSection
const [viewingKit, setViewingKit] = useState<ArtifactFile | null>(null);

// Modify onViewKit handler
const handleViewKit = (kit: ArtifactFile) => {
  if (justFinishedDragging) return;
  setViewingKit(kit);
};

// Add conditional render at top of component return (before main content)
if (viewingKit) {
  return (
    <KitWorkspace
      kit={viewingKit}
      onBack={() => setViewingKit(null)}
    />
  );
}

// ... rest of existing render
```

## Migration Strategy

### For Existing Kits

Kits don't need migration initially. The database records will be created on-demand when:
1. User first opens a kit in the new workspace
2. User adds their first reminder to a kit

**Auto-registration flow:**
```rust
async fn get_kit_details(db: &DatabaseConnection, kit_id: String) -> Result<KitDetails, String> {
    // Try to find existing kit record
    let kit = kit::Entity::find_by_id(&kit_id).one(db).await?;

    // If not found, create it from file metadata
    let kit = match kit {
        Some(k) => k,
        None => {
            // Read file, parse front matter, create database record
            create_kit_from_file(db, kit_id).await?
        }
    };

    // Load reminders and return full details
    // ...
}
```

## Testing Checklist

### Backend (Rust)
- [ ] Database tables created successfully
- [ ] Kit entity CRUD operations work
- [ ] Reminder CRUD operations work
- [ ] Foreign key constraints enforced (cascade delete)
- [ ] IPC commands registered and callable
- [ ] Migration runs without errors
- [ ] Existing kits auto-register on first access

### Frontend (TypeScript)
- [ ] KitWorkspace renders correctly
- [ ] KitOverviewPanel displays kit info
- [ ] Reminders can be added
- [ ] Reminders can be toggled complete
- [ ] Reminders can be deleted
- [ ] Progress bar updates correctly
- [ ] Notes save to localStorage
- [ ] Notes can be copied to clipboard
- [ ] Open in editor button works
- [ ] Sidebar toggle works
- [ ] Markdown content renders correctly
- [ ] Polling updates work (2-second interval)
- [ ] Loading states display correctly
- [ ] Error states display correctly

### Integration
- [ ] Clicking kit in KitsSection opens KitWorkspace
- [ ] Back button returns to KitsSection
- [ ] Kit selection persists across navigation (if using router)
- [ ] No memory leaks from polling intervals
- [ ] Performance is good with 100+ reminders

## Visual Design Consistency

### Color Palette

**Kit Reminders (Blue theme):**
- Primary: `blue.500` (#3182CE)
- Progress bar: `blue.400` to `blue.500` gradient
- Completed: `green.500` (#38A169)
- Icon: `LuBell` (reminders), `LuPackage` (kit)

**Compared to Walkthroughs (Orange theme):**
- Primary: `orange.500`
- Progress bar: `orange.400` to `orange.500` gradient
- Icon: `LuLightbulb` (takeaways)

### Spacing & Layout

All measurements match WalkthroughWorkspace:
- Sidebar width: `480px`
- Panel padding: `p={4}` (16px)
- Card gap: `gap={4}` (16px)
- Progress bar size: `sm` (4px height)
- Border radius: `10px` (inputs, buttons), `16px` (cards)

## Success Criteria

✅ Kits have the same workspace experience as Plans and Walkthroughs
✅ Reminders work identically to Takeaways (add, toggle, delete)
✅ Database schema mirrors walkthrough_takeaways structure
✅ UI styling is consistent across all three workspace types
✅ Performance is good with many reminders
✅ Existing kits auto-register in database on first view
✅ No breaking changes to existing kit functionality

## Related Files

**Backend:**
- `src-tauri/src/db/entities/kit.rs` (NEW)
- `src-tauri/src/db/entities/kit_reminder.rs` (NEW)
- `src-tauri/src/db/entities/mod.rs` (UPDATE)
- `src-tauri/src/db/migrations.rs` (UPDATE)
- `src-tauri/src/db/kit_operations.rs` (NEW)
- `src-tauri/src/commands/kits.rs` (NEW)
- `src-tauri/src/main.rs` (UPDATE - register commands)

**Frontend:**
- `src/types/kit.ts` (NEW)
- `src/ipc/kits.ts` (NEW)
- `src/features/kits/components/KitWorkspace.tsx` (NEW)
- `src/features/kits/components/KitOverviewPanel.tsx` (NEW)
- `src/features/kits/components/KitDocViewPage.tsx` (NEW)
- `src/features/kits/components/ReminderItem.tsx` (NEW)
- `src/views/project/sections/KitsSection.tsx` (UPDATE - integrate workspace)

**Reference:**
- `src/features/walkthroughs/components/WalkthroughWorkspace.tsx`
- `src/features/walkthroughs/components/WalkthroughOverviewPanel.tsx`
- `src/features/walkthroughs/components/TakeawayItem.tsx`
- `src-tauri/src/db/entities/walkthrough.rs`
- `src-tauri/src/db/entities/walkthrough_takeaway.rs`

## Future Enhancements (Optional)

### Phase 9.1: Advanced Reminders
- Add due dates to reminders
- Add priority levels (high, medium, low)
- Add categories/tags to reminders
- Reminder notifications/alerts

### Phase 9.2: Kit Templates
- Create kits from templates
- Template marketplace
- Template variables (fill-in-the-blanks)

### Phase 9.3: Kit Versioning
- Track kit changes over time
- Diff view between versions
- Rollback to previous versions

### Phase 9.4: Kit Dependencies
- Link kits to other kits
- Dependency graph visualization
- Ensure all dependencies are present
