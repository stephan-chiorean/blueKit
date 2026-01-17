---
id: claude-skill-scanner-implementation
type: implementation_plan
title: Claude Skill Scanner & Management Implementation
status: proposed
---

# Implementation Plan: Claude Skill Scanner & Management

This plan details the implementation of a filesystem scanner to discover "Claude Skills" (directories containing `.claude` configurations) and the specialized tooling to move these skills into active projects, leveraging the `local-project-scanner` kit pattern.

## 1. Overview

**Goal**: Enable users to discover local Claude configurations ("Skills") and easily copy them into their BlueKit projects.

**Reference Patterns**:
- Scanning Logic: `local-project-scanner` kit (Marker-based scanning, caching).
- Interaction: `ResourceSelectionBar` (Selection, "Move to Project" flow).

## 2. Definitions

- **Claude Skill**: A directory containing a `.claude` subdirectory. This directory represents a reusable capability or configuration.
- **Scanner**: A backend service that traverses specified search paths to find these directories.

## 3. Backend Implementation (IPC)

We will leverage the existing or implement new IPC commands following the `local-project-scanner` specification.

### 3.1. Scanning Command
Implement `invokeFindClaudeSkills` (or specialized usage of `find_projects`):
- **Marker**: `.claude`
- **Search Paths**: Configurable (default to `~/Documents`, `~/Projects`, etc.)
- **Caching**: Store results in `~/.bluekit/skills-cache.json` using the kit's caching strategy (TTL 60m).
- **Exclusions**: `node_modules`, `.git`, etc.

**Signature**:
```typescript
interface ScanOptions {
  searchPaths?: string[];
  forceRefresh?: boolean;
}

function invokeFindClaudeSkills(options: ScanOptions): Promise<string[]>; // Returns paths
```

### 3.2. Copy Command
Implement `invokeCopySkillToProject` to handle the transfer of the `.claude` directory and relevant files.

**Signature**:
```typescript
function invokeCopySkillToProject(skillPath: string, projectPath: string): Promise<void>;
```
*Logic*:
1. Verify source `skillPath` exists and has `.claude`.
2. Copy `.claude` directory to `projectPath/.claude`.
3. (Optional) Copy other root-level configuration files if deemed part of the "Skill" (e.g., `cursorrules` if applicable, though strictly "Claude Skill" implies `.claude`).

## 4. Frontend Implementation

### 4.1. Navigation
Update `src/components/NavigationDrawer.tsx` to handle the "Claude" menu item interaction under "Plans".
- **Trigger**: Clicking "Claude" should navigate to the `ClaudeSkillsPage` or open a specialized Modal/Drawer.

### 4.2. Claude Skills View (`src/pages/ClaudeSkillsPage.tsx`)
Create a new page/view that runs the scanner on mount (or via manual trigger).

**Components**:
- **Header**: Title, "Scan" button, Search input.
- **List**: Virtualized list or Grid of found Skills.
  - Display Name: Directory name.
  - Path: Full path (muted).
- **Selection State**: Multi-select support.

### 4.3. Selection & Actions
Integrate a specialized version of `ResourceSelectionBar` or extend `ResourceSelectionBar` to support "Skills".

**Modifications to `ResourceSelectionBar.tsx`** (or `SkillSelectionBar.tsx`):
- **Props**: Accept `onAddToProject` handler.
- **Action**: When "Add to Project" is clicked:
  1. Open `AddToProjectPopover` (Project selection).
  2. On Confirm: Call `invokeCopySkillToProject` for each selected skill.
  3. Show Toast (Success/Error).

## 5. Step-by-Step Execution Plan

1.  **Backend Services**:
    - Ensure `find_projects` (Rust) supports the `.claude` marker and is exposed via IPC.
    - Implement `copy_skill_to_project` command in Rust and expose via IPC.
    - Create TypeScript wrappers in `src/ipc/skills.ts`.

2.  **UI/UX Construction**:
    - Create `src/pages/ClaudeSkillsPage.tsx`.
    - Implement the scanning hook `useClaudeSkills` (handling loading, caching, error states).
    - Implement the results grid/list.

3.  **Integration**:
    - Route the "Claude" item in `NavigationDrawer` to this new page.
    - Wire up the `ResourceSelectionBar` to trigger the copy IPC.

4.  **Verification**:
    - Verify scanner finds folders with `.claude`.
    - Verify "Move to Project" correctly copies the `.claude` folder to the target project.
