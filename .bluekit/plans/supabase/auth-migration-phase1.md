# Auth Migration Phase 1: Ripping Out GitHub-First Auth

**Status:** Implementation Plan
**Created:** 2026-01-18
**Context:** Migrating from GitHub OAuth as primary identity to Supabase Auth, while preserving GitHub as an optional integration for timeline features.

---

## Executive Summary

> **The Goal:** Replace GitHub OAuth as the identity layer with Supabase Auth, while keeping GitHub OAuth alive for "Connect GitHub" flows needed by Timeline features.

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT AUTH FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  App Launch                                                  │
│       │                                                      │
│       ▼                                                      │
│  GitHubAuthProvider                                          │
│       │                                                      │
│       ├─→ Check keychain (Rust: keychain.rs)                │
│       │                                                      │
│       ├─→ [No token] → "Welcome" → "GitHub Auth Screen"    │
│       │                                                      │
│       └─→ [Has token] → "Home"                              │
│                                                              │
│  Token Storage:                                              │
│  ├── invokeKeychainRetrieveToken()                          │
│  ├── invokeKeychainStoreToken()                             │
│  └── invokeKeychainDeleteToken()                            │
│                                                              │
│  Auth Flows:                                                 │
│  ├── GitHubAuthScreen.tsx (Device flow OAuth)               │
│  ├── auth.rs (PKCE + code exchange)                         │
│  └── keychain.rs (macOS keychain storage)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────┐
│                     TARGET AUTH FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  App Launch                                                  │
│       │                                                      │
│       ▼                                                      │
│  SupabaseAuthProvider (NEW - primary identity)              │
│       │                                                      │
│       ├─→ Check Supabase session (localStorage)             │
│       │                                                      │
│       ├─→ [No session] → "Welcome" → "Auth Screen"         │
│       │       └─→ Options: Google, GitHub, Email            │
│       │                                                      │
│       └─→ [Has session] → "Home"                            │
│                                                              │
│  GitHubIntegrationProvider (DEMOTED - optional integration) │
│       │                                                      │
│       └─→ Only activated for Timeline features              │
│           via "Connect GitHub" flow when needed              │
│                                                              │
│  Token Storage:                                              │
│  ├── @supabase/supabase-js → localStorage (auth tokens)     │
│  └── user_integrations table → Supabase DB (GitHub tokens)  │
│                                                              │
│  ⚠️ ELIMINATED:                                              │
│  └── All keychain.rs / keychain.ts code (admin prompts)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Diagnosis: What Needs to Change

### Files to MODIFY

| File | Current Role | New Role |
|------|--------------|----------|
| `src/App.tsx` | Wraps in `GitHubAuthProvider` | Wrap in `SupabaseAuthProvider` + `GitHubIntegrationProvider` |
| `src/auth/github/GitHubAuthProvider.tsx` | Primary identity | **DEMOTED** → Optional integration context |
| `src/auth/github/GitHubAuthScreen.tsx` | Login screen | Becomes "Connect GitHub" screen |
| `src/components/Header.tsx` | Uses `useGitHubAuth` | Uses `useSupabaseAuth` + optional `useGitHubIntegration` |
| `src/components/shared/SignInPopover.tsx` | GitHub sign-in | Multiple providers (Google, GitHub, Email) |
| `src/components/library/LibraryTabContent.tsx` | Checks GitHub auth | Checks Supabase auth + GitHub integration status |
| `src/components/library/PublishToLibraryDialog.tsx` | Checks GitHub auth | Same pattern |

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client initialization |
| `src/contexts/SupabaseAuthContext.tsx` | Primary auth provider |
| `src/contexts/GitHubIntegrationContext.tsx` | GitHub as optional integration |
| `src/components/auth/SupabaseAuthScreen.tsx` | Multi-provider login screen |
| `src/components/shared/GitHubGate.tsx` | Feature gate for GitHub-required features |
| `src/lib/featureGates.ts` | Feature gating logic |

### Files to DEPRECATE (Not Delete Yet)

| File | Reason to Keep |
|------|----------------|
| `src/ipc/keychain.ts` | May need for migration testing |
| `src-tauri/src/integrations/github/keychain.rs` | Same |
| `src-tauri/src/integrations/github/auth.rs` | GitHub OAuth for "Connect" flow may still use parts |

### Keychain Commands to Eventually Remove

