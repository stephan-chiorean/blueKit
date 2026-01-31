---
id: linking-plans-architecture
alias: Linking Plans & Consolidated Resources
type: walkthrough
is_base: false
version: 1
tags:
  - architecture
  - plans
  - backend
description: Overview of how BlueKit links database plans to file-system resources and handles synchronization.
complexity: moderate
format: architecture
---
# Linking Plans & Consolidated Resources

This walkthrough explains how BlueKit creates the illusion of a consolidated resource by merging database entities with file system operations plan documents.

## Core Concept: The Hybrid Entity

A "Plan" in BlueKit is a hybrid entity that exists in two places simultaneously:
1.  **Database**: Holds metadata (ID, name, status, phase associations, links).
2.  **File System**: Holds the actual content (markdown files).

The goal is to provide a unified view where a Plan appears as a single object containing multiple documents, some strictly internal and some external.

## Data Model

The architecture uses three main entities to bridge this gap:

### 1. The Plan Record
The `Plan` table is the anchor. It corresponds to a directory on disk:
- `id`: UUID
- `folderPath`: Absolute path to `.bluekit/plans/{slugified-name}`

### 2. Internal Documents (`PlanDocument`)
These represent files *inside* the plan's folder.
- **Source of Truth**: The File System. Use `get_plan_documents` to reconcile.
- **Metadata**: Stored in DB (e.g., `phaseId` assignment).

### 3. External Links (`PlanLink`)
These represent files *outside* the plan's folder (e.g., Claude/Cursor plans).
- **Source of Truth**: The Database (for the link existence).
- **Content**: The external file.

## Synchronization Architecture

The system uses a "Scan-and-Reconcile" strategy to handle changes behind the scenes.

### Internal Documents Reconciliation

When `get_plan_documents` is called (usually triggered by a file watcher event), the backend performs the following:

1.  **Scan**: Reads the `.bluekit/plans/{slug}` directory for all `.md` files.
2.  **Load DB**: Fetches existing `PlanDocument` records for this plan.
3.  **Match**: Compares the file list with the DB records by file path.
4.  **Reconcile**:
    - **New File Found**: Creates a new `PlanDocument` record.
    - **Existing File**: Updates the records if needed (though mostly static).
    - **File Missing**: **Deletes** the `PlanDocument` record (orphaned document cleanup).

> [!WARNING]
> Because reconciliation relies on file paths, **renaming a file behind the scenes** is treated as a DELETE of the old file and a CREATE of a new file. Any metadata attached to the old file ID (like its assignment to a specific Phase) will be lost.

### External Links Handling

External links (Claude/Cursor plans) are static pointers stored in the `PlanLink` table.

- **Creation**: Validates that the file exists at the time of linking.
- **Access**: Reads the file path stored in the DB.
- **Changes**: There is no automatic reconciliation for external file moves. If an external file is renamed or moved, the link breaks. The user must manually unlink and re-link the new file.

## Handling Plan Renames

When a Plan itself is renamed in BlueKit:
1.  **DB Update**: The plan name is updated.
2.  **Folder Rename**: The backend (`update_plan`) calculates the new slug and renames the folder on disk.
    - The `folderPath` in the Plan record is updated.
    - `PlanDocument` paths are NOT automatically updated in the DB immediately, but the next `get_plan_documents` call will reconcile them (creating new records for the "new" paths).

## Summary

This architecture allows BlueKit to robustly handle file operations while maintaining rich database relationships. The "Scan-and-Reconcile" pattern ensures the database never permanently drifts from the file system, effectively self-healing on every access.
