/// Application state management module.
/// 
/// This module demonstrates how to manage shared state across Tauri commands.
/// In a real application, you might store things like:
/// - User preferences
/// - Application configuration
/// - Cached data
/// - Connection handles
/// 
/// For this template, we'll keep it simple and show the structure
/// for future state management.

use std::sync::Mutex;
use serde::{Deserialize, Serialize};

/// Example application state structure.
/// 
/// In Rust, structs are defined with the `struct` keyword.
/// The `#[derive(...)]` attribute automatically generates implementations
/// for common traits like `Serialize` and `Deserialize` (for JSON conversion).
#[allow(dead_code)] // Suppress warning - this is example code for a template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    /// Application name
    pub name: String,
    /// Application version
    pub version: String,
    /// Number of times the app has been initialized
    pub init_count: u32,
}

impl AppState {
    /// Creates a new instance of AppState.
    /// 
    /// In Rust, `impl` blocks contain methods associated with a type.
    /// `new` is a common convention for constructors.
    pub fn new(name: String, version: String) -> Self {
        // `Self` is an alias for the type being implemented (AppState)
        Self {
            name,
            version,
            init_count: 0,
        }
    }
    
    /// Increments the initialization counter.
    /// 
    /// `&mut self` means this method takes a mutable reference to self,
    /// allowing the method to modify the struct's fields.
    pub fn increment_init(&mut self) {
        self.init_count += 1;
    }
}

/// Global application state wrapped in a Mutex for thread safety.
/// 
/// `Mutex` (mutual exclusion) ensures only one thread can access
/// the state at a time. This is necessary because Tauri commands
/// can be called from multiple threads.
/// 
/// The `lazy_static` macro (if used) or `OnceLock` (Rust 1.70+) can be used
/// to create global state. For simplicity, we'll show the pattern here.
/// 
/// In a real application, you would initialize this in `main.rs` and
/// pass it to Tauri's state management system.
#[allow(dead_code)] // Suppress warning - this is example code for a template
pub type SharedAppState = Mutex<AppState>;

