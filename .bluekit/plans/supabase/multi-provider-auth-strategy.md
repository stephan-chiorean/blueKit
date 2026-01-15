# Multi-Provider Auth Strategy: Supabase + GitHub Integration

**Status:** Strategic Design
**Created:** 2026-01-14
**Context:** Moving from GitHub-only OAuth to Supabase Auth as primary identity, with GitHub as an optional linked integration

---

## Executive Summary

BlueKit is transitioning from GitHub OAuth as the sole authentication method to Supabase Auth as the primary identity layer. This creates a common pattern: users can sign in with Google/email/etc, but some features (commit history, Timeline tab, git operations) require GitHub authorization.

**This is a solved problem.** Apps like Vercel, Linear, Figma, and Notion all handle this pattern well. The key insight:

> **Identity is separate from Integrations.**

**Recommendation:** Implement the "Primary Identity + Linked Accounts" pattern:
1. Supabase Auth = Who you are (identity)
2. GitHub OAuth = What you can access (integration)
3. Features gracefully degrade without GitHub
4. Just-in-time prompts when GitHub is needed

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [How Other Apps Handle This](#2-how-other-apps-handle-this)
3. [Recommended Architecture](#3-recommended-architecture)
4. [Auth Flows Detailed](#4-auth-flows-detailed)
5. [Feature Gating Strategy](#5-feature-gating-strategy)
6. [Supabase Implementation](#6-supabase-implementation)
7. [GitHub Integration Service](#7-github-integration-service)
8. [UI/UX Patterns](#8-uiux-patterns)
9. [Collaborative Features Architecture](#9-collaborative-features-architecture)
10. [Synced Projects & Workspaces](#10-synced-projects--workspaces)
11. [Data Model](#11-data-model)
12. [Migration Path](#12-migration-path)
13. [Security Considerations](#13-security-considerations)
14. [Implementation Phases](#14-implementation-phases)

---

## 1. The Problem

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│                     Current Auth Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User → GitHub OAuth → BlueKit                              │
│                                                              │
│  • GitHub is identity AND integration                       │
│  • No way to use app without GitHub                         │
│  • All users need GitHub accounts                           │
│  • Broad OAuth scopes required                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Future State Challenges

1. **iOS App Users** - Many won't have GitHub accounts
2. **Social Sharing** - Recipients clicking shared links shouldn't need GitHub
3. **Library Features** - Supabase Storage doesn't need GitHub
4. **Mixed User Base** - Developers (have GitHub) vs Designers/PMs (might not)

### The Complexity

```
User signs in with Google
       │
       ├─→ Can use: Library, Kits, Walkthroughs, Blueprints
       │
       └─→ Cannot use: Timeline (commits), Git sync, Publishing to repos
                      │
                      └─→ Needs to link GitHub account
```

**Question:** How do we handle this gracefully?

---

## 2. How Other Apps Handle This

### Pattern 1: Vercel

**Identity:** Email/GitHub/GitLab/Bitbucket
**Integrations:** Git providers (separate from identity)

```
Sign in with Google → Use Vercel dashboard
                           │
                           ├─→ Deploy via CLI: Works
                           │
                           └─→ Deploy from Git: "Connect GitHub" prompt
```

**Key UX:**
- Git connection is opt-in per project
- Clear messaging: "Connect GitHub to deploy from repositories"
- Integration can be disconnected without losing account

### Pattern 2: Linear

**Identity:** Google/Email/SAML
**Integrations:** GitHub, GitLab, Figma, Slack

```
Sign in with Google → Use Linear for task management
                           │
                           ├─→ Create issues, plan sprints: Works
                           │
                           └─→ Link PR to issue: "Connect GitHub" in settings
```

**Key UX:**
- Integrations page in settings
- "Connect" buttons with clear scope descriptions
- Each integration has its own OAuth flow

### Pattern 3: Figma

**Identity:** Google/Email/SSO
**Integrations:** GitHub (for Figma Plugins), Slack, Jira

```
Sign in with Google → Design in Figma
                           │
                           ├─→ Design, prototype, share: Works
                           │
                           └─→ Publish plugin: "Connect GitHub"
```

**Key UX:**
- Most features work without integrations
- Integrations are for power users/specific workflows
- Just-in-time prompts when needed

### Pattern 4: Notion

**Identity:** Google/Apple/Email
**Integrations:** GitHub, Jira, Slack, etc.

```
Sign in with Google → Use Notion for docs
                           │
                           ├─→ Write, organize, share: Works
                           │
                           └─→ Embed GitHub issues: "Connect GitHub"
```

**Key UX:**
- Integrations as "Connections" in settings
- Each integration explains what access it needs
- Workspace admins can manage team integrations

---

## 3. Recommended Architecture

### The "Primary Identity + Linked Accounts" Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Recommended Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                      Supabase Auth                           │
│                      (Primary Identity)                      │
│                           │                                  │
│              ┌────────────┼────────────┐                    │
│              │            │            │                    │
│              ▼            ▼            ▼                    │
│          [Google]     [Email]     [GitHub]                  │
│                                      │                      │
│                         Same identity if email matches      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    Linked Integrations                       │
│                    (Optional, feature-gated)                │
│                           │                                  │
│              ┌────────────┴────────────┐                    │
│              │                         │                    │
│              ▼                         ▼                    │
│         [GitHub]                   [Future]                 │
│      (repo access,               (Figma, Slack,            │
│       commits, etc)                Jira, etc)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Identity ≠ Integration**
   - Sign in method doesn't determine feature access
   - User who signs in with GitHub still needs to "connect" GitHub for integrations

2. **Graceful Degradation**
   - App works without GitHub integration
   - Features show "Connect GitHub to use this" instead of breaking

3. **Just-in-Time Linking**
   - Don't ask for GitHub during sign-up
   - Ask when user tries to use a feature that needs it

4. **Unified Account**
   - Same email = same account (Supabase handles this)
   - Can link multiple identities to one account

---

## 4. Auth Flows Detailed

### Flow 1: New User Signs Up with Google

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Sign Up                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────┐                                │
│  │      Welcome to         │                                │
│  │        blueKit          │                                │
│  │                         │                                │
│  │  [Continue with Google] │ ← User clicks                  │
│  │  [Continue with GitHub] │                                │
│  │  [Continue with Email]  │                                │
│  │                         │                                │
│  │  ───────────────────    │                                │
│  │  Continue as guest      │                                │
│  └─────────────────────────┘                                │
│                                                              │
│  → Supabase creates user with google identity               │
│  → User lands in app with library access                    │
│  → No GitHub token yet                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: User Tries to View Commits (No GitHub Linked)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Feature Gate - Timeline Tab                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User clicks Timeline tab in project                        │
│              │                                               │
│              ▼                                               │
│  Check: Does user have GitHub integration?                  │
│              │                                               │
│              ├─→ NO: Show Connect Prompt                    │
│              │                                               │
│  ┌─────────────────────────────────────────┐               │
│  │ 📊 Timeline                              │               │
│  │                                          │               │
│  │  ┌────────────────────────────────────┐ │               │
│  │  │                                    │ │               │
│  │  │   Connect GitHub to view          │ │               │
│  │  │   commit history                  │ │               │
│  │  │                                    │ │               │
│  │  │   BlueKit needs access to your    │ │               │
│  │  │   repositories to show commits,   │ │               │
│  │  │   branches, and checkpoints.      │ │               │
│  │  │                                    │ │               │
│  │  │   [Connect GitHub]                │ │               │
│  │  │                                    │ │               │
│  │  │   What permissions are needed?    │ │               │
│  │  │   • Read repository contents      │ │               │
│  │  │   • Access commit history         │ │               │
│  │  │                                    │ │               │
│  │  └────────────────────────────────────┘ │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: User Connects GitHub

```
┌─────────────────────────────────────────────────────────────┐
│ Step 3: GitHub OAuth Connection Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User clicks "Connect GitHub"                               │
│              │                                               │
│              ▼                                               │
│  Open GitHub OAuth (in browser or WebView)                  │
│              │                                               │
│              ▼                                               │
│  ┌─────────────────────────────────────────┐               │
│  │ Authorize BlueKit                        │               │
│  │                                          │               │
│  │ BlueKit by bluekit-dev wants to access  │               │
│  │ your alice account                       │               │
│  │                                          │               │
│  │ ☑️ Public repositories (read/write)      │               │
│  │ ☑️ Private repositories (read)           │               │
│  │                                          │               │
│  │ [Authorize bluekit-dev]                 │               │
│  └─────────────────────────────────────────┘               │
│              │                                               │
│              ▼                                               │
│  Callback received with OAuth code                          │
│              │                                               │
│              ▼                                               │
│  Exchange code for GitHub access token                      │
│              │                                               │
│              ▼                                               │
│  Store token in Supabase (linked to user)                   │
│              │                                               │
│              ▼                                               │
│  Timeline tab now works!                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 4: User Signs Up with GitHub (Already Has Integration)

```
┌─────────────────────────────────────────────────────────────┐
│ Step 4: GitHub Sign-In (Special Case)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User clicks "Continue with GitHub"                         │
│              │                                               │
│              ▼                                               │
│  Supabase Auth with GitHub provider                         │
│              │                                               │
│              ▼                                               │
│  TWO things happen:                                          │
│                                                              │
│  1. Supabase creates user with github identity              │
│     (email: alice@gmail.com, provider: github)              │
│                                                              │
│  2. We capture the provider_token and store it as           │
│     a linked GitHub integration                             │
│                                                              │
│  Result: User has both identity AND integration from        │
│          one sign-in action                                 │
│                                                              │
│  ⚠️ IMPORTANT: Even though they signed in with GitHub,      │
│     the integration can still expire/be revoked             │
│     independently of their account                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 5: Token Refresh & Expiration

```
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Handling Token Expiration                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User tries to fetch commits                                │
│              │                                               │
│              ▼                                               │
│  GitHub API returns 401 (token expired)                     │
│              │                                               │
│              ▼                                               │
│  ┌─────────────────────────────────────────┐               │
│  │ GitHub Connection Expired                │               │
│  │                                          │               │
│  │ Your GitHub connection needs to be       │               │
│  │ refreshed.                               │               │
│  │                                          │               │
│  │ [Reconnect GitHub]  [Later]             │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
│  • Don't log user out                                       │
│  • Don't break other features                               │
│  • Just re-authenticate GitHub integration                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Feature Gating Strategy

### Feature Categories

| Category | GitHub Required | Examples |
|----------|-----------------|----------|
| **Core** | No | Library browsing, kit viewing, walkthroughs |
| **Local** | No | Project registry, local .bluekit files |
| **Storage** | No | Supabase Storage workspaces |
| **Git Read** | Yes | Timeline/commits, checkpoints, branches |
| **Git Write** | Yes | Publishing to repos, creating PRs |
| **Advanced** | Yes | GitHub-backed workspaces, repo management |

### Implementation Pattern

```typescript
// src/lib/featureGates.ts

export type FeatureId =
  | 'library_browse'
  | 'library_supabase_storage'
  | 'timeline_commits'
  | 'timeline_checkpoints'
  | 'git_publish'
  | 'git_sync'
  | 'workspace_github';

interface FeatureDefinition {
  id: FeatureId;
  name: string;
  requiresGitHub: boolean;
  description: string;
  scopes?: string[]; // GitHub OAuth scopes needed
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  library_browse: {
    id: 'library_browse',
    name: 'Browse Library',
    requiresGitHub: false,
    description: 'Browse and organize your kit library',
  },
  library_supabase_storage: {
    id: 'library_supabase_storage',
    name: 'Supabase Storage',
    requiresGitHub: false,
    description: 'Store kits in BlueKit cloud storage',
  },
  timeline_commits: {
    id: 'timeline_commits',
    name: 'View Commits',
    requiresGitHub: true,
    description: 'View commit history and diffs',
    scopes: ['repo'],
  },
  timeline_checkpoints: {
    id: 'timeline_checkpoints',
    name: 'Checkpoints',
    requiresGitHub: true,
    description: 'Pin commits as checkpoints',
    scopes: ['repo'],
  },
  git_publish: {
    id: 'git_publish',
    name: 'Publish to GitHub',
    requiresGitHub: true,
    description: 'Push kits to GitHub repositories',
    scopes: ['repo'],
  },
  git_sync: {
    id: 'git_sync',
    name: 'Git Sync',
    requiresGitHub: true,
    description: 'Sync local changes with remote',
    scopes: ['repo'],
  },
  workspace_github: {
    id: 'workspace_github',
    name: 'GitHub Workspaces',
    requiresGitHub: true,
    description: 'Create workspaces backed by GitHub repos',
    scopes: ['repo'],
  },
};

// Hook for checking feature access
export function useFeatureAccess(featureId: FeatureId) {
  const { user } = useAuth();
  const { githubIntegration } = useIntegrations();

  const feature = FEATURES[featureId];

  if (!feature.requiresGitHub) {
    return { hasAccess: true, reason: null };
  }

  if (!githubIntegration) {
    return {
      hasAccess: false,
      reason: 'github_not_connected',
      message: `Connect GitHub to ${feature.description.toLowerCase()}`,
    };
  }

  if (githubIntegration.expired) {
    return {
      hasAccess: false,
      reason: 'github_token_expired',
      message: 'Your GitHub connection has expired. Please reconnect.',
    };
  }

  return { hasAccess: true, reason: null };
}
```

### Component Pattern for Gated Features

```tsx
// src/components/shared/GitHubGate.tsx

interface GitHubGateProps {
  feature: FeatureId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function GitHubGate({ feature, children, fallback }: GitHubGateProps) {
  const { hasAccess, reason, message } = useFeatureAccess(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default: Connect GitHub prompt
  return (
    <GitHubConnectPrompt
      feature={feature}
      message={message}
      reason={reason}
    />
  );
}

// Usage in TimelineTabContent.tsx
export function TimelineTabContent({ projectId, gitConnected }: Props) {
  return (
    <GitHubGate feature="timeline_commits">
      {/* Existing timeline content */}
      <VStack align="stretch" gap={2}>
        {/* ... commits, checkpoints, etc ... */}
      </VStack>
    </GitHubGate>
  );
}
```

---

## 6. Supabase Implementation

### Supabase Auth Configuration

```typescript
// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Configure auth options
supabase.auth.configure({
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
});
```

### Auth Context Provider

```typescript
// src/contexts/AuthContext.tsx

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // If signed in with GitHub, capture the provider token
        if (event === 'SIGNED_IN' && session?.provider_token) {
          const provider = session.user?.app_metadata?.provider;
          if (provider === 'github') {
            await storeGitHubIntegration(session.provider_token);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'repo read:user user:email',
      },
    });
  };

  // ... other methods

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      signInWithGoogle,
      signInWithGitHub,
      signInWithEmail,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Identity Linking

Supabase automatically links identities with the same email:

```typescript
// User signs up with Google (alice@gmail.com)
// Later signs in with GitHub (alice@gmail.com)
// → Same user, two identities

// Check user's identities
const { data: { user } } = await supabase.auth.getUser();
console.log(user?.identities);
// [
//   { provider: 'google', identity_data: { email: 'alice@gmail.com' } },
//   { provider: 'github', identity_data: { email: 'alice@gmail.com' } }
// ]
```

### Manual Identity Linking

```typescript
// Link additional identity to existing account
const linkGitHub = async () => {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'github',
    options: {
      scopes: 'repo read:user user:email',
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

---

## 7. GitHub Integration Service

### Separate from Auth

```typescript
// src/lib/integrations/github.ts

interface GitHubIntegration {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  githubUserId: number;
  githubUsername: string;
  connectedAt: Date;
}

export class GitHubIntegrationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // Store GitHub integration (called after OAuth)
  async storeIntegration(
    userId: string,
    accessToken: string,
    scopes: string[]
  ): Promise<GitHubIntegration> {
    // Verify token and get user info
    const octokit = new Octokit({ auth: accessToken });
    const { data: githubUser } = await octokit.users.getAuthenticated();

    // Store in Supabase
    const { data, error } = await this.supabase
      .from('user_integrations')
      .upsert({
        user_id: userId,
        provider: 'github',
        access_token: accessToken, // encrypted at rest by Supabase
        scopes: scopes,
        provider_user_id: githubUser.id.toString(),
        provider_username: githubUser.login,
        connected_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get current GitHub integration
  async getIntegration(userId: string): Promise<GitHubIntegration | null> {
    const { data, error } = await this.supabase
      .from('user_integrations')
      .select()
      .eq('user_id', userId)
      .eq('provider', 'github')
      .single();

    if (error?.code === 'PGRST116') return null; // Not found
    if (error) throw error;

    return data;
  }

  // Check if token is valid
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: accessToken });
      await octokit.users.getAuthenticated();
      return true;
    } catch {
      return false;
    }
  }

  // Disconnect GitHub
  async disconnectIntegration(userId: string): Promise<void> {
    await this.supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'github');
  }
}
```

### Integration Context

```typescript
// src/contexts/IntegrationsContext.tsx

interface IntegrationsContextValue {
  githubIntegration: GitHubIntegration | null;
  isLoading: boolean;
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  refreshGitHub: () => Promise<void>;
}

export function IntegrationsProvider({ children }: Props) {
  const { user } = useAuth();
  const [githubIntegration, setGitHubIntegration] = useState<GitHubIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load integration on mount
  useEffect(() => {
    if (!user) {
      setGitHubIntegration(null);
      setIsLoading(false);
      return;
    }

    loadGitHubIntegration();
  }, [user]);

  const loadGitHubIntegration = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const integration = await githubService.getIntegration(user.id);

      // Validate token is still good
      if (integration) {
        const isValid = await githubService.validateToken(integration.accessToken);
        if (!isValid) {
          // Mark as expired but don't delete
          setGitHubIntegration({ ...integration, expired: true });
        } else {
          setGitHubIntegration(integration);
        }
      } else {
        setGitHubIntegration(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const connectGitHub = async () => {
    // Start OAuth flow (separate from sign-in)
    // This is for linking, not authentication
    await startGitHubOAuthFlow();
  };

  // ... rest of implementation
}
```

---

## 8. UI/UX Patterns

### Settings Page: Integrations Tab

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Account] [Integrations] [Preferences] [Billing]            │
│           ═══════════════                                   │
│                                                              │
│ Connected Services                                           │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🐙 GitHub                            [Connected ✓]      │ │
│ │                                                          │ │
│ │ Connected as @alice                                      │ │
│ │ Permissions: repo, read:user                            │ │
│ │ Connected on Jan 14, 2026                               │ │
│ │                                                          │ │
│ │ [Disconnect]                                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎨 Figma                              [Not Connected]   │ │
│ │                                                          │ │
│ │ Import design tokens and sync with Figma files          │ │
│ │                                                          │ │
│ │ [Connect Figma]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Just-in-Time Connect Prompt

```
┌─────────────────────────────────────────────────────────────┐
│ Connect GitHub                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                      │   │
│   │           🔗 Connect GitHub                         │   │
│   │                                                      │   │
│   │   To view commit history and manage checkpoints,    │   │
│   │   BlueKit needs access to your GitHub repositories. │   │
│   │                                                      │   │
│   │   This allows BlueKit to:                           │   │
│   │   • View commits and branches                       │   │
│   │   • Create checkpoints from commits                 │   │
│   │   • Open diffs in GitHub                           │   │
│   │                                                      │   │
│   │   ┌──────────────────────────────────────────────┐ │   │
│   │   │  [Connect GitHub]                            │ │   │
│   │   └──────────────────────────────────────────────┘ │   │
│   │                                                      │   │
│   │   You can disconnect anytime in Settings            │   │
│   │                                                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Token Expired State

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Connection Expired                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ⚠️ Your GitHub connection has expired                     │
│                                                              │
│   This can happen if:                                        │
│   • You revoked access in GitHub settings                   │
│   • The connection hasn't been used in a while              │
│                                                              │
│   [Reconnect GitHub]                [Maybe Later]           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Graceful Feature Degradation

```tsx
// TimelineTabContent.tsx with graceful degradation

export function TimelineTabContent({ projectId, gitConnected }: Props) {
  const { hasAccess, reason } = useFeatureAccess('timeline_commits');

  // Show limited view without GitHub
  if (!hasAccess) {
    return (
      <VStack align="stretch" gap={4}>
        <ToolkitHeader title="Timeline" />

        {/* Checkpoints might still work (if stored in Supabase) */}
        <CheckpointsView projectId={projectId} />

        {/* Commits need GitHub */}
        <Box p={6} bg="bg.subtle" borderRadius="md">
          <VStack gap={3}>
            <Icon as={LuGitBranch} boxSize={8} color="fg.muted" />
            <Text fontWeight="medium">View Commit History</Text>
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              Connect your GitHub account to see commits,
              create checkpoints, and track changes.
            </Text>
            <Button
              onClick={() => openGitHubConnect()}
              leftIcon={<FaGithub />}
            >
              Connect GitHub
            </Button>
          </VStack>
        </Box>
      </VStack>
    );
  }

  // Full view with GitHub
  return (
    // ... existing implementation
  );
}
```

---

## 9. Collaborative Features Architecture

### The Vision

```
┌─────────────────────────────────────────────────────────────┐
│                 Collaborative BlueKit                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Supabase                            │  │
│  │                                                        │  │
│  │  Auth        Real-time      Database      Storage     │  │
│  │  (Identity)  (Presence)     (Metadata)    (Files)     │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐           │
│    │ User A  │      │ User B  │      │ User C  │           │
│    │ Desktop │      │ Desktop │      │  iOS    │           │
│    └─────────┘      └─────────┘      └─────────┘           │
│                                                              │
│  Features:                                                   │
│  • Shared workspaces (see same kits)                        │
│  • Real-time presence (see who's viewing)                   │
│  • Synced projects (tasks, checkpoints shared)              │
│  • Comments & annotations                                   │
│  • Activity feeds                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What Supabase Provides

| Feature | Supabase Component | Notes |
|---------|-------------------|-------|
| User accounts | Auth | Email, Google, GitHub, Apple |
| Real-time updates | Realtime | Presence, broadcast, DB changes |
| Shared data | Database + RLS | Workspaces, collections, metadata |
| File storage | Storage | Supabase Storage tier |
| Access control | Row Level Security | Fine-grained permissions |
| API | Auto-generated | REST + GraphQL from schema |

### Invite Flow for Workspaces

```
┌─────────────────────────────────────────────────────────────┐
│ Workspace Invite Flow                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Alice creates workspace "Design System"                    │
│              │                                               │
│              ▼                                               │
│  Alice clicks "Share Workspace"                             │
│              │                                               │
│              ▼                                               │
│  ┌─────────────────────────────────────────┐               │
│  │ Share "Design System"                    │               │
│  │                                          │               │
│  │ Invite by email:                         │               │
│  │ ┌────────────────────────────┐          │               │
│  │ │ bob@company.com            │          │               │
│  │ └────────────────────────────┘          │               │
│  │                                          │               │
│  │ Permission: [Viewer ▼]                  │               │
│  │   • Viewer - Can browse kits            │               │
│  │   • Editor - Can add/edit kits          │               │
│  │   • Admin  - Can manage members         │               │
│  │                                          │               │
│  │ [Send Invite]                           │               │
│  │                                          │               │
│  │ ─────── Or share link ───────           │               │
│  │                                          │               │
│  │ bluekit.app/join/abc123      [Copy]     │               │
│  │                                          │               │
│  └─────────────────────────────────────────┘               │
│              │                                               │
│              ▼                                               │
│  Bob receives email or clicks link                          │
│              │                                               │
│              ▼                                               │
│  Bob signs in (with any method)                             │
│              │                                               │
│              ▼                                               │
│  Bob sees "Design System" in his library                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Real-Time Presence

```typescript
// src/lib/presence.ts

export function useWorkspacePresence(workspaceId: string) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!user || !workspaceId) return;

    // Subscribe to presence channel
    const channel = supabase.channel(`workspace:${workspaceId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track our presence
          await channel.track({
            user_id: user.id,
            username: user.email,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, workspaceId]);

  return { onlineUsers };
}
```

---

## 10. Synced Projects & Workspaces

### The Concept

**Local Project** = Folder on your machine with `.bluekit/` directory
**Synced Project** = Local project + cloud metadata (tasks, checkpoints, comments)

```
┌─────────────────────────────────────────────────────────────┐
│                     Synced Project                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Local (SQLite + Files)         Cloud (Supabase)            │
│  ─────────────────────          ─────────────────           │
│  • Project path                 • Project metadata          │
│  • .bluekit/*.md files         • Synced checkpoints        │
│  • Local settings              • Tasks                      │
│                                 • Comments                   │
│                                 • Activity log              │
│                                 • Member list               │
│                                                              │
│  ← File changes sync to cloud metadata →                    │
│  ← Team sees same checkpoints, tasks →                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Enable Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Enable Project Sync                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User opens project → sees "Enable Sync" option             │
│              │                                               │
│              ▼                                               │
│  ┌─────────────────────────────────────────┐               │
│  │ Sync "my-app" with your team            │               │
│  │                                          │               │
│  │ Syncing enables:                         │               │
│  │ ✓ Shared checkpoints across team        │               │
│  │ ✓ Task management & assignments         │               │
│  │ ✓ Comments on kits & plans              │               │
│  │ ✓ Activity feed                         │               │
│  │                                          │               │
│  │ This creates a cloud project linked     │               │
│  │ to your local folder.                   │               │
│  │                                          │               │
│  │ [Enable Sync]                           │               │
│  └─────────────────────────────────────────┘               │
│              │                                               │
│              ▼                                               │
│  Supabase creates `synced_project` record                   │
│              │                                               │
│              ▼                                               │
│  Local project now has `sync_id` in SQLite                  │
│              │                                               │
│              ▼                                               │
│  Future: File changes → Supabase events → Team notified     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Model for Synced Projects

```sql
-- Supabase schema

-- Synced projects (cloud representation of local projects)
CREATE TABLE synced_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Optional: Link to GitHub repo
  github_owner TEXT,
  github_repo TEXT,

  -- Creator/owner
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members
CREATE TABLE project_members (
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- Synced checkpoints (shared across team)
CREATE TABLE synced_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  checkpoint_type TEXT, -- milestone, release, wip, etc.

  -- Git info (if project has GitHub connected)
  git_commit_sha TEXT,
  git_branch TEXT,

  -- Metadata
  tags JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- todo, in_progress, done
  priority TEXT DEFAULT 'medium',

  assignee_id UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,

  -- Link to checkpoint or kit
  linked_checkpoint_id UUID REFERENCES synced_checkpoints(id),
  linked_kit_path TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments (on kits, checkpoints, tasks)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,

  -- Polymorphic: what is this comment on?
  target_type TEXT NOT NULL, -- 'kit', 'checkpoint', 'task'
  target_id TEXT NOT NULL,   -- kit path or UUID

  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),

  -- Threading
  parent_comment_id UUID REFERENCES comments(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Linking Local ↔ Cloud

```typescript
// Local SQLite: projects table
interface LocalProject {
  id: string;
  name: string;
  path: string;

  // Cloud sync fields
  sync_id?: string;        // UUID from synced_projects
  sync_enabled: boolean;
  last_synced_at?: number;
}

// Enable sync for a project
async function enableProjectSync(localProjectId: string): Promise<void> {
  const localProject = await invoke('get_project', { id: localProjectId });

  // Create in Supabase
  const { data: syncedProject, error } = await supabase
    .from('synced_projects')
    .insert({
      name: localProject.name,
      github_owner: localProject.github_owner,
      github_repo: localProject.github_repo,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Update local SQLite with sync_id
  await invoke('update_project', {
    id: localProjectId,
    sync_id: syncedProject.id,
    sync_enabled: true,
  });

  // Auto-join as owner
  await supabase
    .from('project_members')
    .insert({
      project_id: syncedProject.id,
      user_id: user.id,
      role: 'owner',
    });
}
```

---

## 11. Data Model

### Complete Supabase Schema

```sql
-- ============================================================
-- AUTH & IDENTITY
-- ============================================================

-- Users managed by Supabase Auth (auth.users)
-- Additional user profile data
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Linked integrations (GitHub, etc.)
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,              -- 'github', 'figma', etc.
  access_token TEXT NOT NULL,          -- encrypted at rest
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  provider_user_id TEXT,               -- GitHub user ID
  provider_username TEXT,              -- GitHub username
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- ============================================================
-- WORKSPACES (Library)
-- ============================================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Storage backend
  storage_type TEXT NOT NULL DEFAULT 'supabase', -- 'supabase', 'gist', 'repo'
  storage_path TEXT,                   -- For Supabase Storage
  gist_id TEXT,                        -- For GitHub Gist
  github_owner TEXT,                   -- For GitHub Repo
  github_repo TEXT,

  -- Ownership
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer', -- owner, admin, editor, viewer
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- ============================================================
-- SYNCED PROJECTS
-- ============================================================

CREATE TABLE synced_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  github_owner TEXT,
  github_repo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_members (
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- ============================================================
-- COLLABORATION FEATURES
-- ============================================================

CREATE TABLE synced_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  checkpoint_type TEXT,
  git_commit_sha TEXT,
  git_branch TEXT,
  tags JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  assignee_id UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  linked_checkpoint_id UUID REFERENCES synced_checkpoints(id),
  linked_kit_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  parent_comment_id UUID REFERENCES comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVITES
-- ============================================================

CREATE TABLE workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT,                          -- NULL for link invites
  invite_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES synced_projects(id) ON DELETE CASCADE,
  email TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security Policies

```sql
-- Workspaces: members can view, owner/admin can edit
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view workspace"
  ON workspaces FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owner can update"
  ON workspaces FOR UPDATE USING (
    owner_id = auth.uid()
  );

-- Projects: members can view, role-based edit
ALTER TABLE synced_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view project"
  ON synced_projects FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = id AND pm.user_id = auth.uid()
    )
  );

-- ... similar policies for other tables
```

---

## 12. Migration Path

### Phase 1: Add Supabase Auth (Keep GitHub Working)

```
Current:  GitHub OAuth only
Phase 1:  Supabase Auth + GitHub OAuth (both work)
          - New users can choose Google/GitHub/Email
          - Existing users continue with GitHub
          - GitHub token still stored in keychain
```

### Phase 2: Add GitHub as Linked Integration

```
Phase 2:  GitHub becomes "integration" not "identity"
          - Sign-in with GitHub captures provider_token
          - Store in user_integrations table
          - Features check integration, not auth method
```

### Phase 3: Feature Gating

```
Phase 3:  Features gracefully degrade
          - Timeline tab shows "Connect GitHub" if no integration
          - Library works without GitHub (Supabase Storage)
          - Git features require GitHub integration
```

### Phase 4: Collaborative Features

```
Phase 4:  Enable synced projects
          - Local projects can enable cloud sync
          - Shared checkpoints, tasks, comments
          - Real-time presence
```

### Existing User Migration

```typescript
// On app update, detect existing GitHub session
async function migrateExistingUser() {
  // Check if user has GitHub token in keychain
  const existingToken = await invoke('get_github_token');

  if (existingToken) {
    // Get GitHub user info
    const octokit = new Octokit({ auth: existingToken });
    const { data: githubUser } = await octokit.users.getAuthenticated();

    // Create Supabase account (or link if exists)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        skipBrowserRedirect: true,
      },
    });

    // Store as integration
    await supabase
      .from('user_integrations')
      .upsert({
        user_id: data.user.id,
        provider: 'github',
        access_token: existingToken,
        provider_user_id: githubUser.id.toString(),
        provider_username: githubUser.login,
      });

    // Mark migration complete
    await invoke('set_setting', { key: 'auth_migrated', value: 'true' });
  }
}
```

---

## 13. Security Considerations

### Token Storage

| Token | Where Stored | Notes |
|-------|--------------|-------|
| Supabase session | Browser/app | Auto-refreshed by SDK |
| GitHub access token | Supabase DB | Encrypted at rest |
| GitHub refresh token | Supabase DB | For token refresh |

### OAuth Scopes

**Sign-in with GitHub (identity only):**
- `read:user` - Basic profile info
- `user:email` - Email address

**GitHub Integration (repo access):**
- `repo` - Full repo access (private + public)
- `read:user` - Profile info

### RLS Security

All Supabase tables use Row Level Security:
- Users can only access their own data
- Workspace/project members can access shared data
- Role-based permissions (owner, admin, member, viewer)

### Token Refresh Strategy

```typescript
// Periodically check and refresh GitHub token
async function refreshGitHubTokenIfNeeded(integration: GitHubIntegration) {
  // Check if token expires soon (within 1 hour)
  if (integration.expiresAt &&
      integration.expiresAt.getTime() - Date.now() < 3600000) {

    if (integration.refreshToken) {
      // Use refresh token
      const newTokens = await refreshGitHubToken(integration.refreshToken);
      await updateIntegration(integration.id, newTokens);
    } else {
      // No refresh token, need user to re-auth
      markIntegrationExpired(integration.id);
    }
  }
}
```

---

## 14. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

- [ ] Set up Supabase project
- [ ] Configure auth providers (Google, GitHub, Email)
- [ ] Create database schema
- [ ] Add Supabase client to frontend
- [ ] Create AuthContext and IntegrationsContext
- [ ] Build sign-in/sign-up screens

### Phase 2: GitHub Integration (1-2 weeks)

- [ ] Create user_integrations table
- [ ] Build GitHubIntegrationService
- [ ] Add "Connect GitHub" flow
- [ ] Store GitHub tokens in Supabase
- [ ] Add integration management to settings

### Phase 3: Feature Gating (1-2 weeks)

- [ ] Create feature gate system
- [ ] Add GitHubGate component
- [ ] Update Timeline tab with gates
- [ ] Update other GitHub-dependent features
- [ ] Add "Connect GitHub" prompts

### Phase 4: Migration (1 week)

- [ ] Detect existing GitHub users
- [ ] Migrate tokens to Supabase
- [ ] Update keychain handling
- [ ] Test migration flow

### Phase 5: Workspaces (2-3 weeks)

- [ ] Create workspace tables
- [ ] Implement workspace CRUD
- [ ] Add workspace sharing/invites
- [ ] Migrate from SQLite to Supabase

### Phase 6: Synced Projects (3-4 weeks)

- [ ] Create synced_projects tables
- [ ] Implement sync enable flow
- [ ] Build shared checkpoints
- [ ] Add task management
- [ ] Add comments
- [ ] Implement real-time presence

---

## Summary

### Key Decisions

1. **Supabase Auth as primary identity** - Single source of truth for "who you are"
2. **GitHub as optional integration** - Linked account for repo access, not identity
3. **Just-in-time prompts** - Ask for GitHub when needed, not at sign-up
4. **Graceful degradation** - Features work without GitHub where possible
5. **Unified account** - Same email = same account across providers

### User Experience Goals

- **Frictionless onboarding** - Sign up with Google in seconds
- **Progressive disclosure** - Advanced features unlock as needed
- **Clear messaging** - Always explain why GitHub is needed
- **Easy management** - Integrations page in settings

### Technical Benefits

- **Simpler auth code** - Supabase handles complexity
- **Better security** - No broad OAuth scopes by default
- **Real-time ready** - Supabase Realtime for collaboration
- **Mobile-friendly** - iOS app doesn't need GitHub

This architecture positions BlueKit for:
- Broader user base (non-developers can use library)
- Social sharing (recipients don't need GitHub)
- Team collaboration (shared workspaces, real-time features)
- Future integrations (Figma, Slack, Jira using same pattern)
