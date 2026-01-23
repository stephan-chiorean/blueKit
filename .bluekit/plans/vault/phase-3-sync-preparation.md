# Phase 3: Cloud Sync Preparation

## Goal
Prepare the vault architecture for cloud synchronization without implementing the full sync engine. Build the foundation for seamless multi-device sync in Phase 4.

---

## Prerequisites
- Phase 1 completed: Local vault working
- Phase 2 completed: Search, linking, templates working
- Users actively using vault on desktop
- Supabase authentication integrated (from .bluekit/plans/supabase/)

---

## Key Principles

1. **Local-First Architecture**: All operations work offline, sync is additive
2. **Conflict Detection**: Identify conflicts, don't auto-resolve yet
3. **Metadata Layer**: Separate content from sync metadata
4. **UUID-Based**: Use stable IDs instead of file paths
5. **Delta Sync**: Only sync changed files, not entire vault
6. **Idempotent**: Sync operations can be retried safely

---

## User Stories

### US-11: Sync Readiness Indicator
**As an** authenticated user
**I want to** see if my vault is ready for cloud sync
**So that** I know sync will work when enabled

**Acceptance Criteria**:
- Vault settings show "Sync: Ready" if authenticated
- Vault settings show "Sync: Disabled (Sign in required)" if not authenticated
- No actual sync happens in Phase 3 (just indicator)

### US-12: Change Tracking
**As a** user making edits
**I want my** changes to be tracked locally
**So that** future sync knows what to upload

**Acceptance Criteria**:
- All file operations (create, update, delete) logged to change log
- Change log persists across app restarts
- Can view change history in dev tools (for debugging)

### US-13: Conflict Detection (Local Simulation)
**As a** developer testing sync
**I want to** simulate conflicts between two local vaults
**So that** I can verify conflict detection works

**Acceptance Criteria**:
- Can manually trigger "sync" between two local vaults
- Conflicts detected: same file edited in both vaults
- Conflict report shows conflicting files
- No auto-resolution (manual only)

---

## Architecture Overview

### Sync Metadata Structure

Each vault gains a `.bluekit/sync/` directory:

```
.bluekit/sync/
├── manifest.json        # File inventory with checksums
├── changelog.json       # Local changes since last sync
├── conflicts.json       # Detected conflicts
└── sync-state.json      # Last sync timestamp, version
```

### File Manifest
```typescript
interface SyncManifest {
  version: string;              // "1.0.0"
  vaultId: string;              // UUID
  lastSyncedAt: number;         // Unix timestamp
  files: {
    [uuid: string]: FileMetadata;
  };
}

interface FileMetadata {
  uuid: string;                 // Stable ID for file
  path: string;                 // Current file path
  checksum: string;             // SHA-256 hash
  size: number;                 // Bytes
  createdAt: number;            // Unix timestamp
  modifiedAt: number;           // Unix timestamp
  deletedAt?: number;           // If soft-deleted
}
```

### Change Log
```typescript
interface ChangeLog {
  version: string;
  changes: FileChange[];
}

interface FileChange {
  uuid: string;
  type: 'create' | 'update' | 'delete' | 'move';
  path: string;                 // New path (for move/update)
  oldPath?: string;             // Old path (for move)
  timestamp: number;
  checksum?: string;            // For update/create
  size?: number;
}
```

### Conflict Record
```typescript
interface ConflictRecord {
  uuid: string;
  localPath: string;
  localChecksum: string;
  localModifiedAt: number;
  remoteChecksum: string;       // Will be used in Phase 4
  remoteModifiedAt: number;
  status: 'unresolved' | 'resolved';
  resolvedBy?: 'local' | 'remote' | 'merge';
}
```

---

## Implementation Checklist

### Backend: Sync Metadata System

#### New Rust Module: `src-tauri/src/sync.rs`

