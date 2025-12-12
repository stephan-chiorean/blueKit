/// Core application functionality module.
/// 
/// This module contains core functionality used throughout the application:
/// - File content caching
/// - Application state management
/// - Utility functions
/// - File watching

pub mod cache;
pub mod state;
pub mod utils;
pub mod watcher;

// Re-export commonly used types
pub use cache::ArtifactCache;
pub use state::AppState;
