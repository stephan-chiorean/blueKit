# BlueKit App Crash Problem - Deep Dive

## Problem Summary

The BlueKit app experiences silent backend crashes that cause the UI to get stuck in "Loading..." states. Based on deep investigation, the root causes are:

### Backend Issues:
- Unbounded mpsc::channel() causes memory exhaustion (OOM crashes)
- Blocking operations in async context
- Silent task exits with no error propagation
- No watcher lifecycle management
- Missing logging infrastructure
- No debouncing - event spam overwhelms system

### Frontend Issues:
- No timeout protection on IPC calls (hangs forever)
- Race conditions in async useEffect cleanup
- Multiple overlapping watchers accumulate
- Silent failures in secondary operations
- Stuck "Loading..." states with no recovery

## Solution Approach

Production-grade file watching with:
- Bounded channels - prevent OOM
- Debouncing (300ms) - batch rapid changes
- Auto-recovery - restart crashed watchers with exponential backoff
- Timeout protection - all IPC calls have 15s timeout
- Proper cleanup - fix async useEffect race conditions
- Extended watching - add .json files (blueprint.json, clones.json)
- Structured logging - replace eprintln! with tracing crate
- Error UI - show recovery status to users

---

## Implementation Steps

### Phase 1: Backend Core Fixes

#### 1.1 Add Logging Infrastructure

**File: src-tauri/Cargo.toml**

Add dependencies:
```toml
tracing = "0.1"
tracing-subscriber = "0.3"
```

**File: src-tauri/src/main.rs** (before .run() call, around line 26)

Initialize logging:
```rust
tracing_subscriber::fmt()
    .with_max_level(tracing::Level::INFO)
    .with_target(false)
    .init();
```

#### 1.2 Complete Rewrite of watcher.rs

**File: src-tauri/src/watcher.rs** (entire file replacement)

Critical changes:
- Replace std::sync::mpsc with tokio::sync::mpsc::channel(100) (bounded)
- Replace blocking rx.recv() with async rx.recv().await in tokio::select!
- Add debouncing with 300ms window
- Add global WATCHER_REGISTRY for task lifecycle management
- Implement auto-restart with exponential backoff (max 5 attempts)
- Emit error events to frontend instead of silent failure
- Watch .json files: blueprint.json, clones.json, projectRegistry.json
- Replace all eprintln! with tracing::{info, warn, error} macros

Key additions:
- `is_watched_file()` - checks for .md, .mmd, .mermaid, .json extensions
- `is_watched_json()` - filters specific JSON files we care about
- `DebouncerState` struct - batches events within 300ms
- `WatcherTask` struct - stores abort handles and metadata
- `WATCHER_REGISTRY` - global HashMap of active watchers
- `stop_watcher()` - gracefully shutdown watchers
- `get_watcher_health()` - health check for frontend

Architecture:
1. Create bounded channel with 100 event capacity
2. Spawn async task that uses tokio::select! to:
   - Receive file events (non-blocking)
   - Debounce timer (300ms)
   - Emit batched events to frontend
3. On error: attempt auto-restart up to 5 times with exponential backoff
4. Store task handle in registry for lifecycle management

#### 1.3 Add Health Check Command

**File: src-tauri/src/commands.rs**

Add new Tauri command:
```rust
#[tauri::command]
pub async fn get_watcher_health() -> Result<HashMap<String, bool>, String> {
    Ok(crate::watcher::get_watcher_health().await)
}
```

**File: src-tauri/src/main.rs**

Register command in invoke_handler![] macro:
```rust
commands::get_watcher_health,
```

---

### Phase 2: Frontend Timeout Protection

#### 2.1 Create Timeout Wrapper

**File: src/utils/ipcTimeout.ts** (NEW FILE)

Create utility that wraps all Tauri invoke() calls with 15-second timeout:
- Default timeout: 15000ms
- Returns TimeoutError if command doesn't complete in time
- Uses Promise.race() pattern

#### 2.2 Update All IPC Calls

**File: src/ipc.ts**

Replace all invoke() calls with invokeWithTimeout():
- invokeGetProjectKits() - 15s timeout
- invokeWatchProjectKits() - 5s timeout (quick operation)
- invokeGetProjectRegistry() - 15s timeout
- Add new invokeGetWatcherHealth() - 3s timeout
- Update remaining ~20 functions similarly

---

### Phase 3: Fix Async Cleanup Race Conditions

#### 3.1 HomePage.tsx Cleanup Fix

**File: src/pages/HomePage.tsx** (lines 164-201)

Problem: Cleanup wrapped in async Promise - React can't await it properly

Fix:
- Add isMounted flag to track component lifecycle
- Accumulate unlistenFunctions array synchronously
- Make cleanup function synchronous (remove async wrapper)
- Check isMounted before triggering reloads
- Handle TimeoutError gracefully

#### 3.2 ProjectDetailPage.tsx Cleanup Fix

**File: src/pages/ProjectDetailPage.tsx** (lines 102-140)

Apply same pattern:
- Add isMounted flag
- Store unlisten function in closure
- Synchronous cleanup
- Check isMounted in event handlers

#### 3.3 DiagramsTabContent.tsx Cleanup Fix

**File: src/components/diagrams/DiagramsTabContent.tsx** (lines 85-120)

Apply same pattern as above.

---

### Phase 4: Error Recovery UI

#### 4.1 Create Error Banner Component

**File: src/components/ErrorBoundary.tsx** (NEW FILE)