```rust
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncManifest {
    pub version: String,
    pub vault_id: String,
    pub last_synced_at: i64,
    pub files: HashMap<String, FileMetadata>,
}

impl SyncManifest {
    pub fn new(vault_id: String) -> Self {
        Self {
            version: "1.0.0".to_string(),
            vault_id,
            last_synced_at: 0,
            files: HashMap::new(),
        }
    }

    pub fn load(vault_path: &str) -> Result<Self, String> {
        let manifest_path = format!("{}/.bluekit/sync/manifest.json", vault_path);
        // Load from file or create new
    }

    pub fn save(&self, vault_path: &str) -> Result<(), String> {
        let manifest_path = format!("{}/.bluekit/sync/manifest.json", vault_path);
        // Write to file
    }

    pub fn add_file(&mut self, file_path: &str) -> Result<FileMetadata, String> {
        let uuid = Uuid::new_v4().to_string();
        let checksum = Self::calculate_checksum(file_path)?;
        let metadata = fs::metadata(file_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        let file_meta = FileMetadata {
            uuid: uuid.clone(),
            path: file_path.to_string(),
            checksum,
            size: metadata.len(),
            created_at: metadata.created()?.duration_since(UNIX_EPOCH)?.as_secs() as i64,
            modified_at: metadata.modified()?.duration_since(UNIX_EPOCH)?.as_secs() as i64,
            deleted_at: None,
        };

        self.files.insert(uuid, file_meta.clone());
        Ok(file_meta)
    }

    fn calculate_checksum(file_path: &str) -> Result<String, String> {
        let content = fs::read(file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut hasher = Sha256::new();
        hasher.update(&content);
        Ok(format!("{:x}", hasher.finalize()))
    }
}
```

#### Commands

- [ ] `init_sync_metadata(vault_id: String) -> Result<(), String>`
  - Create `.bluekit/sync/` directory
  - Initialize manifest.json, changelog.json, sync-state.json
  - Scan all existing files, add to manifest
  - Called when user enables sync

- [ ] `get_sync_manifest(vault_id: String) -> Result<SyncManifest, String>`
  - Load manifest.json
  - Return manifest object

- [ ] `log_file_change(vault_id: String, change: FileChange) -> Result<(), String>`
  - Append to changelog.json
  - Update manifest.json with new checksum
  - Called by file watcher on every change

- [ ] `detect_local_conflicts(vault_id_a: String, vault_id_b: String) -> Result<Vec<ConflictRecord>, String>`
  - Compare manifests of two vaults
  - Find files with same UUID but different checksums
  - Return conflicts list
  - Used for testing in Phase 3, real sync in Phase 4

- [ ] `rebuild_manifest(vault_id: String) -> Result<(), String>`
  - Re-scan entire vault
  - Recalculate checksums
  - Rebuild manifest from scratch
  - Use when manifest is corrupted

---

### Frontend: Sync Preparation UI

#### New Components

- [ ] `SyncStatusIndicator.tsx`
  - Shows in vault settings
  - States:
    - "Not authenticated" (grey)
    - "Sync ready" (green) - Phase 3
    - "Syncing..." (blue) - Phase 4
    - "Sync paused" (yellow)
    - "Sync error" (red) - Phase 4
  - Click to open sync settings

- [ ] `SyncSettingsPanel.tsx`
  - Enable/disable sync toggle
  - Show last sync time
  - Show sync status
  - Button: "Initialize Sync Metadata" (Phase 3)
  - Button: "Rebuild Manifest" (recovery)

- [ ] `ChangeLogViewer.tsx` (Dev Tools)
  - List all changes since last sync
  - Filter by type (create/update/delete)
  - Shows checksums, timestamps
  - For debugging only

- [ ] `ConflictViewer.tsx` (Dev Tools)
  - List detected conflicts
  - Show local vs. remote metadata
  - Manual resolution options (Phase 4)

---

### File Watcher Integration

Extend existing file watcher to log changes:

