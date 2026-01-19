# Walkthroughs Revamp Implementation Plan

This plan outlines the changes required to support directory-based Walkthroughs with database-backed metadata, establishing parity with the existing Plans architecture.

## Goal Description
Revamp the Walkthroughs architecture to support progressive disclosure by structuring them as directories rather than single files. Each Walkthrough will be a folder containing one or more files, backed by database metadata (tags, complexity, format, etc.). The only way to create a Walkthrough will be to convert a directory into one.

## User Review Required
- **Migration Strategy**: How should we handle existing single-file walkthroughs in `.bluekit/walkthroughs`?
  - *Recommendation*: Auto-migrate them into folders (e.g., `walkthroughs/my-guide.md` -> `walkthroughs/my-guide/index.md`).
- **Database Schema**: Confirm we should add a new `walkthroughs` table to the existing SQLite database.

## Proposed Changes

### Backend (Rust/IPC)
Replicate the Plans architecture for Walkthroughs.

#### [NEW] `src-tauri/src/db/walkthroughs.rs` (or similar)
- Define `Walkthrough` struct:
  - `id`: UUID
  - `project_id`: UUID
  - `name`: string
  - `description`: string (optional)
  - `tags`: JSON/Text
  - `complexity`: Enum (Simple, Moderate, Comprehensive)
  - `format`: Enum (Reference, Guide, Review, Architecture, Documentation)
  - `path`: string (relative to project root)
  - `created_at`, `updated_at`

#### [NEW] `src-tauri/src/ipc/walkthroughs.rs`
- Implement IPC commands:
  - `create_walkthrough(project_id, path, metadata)`: Creates folder if needed, adds DB entry.
  - `get_project_walkthroughs(project_id)`: returns list from DB.
  - `get_walkthrough_details(walkthrough_id)`: returns DB metadata + file listing.
  - `update_walkthrough(id, metadata)`: Updates DB.
  - `delete_walkthrough(id)`: Removes DB entry (and optionally folder?).
  - `scan_walkthroughs(project_id)`: Scans `.bluekit/walkthroughs` and reconciles with DB.

### Frontend
#### [NEW] `src/ipc/walkthroughs.ts`
- Create strongly-typed wrappers for the new Rust IPC commands, mirroring `src/ipc/plans.ts`.

#### [MODIFY] `src/types/walkthrough.ts`
- Update interfaces to reflect the new structure (Walkthrough as an object with metadata, not just a file path).

#### [MODIFY] `src/components/walkthroughs/WalkthroughsTabContent.tsx`
- Update list view to consume `get_project_walkthroughs`.
- Update creation flow to "Convert Directory" or "Create New Walkthrough Checkpoint".
- display metadata (tags, complexity) in the list items.

## Verification Plan

### Automated Tests
- **Rust Unit Tests**: Verify DB operations (create, read, update, delete walkthroughs).
- **IPC Tests**: Verify frontend-backend communication for walkthrough commands.

### Manual Verification
1.  **Creation**:
    - Action: "Create Walkthrough" from a folder.
    - Check: Folder exists in `.bluekit/walkthroughs/<name>`, DB entry created.
2.  **Listing**:
    - Action: Open Walkthroughs tab.
    - Check: Walkthroughs appear with correct metadata (tags, complexity).
3.  **Persistence**:
    - Action: Restart app.
    - Check: Walkthroughs and metadata persist.
4.  **Migration**:
    - Action: Place a legacy `.md` file in `walkthroughs/`.
    - Check: Run scan/migration (if implemented) and verify it becomes a folder/DB entry.
