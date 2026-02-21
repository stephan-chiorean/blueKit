
# Obsidian-style Bookmarks Flow 

This doc assumes the JSON looks like:

- Root: `{ items: BookmarkItem[] }`
- `BookmarkItem` is either:
  - `type: "file"` with `{ ctime, path, title }`
  - `type: "group"` with `{ ctime, title, items: BookmarkItem[] }`
- Groups can nest (because `items` is recursive).

Your goal: keep `bookmarks.json` consistent by pruning or repairing references when files move/rename/delete. This is why it's cool to try to understand what's going on when we build something like this. 

---

## Data Structures

### 1) Parsed in-memory model
- Load `bookmarks.json` -> parse into a tree:
  - `rootItems: BookmarkItem[]`
  - where each item is:
    - File bookmark: `{ type:"file", ctime, path, title }`
    - Group bookmark: `{ type:"group", ctime, title, items:[...] }`

### 2) Vault index (already in BlueKit)
- You already maintain something like:
  - `exists(path) -> boolean`
  - optional: `renameMap(oldPath -> newPath)` if your watcher provides it
  - optional: `fileId` mapping (not present in Obsidian’s JSON above)

---

## Startup / Vault Open Flow

1. **Read**
   - Read `.obsidian/bookmarks.json` (or your equivalent)

2. **Parse**
   - Parse JSON to `BookmarkTree`

3. **Validate**
   - Traverse the tree depth-first
   - For each `type:"file"` node:
     - if `VaultIndex.exists(path)` is false -> mark for removal (or unresolved)
   - For each `type:"group"` node:
     - recurse into `group.items`
     - after recursion:
       - if `group.items` becomes empty -> decide policy:
         - Obsidian-like: keep empty groups *or* prune empty groups
         - (I recommend pruning empty groups to avoid dead UI)

4. **Persist if changed**
   - If any bookmark was removed or tree changed, rewrite `bookmarks.json` atomically

---

## Watcher-Driven Reconciliation Flow

> Rule: update your VaultIndex FIRST, then reconcile bookmarks.

### Event Types
- `FILE_DELETED(path)`
- `FILE_RENAMED(oldPath, newPath)` (or delete+create)
- `FILE_CREATED(path)` (optional for unresolved recovery)
- `VAULT_REFRESHED()` (fallback when you only know “something changed”)

---

## Delete Flow (FILE_DELETED)

### Inputs
- deleted `path`

### Steps
1. Traverse `root.items` recursively
2. For any `type:"file"` item where `item.path == path`:
   - **remove it** from its parent array (Obsidian-like behavior)
3. For any `type:"group"` item:
   - recurse into `group.items`
   - after recursion, if `group.items.length === 0`:
     - remove the group (recommended) or keep (optional)

4. If any removal occurred:
   - schedule a debounced atomic write of `bookmarks.json`

---

## Rename/Move Flow (FILE_RENAMED)

### Inputs
- `oldPath`, `newPath`

### Steps
1. Traverse recursively
2. For any `type:"file"` item where `item.path == oldPath`:
   - set `item.path = newPath`
   - optionally update `item.title`:
     - Obsidian stores `title` explicitly, so it may keep user-defined title
     - recommended rule:
       - if `title` equals the old filename-derived title, update it
       - otherwise preserve it (user may have customized)

3. Persist if any changes occurred

> If your watcher emits delete+create rather than rename:
- you can maintain a short-lived rename heuristic (time-window + same inode/fileId if available)
- otherwise you’ll prune on delete and rely on user to re-bookmark on create (worse UX)

---

## Modify Flow (FILE_MODIFIED)

For Obsidian’s shown schema (`type:"file"` only, no headings/blocks):
- **no action needed**
- a file bookmark remains valid as long as the file exists

(If BlueKit later adds heading/block bookmarks, this is where you re-validate deep targets.)

---

## Periodic / Fallback Cleanup (VAULT_REFRESHED)

Even with watchers, you want a safety net:

1. Traverse all file bookmarks
2. Remove any whose `path` no longer exists
3. Prune empty groups
4. Persist if changed

Trigger this when:
- watcher misses events
- external tools mutate the repo aggressively
- the user switches branches

---

## Persistence (Debounced + Atomic)

Whenever reconciliation changes the tree:

1. Set `dirty = true`
2. Debounce (e.g. 250–1000ms)
3. Write:
   - `bookmarks.json.tmp`
   - then atomic rename to `bookmarks.json`

This prevents:
- writing on every single FS event
- partially-written JSON on crash

---

## Implementation Notes for Your Exact JSON Shape

### Tree traversal pattern
You need a function that:
- takes `items: BookmarkItem[]`
- returns a filtered/updated `items` array + `didChange` flag

Pseudo rules:
- if item.type === "file":
  - keep only if `exists(item.path)` (or if not in delete target)
- if item.type === "group":
  - recurse, replace `group.items` with result
  - drop group if `group.items.length === 0` (recommended)

### Titles & ctime
- `ctime` is just metadata (creation time)
- It does not help resolution
- Keep it unchanged during cleanup
- For rename, keep `ctime`; only change `path` (and optionally `title`)

---

## Recommended BlueKit Policy (matches Obsidian’s spirit)
- Delete file -> remove matching file bookmarks
- Rename/move file -> rewrite `path` in-place
- Empty groups -> prune
- Persist via debounced atomic write
