/**
 * GitHub integration types.
 * 
 * This file contains TypeScript type definitions for GitHub API responses
 * and authentication tokens used throughout the GitHub integration.
 */

/**
 * GitHub token structure stored in keychain.
 */
export interface GitHubToken {
  /** OAuth access token */
  access_token: string;
  /** Token type (typically "bearer") */
  token_type: string;
  /** Comma-separated list of scopes (e.g., "repo,user,read:org") */
  scope: string;
  /** Optional expiration timestamp (Unix timestamp) */
  expires_at?: number;
}

/**
 * GitHub user information from API.
 */
export interface GitHubUser {
  /** GitHub user ID */
  id: number;
  /** GitHub username */
  login: string;
  /** Display name */
  name: string | null;
  /** Email address */
  email: string | null;
  /** Avatar URL */
  avatar_url: string;
  /** Profile URL */
  html_url: string;
  /** Bio */
  bio: string | null;
  /** Company */
  company: string | null;
  /** Location */
  location: string | null;
  /** Public repositories count */
  public_repos: number;
  /** Followers count */
  followers: number;
  /** Following count */
  following: number;
}

/**
 * GitHub repository information from API.
 */
export interface GitHubRepo {
  /** Repository ID */
  id: number;
  /** Repository name */
  name: string;
  /** Full name (owner/repo) */
  full_name: string;
  /** Repository owner */
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  /** Repository description */
  description: string | null;
  /** Whether repository is private */
  private: boolean;
  /** Whether repository is a fork */
  fork: boolean;
  /** Default branch */
  default_branch: string;
  /** Repository URL */
  html_url: string;
  /** Clone URL (HTTPS) */
  clone_url: string;
  /** Clone URL (SSH) */
  ssh_url: string;
  /** Created at timestamp */
  created_at: string;
  /** Updated at timestamp */
  updated_at: string;
  /** Pushed at timestamp */
  pushed_at: string;
  /** Stars count */
  stargazers_count: number;
  /** Watchers count */
  watchers_count: number;
  /** Forks count */
  forks_count: number;
  /** Language */
  language: string | null;
}

/**
 * GitHub commit information from API.
 */
export interface GitHubCommit {
  /** Commit SHA */
  sha: string;
  /** Commit message */
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  /** Author information */
  author: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
  /** Committer information */
  committer: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
  /** Commit URL */
  html_url: string;
  /** Files changed in commit */
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

/**
 * Library workspace structure.
 */
export interface LibraryWorkspace {
  /** Unique workspace ID */
  id: string;
  /** Workspace name */
  name: string;
  /** GitHub owner (username or org) */
  github_owner: string;
  /** GitHub repository name */
  github_repo: string;
  /** Creation timestamp (Unix timestamp) */
  created_at: number;
  /** Last update timestamp (Unix timestamp) */
  updated_at: number;
}

/**
 * Library artifact structure.
 */
export interface LibraryArtifact {
  /** Unique artifact ID */
  id: string;
  /** Workspace ID this artifact belongs to */
  workspace_id: string;
  /** Original local path */
  local_path: string;
  /** Path in GitHub repository */
  library_path: string;
  /** Artifact type (kit, walkthrough, blueprint, etc.) */
  artifact_type: string;
  /** Publication timestamp (Unix timestamp) */
  published_at: number;
  /** Last sync timestamp (Unix timestamp) */
  last_synced_at: number;
}

/**
 * Authentication status for tracking authentication progress.
 */
export type AuthStatus =
  | { type: 'authorized'; token: GitHubToken }
  | { type: 'error'; message: string };

/**
 * GitHub file operation response.
 */
export interface GitHubFileResponse {
  content: {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string | null;
    type: string;
    content: string;
    encoding: string | null;
  };
  commit: {
    sha: string;
    html_url: string;
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
}

/**
 * GitHub tree response.
 */
export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size: number | null;
    url: string;
  }>;
  truncated: boolean;
}


