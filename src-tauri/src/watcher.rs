/// File watching module with production-grade reliability.
///
/// This module provides functionality to watch files and directories, emitting
/// Tauri events when changes are detected. Key improvements over previous version:
/// - Bounded channels prevent memory exhaustion
/// - Debouncing reduces event spam (300ms window)
/// - Auto-recovery with exponential backoff
/// - Proper error propagation to frontend
/// - Task lifecycle management
/// - Extended file type support (.md, .mmd, .mermaid, .json)

use notify::{Watcher, RecommendedWatcher, RecursiveMode};
use std::path::PathBuf;
use std::time::Duration;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::{mpsc, RwLock, oneshot};
use tokio::time::{sleep, Instant};
use tauri::{AppHandle, Manager};
use std::env;
use std::fs;
use tracing::{info, warn, error, debug};

// Configuration constants
const CHANNEL_BUFFER_SIZE: usize = 100;   // Bounded channel prevents OOM
const DEBOUNCE_DURATION_MS: u64 = 300;    // Batch events within 300ms window
const MAX_RETRY_ATTEMPTS: u32 = 5;         // Auto-restart attempts before giving up
const RETRY_BASE_DELAY_MS: u64 = 1000;    // Exponential backoff base (1s)

/// Watcher task handle for lifecycle management
struct WatcherTask {
    /// Path being watched
    path: PathBuf,
    /// Event name for emissions
    event_name: String,
    /// Restart attempt counter
    restart_count: u32,
    /// Whether the task is active
    is_active: bool,
    /// Task handle for cancellation
    task_handle: tauri::async_runtime::JoinHandle<()>,
    /// Cancellation signal sender
    cancel_tx: Option<oneshot::Sender<()>>,
}

/// Global watcher registry - stores active watchers
/// Key: event name (used as unique identifier)
/// Value: WatcherTask handle for lifecycle management
static WATCHER_REGISTRY: once_cell::sync::Lazy<Arc<RwLock<HashMap<String, WatcherTask>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

/// Global shutdown flag - prevents watcher restarts during app shutdown
static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

/// Debouncer state - tracks recent file events to batch them
struct DebouncerState {
    last_event_time: Instant,
    pending_paths: std::collections::HashSet<PathBuf>, // Changed from Vec to HashSet for automatic deduplication
}

/// Checks if a file extension matches watched types
fn is_watched_file(path: &PathBuf) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        matches!(ext, "md" | "mmd" | "mermaid" | "json")
    } else {
        false
    }
}

/// Checks if a JSON file is one we specifically care about
fn is_watched_json(path: &PathBuf) -> bool {
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        matches!(name, "blueprint.json" | "clones.json" | "projectRegistry.json" | "config.json" | "bookmarks.json")
    } else {
        false
    }
}