```rust
// src-tauri/src/commands.rs
keychain_store_token   // → Replace with Supabase user_integrations
keychain_retrieve_token // → Replace with Supabase session
keychain_delete_token   // → Replace with Supabase signOut
```

---

## Phase 1 Implementation Steps

### Step 1: Install Supabase & Create Client

```bash
npm install @supabase/supabase-js
```

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 2: Create SupabaseAuthContext

```typescript
// src/contexts/SupabaseAuthContext.tsx
interface SupabaseAuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;  // For sign-in, not integration
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

Key behaviors:
- On mount: `supabase.auth.getSession()` → check for existing session
- Listen: `supabase.auth.onAuthStateChange()` → react to auth events
- Token storage: Handled automatically by `@supabase/supabase-js` (localStorage)
- No keychain prompts ever

### Step 3: Create GitHubIntegrationContext

```typescript
// src/contexts/GitHubIntegrationContext.tsx
interface GitHubIntegrationContextValue {
  isConnected: boolean;
  githubUser: GitHubUser | null;
  accessToken: string | null;
  isLoading: boolean;
  connectGitHub: () => Promise<void>;    // OAuth flow for integration
  disconnectGitHub: () => Promise<void>;
  refreshConnection: () => Promise<void>;
}
```

Key behaviors:
- Stores GitHub OAuth token in `user_integrations` Supabase table (not keychain)
- Only loads when user navigates to GitHub-requiring features
- Graceful degradation: features show "Connect GitHub" prompt when not connected

### Step 4: Update App.tsx Provider Hierarchy

```tsx
// BEFORE
<GitHubAuthProvider>
  <AppContent />
</GitHubAuthProvider>

// AFTER
<SupabaseAuthProvider>
  <GitHubIntegrationProvider>  {/* Optional, lazy-loaded */}
    <AppContent />
  </GitHubIntegrationProvider>
</SupabaseAuthProvider>
```

### Step 5: Create Multi-Provider Auth Screen

Replace `GitHubAuthScreen.tsx` with `SupabaseAuthScreen.tsx`:

```tsx
// src/components/auth/SupabaseAuthScreen.tsx
export function SupabaseAuthScreen({ onSuccess, onSkip }: Props) {
  const { signInWithGoogle, signInWithGitHub, signInWithEmail } = useSupabaseAuth();
  
  return (
    <VStack>
      <Button onClick={signInWithGoogle}>Continue with Google</Button>
      <Button onClick={signInWithGitHub}>Continue with GitHub</Button>
      <Button onClick={handleEmailFlow}>Continue with Email</Button>
      <Button variant="ghost" onClick={onSkip}>Continue as guest</Button>
    </VStack>
  );
}
```

### Step 6: Feature Gating for Timeline

```tsx
// src/components/shared/GitHubGate.tsx
export function GitHubGate({ feature, children, fallback }: Props) {
  const { isConnected } = useGitHubIntegration();
  
  if (isConnected) {
    return <>{children}</>;
  }
  
  return fallback ?? <GitHubConnectPrompt feature={feature} />;
}

// Usage in TimelineTabContent.tsx
<GitHubGate feature="timeline_commits">
  {/* Existing timeline content */}
</GitHubGate>
```

---

## What We're NOT Changing in Phase 1

| Item | Reason |
|------|--------|
| Timeline feature implementation | Just gating it, not rewriting |
| Rust GitHub API client | Still used for commits (via integration token) |
| SQLite local storage | Not touching projects table |
| Library workspaces | That's Phase 2+ |

---

## Migration Strategy: Soft Cutover

Since there are no users except you:

1. **Keep old auth code in place** (but unused)
2. **Add new Supabase auth alongside**
3. **Flip the switch in App.tsx** to use new provider
4. **Let old keychain tokens expire naturally**
5. **Delete old code once confident**

### Environment Variables Needed

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Project Setup Required

Before implementing, you need:
- [ ] Create Supabase project
- [ ] Enable Google OAuth provider (configure in Supabase dashboard)
- [ ] Enable GitHub OAuth provider (creates NEW GitHub OAuth app for Supabase)
- [ ] Enable Email magic link auth
- [ ] Create `user_profiles` table
- [ ] Create `user_integrations` table (for GitHub tokens)
- [ ] Configure redirect URLs for Tauri deep linking

> ⚠️ **IMPORTANT:** Supabase's GitHub OAuth is for IDENTITY. Your current GitHub OAuth app is for INTEGRATION. You may end up with two GitHub OAuth apps:
> 1. **Supabase's GitHub OAuth** → For signing in with GitHub
> 2. **BlueKit's GitHub OAuth** → For Timeline features (repo access, commits)

---

## Decision Points to Discuss

1. **Deep Linking for OAuth Callbacks:**
   - Tauri doesn't have a browser URL bar
   - Options: Custom URL scheme (`bluekit://`), localhost server, or webview-based OAuth
   - Current impl uses localhost server (port 8080) - keep this?

