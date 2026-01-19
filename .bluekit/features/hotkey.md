# hotkey

# Implement: Global Hotkey to Toggle/Focus BlueKit (Tauri + React + Rust)

## Goal
Add a **system-wide keyboard shortcut** that:
- Works **when BlueKit is running** (including when its window is hidden/minimized).
- **Toggles** the main window:
  - If the main window is **visible and focused** → **hide** it.
  - Otherwise → **show** it and **focus** it (bring to front).

This should feel like **Spotlight/Alfred**:
- Press hotkey → BlueKit appears front-and-center.
- Press hotkey again → BlueKit disappears.

## Non-Goals (for this iteration)
- Do NOT implement a background helper to capture hotkeys while the app is fully quit.
- Do NOT implement login-item auto-start (optional future work).
- Do NOT implement deep OS permission prompts (Accessibility / Automation) unless absolutely required.

## Requirements
### 1) Global hotkey registration
- Register a default hotkey (pick one that’s unlikely to conflict):
  - macOS default suggestion: `Cmd+Shift+Space`
  - Windows/Linux default suggestion: `Ctrl+Shift+Space`
- The hotkey must be configurable later, but for now:
  - It’s fine to hardcode it as a constant in Rust.
  - If the chosen hotkey fails to register (already taken), log a clear error.

### 2) Toggle window behavior
Implement a function like `toggle_main_window(app_handle)` that:
- Locates the existing main window (by label).
- Determines whether it is currently:
  - visible
  - focused
  - minimized
- Behavior:
  - If window is **visible AND focused**:
    - `hide()` (or `set_visible(false)`) the window.
  - Else:
    - Ensure it is not minimized
    - `show()` it
    - Bring it to front (`set_focus()` / `set_always_on_top(true->false)` if needed as a focus workaround)
    - Ensure it becomes the active app window if possible.

### 3) Tray/menubar mode support (keep app alive)
- Ensure the app can stay running even when the window is closed/hidden.
- Prefer:
  - Closing the window hides it rather than quitting the entire app.
  - Add a tray icon with:
    - “Show BlueKit”
    - “Hide BlueKit”
    - “Quit”
- The hotkey must work as long as the app process is alive (tray running is OK).

### 4) Cross-platform considerations
- Handle macOS/Windows/Linux without separate feature branches if possible.
- If a platform needs a specific workaround, isolate it behind `#[cfg(target_os = "...")]`.
- Do not introduce new permissions prompts unless strictly necessary.

## Implementation Notes / Hints
- Use Tauri’s global shortcut system (Tauri v2: `tauri-plugin-global-shortcut`).
- Register shortcuts during app setup / initialization (not from React).
- Store the window label constant in one place (e.g. `"main"`).
- Use robust logging so failures are obvious:
  - “Failed to register global shortcut …”
  - “Main window not found”
  - “Toggle requested: visible=…, focused=…, minimized=…”

## Acceptance Criteria
- With BlueKit running:
  1. Press hotkey → main window shows and focuses.
  2. Press hotkey again while focused → window hides.
  3. If minimized, hotkey restores + focuses.
  4. If hidden but app running (tray), hotkey shows + focuses.
- No crashes if window is missing; log and no-op.
- No required user permission setup for baseline behavior.

## Deliverables
- Rust code changes (Tauri backend):
  - Register global shortcut.
  - Implement `toggle_main_window`.
  - Tray menu + “hide on close” behavior (keep app alive).
- Minimal or no React changes (only if needed for UI wiring later).
- Short README snippet explaining:
  - Default hotkey
  - How to change it in code (for now)
  - Known limitations (won’t work if the app is fully quit)