Create WatcherErrorBanner component that:
- Listens for *-error and *-fatal events from backend
- Shows orange warning banner when watcher has issues
- Provides "Reload App" button
- Dismissible by user

#### 4.2 Create Health Monitor Component

**File: src/components/WatcherHealthMonitor.tsx** (NEW FILE)

Create component that:
- Polls invokeGetWatcherHealth() every 30 seconds
- Shows red warning if any watchers are dead
- Lists which watchers have crashed
- Indicates auto-recovery is in progress

#### 4.3 Add to Key Pages

Add both components to:
- src/pages/HomePage.tsx (top of main content)
- src/pages/ProjectDetailPage.tsx (top of main content)

#### 4.4 Add Loading Timeout Protection

**File: src/pages/HomePage.tsx** (loadProjects function, around line 54-76)

Add 30-second timeout that clears loading state and shows error if exceeded:
```typescript
const timeoutId = setTimeout(() => {
  setProjectsError('Loading is taking too long...');
  setProjectsLoading(false);
}, 30000);
```

Clear timeout in both success and error cases.

---

### Phase 5: Testing & Validation

#### 5.1 Create Stress Test Script

**File: test-scripts/stress-test-watchers.sh** (NEW FILE)

Bash script that:
- Creates 100 .md files rapidly in .bluekit/kits/
- Modifies existing files repeatedly
- Verifies app doesn't crash
- Cleans up test files

Run manually: `./test-scripts/stress-test-watchers.sh /path/to/project`

#### 5.2 Create Memory Leak Test

**File: test-scripts/memory-leak-test.sh** (NEW FILE)

Bash script that:
- Runs for 1 hour (configurable)
- Continuously creates and deletes files
- User monitors memory usage in Activity Monitor
- Verifies memory stays bounded

#### 5.3 Manual Test Checklist

Create manual test document covering:
- Timeout errors - disconnect network, verify timeout handling
- Channel overflow - create 200 files in 1 second, verify no crash
- Permission errors - make .bluekit read-only, verify error shown
- Recovery testing - trigger crash, verify auto-restart
- Multiple projects - test with 5+ projects simultaneously

---

## Critical Files to Modify

### Must Change (Core Fixes):

1. **src-tauri/Cargo.toml** - Add logging dependencies
2. **src-tauri/src/watcher.rs** - Complete rewrite (unbounded → bounded channels, add debouncing, auto-recovery)
3. **src-tauri/src/main.rs** - Initialize logging, register health check command
4. **src-tauri/src/commands.rs** - Add get_watcher_health command
5. **src/ipc.ts** - Wrap all invoke calls with timeout protection
6. **src/pages/HomePage.tsx** - Fix async cleanup race condition, add timeout to loadProjects
7. **src/pages/ProjectDetailPage.tsx** - Fix async cleanup race condition

### New Files to Create:

8. **src/utils/ipcTimeout.ts** - Timeout wrapper utility
9. **src/components/ErrorBoundary.tsx** - Watcher error banner
10. **src/components/WatcherHealthMonitor.tsx** - Health monitor UI
11. **test-scripts/stress-test-watchers.sh** - Stress testing
12. **test-scripts/memory-leak-test.sh** - Memory leak detection

### Should Change (Additional Reliability):

13. **src/components/diagrams/DiagramsTabContent.tsx** - Fix async cleanup

---

## Key Technical Details

### Bounded Channel Architecture

```
File Change → notify Watcher → Bounded Channel (100) → Debounce (300ms) → Emit Event
                                      ↓ (if full)
                                 Drop event + log warning
```

### Auto-Recovery Flow

```
Crash Detected → Delay 1s → Retry #1 → Fail → Delay 2s → Retry #2 → ... → Max 5 attempts
                                                                              ↓
                                                                       Emit fatal error
```

### Debouncing Logic

- Collect all file change events in 300ms window
- After 300ms of silence, emit single batched event
- Prevents spam from rapid file changes
- Reduces frontend reload frequency by 90%+

### Timeout Protection

- All invoke() calls wrapped with Promise.race()
- Default: 15 seconds
- Watch setup: 5 seconds (quick operation)
- Health check: 3 seconds
- User sees clear timeout error message with retry option

---

## Success Criteria

After implementation:
- ✅ Zero crashes in 24-hour stress test
- ✅ Zero memory leaks in 1-hour continuous test
- ✅ 100% auto-recovery success rate (within 5 attempts)
- ✅ No stuck "Loading..." states
- ✅ All file types (.md, .mmd, .json) trigger updates
- ✅ UI updates within 300ms of file changes (debounced)
- ✅ Clear error messages for all failure modes
- ✅ Bounded memory usage (<50MB growth over time)

---

## Risks & Mitigations

**Risk:** Debouncing adds 300ms delay
**Mitigation:** Imperceptible to users, industry standard practice

**Risk:** Bounded channel might drop events if overwhelmed
**Mitigation:** Better than OOM crash; 100-event buffer is very large; logged warnings

**Risk:** Auto-restart might loop infinitely
**Mitigation:** Hard 5-attempt limit, exponential backoff, fatal error emission

**Risk:** 15s timeout too aggressive
**Mitigation:** Very generous for local IPC; different timeouts per operation; user-visible errors with retry

---

## Implementation Order

**Day 1:** Backend core (Cargo.toml, watcher.rs rewrite, logging)
**Day 2:** Backend health check + Frontend timeout wrapper
**Day 3:** Frontend cleanup fixes + Error UI components
**Day 4:** Testing scripts + Manual testing
**Day 5:** Validation with real projects + Bug fixes