2. **GitHub OAuth Scopes:**
   - Current scopes: `repo,user,read:org,write:org,user:follow`
   - For Supabase identity: Just need `user:email`
   - For integration (timeline): Still need `repo`
   - Two separate OAuth apps or reuse one?

3. **Token Storage Location:**
   - Supabase auth tokens: localStorage (automatic)
   - GitHub integration tokens: `user_integrations` table (requires user to be signed in)
   - Is this acceptable? (tokens synced to cloud, encrypted at rest)

4. **Existing Keychain Tokens:**
   - Just ignore them (they'll error and user re-auths with Supabase)
   - Or: One-time migration to Supabase on first launch?
   - Recommend: Just ignore, you're the only user

---

## Supabase Tables Needed for Phase 1

```sql
-- Minimal schema for Phase 1

-- Extends auth.users with profile info
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores GitHub OAuth tokens for integration (not identity)
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  provider_user_id TEXT,
  provider_username TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integrations" ON user_integrations FOR ALL USING (auth.uid() = user_id);
```

---

## Files Changed Summary

### Frontend (TypeScript/React)

| Action | File |
|--------|------|
| CREATE | `src/lib/supabase.ts` |
| CREATE | `src/contexts/SupabaseAuthContext.tsx` |
| CREATE | `src/contexts/GitHubIntegrationContext.tsx` |
| CREATE | `src/components/auth/SupabaseAuthScreen.tsx` |
| CREATE | `src/components/shared/GitHubGate.tsx` |
| CREATE | `src/lib/featureGates.ts` |
| MODIFY | `src/App.tsx` (provider swap) |
| MODIFY | `src/components/Header.tsx` (use new auth) |
| DEPRECATE | `src/auth/github/GitHubAuthProvider.tsx` |
| DEPRECATE | `src/auth/github/GitHubAuthScreen.tsx` |
| DEPRECATE | `src/ipc/keychain.ts` |

### Backend (Rust)

| Action | File |
|--------|------|
| KEEP | `src-tauri/src/integrations/github/github.rs` (for API calls) |
| DEPRECATE | `src-tauri/src/integrations/github/keychain.rs` |
| MODIFY | `src-tauri/src/integrations/github/auth.rs` (may need for Connect flow) |
| MODIFY | `src-tauri/src/commands.rs` (remove keychain commands) |

---

## Verification Plan

### Automated Testing

No existing frontend auth tests found. We'll rely on manual testing for Phase 1.

### Manual Verification Steps

1. **Fresh Start:**
   - Clear localStorage and keychain
   - Launch app → Should show welcome → Auth screen with 3 options

2. **Google Sign-In:**
   - Click "Continue with Google"
   - Complete OAuth in browser
   - Return to app → Should be on Home

3. **GitHub Sign-In (as identity):**
   - Sign out
   - Click "Continue with GitHub"
   - Complete OAuth
   - Return to app → Should be on Home
   - GitHub integration should also be connected (captured from sign-in)

4. **Email Sign-In:**
   - Sign out
   - Enter email → Receive magic link
   - Click link → Should open app and be authenticated

5. **Timeline Feature (GitHub Integration):**
   - Sign in with Google (no GitHub)
   - Open project → Timeline tab
   - Should see "Connect GitHub" prompt
   - Click connect → GitHub OAuth → Timeline should work

6. **Session Persistence:**
   - Sign in with any method
   - Close and reopen app
   - Should still be authenticated (no keychain prompt!)

---

## Next Steps After Phase 1

- **Phase 2:** Supabase database for workspaces/collections
- **Phase 3:** Supabase Storage for file storage
- **Phase 4:** Delete deprecated keychain code
- **Phase 5:** Collaboration features (sharing, real-time)
