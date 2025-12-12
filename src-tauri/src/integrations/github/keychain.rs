/// Keychain management module for secure token storage.
/// 
/// This module provides a unified interface for storing and retrieving
/// sensitive data (like GitHub tokens) using the OS keychain:
/// - macOS: Keychain
/// - Windows: Credential Manager
/// - Linux: Secret Service API
/// 
/// The module uses a trait-based architecture to abstract platform-specific
/// implementations behind a common interface.

use serde::{Deserialize, Serialize};

/// GitHub token structure for storage in keychain.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitHubToken {
    pub access_token: String,
    pub token_type: String, // "bearer"
    pub scope: String,     // "repo,user,read:org"
    pub expires_at: Option<i64>, // Unix timestamp (if applicable)
}

/// Platform-agnostic trait for keychain backends.
pub trait KeychainBackend {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String>;
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String>;
    fn delete(&self, service: &str, key: &str) -> Result<(), String>;
}

/// macOS keychain implementation using the `keyring` crate.
#[cfg(target_os = "macos")]
pub struct MacOSKeychain;

#[cfg(target_os = "macos")]
impl KeychainBackend for MacOSKeychain {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String> {
        use keyring::Entry;
        let entry = Entry::new(service, key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry.set_password(value)
            .map_err(|e| format!("Failed to store password: {}", e))?;
        Ok(())
    }
    
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String> {
        use keyring::Entry;
        let entry = Entry::new(service, key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry.get_password()
            .map_err(|e| format!("Failed to retrieve password: {}", e))
    }
    
    fn delete(&self, service: &str, key: &str) -> Result<(), String> {
        use keyring::Entry;
        let entry = Entry::new(service, key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        entry.delete_password()
            .map_err(|e| format!("Failed to delete password: {}", e))?;
        Ok(())
    }
}

/// Windows Credential Manager implementation.
#[cfg(target_os = "windows")]
pub struct WindowsKeychain;

#[cfg(target_os = "windows")]
impl KeychainBackend for WindowsKeychain {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String> {
        use winapi::um::wincred::*;
        use std::ffi::CString;
        use std::ptr;
        
        let target_name = format!("bluekit:{}:{}", service, key);
        let target_name_cstr = CString::new(target_name)
            .map_err(|e| format!("Failed to create CString: {}", e))?;
        
        let credential_value = value.as_bytes();
        let credential_value_len = credential_value.len() as u32;
        
        let mut credential_blob = credential_value.to_vec();
        
        let mut credential = CREDENTIALW {
            Flags: 0,
            Type: CRED_TYPE_GENERIC,
            TargetName: target_name_cstr.as_ptr() as *mut u16,
            Comment: ptr::null_mut(),
            LastWritten: winapi::um::minwinbase::FILETIME {
                dwLowDateTime: 0,
                dwHighDateTime: 0,
            },
            CredentialBlobSize: credential_value_len,
            CredentialBlob: credential_blob.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: ptr::null_mut(),
            TargetAlias: ptr::null_mut(),
            UserName: ptr::null_mut(),
        };
        
        unsafe {
            if CredWriteW(&mut credential as *mut _, 0) == 0 {
                return Err(format!("Failed to write credential: {}", 
                    std::io::Error::last_os_error()));
            }
        }
        
        Ok(())
    }
    
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String> {
        use winapi::um::wincred::*;
        use std::ffi::CString;
        use std::ptr;
        
        let target_name = format!("bluekit:{}:{}", service, key);
        let target_name_cstr = CString::new(target_name)
            .map_err(|e| format!("Failed to create CString: {}", e))?;
        
        let mut credential_ptr: *mut CREDENTIALW = ptr::null_mut();
        
        unsafe {
            if CredReadW(
                target_name_cstr.as_ptr() as *const u16,
                CRED_TYPE_GENERIC,
                0,
                &mut credential_ptr,
            ) == 0 {
                return Err(format!("Failed to read credential: {}", 
                    std::io::Error::last_os_error()));
            }
            
            let credential = &*credential_ptr;
            let blob_size = credential.CredentialBlobSize as usize;
            let blob_ptr = credential.CredentialBlob;
            
            let blob_slice = std::slice::from_raw_parts(blob_ptr as *const u8, blob_size);
            let value = String::from_utf8(blob_slice.to_vec())
                .map_err(|e| format!("Failed to convert to UTF-8: {}", e))?;
            
            CredFree(credential_ptr as *mut _);
            
            Ok(value)
        }
    }
    
    fn delete(&self, service: &str, key: &str) -> Result<(), String> {
        use winapi::um::wincred::*;
        use std::ffi::CString;
        
        let target_name = format!("bluekit:{}:{}", service, key);
        let target_name_cstr = CString::new(target_name)
            .map_err(|e| format!("Failed to create CString: {}", e))?;
        
        unsafe {
            if CredDeleteW(
                target_name_cstr.as_ptr() as *const u16,
                CRED_TYPE_GENERIC,
                0,
            ) == 0 {
                return Err(format!("Failed to delete credential: {}", 
                    std::io::Error::last_os_error()));
            }
        }
        
        Ok(())
    }
}

/// Linux Secret Service implementation.
#[cfg(target_os = "linux")]
pub struct LinuxKeychain;

#[cfg(target_os = "linux")]
impl KeychainBackend for LinuxKeychain {
    fn store(&self, service: &str, key: &str, value: &str) -> Result<(), String> {
        use secret_service::SecretService;
        use secret_service::EncryptionType;
        
        let ss = SecretService::connect(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;
        
        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;
        
        let label = format!("bluekit:{}:{}", service, key);
        let attributes = vec![
            ("service", service),
            ("key", key),
        ];
        
        collection.create_item(
            &label,
            &attributes,
            value.as_bytes(),
            true, // replace if exists
        )
        .map_err(|e| format!("Failed to create secret: {}", e))?;
        
        Ok(())
    }
    
    fn retrieve(&self, service: &str, key: &str) -> Result<String, String> {
        use secret_service::SecretService;
        use secret_service::EncryptionType;
        
        let ss = SecretService::connect(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;
        
        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;
        
        let attributes = vec![
            ("service", service),
            ("key", key),
        ];
        
        let search_result = collection.search_items(&attributes)
            .map_err(|e| format!("Failed to search items: {}", e))?;
        
        if search_result.is_empty() {
            return Err("Token not found".to_string());
        }
        
        let item = &search_result[0];
        let secret = item.get_secret()
            .map_err(|e| format!("Failed to get secret: {}", e))?;
        
        String::from_utf8(secret)
            .map_err(|e| format!("Failed to convert to UTF-8: {}", e))
    }
    
    fn delete(&self, service: &str, key: &str) -> Result<(), String> {
        use secret_service::SecretService;
        use secret_service::EncryptionType;
        
        let ss = SecretService::connect(EncryptionType::Dh)
            .map_err(|e| format!("Failed to connect to Secret Service: {}", e))?;
        
        let collection = ss.get_default_collection()
            .map_err(|e| format!("Failed to get default collection: {}", e))?;
        
        let attributes = vec![
            ("service", service),
            ("key", key),
        ];
        
        let search_result = collection.search_items(&attributes)
            .map_err(|e| format!("Failed to search items: {}", e))?;
        
        if search_result.is_empty() {
            return Err("Token not found".to_string());
        }
        
        let item = &search_result[0];
        item.delete()
            .map_err(|e| format!("Failed to delete secret: {}", e))?;
        
        Ok(())
    }
}

/// Unified keychain manager that abstracts platform-specific implementations.
pub struct KeychainManager {
    backend: Box<dyn KeychainBackend>,
}

impl KeychainManager {
    /// Creates a new KeychainManager with the appropriate backend for the current platform.
    pub fn new() -> Result<Self, String> {
        #[cfg(target_os = "macos")]
        let backend: Box<dyn KeychainBackend> = Box::new(MacOSKeychain);
        
        #[cfg(target_os = "windows")]
        let backend: Box<dyn KeychainBackend> = Box::new(WindowsKeychain);
        
        #[cfg(target_os = "linux")]
        let backend: Box<dyn KeychainBackend> = Box::new(LinuxKeychain);
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return Err("Unsupported platform for keychain operations".to_string());
        
        Ok(Self { backend })
    }
    
    /// Stores a GitHub token in the keychain.
    pub fn store_token(&self, token: &GitHubToken) -> Result<(), String> {
        let serialized = serde_json::to_string(token)
            .map_err(|e| format!("Failed to serialize token: {}", e))?;
        self.backend.store("bluekit", "github_token", &serialized)
    }
    
    /// Retrieves a GitHub token from the keychain.
    pub fn retrieve_token(&self) -> Result<GitHubToken, String> {
        let serialized = self.backend.retrieve("bluekit", "github_token")?;
        serde_json::from_str(&serialized)
            .map_err(|e| format!("Failed to deserialize token: {}", e))
    }
    
    /// Deletes a GitHub token from the keychain.
    pub fn delete_token(&self) -> Result<(), String> {
        self.backend.delete("bluekit", "github_token")
    }
}
