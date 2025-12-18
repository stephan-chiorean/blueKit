use sha2::{Sha256, Digest};

/// Computes SHA-256 hash of content for duplicate detection and change tracking.
///
/// Returns lowercase hex string (64 characters).
pub fn compute_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

/// Extracts artifact type from file path based on directory structure.
///
/// Examples:
/// - `.bluekit/kits/foo.md` -> "kit"
/// - `.bluekit/walkthroughs/bar.md` -> "walkthrough"
/// - `.bluekit/agents/baz.md` -> "agent"
/// - `.bluekit/diagrams/qux.mmd` -> "diagram"
pub fn infer_artifact_type(relative_path: &str) -> String {
    let path_lower = relative_path.to_lowercase();

    if path_lower.contains("/.bluekit/kits/") || path_lower.contains("\\.bluekit\\kits\\") {
        "kit".to_string()
    } else if path_lower.contains("/.bluekit/walkthroughs/") || path_lower.contains("\\.bluekit\\walkthroughs\\") {
        "walkthrough".to_string()
    } else if path_lower.contains("/.bluekit/agents/") || path_lower.contains("\\.bluekit\\agents\\") {
        "agent".to_string()
    } else if path_lower.contains("/.bluekit/diagrams/") || path_lower.contains("\\.bluekit\\diagrams\\") {
        "diagram".to_string()
    } else if path_lower.contains("/.bluekit/tasks/") || path_lower.contains("\\.bluekit\\tasks\\") {
        "task".to_string()
    } else {
        "unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_content_hash() {
        let content1 = "Hello, World!";
        let content2 = "Hello, World!";
        let content3 = "Different content";

        let hash1 = compute_content_hash(content1);
        let hash2 = compute_content_hash(content2);
        let hash3 = compute_content_hash(content3);

        assert_eq!(hash1, hash2); // Same content = same hash
        assert_ne!(hash1, hash3); // Different content = different hash
        assert_eq!(hash1.len(), 64); // SHA-256 is 64 hex chars
    }

    #[test]
    fn test_infer_artifact_type() {
        assert_eq!(infer_artifact_type("/project/.bluekit/kits/example.md"), "kit");
        assert_eq!(infer_artifact_type("/project/.bluekit/walkthroughs/guide.md"), "walkthrough");
        assert_eq!(infer_artifact_type("/project/.bluekit/agents/ai.md"), "agent");
        assert_eq!(infer_artifact_type("/project/.bluekit/diagrams/arch.mmd"), "diagram");
        assert_eq!(infer_artifact_type("C:\\project\\.bluekit\\kits\\example.md"), "kit");
        assert_eq!(infer_artifact_type("other/path/file.md"), "unknown");
    }
}
