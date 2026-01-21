# Phase 3: GitHub OAuth Integration - Fix & Complete

**Status:** Not Started
**Priority:** P1 (Blocks Timeline and Library features)
**Dependencies:** Phase 2 (Supabase Auth Migration) ✅

## Executive Summary

The GitHub OAuth integration is **95% already implemented** in `GitHubIntegrationContext.tsx`. The main issues are:

1. **Critical IPC commands are commented out** - The context calls functions that don't exist at runtime
2. **Timeline UI missing "Connect to GitHub" empty state** - Needs to match Library pattern
3. **Library auth check broken** - Calls `invokeGitHubGetUser('')` with empty token

This plan focuses on **re-enabling existing functionality**, not building new systems.

## Current State Analysis

### What's Already Implemented ✅

**GitHubIntegrationContext** (`src/contexts/GitHubIntegrationContext.tsx`):
- ✅ OAuth flow via `invokeAuthStartAuthorization()` and `invokeAuthExchangeCode()`
- ✅ Token storage in Supabase `user_integrations` table (column: `provider: 'github'`)
- ✅ Auto-load tokens on mount from Supabase
- ✅ `connectGitHub()` function triggers OAuth popup
- ✅ `disconnectGitHub()` function clears token
- ✅ Direct GitHub API call (`fetchGitHubUser()`) to avoid backend keychain
- ✅ Tauri event listener for `oauth-callback`

**The OAuth Flow Already Works Like This:**
```
User clicks button calling connectGitHub()
  → invokeAuthStartAuthorization() generates auth URL
  → open() launches browser to GitHub OAuth
  → User authorizes app
  → GitHub redirects to local callback (Tauri deep link)
  → Tauri emits 'oauth-callback' event with code
  → invokeAuthExchangeCode() exchanges code for token
  → Token stored in Supabase user_integrations
  → UI shows "Connected" state
```

### Critical Issues 🚨

**P1: Auth IPC Commands Commented Out (main.rs:107-112)**
```rust
// commands::auth_start_authorization, commands::auth_exchange_code, commands::auth_get_status,
// commands::github_get_user, commands::github_get_repos, commands::github_get_file,
```

**Impact:** `GitHubIntegrationContext.connectGitHub()` calls `invokeAuthStartAuthorization()` which throws "unknown command" error. **GitHub connection is completely broken.**

**P1: Commit IPC Commands Commented Out (main.rs:143-145)**
```rust
// commands::fetch_project_commits, commands::open_commit_in_github,
// commands::invalidate_commit_cache, commands::checkout_commit_in_project,
```

**Impact:** `TimelineTabContent.tsx` calls `invokeFetchProjectCommits()` which throws "unknown command" error. **Timeline commits view is completely broken.**

**P1: Library Commands Commented Out (main.rs:131-135)**
```rust
// commands::publish_resource, commands::sync_workspace_catalog,
// commands::list_workspace_catalogs, commands::delete_catalogs,
// commands::pull_variation, commands::check_resource_status,
```

**Impact:** Library publishing and catalog management completely broken.

**P2: Library Auth Check Broken (LibraryTabContent.tsx:428-432)**
```tsx
const user = await invokeGitHubGetUser('');  // Empty token = always fails
```

**Impact:** Even if IPC commands were enabled, Library would stay in "no-auth" state.

**P2: Timeline Missing "Connect to GitHub" Empty State**
- Timeline shows "Not connected to git" but doesn't handle "git connected, no GitHub"
- Should match Library's "Connect to GitHub" pattern

## Goals for Phase 3

1. **Re-enable All Commented IPC Commands** (P1)
2. **Add "Connect to GitHub" Empty State to Timeline** (P2)
3. **Fix Library Auth Check** (P2)
4. **Add GitHubConnectButton Component** (P2)

## Implementation Plan

### Step 1: Re-enable IPC Commands (P1 Critical)

**File:** `src-tauri/src/main.rs`

**Un-comment lines 107-112 (Auth + GitHub API):**
```rust
commands::auth_start_authorization,
commands::auth_exchange_code,
commands::auth_get_status,
commands::github_get_user,
commands::github_get_repos,
commands::github_get_file,
commands::github_create_or_update_file,
commands::github_delete_file,
commands::github_get_file_sha,
commands::github_get_tree,
```

**Un-comment lines 131-135 (Library publishing):**
```rust
commands::publish_resource,
commands::sync_workspace_catalog,
commands::list_workspace_catalogs,
commands::delete_catalogs,
commands::pull_variation,
commands::check_resource_status,
commands::check_project_for_updates,
```

**Un-comment lines 143-145 (Commits):**
```rust
commands::fetch_project_commits,
commands::open_commit_in_github,
commands::invalidate_commit_cache,
commands::checkout_commit_in_project,
```

