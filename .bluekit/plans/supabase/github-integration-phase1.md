# Phase 1: GitHub Integration Refactor

**Status:** Ready to Implement
**Goal:** Move GitHub OAuth from sign-in identity to optional feature integration

---

## Current State → Target State

```
CURRENT                              TARGET
───────                              ──────
GitHubAuthProvider (identity)   →    No identity check (temp)
Sign-in required on app launch  →    App opens freely
GitHub OAuth at entry           →    "Connect GitHub" button

Timeline hidden if no token     →    Timeline shows "Connect to unlock"
                                     (similar to project git connection)
```

---

## Core Concept

Currently, GitHub OAuth is the **identity provider**—you must sign in with GitHub to use the app. This is wrong because:

1. GitHub is for *code*, not *identity*
2. Not all features need GitHub (kits, walkthroughs, plans work locally)
3. Forces unnecessary friction at app launch

**Target pattern** (see `ProjectsTabContent.tsx` lines 61-124):
- User opens app freely
- GitHub features show "Connect GitHub to unlock" 
- One-time connection stores token
- Features work after connection

---

## Implementation Steps

### Step 1: Remove Sign-In Gate

Remove the sign-in requirement at app launch. The app should open directly to the home page.

```typescript
// src/App.tsx - Remove GitHubAuthProvider as gating wrapper
// Before: App wrapped in auth check that blocks until signed in
// After: App renders immediately, auth context available for optional features
```

**Files to Modify:**
- `src/App.tsx` - Remove auth gate
- `src/auth/github/GitHubAuthProvider.tsx` - Convert to integration context

### Step 2: Create GitHubIntegrationContext

New context that manages GitHub as an **optional integration**, not identity:

```typescript
// src/contexts/GitHubIntegrationContext.tsx
interface GitHubIntegrationContextValue {
  isConnected: boolean;
  isLoading: boolean;
  user: GitHubUser | null;
  accessToken: string | null;
  
  connectGitHub: () => Promise<void>;  // Triggers OAuth flow
  disconnectGitHub: () => Promise<void>;  // Clears token
}
```

**Key differences from current auth:**
- No automatic prompt on app launch
- `connectGitHub()` called explicitly by user action
- Token stored in keychain (reuses existing infra)

### Step 3: Add "Connect GitHub" UI

Add connection UI to header/settings:

```typescript
// src/components/Header.tsx or new GitHubConnectionButton.tsx

// When not connected:
<Button onClick={connectGitHub}>
  <FaGithub /> Connect GitHub
</Button>

// When connected:
<Menu>
  <Avatar src={user.avatarUrl} />
  <MenuItem onClick={disconnectGitHub}>Disconnect</MenuItem>
</Menu>
```

**Pattern reference:** See `ProjectsTabContent.tsx` lines 320-358 for similar UI pattern.

### Step 4: Gate GitHub-Dependent Features

Update features that need GitHub API to check connection status:

```typescript
// src/components/timeline/Timeline.tsx
const { isConnected, connectGitHub } = useGitHubIntegration();

if (!isConnected) {
  return (
    <EmptyState>
      <Text>Connect GitHub to view your activity timeline</Text>
      <Button onClick={connectGitHub}>Connect GitHub</Button>
    </EmptyState>
  );
}

// ... render timeline normally
```

**Features to gate:**
- Timeline / Activity Feed
- GitHub-synced plans (if any)
- Any future GitHub API features

### Step 5: Update IPC Layer

The backend already has GitHub OAuth infrastructure. Minimal changes needed:

```rust
// src-tauri/src/integrations/github/
// Keep existing OAuth flow, just call it differently:
// - Before: Called automatically on app launch
// - After: Called when user clicks "Connect GitHub"
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/contexts/GitHubIntegrationContext.tsx` | Optional GitHub integration context |
| `src/components/shared/GitHubConnectionButton.tsx` | Connect/disconnect UI component |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Remove auth gate, add GitHubIntegrationProvider |
| `src/components/Header.tsx` | Add GitHub connection button |
| `src/components/timeline/Timeline.tsx` | Gate behind connection check |
| `src/auth/github/GitHubAuthProvider.tsx` | Deprecate or refactor |

## Files to Deprecate

| File | Reason |
|------|--------|
| `src/auth/github/GitHubAuthScreen.tsx` | No longer need dedicated auth screen |
| `src/components/shared/SignInPopover.tsx` | Replace with simple connection button |

---

## Verification Checklist

- [ ] App opens directly to home page (no sign-in required)
- [ ] "Connect GitHub" button visible in header when not connected
- [ ] Clicking "Connect GitHub" triggers OAuth flow
- [ ] After connection, user avatar appears in header
- [ ] Timeline shows "Connect to unlock" message when not connected
- [ ] Timeline works normally after connection
- [ ] Can disconnect and reconnect GitHub
- [ ] Token persists across app restarts

---

## Notes

**Why keep keychain storage?**
- Existing infrastructure works well
- Will be replaced by Supabase in Phase 2, but no need to change now

**Temporary state:**
- After Phase 1, app has no *identity* (anonymous local use)
- This is fine for local-first features
- Phase 2 adds proper identity via Supabase

**Migration path:**
- Existing users with GitHub tokens: Token still valid, shows as connected
- New users: App works immediately, GitHub optional
