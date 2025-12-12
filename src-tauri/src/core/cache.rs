/// File content caching module.
///
/// This module provides a thread-safe cache for artifact file contents,
/// tracking file modification times to avoid unnecessary re-reads.
///
/// The cache is used to:
/// - Avoid re-reading unchanged files
/// - Support incremental updates (only reload changed files)
/// - Reduce file I/O operations

use std::path::PathBuf;
use std::time::SystemTime;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::fs;
use tracing::debug;

/// Cache entry containing file content and modification time
type CacheEntry = (String, SystemTime);

/// Thread-safe cache for artifact file contents.
///
/// Uses `Arc<RwLock<>>` for async-friendly thread-safe access.
/// Maps file paths to (content, modification_time) tuples.
pub struct ArtifactCache {
    cache: Arc<RwLock<HashMap<PathBuf, CacheEntry>>>,
}

impl ArtifactCache {
    /// Creates a new empty cache.
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Gets file modification time from filesystem.
    fn get_file_mtime(path: &PathBuf) -> Result<SystemTime, String> {
        let metadata = fs::metadata(path)
            .map_err(|e| format!("Failed to read metadata for {}: {}", path.display(), e))?;
        metadata
            .modified()
            .map_err(|e| format!("Failed to get modification time for {}: {}", path.display(), e))
    }

    /// Gets cached content if file hasn't changed, otherwise reads and caches it.
    ///
    /// Returns the file content, either from cache (if unchanged) or by reading from disk.
    pub async fn get_or_read(&self, path: &PathBuf) -> Result<String, String> {
        // Check if file exists
        if !path.exists() {
            return Err(format!("File does not exist: {}", path.display()));
        }

        // Get current file modification time
        let current_mtime = Self::get_file_mtime(path)?;

        // Check cache
        let cache = self.cache.read().await;
        if let Some((cached_content, cached_mtime)) = cache.get(path) {
            // If modification time matches, return cached content
            if *cached_mtime == current_mtime {
                debug!("Cache hit for {}", path.display());
                return Ok(cached_content.clone());
            }
        }
        drop(cache); // Release read lock before acquiring write lock

        // File changed or not in cache - read from disk
        debug!("Cache miss for {}, reading from disk", path.display());
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;

        // Update cache
        let mut cache = self.cache.write().await;
        cache.insert(path.clone(), (content.clone(), current_mtime));

        Ok(content)
    }

    /// Gets cached content only if file hasn't changed.
    ///
    /// Returns `Some(content)` if file is cached and unchanged, `None` otherwise.
    pub async fn get_if_unchanged(&self, path: &PathBuf) -> Option<String> {
        if !path.exists() {
            return None;
        }

        let current_mtime = match Self::get_file_mtime(path) {
            Ok(mtime) => mtime,
            Err(_) => return None,
        };

        let cache = self.cache.read().await;
        if let Some((cached_content, cached_mtime)) = cache.get(path) {
            if *cached_mtime == current_mtime {
                return Some(cached_content.clone());
            }
        }

        None
    }

    /// Gets the modification time of a file from cache or filesystem.
    pub async fn get_modification_time(&self, path: &PathBuf) -> Option<SystemTime> {
        // Try cache first
        let cache = self.cache.read().await;
        if let Some((_, cached_mtime)) = cache.get(path) {
            return Some(*cached_mtime);
        }
        drop(cache);

        // Fall back to filesystem
        Self::get_file_mtime(path).ok()
    }

    /// Invalidates cache entry for a specific path.
    pub async fn invalidate(&self, path: &PathBuf) {
        let mut cache = self.cache.write().await;
        if cache.remove(path).is_some() {
            debug!("Invalidated cache for {}", path.display());
        }
    }

    /// Updates cache entry with new content.
    ///
    /// Reads modification time from filesystem and updates cache.
    pub async fn update(&self, path: &PathBuf, content: String) -> Result<(), String> {
        let mtime = Self::get_file_mtime(path)?;
        let mut cache = self.cache.write().await;
        cache.insert(path.clone(), (content, mtime));
        Ok(())
    }

    /// Clears the entire cache.
    ///
    /// Useful for testing or when cache needs to be reset.
    pub async fn clear(&self) {
        let mut cache = self.cache.write().await;
        let count = cache.len();
        cache.clear();
        debug!("Cleared cache (removed {} entries)", count);
    }
}