**Validation:**
```bash
cd src-tauri && cargo check
```

---

### Step 2: Create GitHubConnectButton Component

**New File:** `src/components/auth/GitHubConnectButton.tsx`

```tsx
import { Button, HStack, Icon, Text } from '@chakra-ui/react';
import { LuGithub } from 'react-icons/lu';
import { useGitHubIntegration } from '../../contexts/GitHubIntegrationContext';

interface GitHubConnectButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
}

export function GitHubConnectButton({
  size = 'lg',
  variant = 'outline'
}: GitHubConnectButtonProps) {
  const { isConnected, isConnecting, connectGitHub } = useGitHubIntegration();

  if (isConnected) {
    return null; // Already connected
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={connectGitHub}
      loading={isConnecting}
      loadingText="Connecting..."
    >
      <HStack gap={2}>
        <Icon fontSize="xl"><LuGithub /></Icon>
        <Text>Connect to GitHub</Text>
      </HStack>
    </Button>
  );
}
```

**Note:** This uses the **existing** `connectGitHub()` from `GitHubIntegrationContext`, which already handles the full OAuth flow.

---

### Step 3: Update Timeline Empty State

**File:** `src/components/commits/TimelineTabContent.tsx`

**Add import at top:**
```tsx
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { GitHubConnectButton } from '../auth/GitHubConnectButton';
import { LuGithub } from 'react-icons/lu';
```

**Replace empty state logic (around line 580-600):**

```tsx
// Empty state: not authenticated with Supabase
const { isAuthenticated } = useSupabaseAuth();
const { isConnected: isGitHubConnected, isLoading: isGitHubLoading } = useGitHubIntegration();

if (!isAuthenticated) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="gray.400">
            <LuGitBranch />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>Sign in to view commits</EmptyState.Title>
        <EmptyState.Description>
          Sign in to your account to view commit history for this project.
        </EmptyState.Description>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

// Empty state: not connected to git
if (!gitConnected) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="primary.500">
            <LuGitBranch />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>Not connected to git</EmptyState.Title>
        <EmptyState.Description>
          Connect this project to git to view commit history
        </EmptyState.Description>
        <Button
          variant="outline"
          onClick={handleConnectGit}
          loading={connectingGit}
          loadingText="Connecting..."
        >
          Connect Git
        </Button>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

// Empty state: git connected but no GitHub integration
if (!isGitHubConnected && !isGitHubLoading) {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="gray.400">
            <LuGithub />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>Connect to GitHub</EmptyState.Title>
        <EmptyState.Description>
          Connect your GitHub account to view commit history and open diffs.
        </EmptyState.Description>
        <GitHubConnectButton />
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
```

**Update useEffect to check GitHub connection:**
```tsx
// Load commits only when git + GitHub both connected
useEffect(() => {
  if (gitConnected && isGitHubConnected && accessToken) {
    loadCommits(1);
  } else {
    setLoading(false);
  }
}, [projectId, gitConnected, isGitHubConnected, accessToken]);
```

---

### Step 4: Fix Library Auth Check

**File:** `src/components/library/LibraryTabContent.tsx`

**Replace checkGitHubAuth function (around line 428):**

```tsx
// Add hook at component top (it's already imported)
const { isConnected, accessToken, user: gitHubUserFromContext } = useGitHubIntegration();

const checkGitHubAuth = async () => {
  // Use GitHubIntegrationContext state instead of IPC call
  if (isConnected && gitHubUserFromContext) {
    setGithubUser(gitHubUserFromContext);
    loadWorkspaces();
  } else {
    setGithubUser(null);
    setViewMode('no-auth');
  }
};
```

**Update useEffect to react to context changes:**
```tsx
useEffect(() => {
  if (isConnected && gitHubUserFromContext) {
    setGithubUser(gitHubUserFromContext);
    loadWorkspaces();
  } else if (!isConnected) {
    setGithubUser(null);
    setViewMode('no-auth');
  }
}, [isConnected, gitHubUserFromContext]);
```

**Update no-auth empty state (around line 1350):**
```tsx
// Import at top
import { GitHubConnectButton } from '../auth/GitHubConnectButton';

// In render:
if (viewMode === 'no-auth') {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <Icon size="xl" color="gray.400">
            <LuGithub />
          </Icon>
        </EmptyState.Indicator>
        <EmptyState.Title>Connect to GitHub</EmptyState.Title>
        <EmptyState.Description>
          Connect your GitHub account to access the library and publish resources.
        </EmptyState.Description>
        <GitHubConnectButton />
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
```

---

