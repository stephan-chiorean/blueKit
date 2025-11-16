/// IPC command handlers module.
/// 
/// This module contains all the functions that handle IPC (Inter-Process Communication)
/// requests from the frontend. In Tauri, these are called "commands".
/// 
/// Each command is a Rust function that:
/// 1. Is marked with `#[tauri::command]` attribute
/// 2. Is async (can perform asynchronous operations)
/// 3. Returns a `Result<T, E>` for error handling
/// 4. Can accept parameters from the frontend
/// 5. Can return data back to the frontend

use serde::{Deserialize, Serialize};

/// Response structure for the `get_app_info` command.
/// 
/// The `#[derive(Serialize, Deserialize)]` attributes allow this struct
/// to be automatically converted to/from JSON when communicating with the frontend.
/// 
/// `Serialize` - converts Rust struct to JSON
/// `Deserialize` - converts JSON to Rust struct
#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    /// Application name
    pub name: String,
    /// Application version
    pub version: String,
    /// Platform the app is running on
    pub platform: String,
}

/// Simple ping command to test IPC communication.
/// 
/// This is the simplest possible IPC command - it takes no parameters
/// and returns a simple string. Use this as a template for creating
/// new commands.
/// 
/// # Returns
/// 
/// A `Result<String, String>` containing either:
/// - `Ok(String)` - Success case with the "pong" message
/// - `Err(String)` - Error case with an error message
/// 
/// In Rust, `Result<T, E>` is the standard way to handle operations
/// that can fail. `Ok(T)` represents success, `Err(E)` represents failure.
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// import { invoke } from '@tauri-apps/api/tauri';
/// const result = await invoke<string>('ping');
/// console.log(result); // "pong"
/// ```
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    // The `Ok()` constructor wraps the success value
    // This string will be sent back to the frontend
    Ok("pong".to_string())
}

/// Gets application information including name, version, and platform.
/// 
/// This command demonstrates how to return structured data (a struct)
/// from a Tauri command. The struct will be automatically serialized
/// to JSON and sent to the frontend.
/// 
/// # Returns
/// 
/// A `Result<AppInfo, String>` containing either:
/// - `Ok(AppInfo)` - Success case with app information
/// - `Err(String)` - Error case with an error message
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// import { invoke } from '@tauri-apps/api/tauri';
/// const info = await invoke<AppInfo>('get_app_info');
/// console.log(info.name); // "bluekit-app"
/// ```
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    // We're creating a new AppInfo struct instance
    // In Rust, structs can be created using struct literal syntax
    let app_info = AppInfo {
        name: "bluekit-app".to_string(),
        version: "0.1.0".to_string(),
        // Using the `std::env::consts::OS` constant to get the platform
        // This is a standard library feature that works at compile time
        platform: std::env::consts::OS.to_string(),
    };
    
    // Return the struct wrapped in Ok()
    // Tauri will automatically serialize this to JSON
    Ok(app_info)
}

/// Example command that demonstrates error handling.
/// 
/// This command shows how to return errors from Tauri commands.
/// In a real application, you might use this pattern when:
/// - File operations fail
/// - Network requests fail
/// - Validation fails
/// 
/// # Arguments
/// 
/// * `should_fail` - If true, the command will return an error
/// 
/// # Returns
/// 
/// A `Result<String, String>` that either succeeds or fails based on the parameter
/// 
/// # Example Usage (from frontend)
/// 
/// ```typescript
/// try {
///   const result = await invoke<string>('example_error', { shouldFail: false });
///   console.log(result); // "Success!"
/// } catch (error) {
///   console.error(error); // Error message if shouldFail is true
/// }
/// ```
#[tauri::command]
pub async fn example_error(should_fail: bool) -> Result<String, String> {
    // Rust's `if` expression can return values
    // This is similar to a ternary operator in other languages
    if should_fail {
        // Return an error using the `Err()` constructor
        Err("This is an example error message".to_string())
    } else {
        // Return success
        Ok("Success!".to_string())
    }
}

// How to add a new command:
// 
// 1. Create a new async function in this file
// 2. Add the `#[tauri::command]` attribute above it
// 3. Define the function signature with parameters and return type
// 4. Return `Result<T, E>` where T is your success type and E is your error type
// 5. Register the command in `main.rs` (see the `main.rs` file)
// 6. Create a typed wrapper in `src/ipc.ts` on the frontend
// 7. Use the wrapper function in your React components
// 
// Example:
// 
// ```rust
// #[tauri::command]
// pub async fn my_new_command(param: String) -> Result<String, String> {
//     Ok(format!("Received: {}", param))
// }
// ```

