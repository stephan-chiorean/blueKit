use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitMetadata {
    pub remote_url: String,
    pub current_branch: String,
    pub latest_commit_sha: String,
    pub remote_name: String, // e.g., "origin"
}

/// Detects git repository and extracts metadata
pub fn detect_git_metadata(project_path: &str) -> Result<GitMetadata, String> {
    let path = Path::new(project_path);

    // Check if .git directory exists
    if !path.join(".git").exists() {
        return Err("No .git directory found".to_string());
    }

    // Get remote URL
    let remote_output = Command::new("git")
        .arg("-C")
        .arg(project_path)
        .arg("remote")
        .arg("get-url")
        .arg("origin")
        .output()
        .map_err(|e| format!("Failed to get git remote: {}", e))?;

    if !remote_output.status.success() {
        return Err("Failed to get git remote URL".to_string());
    }

    let remote_url = String::from_utf8_lossy(&remote_output.stdout)
        .trim()
        .to_string();

    // Get current branch
    let branch_output = Command::new("git")
        .arg("-C")
        .arg(project_path)
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .output()
        .map_err(|e| format!("Failed to get current branch: {}", e))?;

    if !branch_output.status.success() {
        return Err("Failed to get current branch".to_string());
    }

    let current_branch = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    // Get latest commit SHA
    let commit_output = Command::new("git")
        .arg("-C")
        .arg(project_path)
        .arg("rev-parse")
        .arg("HEAD")
        .output()
        .map_err(|e| format!("Failed to get latest commit: {}", e))?;

    if !commit_output.status.success() {
        return Err("Failed to get latest commit SHA".to_string());
    }

    let latest_commit_sha = String::from_utf8_lossy(&commit_output.stdout)
        .trim()
        .to_string();

    Ok(GitMetadata {
        remote_url,
        current_branch,
        latest_commit_sha,
        remote_name: "origin".to_string(),
    })
}
