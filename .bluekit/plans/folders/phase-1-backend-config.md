---
id: folders-phase-1-backend-config
alias: "Phase 1: Backend Config.json Support"
type: plan
tags: [backend, rust, folders, config]
description: "Implement config.json reading/writing for artifact folders in Rust backend"
status: pending
---

# Phase 1: Backend Config.json Support

## Overview
Update Rust backend to support reading and writing `config.json` files in artifact folders while maintaining backward compatibility with folders that don't have config files.

## Goals
- ✅ Read `config.json` when loading folders
- ✅ Write `config.json` when creating folders with metadata
- ✅ Maintain backward compatibility (folders without config still work)
- ✅ Update folder operations to preserve config

## Files to Modify

### 1. `src-tauri/src/commands.rs`

#### Update `get_artifact_folders()` (line ~2379)
**Current behavior:** Returns folders without config (always `None`)

**New behavior:**
```rust
// After creating ArtifactFolder struct, try to read config.json
let config_path = dir_path.join("config.json");
let config = if config_path.exists() {
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            match serde_json::from_str::<FolderConfig>(&content) {
                Ok(cfg) => Some(cfg),
                Err(e) => {
                    warn!("Failed to parse config.json for {}: {}", folder_name, e);
                    None
                }
            }
        }
        Err(e) => {
            warn!("Failed to read config.json for {}: {}", folder_name, e);
            None
        }
    }
} else {
    None
};
```

**Fallback logic:** If no config exists, use directory name as display name

#### Update `create_artifact_folder()` (line ~2471)
**Current behavior:** Ignores `config` parameter, creates empty folder

**New behavior:**
```rust
pub async fn create_artifact_folder(
    project_path: String,
    artifact_type: String,
    _parent_path: Option<String>,
    folder_name: String,
    config: FolderConfig,  // NO LONGER IGNORED
) -> Result<String, String> {
    use std::fs;

    let base_dir = PathBuf::from(&project_path)
        .join(".bluekit")
        .join(&artifact_type);

    let folder_path = base_dir.join(&folder_name);

    if folder_path.exists() {
        return Err(format!("Folder already exists: {}", folder_name));
    }

    // Create the folder
    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    // Write config.json
    let config_path = folder_path.join("config.json");
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(folder_path.to_str().unwrap_or("").to_string())
}
```

#### Undeprecate `update_folder_config()` (line ~2498)
**Current behavior:** No-op (deprecated)

**New behavior:**
```rust
#[tauri::command]
pub async fn update_folder_config(
    folder_path: String,
    config: FolderConfig,
) -> Result<(), String> {
    use std::fs;

    let config_path = PathBuf::from(&folder_path).join("config.json");

    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write config.json: {}", e))?;

    Ok(())
}
```

#### Update `rename_artifact_folder()`
**Current:** Just renames directory

**New:** Rename directory AND update `config.name` if config.json exists
```rust
// After renaming folder, update config.json
let config_path = new_folder_path.join("config.json");
if config_path.exists() {
    if let Ok(content) = fs::read_to_string(&config_path) {
        if let Ok(mut cfg) = serde_json::from_str::<FolderConfig>(&content) {
            cfg.name = new_name.clone();
            cfg.updated_at = chrono::Utc::now().to_rfc3339();
            if let Ok(updated_json) = serde_json::to_string_pretty(&cfg) {
                let _ = fs::write(&config_path, updated_json);
            }
        }
    }
}
```

### 2. `src-tauri/Cargo.toml`
Add dependency if not already present:
```toml
chrono = { version = "0.4", features = ["serde"] }
```

## Testing Checklist

### Unit Tests
- [ ] Folder creation with valid config writes config.json
- [ ] Folder creation with empty config creates minimal config.json
- [ ] Loading folder with config.json populates `ArtifactFolder.config`
- [ ] Loading folder without config.json returns `config: None`
- [ ] Malformed config.json doesn't crash (warns + returns `None`)
- [ ] Renaming folder updates config.name field
- [ ] Update config command writes changes

### Integration Tests
- [ ] Create folder, reload, verify config persists
- [ ] Create folder without UI (just directory), still loads correctly
- [ ] Rename folder preserves all config except name
- [ ] Move artifacts doesn't corrupt parent folder config

## File Watcher Considerations
Config.json changes should trigger folder reload:
- Add `config.json` to file watcher patterns
- Emit `kits-updated`, `walkthroughs-updated` events on config changes

## Acceptance Criteria
- ✅ Backend reads config.json and populates `ArtifactFolder.config`
- ✅ Backend writes config.json on folder creation
- ✅ Folders without config.json continue to work (backward compatible)
- ✅ Config updates persist across app restarts
- ✅ File watcher detects config.json changes
- ✅ No breaking changes to existing IPC interface

## Dependencies
**Before:** None (this is the foundation)
**After:** Phase 2 (frontend can use new config data)

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Corrupt JSON crashes app | Wrap parsing in try-catch, log warning, return None |
| Name mismatch (folder vs config) | Config.name is source of truth, display in UI |
| File watcher doesn't see config.json | Add "config.json" to watched patterns |
| Migration breaks old folders | Graceful fallback: missing config = use directory name |

## Performance Notes
- Config.json files are tiny (~200 bytes typical)
- Reading during folder scan adds ~1ms per folder
- Acceptable for <100 folders per project
