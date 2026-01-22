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

/// Represents a git worktree
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitWorktree {
    /// Absolute path to the worktree directory
    pub path: String,
    /// Branch name (or "(detached HEAD)" if in detached state)
    pub branch: String,
    /// Current commit SHA at HEAD
    pub commit_sha: String,
    /// Whether this is the main working tree
    pub is_main: bool,
}

/// Lists all git worktrees for a repository
/// 
/// Uses `git worktree list --porcelain` for machine-readable output.
/// The first worktree returned is the main working tree.
pub fn list_git_worktrees(project_path: &str) -> Result<Vec<GitWorktree>, String> {
    let path = Path::new(project_path);

    // Check if this is a git repo (either .git directory or .git file for worktrees)
    if !path.join(".git").exists() {
        return Err("No .git directory found".to_string());
    }

    // Run: git worktree list --porcelain
    let output = Command::new("git")
        .arg("-C")
        .arg(project_path)
        .arg("worktree")
        .arg("list")
        .arg("--porcelain")
        .output()
        .map_err(|e| format!("Failed to run git worktree: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree list failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut worktrees: Vec<GitWorktree> = Vec::new();
    
    // Parse porcelain output
    // Format:
    // worktree /path/to/main
    // HEAD abc123def456
    // branch refs/heads/main
    // 
    // worktree /path/to/worktrees/feature-x
    // HEAD 789ghi012jkl
    // branch refs/heads/feature-x
    
    let mut current_path: Option<String> = None;
    let mut current_sha: Option<String> = None;
    let mut current_branch: Option<String> = None;
    let mut is_detached = false;
    
    for line in stdout.lines() {
        if line.starts_with("worktree ") {
            // If we have a complete previous worktree, save it
            if let (Some(path), Some(sha)) = (&current_path, &current_sha) {
                let branch = if is_detached {
                    "(detached HEAD)".to_string()
                } else {
                    current_branch.clone().unwrap_or_else(|| "(unknown)".to_string())
                };
                
                worktrees.push(GitWorktree {
                    path: path.clone(),
                    branch,
                    commit_sha: sha.clone(),
                    is_main: worktrees.is_empty(), // First worktree is main
                });
            }
            
            // Start new worktree
            current_path = Some(line.strip_prefix("worktree ").unwrap_or("").to_string());
            current_sha = None;
            current_branch = None;
            is_detached = false;
        } else if line.starts_with("HEAD ") {
            current_sha = Some(line.strip_prefix("HEAD ").unwrap_or("").to_string());
        } else if line.starts_with("branch ") {
            // Branch format: refs/heads/branch-name
            let branch_ref = line.strip_prefix("branch ").unwrap_or("");
            current_branch = Some(
                branch_ref
                    .strip_prefix("refs/heads/")
                    .unwrap_or(branch_ref)
                    .to_string()
            );
        } else if line == "detached" {
            is_detached = true;
        }
    }
    
    // Don't forget the last worktree
    if let (Some(path), Some(sha)) = (current_path, current_sha) {
        let branch = if is_detached {
            "(detached HEAD)".to_string()
        } else {
            current_branch.unwrap_or_else(|| "(unknown)".to_string())
        };
        
        worktrees.push(GitWorktree {
            path,
            branch,
            commit_sha: sha,
            is_main: worktrees.is_empty(), // First worktree is main
        });
    }
    
    Ok(worktrees)
}
