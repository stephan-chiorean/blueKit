# Pickup

  - [P1] Re-register GitHub IPC commands used by library UI — /Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src-tauri/src/main.rs:107-112
    The GitHub IPC commands (github_get_user, github_get_file, etc.) are now commented out in the invoke handler, but the library screens still call them (e.g., invokeGitHubGetUser
    in LibraryTabContent and PublishToLibraryDialog). This will raise “unknown command” errors at runtime and force the library view into a permanent unauthenticated/error state
    whenever those screens load. If the library flows are still meant to work, these commands need to remain registered (or the UI needs to stop invoking them).
  - [P1] Re-register commit IPC commands used by timeline — /Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src-tauri/src/main.rs:143-145
    The commit-related commands (fetch_project_commits, open_commit_in_github, etc.) are commented out, but the timeline UI still calls invokeFetchProjectCommits when GitHub is
    connected. With these commands missing, the commits view will always fail with an invoke error even for authenticated users. Either re-enable the commands or update the UI to
    avoid calling them when unavailable.
  - [P2] Pass a real GitHub access token in library auth check — /Users/stephanchiorean/Documents/projects/blueKitApps/blueKit/src/components/library/LibraryTabContent.tsx:428-432
    The library auth check now calls invokeGitHubGetUser('') with an empty token, which guarantees a 401 from GitHub and forces the UI into a no-auth state even for connected
    users. Since GitHub IPC now requires a token, this needs to be sourced from GitHubIntegrationContext (or the check needs to be skipped) or the library features will never
    authenticate successfully.

    pick up with github oauth implementation with supabase plan