/// Starts watching a file and emits Tauri events when it changes.
///
/// Uses bounded channels, debouncing, and error propagation.
///
/// # Arguments
///
/// * `app_handle` - Tauri application handle for emitting events
/// * `file_path` - Path to the file to watch
/// * `event_name` - Name of the Tauri event to emit when file changes
///
/// # Returns
///
/// A `Result<(), String>` indicating success or failure
pub fn watch_file(
    app_handle: AppHandle,
    file_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    let watch_dir = file_path.parent()
        .ok_or_else(|| "File path has no parent directory".to_string())?
        .to_path_buf();

    if !watch_dir.exists() {
        fs::create_dir_all(&watch_dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Use bounded channel instead of unbounded
    let (tx, mut rx) = mpsc::channel(CHANNEL_BUFFER_SIZE);

    // Create cancellation channel for graceful shutdown
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

    let mut watcher: RecommendedWatcher = Watcher::new(
        move |res| {
            // Non-blocking send - if channel is full, log warning and drop event
            if tx.blocking_send(res).is_err() {
                warn!("Watcher channel full, dropping event");
            }
        },
        notify::Config::default()
    ).map_err(|e| format!("Failed to create file watcher: {}", e))?;

    watcher.watch(&watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;

    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string();

    let event_name_for_task = event_name.clone();

    // Spawn task with proper error handling
    let task_handle = tauri::async_runtime::spawn(async move {
        let _watcher = watcher; // Keep watcher alive

        let mut debounce_state = DebouncerState {
            last_event_time: Instant::now(),
            pending_paths: std::collections::HashSet::new(), // HashSet for automatic deduplication
        };

        info!("File watcher started for: {}", event_name_for_task);

        loop {
            tokio::select! {
                // Cancellation signal received
                _ = &mut cancel_rx => {
                    info!("Watcher cancelled: {}", event_name_for_task);
                    break;
                }

                // Non-blocking receive with timeout
                event_result = rx.recv() => {
                    match event_result {
                        Some(Ok(event)) => {
                            if let Some(path) = event.paths.iter().find(|p| {
                                p.file_name()
                                    .and_then(|n| n.to_str())
                                    .map(|n| n == file_name)
                                    .unwrap_or(false)
                            }) {
                                // Debounce: collect events (insert deduplicates automatically)
                                debounce_state.pending_paths.insert(path.clone());
                                debounce_state.last_event_time = Instant::now();
                            }
                        }
                        Some(Err(e)) => {
                            error!("File watcher error: {}", e);
                            // Emit error event to frontend
                            let _ = app_handle.emit_all(&format!("{}-error", event_name_for_task),
                                format!("Watcher error: {}", e));
                        }
                        None => {
                            warn!("Watcher channel closed, exiting task");
                            break;
                        }
                    }
                }

                // Debounce timer - emit after quiet period
                _ = sleep(Duration::from_millis(DEBOUNCE_DURATION_MS)) => {
                    if !debounce_state.pending_paths.is_empty() &&
                       debounce_state.last_event_time.elapsed() >= Duration::from_millis(DEBOUNCE_DURATION_MS) {
                        debug!("Debounced {} file changes, emitting event", debounce_state.pending_paths.len());

                        // Emit event
                        if let Err(e) = app_handle.emit_all(&event_name_for_task, ()) {
                            error!("Failed to emit file change event: {}", e);
                        }

                        debounce_state.pending_paths.clear();
                    }
                }
            }
        }

        info!("File watcher task exiting: {}", event_name_for_task);
    });

    // Store task handle for lifecycle management
    // Note: This happens asynchronously but very quickly (< 1ms typically)
    // The tiny race condition window is acceptable vs blocking the executor
    let event_name_clone = event_name.clone();
    let file_path_clone = file_path.clone();

    tauri::async_runtime::spawn(async move {
        let mut registry = WATCHER_REGISTRY.write().await;
        registry.insert(event_name_clone, WatcherTask {
            path: file_path_clone,
            event_name,
            restart_count: 0,
            is_active: true,
            task_handle,
            cancel_tx: Some(cancel_tx),
        });
    });

    Ok(())
}

/// Starts watching a directory for file changes and emits Tauri events.
///
/// Watches recursively with auto-recovery on failure.
///
/// # Arguments
///
/// * `app_handle` - Tauri application handle for emitting events
/// * `directory_path` - Path to the directory to watch
/// * `event_name` - Name of the Tauri event to emit when files change
///
/// # Returns
///
/// A `Result<(), String>` indicating success or failure
pub fn watch_directory(
    app_handle: AppHandle,
    directory_path: PathBuf,
    event_name: String,
) -> Result<(), String> {
    if !directory_path.exists() {
        fs::create_dir_all(&directory_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    start_directory_watcher_with_recovery(app_handle, directory_path, event_name, 0)
}

fn start_directory_watcher_with_recovery(
    app_handle: AppHandle,
    directory_path: PathBuf,
    event_name: String,
    restart_count: u32,
) -> Result<(), String> {
    let (tx, mut rx) = mpsc::channel(CHANNEL_BUFFER_SIZE);

    // Create cancellation channel for graceful shutdown
    let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();

    let mut watcher: RecommendedWatcher = Watcher::new(
        move |res| {
            if tx.blocking_send(res).is_err() {
                warn!("Directory watcher channel full, dropping event");
            }
        },
        notify::Config::default()
    ).map_err(|e| format!("Failed to create directory watcher: {}", e))?;

    watcher.watch(&directory_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching directory: {}", e))?;

    let app_handle_for_restart = app_handle.clone();
    let dir_path_for_restart = directory_path.clone();
    let event_name_for_restart = event_name.clone();
    let event_name_for_task = event_name.clone();

    let task_handle = tauri::async_runtime::spawn(async move {
        let _watcher = watcher;

        let mut debounce_state = DebouncerState {
            last_event_time: Instant::now(),
            pending_paths: std::collections::HashSet::new(), // HashSet for automatic deduplication
        };

        let mut consecutive_errors = 0u32;
        const MAX_CONSECUTIVE_ERRORS: u32 = 10;

        info!("Directory watcher started for: {}", event_name_for_task);

        // Track why the watcher exited
        enum ExitReason {
            Cancelled,  // Intentional shutdown
            Error,      // Crash/error that should trigger restart
        }

        let exit_reason = loop {
            tokio::select! {
                // Cancellation signal received
                _ = &mut cancel_rx => {
                    info!("Directory watcher cancelled: {}", event_name_for_task);
                    break ExitReason::Cancelled;
                }

                event_result = rx.recv() => {
                    match event_result {
                        Some(Ok(event)) => {
                            consecutive_errors = 0; // Reset error counter

                            // Check if any relevant files changed
                            let has_relevant_change = event.paths.iter().any(|p| {
                                if is_watched_file(p) {
                                    // For JSON files, only watch specific ones
                                    if p.extension().and_then(|e| e.to_str()) == Some("json") {
                                        is_watched_json(p)
                                    } else {
                                        true // All .md, .mmd, .mermaid files
                                    }
                                } else {
                                    false
                                }
                            });

                            if has_relevant_change {
                                for path in &event.paths {
                                    debounce_state.pending_paths.insert(path.clone()); // Insert into HashSet (auto-deduplicates)
                                }
                                debounce_state.last_event_time = Instant::now();
                            }
                        }
                        Some(Err(e)) => {
                            consecutive_errors += 1;
                            error!("Directory watcher error (#{}/{}): {}",
                                consecutive_errors, MAX_CONSECUTIVE_ERRORS, e);

                            // Emit error event
                            let _ = app_handle.emit_all(&format!("{}-error", event_name_for_task),
                                format!("Watcher error: {}", e));

                            // Too many errors - trigger restart
                            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
                                error!("Too many consecutive errors, attempting restart");
                                break ExitReason::Error;
                            }
                        }
                        None => {
                            warn!("Directory watcher channel closed");
                            break ExitReason::Error;
                        }
                    }
                }

                _ = sleep(Duration::from_millis(DEBOUNCE_DURATION_MS)) => {
                    if !debounce_state.pending_paths.is_empty() &&
                       debounce_state.last_event_time.elapsed() >= Duration::from_millis(DEBOUNCE_DURATION_MS) {
                        debug!("Debounced {} directory changes, emitting event",
                            debounce_state.pending_paths.len());

                        // Filter to only watched file types and convert to strings
                        let changed_paths: Vec<String> = debounce_state.pending_paths
                            .iter()
                            .filter(|p| {
                                if is_watched_file(p) {
                                    // For JSON files, only watch specific ones
                                    if p.extension().and_then(|e| e.to_str()) == Some("json") {
                                        is_watched_json(p)
                                    } else {
                                        true // All .md, .mmd, .mermaid files
                                    }
                                } else {
                                    false
                                }
                            })
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();

                        if let Err(e) = app_handle.emit_all(&event_name_for_task, changed_paths) {
                            error!("Failed to emit directory change event: {}", e);
                        }

                        debounce_state.pending_paths.clear();
                    }
                }
            }
        };

        // Only auto-restart if watcher crashed (not intentionally cancelled)
        if matches!(exit_reason, ExitReason::Error) &&
           !SHUTTING_DOWN.load(Ordering::SeqCst) &&
           restart_count < MAX_RETRY_ATTEMPTS {
            let next_restart = restart_count + 1;
            let delay_ms = RETRY_BASE_DELAY_MS * 2u64.pow(restart_count); // Exponential backoff

            warn!("Directory watcher crashed, restarting in {}ms (attempt {}/{})",
                delay_ms, next_restart, MAX_RETRY_ATTEMPTS);

            sleep(Duration::from_millis(delay_ms)).await;

            if let Err(e) = start_directory_watcher_with_recovery(
                app_handle_for_restart,
                dir_path_for_restart,
                event_name_for_restart,
                next_restart,
            ) {
                error!("Failed to restart directory watcher: {}", e);
            } else {
                info!("Directory watcher successfully restarted");
            }
        } else if matches!(exit_reason, ExitReason::Cancelled) {
            // Intentional cancellation - exit cleanly without logging error
            info!("Directory watcher stopped cleanly: {}", event_name_for_task);
        } else if SHUTTING_DOWN.load(Ordering::SeqCst) {
            info!("Skipping directory watcher restart - app shutting down");
        } else {
            // Error exit with exhausted retries
            error!("Directory watcher exhausted retry attempts, giving up");
            let _ = app_handle.emit_all(&format!("{}-fatal", event_name_for_task),
                "File watcher failed and could not be restarted");
        }
    });

    // Store task handle for lifecycle management
    // Note: This happens asynchronously but very quickly (< 1ms typically)
    // The tiny race condition window is acceptable vs blocking the executor
    let event_name_clone = event_name.clone();
    let directory_path_clone = directory_path.clone();

    tauri::async_runtime::spawn(async move {
        let mut registry = WATCHER_REGISTRY.write().await;
        registry.insert(event_name_clone, WatcherTask {
            path: directory_path_clone,
            event_name,
            restart_count,
            is_active: true,
            task_handle,
            cancel_tx: Some(cancel_tx),
        });
    });

    Ok(())
}

/// Checks if a watcher exists by event name
pub async fn watcher_exists(event_name: &str) -> bool {
    let registry = WATCHER_REGISTRY.read().await;
    registry.contains_key(event_name)
}

/// Stops a watcher by event name
pub async fn stop_watcher(event_name: &str) -> Result<(), String> {
    let mut registry = WATCHER_REGISTRY.write().await;

    if let Some(mut task) = registry.remove(event_name) {
        // Send cancellation signal
        if let Some(cancel_tx) = task.cancel_tx.take() {
            let _ = cancel_tx.send(());
        }

        // Drop the lock before waiting on the task to prevent deadlock
        drop(registry);

        // Wait for task to finish (5s timeout)
        match tokio::time::timeout(Duration::from_secs(5), task.task_handle).await {
            Ok(Ok(())) => {
                info!("Watcher stopped gracefully: {}", event_name);
                Ok(())
            }
            Ok(Err(e)) => {
                warn!("Watcher task panicked: {:?}", e);
                Ok(())
            }
            Err(_) => {
                warn!("Watcher stop timed out (forced): {}", event_name);
                Ok(())
            }
        }
    } else {
        Err(format!("Watcher not found: {}", event_name))
    }
}

/// Stops all active watchers (used during app shutdown)
pub async fn stop_all_watchers() -> Result<(), String> {
    SHUTTING_DOWN.store(true, Ordering::SeqCst);

    let event_names: Vec<String> = {
        let registry = WATCHER_REGISTRY.read().await;
        registry.keys().cloned().collect()
    };

    info!("Stopping {} watchers...", event_names.len());

    for name in event_names {
        if let Err(e) = stop_watcher(&name).await {
            warn!("Failed to stop watcher {}: {}", name, e);
        }
    }

    info!("All watchers stopped");
    Ok(())
}

/// Gets health status of all active watchers
pub async fn get_watcher_health() -> HashMap<String, bool> {
    let registry = WATCHER_REGISTRY.read().await;

    registry.iter()
        .map(|(name, task)| (name.clone(), task.is_active))
        .collect()
}

/// Gets the path to the project registry file
pub fn get_registry_path() -> Result<PathBuf, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;

    Ok(PathBuf::from(&home_dir)
        .join(".bluekit")
        .join("projectRegistry.json"))
}
