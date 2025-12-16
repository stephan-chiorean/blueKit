/// Library workspace management module.
/// 
/// This module handles Library workspaces, which are GitHub-backed
/// systems for sharing kits, walkthroughs, and other artifacts.

pub mod library;

// Re-export commonly used types
pub use library::{LibraryWorkspace, LibraryArtifact};


