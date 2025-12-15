//! Git operations module.
//!
//! This module provides git operations using git CLI commands.

pub mod operations;
pub use operations::{GitMetadata, detect_git_metadata};