```rust
// In src-tauri/src/watcher.rs

pub fn watch_vault_with_sync(vault_id: String, vault_path: String) -> Result<(), String> {
    // Existing watch logic...

    // Add sync logging
    let sync_enabled = is_sync_enabled(&vault_id)?;
    if sync_enabled {
        // Log change to changelog.json
        log_file_change(vault_id.clone(), FileChange {
            uuid: get_or_create_file_uuid(&vault_id, &file_path)?,
            type_: determine_change_type(&event),
            path: file_path.clone(),
            timestamp: Utc::now().timestamp(),
            checksum: calculate_checksum(&file_path)?,
            size: fs::metadata(&file_path)?.len(),
        })?;
    }

    // Emit event as usual
}

fn get_or_create_file_uuid(vault_id: &str, file_path: &str) -> Result<String, String> {
    let manifest = SyncManifest::load(vault_id)?;

    // Find existing UUID by path
    for (uuid, meta) in manifest.files.iter() {
        if meta.path == file_path {
            return Ok(uuid.clone());
        }
    }

    // Create new UUID
    let uuid = Uuid::new_v4().to_string();
    Ok(uuid)
}
```

---

## Change Detection Strategies

### Strategy 1: File Watcher + Checksums (Recommended)
- **How**: File watcher logs all changes immediately
- **Pros**: Real-time, no missed changes
- **Cons**: Requires app to be running
- **Mitigation**: On app start, compare manifest checksums vs. actual files

### Strategy 2: Periodic Scanning
- **How**: Every N minutes, scan vault and compare checksums
- **Pros**: Catches external edits (VS Code, etc.)
- **Cons**: Battery drain, delayed detection
- **Use**: As fallback, not primary method

### Strategy 3: Hybrid (Recommended)
- File watcher for real-time changes (when app is running)
- On app start, run full checksum scan
- Log any discrepancies to changelog

---

## Local Conflict Simulation (Testing)

### Setup
1. Create two local vaults: `Vault A` and `Vault B`
2. Initialize sync metadata in both
3. Copy same note to both vaults with same UUID
4. Edit note differently in each vault

### Test Cases

#### Test 1: Simple Conflict
- Vault A: `note.md` (checksum: `abc123`)
- Vault B: `note.md` (checksum: `def456`)
- Expected: Conflict detected, both versions preserved

#### Test 2: Delete vs. Update
- Vault A: `note.md` deleted
- Vault B: `note.md` updated
- Expected: Conflict detected, prompt user

#### Test 3: Move vs. Update
- Vault A: `note.md` moved to `archive/note.md`
- Vault B: `note.md` updated in place
- Expected: Conflict detected, manual resolution

#### Test 4: No Conflict (Same Changes)
- Vault A: `note.md` (checksum: `abc123`)
- Vault B: `note.md` (checksum: `abc123`)
- Expected: No conflict, in sync

---

## Data Integrity

### Checksums
- Use SHA-256 for file content
- Store in manifest.json
- Recalculate on every change
- Detect corruption via mismatch

### Atomic Operations
- Use temporary files for writes
- Rename after successful write
- Prevents partial writes

### Backup Strategy
- Before any sync operation, backup manifest
- Store last 5 manifests (manifest.json.1, .2, etc.)
- Rollback if sync fails

---

## Performance Considerations

### Manifest Size
- 10,000 files = ~2MB JSON
- Load on app start (acceptable)
- Consider SQLite for >50K files

### Checksum Calculation
- SHA-256: ~500 MB/s on modern CPU
- 1000 files x 10KB = 10MB → ~20ms
- Run in background thread (Rust async)

### Change Log Growth
- Prune old changes after successful sync
- Keep last 1000 changes as history
- Archive older changes to `changelog-archive.json`

---

## Security & Privacy

### Local Storage
- Manifest contains file paths (sensitive)
- Store in `.bluekit/sync/` (not synced yet)
- Encrypt manifest if user requests (future)

