/// Library workspace management module.
/// 
/// This module handles Library workspaces, which are GitHub-backed
/// systems for sharing kits, walkthroughs, and other artifacts.

pub mod library;
pub mod utils;
pub mod resource_scanner;
pub mod publishing;
pub mod sync;
pub mod pull;
pub mod updates;

// Re-export commonly used types
pub use library::{LibraryWorkspace, LibraryArtifact};



