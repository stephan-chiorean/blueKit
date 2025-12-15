use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use super::github::GitHubCommit;

const CACHE_TTL_SECONDS: u64 = 300; // 5 minutes

#[derive(Clone)]
struct CacheEntry {
    commits: Vec<GitHubCommit>,
    cached_at: Instant,
}

pub struct CommitCache {
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
}

impl CommitCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Generates cache key from project_id, branch, and page
    fn cache_key(project_id: &str, branch: Option<&str>, page: u32) -> String {
        format!(
            "{}:{}:{}",
            project_id,
            branch.unwrap_or("default"),
            page
        )
    }

    /// Gets cached commits if fresh
    pub fn get(
        &self,
        project_id: &str,
        branch: Option<&str>,
        page: u32,
    ) -> Option<Vec<GitHubCommit>> {
        let cache = self.cache.lock().unwrap();
        let key = Self::cache_key(project_id, branch, page);

        if let Some(entry) = cache.get(&key) {
            let age = Instant::now().duration_since(entry.cached_at);
            if age < Duration::from_secs(CACHE_TTL_SECONDS) {
                return Some(entry.commits.clone());
            }
        }

        None
    }

    /// Stores commits in cache
    pub fn set(
        &self,
        project_id: &str,
        branch: Option<&str>,
        page: u32,
        commits: Vec<GitHubCommit>,
    ) {
        let mut cache = self.cache.lock().unwrap();
        let key = Self::cache_key(project_id, branch, page);

        cache.insert(key, CacheEntry {
            commits,
            cached_at: Instant::now(),
        });
    }

    /// Invalidates cache for a project (e.g., on branch switch)
    pub fn invalidate_project(&self, project_id: &str) {
        let mut cache = self.cache.lock().unwrap();
        cache.retain(|key, _| !key.starts_with(&format!("{}:", project_id)));
    }

    /// Clears entire cache
    pub fn clear(&self) {
        let mut cache = self.cache.lock().unwrap();
        cache.clear();
    }
}