### Checksums
- SHA-256 is one-way (can't reverse to content)
- Safe to store/sync
- Used for integrity, not security

### User Data
- No cloud upload in Phase 3
- All data stays local
- Privacy-first approach

---

## Sync State Machine (Preparation)

In Phase 4, the sync state will be:

```
┌─────────────┐
│   Offline   │
└──────┬──────┘
       │ authenticate
       ▼
┌─────────────┐
│    Ready    │ ◄─────────────┐
└──────┬──────┘               │
       │ start sync           │
       ▼                      │
┌─────────────┐               │
│   Syncing   │               │
└──────┬──────┘               │
       │ complete/error       │
       └──────────────────────┘
```

**Phase 3 Tasks**:
- [ ] Implement state machine logic (local only)
- [ ] Test state transitions
- [ ] Add state persistence

---

## Testing Strategy

### Unit Tests (Rust)

- [ ] `test_manifest_creation()` - Initialize manifest
- [ ] `test_add_file_to_manifest()` - Add file metadata
- [ ] `test_calculate_checksum()` - Verify SHA-256
- [ ] `test_detect_conflicts()` - Conflict detection logic
- [ ] `test_changelog_append()` - Log file changes

### Integration Tests (Frontend)

- [ ] Initialize sync metadata via UI
- [ ] View changelog in dev tools
- [ ] Simulate conflict between two vaults
- [ ] Rebuild manifest after corruption

### Manual Testing

- [ ] Create 10,000 notes, verify manifest generation time
- [ ] Edit files externally (VS Code), verify changelog updates
- [ ] Corrupt manifest, verify rebuild works
- [ ] Simulate conflicts, verify detection

---

## Performance Targets

- Manifest initialization: <5 seconds for 10,000 files
- Checksum calculation: <20ms for 1000 files
- Changelog append: <5ms per change
- Conflict detection: <500ms for 10,000 files

---

## Documentation

### User Guide
- [ ] "Preparing Your Vault for Sync" guide
- [ ] "Understanding Sync Metadata" article
- [ ] FAQ: "What happens to my data in Phase 3?"

### Developer Guide
- [ ] Sync architecture overview
- [ ] Manifest schema documentation
- [ ] Conflict resolution strategies (for Phase 4)

---

## Migration from Phase 2

### Backward Compatibility
- Phase 2 vaults work as-is
- Sync metadata is opt-in
- No breaking changes

### Upgrade Path
1. User clicks "Enable Sync" in settings
2. Show warning: "This will prepare your vault for cloud sync (coming soon)"
3. Initialize sync metadata in background
4. Show progress: "Scanning X of Y files..."
5. Complete: "Vault ready for sync"

---

## Success Criteria (Phase 3 Complete)

- [ ] Sync metadata system implemented and tested
- [ ] File changes tracked in changelog
- [ ] Checksums calculated correctly
- [ ] Conflict detection works (local simulation)
- [ ] Manifest can be rebuilt from scratch
- [ ] State machine logic implemented
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Zero data loss in testing
- [ ] Ready for Phase 4 (cloud sync implementation)

**Definition of Done**: A user can enable "sync preparation" on their vault, see all file changes tracked, simulate conflicts between two local vaults, and be confident their data is ready for cloud sync in Phase 4.

---

## Risks & Mitigations

### Risk: Manifest Corruption
- **Mitigation**: Automatic backups, rebuild command

### Risk: Missed File Changes
- **Mitigation**: Hybrid detection (watcher + startup scan)

### Risk: Performance Degradation
- **Mitigation**: Background checksumming, SQLite for large vaults

### Risk: User Confusion
- **Mitigation**: Clear messaging: "Sync preparation, not actual sync"

---

## Next Phase Preview: Phase 4 (Cloud Sync)

After Phase 3 completes:
- Upload manifest to Supabase Storage
- Download remote manifest
- Merge local + remote changes
- Implement conflict resolution UI
- Enable real-time sync
- Add mobile app support

Phase 3 lays the foundation for all of this by ensuring:
1. Every file has a stable UUID
2. All changes are tracked
3. Conflicts can be detected
4. Data integrity is maintained