### Step 5: Update UserProfileButton (Optional Enhancement)

**File:** `src/components/shared/UserProfileButton.tsx`

**Add GitHub status display:**

```tsx
import { useGitHubIntegration } from '../../contexts/GitHubIntegrationContext';
import { LuGithub, LuUnlink } from 'react-icons/lu';

// Inside component:
const { isConnected: isGitHubConnected, user: gitHubUser, disconnectGitHub } = useGitHubIntegration();

// Add to menu (before sign out):
<Menu.Separator />
<Menu.Item value="github-status" disabled css={{ opacity: 1, cursor: 'default' }}>
  <HStack gap={2}>
    <Icon color={isGitHubConnected ? 'green.500' : 'gray.400'}>
      <LuGithub />
    </Icon>
    <VStack align="start" gap={0}>
      <Text fontSize="xs" fontWeight="medium">
        GitHub: {isGitHubConnected ? 'Connected' : 'Not Connected'}
      </Text>
      {isGitHubConnected && gitHubUser && (
        <Text fontSize="xs" color="fg.muted">@{gitHubUser.login}</Text>
      )}
    </VStack>
  </HStack>
</Menu.Item>

{isGitHubConnected && (
  <Menu.Item value="disconnect-github" onSelect={disconnectGitHub}>
    <HStack gap={2}>
      <LuUnlink />
      <Text>Disconnect GitHub</Text>
    </HStack>
  </Menu.Item>
)}
```

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/auth/GitHubConnectButton.tsx` | Reusable connect button |

### Modified Files
| File | Change |
|------|--------|
| `src-tauri/src/main.rs` | Un-comment IPC commands (3 blocks) |
| `src/components/commits/TimelineTabContent.tsx` | Add GitHub empty state |
| `src/components/library/LibraryTabContent.tsx` | Use context state, add connect button |
| `src/components/shared/UserProfileButton.tsx` | Show GitHub status (optional) |

### No Changes Needed
| File | Reason |
|------|--------|
| `src/contexts/GitHubIntegrationContext.tsx` | **Already complete** - OAuth flow, Supabase storage, auto-load |
| `src/lib/supabase.ts` | Already configured |
| Database schema | `user_integrations` table exists with `provider` column |

---

## Testing Checklist

### IPC Commands (after Step 1)
- [ ] `cargo check` passes
- [ ] App launches without errors
- [ ] No "unknown command" errors in console

### OAuth Flow (after Steps 1-2)
- [ ] Click "Connect to GitHub" opens browser
- [ ] GitHub auth page appears
- [ ] After approval, app shows success toast
- [ ] Token saved to Supabase `user_integrations`
- [ ] Refreshing app retains connection

### Timeline UI (after Step 3)
- [ ] Shows "Sign in" state when not authenticated
- [ ] Shows "Connect Git" when authenticated but no git
- [ ] Shows "Connect to GitHub" when git but no GitHub
- [ ] Shows commits when both connected

### Library UI (after Step 4)
- [ ] Shows "Connect to GitHub" when not connected
- [ ] Shows workspaces when connected
- [ ] Sync works with valid token
- [ ] Publish works with valid token

### UserProfileButton (after Step 5)
- [ ] Shows GitHub status (Connected/Not Connected)
- [ ] Shows @username when connected
- [ ] "Disconnect GitHub" clears connection

---

## Rollout Plan

### Phase 3A: Critical Fix (Day 1)
1. Un-comment all IPC commands in `main.rs`
2. Verify `cargo check` passes
3. Test that OAuth flow works again

### Phase 3B: UI Updates (Day 2-3)
4. Create `GitHubConnectButton` component
5. Update Timeline empty states
6. Fix Library auth check

### Phase 3C: Polish (Day 4)
7. Update UserProfileButton
8. Integration testing
9. Update walkthrough documentation

---

## Notes

### Why Not Supabase OAuth?

The existing implementation uses **Tauri's native OAuth flow** (deep links + local callback server), not Supabase's OAuth. This is actually better because:

1. **Works offline** - Token exchange happens locally
2. **Better UX** - Browser opens, user approves, app gets token immediately
3. **More secure** - No token in URL fragments
4. **Already implemented** - Just needs IPC commands re-enabled

Supabase is only used for **storing the token**, not the OAuth flow itself.

### Schema Note

The existing code uses `provider: 'github'` (not `integration_type`):
```tsx
.eq('provider', 'github')
```

This matches what's already in `GitHubIntegrationContext.tsx`. No schema changes needed.

---

## References

- Phase 2 Walkthrough: `auth-phase2-walkthrough.md`
- GitHubIntegrationContext: `src/contexts/GitHubIntegrationContext.tsx`
- Schema: `schema.sql`
