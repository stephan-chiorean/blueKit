/// Utility functions that can be reused across backend modules.
/// 
/// This module contains helper functions that don't belong to any specific
/// domain but are useful throughout the application.

/// Example utility function that formats a message.
/// 
/// In Rust, functions are defined with `fn` keyword. This function takes
/// a string slice (`&str`) as input and returns an owned `String`.
/// 
/// # Arguments
/// 
/// * `message` - A string slice containing the message to format
/// 
/// # Returns
/// 
/// A formatted string with a prefix
/// 
/// # Example
/// 
/// ```
/// let formatted = format_message("Hello");
/// assert_eq!(formatted, "Formatted: Hello");
/// ```
#[allow(dead_code)] // Suppress warning - this is example code for a template
pub fn format_message(message: &str) -> String {
    // String formatting in Rust uses the `format!` macro
    // The `!` indicates it's a macro, not a regular function
    format!("Formatted: {}", message)
}

/// Gets the current platform information.
/// 
/// This demonstrates how to use conditional compilation in Rust.
/// The `#[cfg(...)]` attribute allows code to be included or excluded
/// based on compilation target.
/// 
/// # Returns
/// 
/// A string representing the current platform
#[allow(dead_code)] // Suppress warning - this is example code for a template
pub fn get_platform() -> String {
    // Conditional compilation: this code only compiles on the specified platform
    // Each platform-specific block returns immediately, so only one will compile
    #[cfg(target_os = "windows")]
    {
        return "windows".to_string();
    }
    
    #[cfg(target_os = "macos")]
    {
        return "macos".to_string();
    }
    
    #[cfg(target_os = "linux")]
    {
        return "linux".to_string();
    }
    
    // Fallback for unknown platforms (this will only compile if none of the above match)
    #[allow(unreachable_code)]
    "unknown".to_string()
}

