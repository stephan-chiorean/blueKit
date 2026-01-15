# Supabase Implementation Roadmap

**Status:** Master Implementation Plan
**Created:** 2026-01-14
**Context:** Greenfield implementation of Supabase-first architecture

---

## Executive Summary

### Implementation Context: Greenfield

> **No existing users, no migration required.** This is a clean-slate implementation.

Current SQLite tables (`library_workspaces`, `library_collections`) will be completely replaced.
The workspace mechanism will be fundamentally different. At the end of this implementation,
**we can wipe the legacy SQLite library tables entirely** — no overlap, no migration concerns.

### The Sequencing Question

> Should we implement auth first, or data model first?

**Answer: Neither in isolation. They must be designed together, implemented in coordinated phases.**

Here's why:

1. **RLS requires auth** - Row Level Security policies reference `auth.uid()`. You can't secure data without auth.
2. **Auth without data is useless** - Sign-in with no workspaces to access is pointless.
3. **Retrofitting auth is painful** - Adding RLS after data exists means rewriting queries.
4. **Retrofitting data is also painful** - Changing schema after auth depends on it breaks things.

### The Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                  Implementation Strategy                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 0: Design Everything Together (Schema + Auth + RLS)  │
│              ↓                                               │
│  Phase 1: Auth Foundation (Supabase Auth)                   │
│              ↓                                               │
│  Phase 2: Data Model (Workspaces + Collections + RLS)       │
│              ↓                                               │
│  Phase 3: Storage Layer (Supabase Storage + abstraction)    │
│              ↓                                               │
│  Phase 4: GitHub as Integration (not identity)              │
│              ↓                                               │
│  Phase 5: Collaboration (Sharing, real-time, presence)      │
│              ↓                                               │
│  Phase 6: Enterprise (SSO, SCIM, advanced features)         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** Auth is always slightly ahead of data, but they move together.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Dependency Graph](#3-dependency-graph)
4. [Phase 0: Foundation & Design](#4-phase-0-foundation--design)
5. [Phase 1: Auth Foundation](#5-phase-1-auth-foundation)
6. [Phase 2: Data Model & RLS](#6-phase-2-data-model--rls)
7. [Phase 3: Storage Layer](#7-phase-3-storage-layer)
8. [Phase 4: GitHub Integration](#8-phase-4-github-integration)
9. [Phase 5: Collaboration Features](#9-phase-5-collaboration-features)
10. [Phase 6: Enterprise Features](#10-phase-6-enterprise-features)
11. [Risk Mitigation](#11-risk-mitigation)
12. [Success Metrics](#12-success-metrics)
13. [Detailed Timeline](#13-detailed-timeline)
14. [SSO Architecture Notes](#14-sso-architecture-notes)
15. [Legacy Database Cleanup](#15-legacy-database-cleanup-final-phase)

---

## 1. Current State Analysis

### What Exists Today (To Be Replaced)

```
┌─────────────────────────────────────────────────────────────┐
│               Current Architecture (Legacy)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Desktop App (Tauri + React)                                │
│  ├── Auth: GitHub OAuth only                                │
│  │   └── Token in macOS Keychain                            │
│  │                                                          │
│  ├── Local Data: SQLite                                     │
│  │   ├── projects (local folders) ← KEEP                   │
│  │   ├── library_workspaces ← REPLACE (can wipe)           │
│  │   └── library_collections ← REPLACE (can wipe)          │
│  │                                                          │
│  ├── Remote Storage: GitHub Repos                           │
│  │   └── Each workspace = one repo                          │
│  │                                                          │
│  └── No cloud backend (pure client-side)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

> **Note:** The `library_workspaces` and `library_collections` SQLite tables
> can be completely wiped at the end of implementation. The new workspace
> mechanism will be fundamentally different — no migration or overlap concerns.

### Problems to Solve (Greenfield)

| Problem | Impact | Solution |
|---------|--------|----------|
| GitHub-only auth | Excludes non-developers | Supabase Auth (Google, email) |
| `repo` scope | Scary permissions | Supabase Storage (no GitHub needed) |
| No sharing | Can't collaborate | Supabase RLS + membership |
| Local collections | Not shareable | Supabase database |
| No iOS support | Limited reach | Supabase as unified backend |
| **Keychain prompts** | Admin password every time | **Supabase token storage** |

### Current Token Storage Pain Point

The current implementation uses OS keychain (`keyring` crate) which triggers:
- **macOS**: Admin password prompts to access Keychain
- **Windows**: Credential Manager prompts
- **Linux**: Secret Service prompts

**This is terrible UX.** Users shouldn't need admin credentials to use the app.

**Solution with Supabase:**
1. **Supabase Auth tokens** → Stored automatically in localStorage by `@supabase/supabase-js` (no system prompts)
2. **GitHub integration tokens** → Stored in `user_integrations` table in Supabase (cloud-synced, encrypted at rest)

This eliminates:
- All Keychain/Credential Manager prompts
- Platform-specific credential storage code (`keychain.rs`)
- Admin password requirements
- Token sync issues across devices (tokens live in cloud)

---

## 2. Target Architecture

### End State Vision

```
┌─────────────────────────────────────────────────────────────┐
│                      Target Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Clients                                                    │
│  ├── Desktop (Tauri)                                        │
│  ├── iOS (Swift/React Native)                               │
│  └── Web (future)                                           │
│              │                                               │
│              ▼                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                      Supabase                          │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  Auth          Database         Storage      Realtime  │  │
│  │  ────          ────────         ───────      ────────  │  │
│  │  • Google      • users          • files      • presence│  │
│  │  • GitHub      • workspaces     • kits       • changes │  │
│  │  • Email       • collections    • assets     • sync    │  │
│  │  • SSO         • memberships                           │  │
│  │                • catalogs       (ONLY OPTION)          │  │
│  │                • integrations                          │  │
│  │                                                        │  │
│  │  Token Storage (NO LOCAL KEYCHAIN)                     │  │
│  │  ─────────────────────────────────                     │  │
│  │  • Auth tokens → localStorage (Supabase JS)           │  │
│  │  • GitHub tokens → user_integrations table            │  │
│  │  • No admin password prompts ever                     │  │
│  │                                                        │  │
│  │  Row Level Security (RLS)                              │  │
│  │  ─────────────────────────                             │  │
│  │  • auth.uid() = user_id                               │  │
│  │  • Workspace membership checks                        │  │
│  │  • Organization-scoped access                         │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│              │                                               │
│              ▼                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         GitHub Integration (Timeline Only)             │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  • Commit history (Timeline tab)                      │  │
│  │  • Checkpoints                                        │  │
│  │  • Branch visualization                               │  │
│  │                                                        │  │
│  │  NOT for storage - Supabase Storage is the ONLY       │  │
│  │  storage backend. GitHub is sticky/locked-in for      │  │
│  │  power users who want git features.                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Supabase is the source of truth** for identity, storage, and shared data
2. **Local SQLite remains** for projects (folders on disk) only
3. **GitHub is for features only** (Timeline, commits) — NOT for storage
4. **Supabase Storage is the ONLY storage option** — no GitHub repos, no gists, nothing else
5. **No local keychain** — all tokens stored in Supabase (eliminates admin password prompts)
6. **RLS from day one** - no security retrofitting

---

## 3. Dependency Graph

### What Depends on What

```
┌─────────────────────────────────────────────────────────────┐
│                     Dependency Graph                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Supabase Project Setup                                     │
│          │                                                   │
│          ▼                                                   │
│  Auth Configuration ◄───────────────────────────────────┐   │
│          │                                               │   │
│          ▼                                               │   │
│  Database Schema ────────────────────────────────────┐  │   │
│          │                                           │  │   │
│          ▼                                           │  │   │
│  RLS Policies (requires auth.uid()) ◄───────────────┘  │   │
│          │                                              │   │
│          ▼                                              │   │
│  Storage Buckets + Policies ◄───────────────────────────┘   │
│          │                                                   │
│          ▼                                                   │
│  Frontend Auth Context                                      │
│          │                                                   │
│          ├────────────────────────┐                         │
│          ▼                        ▼                         │
│  Workspace CRUD           User Integrations                 │
│          │                (GitHub linking)                  │
│          │                        │                         │
│          ▼                        ▼                         │
│  Collection CRUD          GitHub-backed features            │
│          │                (Timeline, commits)               │
│          │                                                   │
│          ▼                                                   │
│  File Operations (via storage abstraction)                  │
│          │                                                   │
│          ▼                                                   │
│  Sharing & Collaboration                                    │
│          │                                                   │
│          ▼                                                   │
│  Real-time Features (presence, sync)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Critical Path

The minimum viable sequence:

```
1. Supabase project + auth config
2. User table + profiles
3. Auth context in frontend
4. Workspace table + RLS
5. Storage bucket + policies
6. Basic CRUD operations
```

Everything else can be parallelized after step 6.

---

## 4. Phase 0: Foundation & Design

**Duration:** 1-2 weeks
**Goal:** Complete design before writing code

### 4.1 Supabase Project Setup

```bash
# Create Supabase project
# - Choose region closest to users
# - Note project URL and anon key
# - Enable auth providers (Google, GitHub, Email)
```

**Checklist:**
- [ ] Create Supabase project
- [ ] Enable Google OAuth provider
- [ ] Enable GitHub OAuth provider
- [ ] Enable Email auth (magic link)
- [ ] Configure redirect URLs
- [ ] Get project URL and keys
- [ ] Set up local development (supabase CLI)

### 4.2 Complete Schema Design

Design all tables before creating any. This prevents migrations hell.

```sql
-- ============================================================
-- PHASE 0: COMPLETE SCHEMA DESIGN
-- Design everything, implement incrementally
-- ============================================================

-- Core user data (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Linked integrations (GitHub, etc.)
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

-- Organizations (for enterprise)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sso_enabled BOOLEAN DEFAULT FALSE,
  sso_provider_id TEXT,
  sso_domains TEXT[],
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

-- Workspaces (library containers)
-- NOTE: Supabase Storage is the ONLY storage backend. No GitHub repos/gists.
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Storage (Supabase Storage ONLY - no alternatives)
  storage_path TEXT NOT NULL,  -- Path in Supabase Storage bucket

  -- Ownership
  owner_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),

  -- Settings
  visibility TEXT DEFAULT 'private',  -- private, unlisted, public

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace membership
CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',  -- owner, admin, editor, viewer
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Collections (organization within workspace)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catalogs (kit metadata, synced from storage)
CREATE TABLE catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,

  -- Kit metadata
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,  -- kit, walkthrough, agent, diagram
  file_path TEXT NOT NULL,      -- Path in storage

  -- Parsed from YAML front matter
  alias TEXT,
  description TEXT,
  tags JSONB DEFAULT '[]',

  -- Sync state
  content_hash TEXT,
  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id, file_path)
);

-- Workspace invites
CREATE TABLE workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 RLS Policy Design

Design all policies before enabling RLS:

```sql
-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- User profiles: users can read all, update own
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- User integrations: private to owner
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own integrations"
  ON user_integrations FOR ALL
  USING (auth.uid() = user_id);

-- Workspaces: based on membership
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspaces they're members of"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR
    visibility = 'public' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update workspaces"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners can delete workspaces"
  ON workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- Workspace members: based on workspace access
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace membership"
  ON workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage membership"
  ON workspace_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Collections: based on workspace access
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view collections"
  ON collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = collections.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can manage collections"
  ON collections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = collections.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

-- Catalogs: based on workspace access
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view catalogs"
  ON catalogs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = catalogs.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can manage catalogs"
  ON catalogs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = catalogs.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'editor')
    )
  );
```

### 4.4 Storage Bucket Design

```sql
-- Storage bucket for workspace files
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspaces', 'workspaces', false);

-- Storage policies
CREATE POLICY "Workspace members can view files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.storage_path = (storage.foldername(name))[1]
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.storage_path = (storage.foldername(name))[1]
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Editors can update files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.storage_path = (storage.foldername(name))[1]
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Editors can delete files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspaces' AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.storage_path = (storage.foldername(name))[1]
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'editor')
    )
  );
```

### 4.5 TypeScript Types Generation

```bash
# Generate types from Supabase schema
npx supabase gen types typescript --project-id your-project-id > src/lib/database.types.ts
```

**Deliverables for Phase 0:**
- [ ] Supabase project configured
- [ ] Complete SQL schema file (not yet applied)
- [ ] Complete RLS policies file (not yet applied)
- [ ] Storage bucket design documented
- [ ] TypeScript types planned
- [ ] Migration strategy documented

---

## 5. Phase 1: Auth Foundation

**Duration:** 2 weeks
**Goal:** Supabase Auth as the sole authentication system

### 5.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### 5.2 Auth Context Provider

```typescript
// src/contexts/SupabaseAuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
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

        if (event === 'SIGNED_IN') {
          // Create/update user profile
          await ensureUserProfile(session?.user);

          // If signed in with GitHub, capture token
          if (session?.provider_token &&
              session.user?.app_metadata?.provider === 'github') {
            await storeGitHubIntegration(session.user.id, session.provider_token);
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

  const signInWithEmail = async (email: string) => {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      signInWithGoogle,
      signInWithGitHub,
      signInWithEmail,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
}

// Helper functions
async function ensureUserProfile(user: User | undefined) {
  if (!user) return;

  await supabase
    .from('user_profiles')
    .upsert({
      id: user.id,
      email: user.email!,
      display_name: user.user_metadata?.full_name || user.user_metadata?.name,
      avatar_url: user.user_metadata?.avatar_url,
    });
}

async function storeGitHubIntegration(userId: string, accessToken: string) {
  // Fetch GitHub user info
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const githubUser = await response.json();

  await supabase
    .from('user_integrations')
    .upsert({
      user_id: userId,
      provider: 'github',
      access_token: accessToken,
      scopes: ['repo', 'read:user', 'user:email'],
      provider_user_id: githubUser.id.toString(),
      provider_username: githubUser.login,
      connected_at: new Date().toISOString(),
    });
}
```

### 5.3 Auth Callback Handler

```typescript
// src/pages/AuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Auth callback error:', error);
        navigate('/login?error=auth_failed');
        return;
      }

      if (data.session) {
        // Successfully authenticated
        navigate('/');
      } else {
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return <div>Completing sign in...</div>;
}
```

### 5.4 New Sign-In Screen

```typescript
// src/auth/SignInScreen.tsx
import { useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

export function SignInScreen() {
  const { signInWithGoogle, signInWithGitHub, signInWithEmail } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleEmailSignIn = async () => {
    await signInWithEmail(email);
    setEmailSent(true);
  };

  return (
    <Center h="100vh" bg="transparent">
      <Box borderRadius="2xl" p={8} w="400px" /* glassmorphism styles */>
        <VStack gap={4}>
          <Heading size="xl">Sign in to BlueKit</Heading>

          <Button
            onClick={signInWithGoogle}
            leftIcon={<FaGoogle />}
            w="100%"
            size="lg"
          >
            Continue with Google
          </Button>

          <Button
            onClick={signInWithGitHub}
            leftIcon={<FaGithub />}
            w="100%"
            size="lg"
            variant="outline"
          >
            Continue with GitHub
          </Button>

          <Divider />

          {!emailSent ? (
            <>
              <Input
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button onClick={handleEmailSignIn} w="100%">
                Continue with Email
              </Button>
            </>
          ) : (
            <Text>Check your email for a sign-in link!</Text>
          )}
        </VStack>
      </Box>
    </Center>
  );
}
```

**Deliverables for Phase 1:**
- [ ] Supabase client installed and configured
- [ ] Auth tables created (user_profiles, user_integrations)
- [ ] SupabaseAuthProvider implemented
- [ ] New sign-in screen with Google/GitHub/Email
- [ ] Auth callback handler
- [ ] RLS enabled on auth tables
- [ ] Remove legacy GitHub-only auth (GitHubAuthScreen, keychain storage)

---

## 6. Phase 2: Data Model & RLS

**Duration:** 2-3 weeks
**Goal:** Workspaces and collections in Supabase with RLS

### 6.1 Apply Database Schema

```bash
# Apply migrations
npx supabase migration new initial_schema
# Paste schema SQL into migration file
npx supabase db push
```

### 6.2 Workspace Service

```typescript
// src/lib/services/workspaces.ts
import { supabase } from '../supabase';
import type { Database } from '../database.types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type WorkspaceInsert = Database['public']['Tables']['workspaces']['Insert'];

export class WorkspaceService {
  // Create workspace (Supabase Storage ONLY - no alternatives)
  async create(data: {
    name: string;
    description?: string;
  }): Promise<Workspace> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate storage path (always Supabase Storage)
    const storagePath = `${user.id}/${crypto.randomUUID()}`;

    // Create workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: data.name,
        description: data.description,
        storage_path: storagePath,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-add creator as owner member
    await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
      });

    return workspace;
  }

  // List user's workspaces
  async listMine(): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        workspace_members!inner(role)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get workspace by ID
  async getById(id: string): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        workspace_members(user_id, role),
        collections(*)
      `)
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  }

  // Update workspace
  async update(id: string, updates: Partial<WorkspaceInsert>): Promise<Workspace> {
    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Delete workspace
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Get members
  async getMembers(workspaceId: string) {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        joined_at,
        user:user_profiles(id, email, display_name, avatar_url)
      `)
      .eq('workspace_id', workspaceId);

    if (error) throw error;
    return data;
  }

  // Add member
  async addMember(workspaceId: string, userId: string, role: string) {
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role,
      });

    if (error) throw error;
  }

  // Remove member
  async removeMember(workspaceId: string, userId: string) {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}

export const workspaceService = new WorkspaceService();
```

### 6.3 Collection Service

```typescript
// src/lib/services/collections.ts
import { supabase } from '../supabase';
import type { Database } from '../database.types';

type Collection = Database['public']['Tables']['collections']['Row'];

export class CollectionService {
  async create(workspaceId: string, data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<Collection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: collection, error } = await supabase
      .from('collections')
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: data.description,
        color: data.color,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return collection;
  }

  async listByWorkspace(workspaceId: string): Promise<Collection[]> {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('order_index');

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: Partial<Collection>): Promise<Collection> {
    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async reorder(workspaceId: string, orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) => ({
      id,
      order_index: index,
    }));

    for (const update of updates) {
      await supabase
        .from('collections')
        .update({ order_index: update.order_index })
        .eq('id', update.id);
    }
  }
}

export const collectionService = new CollectionService();
```

### 6.4 Workspace Context

```typescript
// src/contexts/WorkspacesContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { workspaceService, WorkspaceService } from '../lib/services/workspaces';
import { useSupabaseAuth } from './SupabaseAuthContext';
import type { Database } from '../lib/database.types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];

interface WorkspacesContextValue {
  workspaces: Workspace[];
  isLoading: boolean;
  error: Error | null;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (data: Parameters<WorkspaceService['create']>[0]) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
}

const WorkspacesContext = createContext<WorkspacesContextValue | undefined>(undefined);

export function WorkspacesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await workspaceService.listMine();
      setWorkspaces(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load workspaces'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, [user]);

  const createWorkspace = async (data: Parameters<WorkspaceService['create']>[0]) => {
    const workspace = await workspaceService.create(data);
    await refreshWorkspaces();
    return workspace;
  };

  const deleteWorkspace = async (id: string) => {
    await workspaceService.delete(id);
    await refreshWorkspaces();
  };

  return (
    <WorkspacesContext.Provider value={{
      workspaces,
      isLoading,
      error,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace,
    }}>
      {children}
    </WorkspacesContext.Provider>
  );
}

export function useWorkspaces() {
  const context = useContext(WorkspacesContext);
  if (!context) {
    throw new Error('useWorkspaces must be used within WorkspacesProvider');
  }
  return context;
}
```

**Deliverables for Phase 2:**
- [ ] Workspaces table with RLS
- [ ] Workspace members table with RLS
- [ ] Collections table with RLS
- [ ] Catalogs table with RLS
- [ ] WorkspaceService implemented
- [ ] CollectionService implemented
- [ ] WorkspacesContext provider
- [ ] Basic workspace CRUD UI

---

## 7. Phase 3: Storage Layer

**Duration:** 2-3 weeks
**Goal:** Supabase Storage as default, abstraction for multiple backends

### 7.1 Storage Abstraction

```typescript
// src/lib/storage/types.ts
export interface StorageBackend {
  listFiles(workspaceId: string): Promise<FileInfo[]>;
  readFile(workspaceId: string, path: string): Promise<string>;
  writeFile(workspaceId: string, path: string, content: string): Promise<void>;
  deleteFile(workspaceId: string, path: string): Promise<void>;
  getFileUrl(workspaceId: string, path: string): Promise<string>;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  contentType: string;
}
```

### 7.2 Supabase Storage Backend

```typescript
// src/lib/storage/supabaseStorage.ts
import { supabase } from '../supabase';
import type { StorageBackend, FileInfo } from './types';

export class SupabaseStorageBackend implements StorageBackend {
  private bucket = 'workspaces';

  async listFiles(storagePath: string): Promise<FileInfo[]> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .list(storagePath);

    if (error) throw error;

    return (data || []).map(file => ({
      name: file.name,
      path: `${storagePath}/${file.name}`,
      size: file.metadata?.size || 0,
      lastModified: new Date(file.updated_at || file.created_at),
      contentType: file.metadata?.mimetype || 'text/markdown',
    }));
  }

  async readFile(storagePath: string, fileName: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .download(`${storagePath}/${fileName}`);

    if (error) throw error;
    return await data.text();
  }

  async writeFile(storagePath: string, fileName: string, content: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(`${storagePath}/${fileName}`, content, {
        contentType: 'text/markdown',
        upsert: true,
      });

    if (error) throw error;
  }

  async deleteFile(storagePath: string, fileName: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([`${storagePath}/${fileName}`]);

    if (error) throw error;
  }

  async getFileUrl(storagePath: string, fileName: string): Promise<string> {
    const { data } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(`${storagePath}/${fileName}`, 3600);

    return data?.signedUrl || '';
  }
}
```

### 7.3 Storage Service (Supabase Only)

```typescript
// src/lib/storage/storage.ts
// NOTE: Supabase Storage is the ONLY backend. No GitHub repos/gists.
// This simplifies the architecture significantly.

import { SupabaseStorageBackend } from './supabaseStorage';

// Single storage backend - no factory needed
export const storage = new SupabaseStorageBackend();
```

> **Simplification:** No storage factory, no GitHub backends, no storage type switching.
> Every workspace uses Supabase Storage. Period.

### 7.4 Catalog Service (File Metadata)

```typescript
// src/lib/services/catalogs.ts
import { supabase } from '../supabase';
import { storage } from '../storage/storage';
import { parseYamlFrontMatter } from '../../utils/yamlParser';
import type { Database } from '../database.types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type Catalog = Database['public']['Tables']['catalogs']['Row'];

export class CatalogService {
  // Sync catalogs from storage to database
  async syncFromStorage(workspace: Workspace): Promise<void> {
    const storagePath = workspace.storage_path;

    // List all files in workspace
    const files = await storage.listFiles(storagePath);
    const mdFiles = files.filter(f => f.name.endsWith('.md'));

    for (const file of mdFiles) {
      // Read file content
      const content = await storage.readFile(storagePath, file.name);

      // Parse YAML front matter
      const { metadata, hash } = parseYamlFrontMatter(content);

      // Upsert catalog entry
      await supabase
        .from('catalogs')
        .upsert({
          workspace_id: workspace.id,
          name: metadata.alias || file.name.replace('.md', ''),
          artifact_type: metadata.type || 'kit',
          file_path: file.name,
          alias: metadata.alias,
          description: metadata.description,
          tags: metadata.tags || [],
          content_hash: hash,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id,file_path',
        });
    }

    // Remove catalogs for deleted files
    const existingPaths = mdFiles.map(f => f.name);
    await supabase
      .from('catalogs')
      .delete()
      .eq('workspace_id', workspace.id)
      .not('file_path', 'in', `(${existingPaths.map(p => `'${p}'`).join(',')})`);
  }

  // Get catalogs for workspace
  async listByWorkspace(workspaceId: string): Promise<Catalog[]> {
    const { data, error } = await supabase
      .from('catalogs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  // Read catalog content
  async getContent(workspace: Workspace, catalog: Catalog): Promise<string> {
    return storage.readFile(workspace.storage_path, catalog.file_path);
  }

  // Save catalog content
  async saveContent(
    workspace: Workspace,
    catalog: Catalog,
    content: string
  ): Promise<void> {
    await storage.writeFile(workspace.storage_path, catalog.file_path, content);

    // Re-sync metadata
    const { metadata, hash } = parseYamlFrontMatter(content);
    await supabase
      .from('catalogs')
      .update({
        name: metadata.alias || catalog.name,
        description: metadata.description,
        tags: metadata.tags || [],
        content_hash: hash,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', catalog.id);
  }
}

export const catalogService = new CatalogService();
```

**Deliverables for Phase 3:**
- [ ] Storage bucket created with RLS policies
- [ ] SupabaseStorageBackend implemented (single backend, no factory needed)
- [ ] CatalogService for metadata sync
- [ ] File upload/download working
- [ ] Workspace creation with Supabase storage (only option)
- [ ] Delete legacy `keychain.rs` and all OS credential code

---

## 8. Phase 4: GitHub Integration

**Duration:** 2 weeks
**Goal:** GitHub as required integration for Timeline features (sticky, locked-in)

> **Important:** GitHub is NOT optional for power users. Once connected, GitHub features
> (Timeline, commits, checkpoints) become core to the experience.
> This is intentionally sticky — we want users invested in the GitHub workflow.
>
> **Note:** GitHub is NOT used for storage. Supabase Storage is the only storage backend.
> GitHub integration is purely for git-based features (commit history, branches, etc.).

### 8.1 GitHub Token Expiration & UX

**Classic OAuth App Behavior:**
- Access tokens are **long-lived with no fixed expiration** by default
- Tokens remain valid until:
  - User manually revokes them
  - Token unused for 1 year (GitHub auto-revokes)
  - Organization policy enforces expiration
  - Token is compromised/exposed
- **Users will NOT need to reconnect every 6 months** — that's only for GitHub Apps with expiring tokens enabled

**UX Strategy:**
1. **Initial connection**: One-time OAuth flow, store token in `user_integrations` table
2. **Normal usage**: Token works silently, no user interruption
3. **Token validation**: Periodically check token validity (e.g., on app startup, before API calls)
4. **Revocation handling**: If token is invalid, show reconnect prompt with clear message:
   - "Your GitHub connection has expired. Click to reconnect."
   - Not a full re-auth flow, just a button that triggers OAuth again

### 8.2 Integration Service

```typescript
// src/lib/services/integrations.ts
import { supabase } from '../supabase';
import type { Database } from '../database.types';

type Integration = Database['public']['Tables']['user_integrations']['Row'];

export class IntegrationsService {
  // Get user's GitHub integration
  async getGitHub(): Promise<Integration | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_integrations')
      .select()
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  }

  // Check if GitHub token is valid
  // Classic OAuth App tokens don't expire on a schedule, but can be revoked
  async validateGitHubToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Connect GitHub (initiate OAuth)
  async connectGitHub(): Promise<void> {
    // Use Supabase's identity linking
    await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        scopes: 'repo read:user user:email',
        redirectTo: `${window.location.origin}/auth/callback?action=link`,
      },
    });
  }

  // Disconnect GitHub
  async disconnectGitHub(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'github');
  }

  // Get GitHub token for API calls
  // Classic OAuth tokens are long-lived - no refresh token needed
  async getGitHubToken(): Promise<string | null> {
    const integration = await this.getGitHub();
    if (!integration) return null;

    // Validate token (checks if revoked, not if expired - tokens don't expire)
    const isValid = await this.validateGitHubToken(integration.access_token);
    if (!isValid) {
      // Token was revoked or invalid - mark for reconnection
      await supabase
        .from('user_integrations')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', integration.id);
      return null;
    }

    return integration.access_token;
  }
}

export const integrationsService = new IntegrationsService();
```

### 8.3 Integrations Context

```typescript
// src/contexts/IntegrationsContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { integrationsService } from '../lib/services/integrations';
import { useSupabaseAuth } from './SupabaseAuthContext';

interface IntegrationsContextValue {
  github: {
    isConnected: boolean;
    isExpired: boolean;
    username?: string;
  };
  isLoading: boolean;
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  refreshIntegrations: () => Promise<void>;
}

const IntegrationsContext = createContext<IntegrationsContextValue | undefined>(undefined);

export function IntegrationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth();
  const [github, setGitHub] = useState({
    isConnected: false,
    isExpired: false,
    username: undefined as string | undefined,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshIntegrations = async () => {
    if (!user) {
      setGitHub({ isConnected: false, isExpired: false, username: undefined });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const integration = await integrationsService.getGitHub();

      if (integration) {
        const isValid = await integrationsService.validateGitHubToken(
          integration.access_token
        );
        setGitHub({
          isConnected: true,
          isExpired: !isValid,
          username: integration.provider_username || undefined,
        });
      } else {
        setGitHub({ isConnected: false, isExpired: false, username: undefined });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshIntegrations();
  }, [user]);

  return (
    <IntegrationsContext.Provider value={{
      github,
      isLoading,
      connectGitHub: integrationsService.connectGitHub,
      disconnectGitHub: async () => {
        await integrationsService.disconnectGitHub();
        await refreshIntegrations();
      },
      refreshIntegrations,
    }}>
      {children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrations() {
  const context = useContext(IntegrationsContext);
  if (!context) {
    throw new Error('useIntegrations must be used within IntegrationsProvider');
  }
  return context;
}
```

### 8.4 Feature Gating

```typescript
// src/lib/featureGates.ts
import { useIntegrations } from '../contexts/IntegrationsContext';

// GitHub features are ONLY for Timeline - NOT for storage
export type FeatureId =
  | 'timeline_commits'
  | 'timeline_checkpoints'
  | 'timeline_branches';

export function useFeatureAccess(feature: FeatureId) {
  const { github } = useIntegrations();

  // All Timeline features require GitHub - no exceptions
  const githubFeatures: FeatureId[] = [
    'timeline_commits',
    'timeline_checkpoints',
    'timeline_branches',
  ];

  if (githubFeatures.includes(feature)) {
    if (!github.isConnected) {
      return { hasAccess: false, reason: 'github_not_connected' };
    }
    if (github.isExpired) {
      return { hasAccess: false, reason: 'github_token_expired' };
    }
  }

  return { hasAccess: true, reason: null };
}

// Component for gating features
export function GitHubGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasAccess, reason } = useFeatureAccess(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return fallback || <GitHubConnectPrompt reason={reason} />;
}
```

**Deliverables for Phase 4:**
- [ ] IntegrationsService implemented (with Classic OAuth App token handling)
- [ ] IntegrationsContext provider
- [ ] GitHub connect/disconnect flow (stored in Supabase, not keychain)
- [ ] Token validation on app startup and before API calls
- [ ] Graceful handling of revoked tokens (reconnect prompt)
- [ ] Feature gating system for Timeline features
- [ ] GitHubGate component
- [ ] Update Timeline tab to use feature gate
- [ ] Settings page with integrations tab
- [ ] GitHub tokens stored in `user_integrations` table (no local keychain)

---

## 9. Phase 5: Collaboration Features

**Duration:** 3-4 weeks
**Goal:** Sharing, invites, real-time presence

### 9.1 Invite System

```typescript
// src/lib/services/invites.ts
import { supabase } from '../supabase';

export class InviteService {
  // Create invite link
  async createInvite(workspaceId: string, role: string = 'viewer'): Promise<string> {
    const inviteCode = crypto.randomUUID();

    await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: workspaceId,
        invite_code: inviteCode,
        role,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });

    return `${window.location.origin}/join/${inviteCode}`;
  }

  // Accept invite
  async acceptInvite(inviteCode: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get invite
    const { data: invite, error } = await supabase
      .from('workspace_invites')
      .select()
      .eq('invite_code', inviteCode)
      .is('accepted_at', null)
      .single();

    if (error || !invite) throw new Error('Invalid or expired invite');
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('Invite has expired');
    }

    // Add user to workspace
    await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
      });

    // Mark invite as accepted
    await supabase
      .from('workspace_invites')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq('id', invite.id);
  }
}

export const inviteService = new InviteService();
```

### 9.2 Real-Time Presence

```typescript
// src/hooks/useWorkspacePresence.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

interface PresenceUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  online_at: string;
}

export function useWorkspacePresence(workspaceId: string) {
  const { user } = useSupabaseAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user || !workspaceId) return;

    const channel = supabase.channel(`workspace:${workspaceId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as PresenceUser[];
        setOnlineUsers(users.filter(u => u.id !== user.id));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name,
            avatar: user.user_metadata?.avatar_url,
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

### 9.3 Real-Time Data Sync

```typescript
// src/hooks/useRealtimeWorkspace.ts
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspaces } from '../contexts/WorkspacesContext';

export function useRealtimeWorkspace(workspaceId: string) {
  const { refreshWorkspaces } = useWorkspaces();

  useEffect(() => {
    if (!workspaceId) return;

    // Subscribe to workspace changes
    const channel = supabase
      .channel(`workspace_changes:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catalogs',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          // Refresh when catalogs change
          refreshWorkspaces();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          refreshWorkspaces();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [workspaceId, refreshWorkspaces]);
}
```

**Deliverables for Phase 5:**
- [ ] Invite system (create, accept)
- [ ] Join page for invite links
- [ ] Real-time presence hook
- [ ] Real-time data sync
- [ ] Online users indicator in workspace view
- [ ] Share workspace modal
- [ ] Workspace member management UI

---

## 10. Phase 6: Enterprise Features

**Duration:** 4-6 weeks
**Goal:** SSO, organizations, advanced features

Refer to `enterprise-sso-saml-oidc.md` for detailed implementation.

**Deliverables for Phase 7:**
- [ ] Organizations table and management
- [ ] Domain verification system
- [ ] SAML SSO configuration
- [ ] OIDC support
- [ ] SSO enforcement
- [ ] JIT provisioning
- [ ] Audit logging
- [ ] Admin dashboard

---

## 11. Risk Mitigation

### Risk 1: RLS Performance

**Mitigation:**
- Add indexes on foreign keys
- Use Supabase's RLS performance advisor
- Cache frequently accessed policies

### Risk 2: GitHub Token Expiration

**Mitigation:**
- Store refresh tokens where available
- Graceful degradation when token expires
- Clear UI for reconnection

### Risk 3: Offline Mode

**Mitigation:**
- Cache workspace data in SQLite (offline cache, not the legacy tables)
- Queue operations for sync when online
- Local-first for project files (unchanged)

### Risk 4: Legacy Cleanup

**Mitigation:**
- At end of implementation, wipe SQLite `library_workspaces` and `library_collections` tables
- Remove legacy GitHub auth code (GitHubAuthScreen, keychain commands)
- No migration needed — greenfield implementation

---

## 12. Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 1 | Users can sign in with Google/Email/GitHub | 100% |
| Phase 2 | Workspaces created in Supabase | 100% |
| Phase 3 | Files stored in Supabase Storage | 100% (only option) |
| Phase 4 | GitHub integration for Timeline features | Works, sticky |
| Phase 5 | Workspace sharing works | 90% success |
| Phase 6 | Enterprise SSO configured | 5+ customers |
| Cleanup | No keychain prompts, no admin passwords | 100% eliminated |

---

## 13. Detailed Timeline

```
┌─────────────────────────────────────────────────────────────┐
│          Implementation Timeline (Greenfield)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Week 1-2:   Phase 0 - Foundation & Design                  │
│              • Supabase project setup                       │
│              • Complete schema design                       │
│              • RLS policy design                            │
│                                                              │
│  Week 3-4:   Phase 1 - Auth Foundation                      │
│              • Supabase Auth integration                    │
│              • New sign-in screens                          │
│              • Remove legacy GitHub auth                    │
│                                                              │
│  Week 5-7:   Phase 2 - Data Model                           │
│              • Apply schema migrations                      │
│              • Workspace/Collection services                │
│              • Basic CRUD UI                                │
│                                                              │
│  Week 8-10:  Phase 3 - Storage                              │
│              • Supabase Storage integration                 │
│              • Storage abstraction layer                    │
│              • Catalog sync service                         │
│                                                              │
│  Week 11-12: Phase 4 - GitHub Integration                   │
│              • Integrations service                         │
│              • Feature gating                               │
│              • GitHub storage backends                      │
│                                                              │
│  Week 13-16: Phase 5 - Collaboration                        │
│              • Invite system                                │
│              • Real-time presence                           │
│              • Data sync                                    │
│                                                              │
│  Week 17:    Cleanup                                        │
│              • Wipe legacy SQLite tables                    │
│              • Remove old GitHub auth code                  │
│              • Final testing                                │
│                                                              │
│  Week 18+:   Phase 6 - Enterprise (when needed)             │
│              • SSO/SAML                                     │
│              • Organizations                                │
│              • Advanced features                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

> **Total implementation: ~17 weeks** (excluding enterprise phase)
> Enterprise SSO deferred until customer demand, but architecture is ready.

---

## Summary

### Why This Sequence?

1. **Design first** (Phase 0) prevents costly changes later
2. **Auth slightly ahead** (Phase 1) because RLS needs `auth.uid()`
3. **Data model with RLS** (Phase 2) locks in security from day one
4. **Storage after data** (Phase 3) because catalogs reference workspaces
5. **GitHub for Timeline** (Phase 4) after core storage works
6. **Collaboration last** (Phase 5) because it builds on everything
7. **Enterprise deferred** (Phase 6) based on customer demand

### Key Principles

1. **Greenfield implementation** - No migration needed, wipe legacy tables when done
2. **Supabase Storage ONLY** - No GitHub repos, no gists, no alternatives
3. **GitHub is for Timeline only** - Commits, checkpoints, branches (sticky, locked-in)
4. **No local keychain** - All tokens in Supabase, no admin password prompts ever
5. **Local-first for projects** - SQLite stays for offline/performance (projects table only)
6. **Cloud-first for collaboration** - Supabase for anything shared
7. **SSO-ready architecture** - Organization model designed for future SSO expansion

### What Gets Deleted

At the end of implementation, completely remove:
- `keychain.rs` and all OS credential storage code
- `library_workspaces` and `library_collections` SQLite tables
- Legacy GitHub auth code (`GitHubAuthScreen`, device flow)
- Any GitHub storage backend code

This roadmap transforms BlueKit from a single-user GitHub-dependent app to a collaborative, multi-provider, enterprise-ready platform with seamless authentication (no admin passwords!).

---

## 14. SSO Architecture Notes

> **Implementation Deferred:** Enterprise SSO (SAML/OIDC) should not be implemented soon,
> but the architecture should be ready for this expansion when the time comes.

### Design Decisions That Enable Future SSO

The following architectural choices have been made to ensure SSO can be added without major refactoring:

#### 1. Organizations Table Already Exists

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sso_enabled BOOLEAN DEFAULT FALSE,      -- Ready for SSO toggle
  sso_provider_id TEXT,                   -- Supabase SSO provider ID
  sso_domains TEXT[],                     -- Domain-based routing
  plan TEXT DEFAULT 'free',               -- For enterprise tier gating
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Why this helps:** When SSO is needed, we just populate these fields and enable the feature.
No schema changes required.

#### 2. User Profiles Decoupled from Auth Provider

Users are identified by `auth.users.id` (Supabase-generated UUID), not by email or provider.
This means a user can:
- Sign in with Google today
- Later have their org enable SAML
- Same user record, different auth method

#### 3. Workspace Membership Supports Org-Based Access

```sql
-- Workspaces can be owned by users OR organizations
CREATE TABLE workspaces (
  owner_id UUID REFERENCES auth.users(id),           -- Personal workspaces
  organization_id UUID REFERENCES organizations(id), -- Org workspaces
  ...
);
```

**Why this helps:** Enterprise customers will want org-owned workspaces. The schema already supports this.

#### 4. RLS Policies Can Check Org Membership

The RLS policies are designed to be extensible:

```sql
-- Current: Check user membership
EXISTS (SELECT 1 FROM workspace_members WHERE user_id = auth.uid())

-- Future: Also check org membership (when implemented)
EXISTS (
  SELECT 1 FROM workspace_members WHERE user_id = auth.uid()
  UNION
  SELECT 1 FROM organization_members om
  JOIN workspaces w ON w.organization_id = om.organization_id
  WHERE om.user_id = auth.uid()
)
```

#### 5. Integrations Table Supports Multiple Providers

The `user_integrations` table is provider-agnostic:

```sql
CREATE TABLE user_integrations (
  provider TEXT NOT NULL,  -- 'github', 'figma', 'slack', etc.
  ...
);
```

**Why this helps:** SAML/OIDC tokens can be stored the same way if needed for advanced scenarios.

### When to Implement SSO

Implement Phase 6 (Enterprise Features) when:
- [ ] First enterprise customer requests SSO
- [ ] Supabase plan supports SSO (Pro or Enterprise)
- [ ] Domain verification infrastructure is needed

### SSO Implementation Checklist (Future)

When the time comes, refer to `enterprise-sso-saml-oidc.md` for detailed implementation.
Key steps:
1. Enable Supabase SSO feature (requires paid plan)
2. Create SSO configuration UI for org admins
3. Implement domain verification
4. Add JIT (Just-In-Time) user provisioning
5. Implement SSO enforcement policies
6. Add audit logging for compliance

### What NOT to Do Now

- **Don't** implement SSO infrastructure prematurely
- **Don't** add org-based RLS policies until needed
- **Don't** build admin dashboards for SSO configuration
- **Do** keep the schema ready (which it is)
- **Do** reference this document when SSO becomes a priority

---

## 15. Legacy Database Cleanup (Final Phase)

**Duration:** 1 week (after all phases complete)
**Goal:** Remove legacy SQLite tables that are no longer used

> **Note:** This cleanup is NOT urgent. The legacy tables can remain unused indefinitely.
> Only delete when you're 100% confident the new system is stable and all data is migrated.

### What Gets Deleted

After confirming the new Supabase system is fully operational:

- [ ] `library_workspaces` table (replaced by Supabase `workspaces`)
- [ ] `library_collections` table (replaced by Supabase `collections`)
- [ ] `library_catalogs` table (replaced by Supabase `catalogs`)
- [ ] `library_variations` table (replaced by Supabase `catalogs` with file paths)
- [ ] `library_artifacts` table (if exists, replaced by Supabase `catalogs`)
- [ ] All related Rust entity files:
  - `src-tauri/src/db/entities/library_workspace.rs`
  - `src-tauri/src/db/entities/library_collection.rs`
  - `src-tauri/src/db/entities/library_catalog.rs`
  - `src-tauri/src/db/entities/library_variation.rs`
  - `src-tauri/src/db/entities/library_artifact.rs` (if exists)
- [ ] Legacy library sync code:
  - `src-tauri/src/library/sync.rs`
  - `src-tauri/src/library/pull.rs`
  - `src-tauri/src/library/publishing.rs`
- [ ] Keychain storage code:
  - `src-tauri/src/integrations/github/keychain.rs`
  - All `invokeKeychain*` IPC commands in `src/ipc/keychain.ts`
- [ ] Legacy GitHub auth UI:
  - `src/auth/github/GitHubAuthScreen.tsx`
  - `src/auth/github/GitHubAuthProvider.tsx`
  - `src/auth/github/useGitHubAuth.ts`

### Cleanup Process

1. **Verification Phase** (2 days)
   - [ ] Confirm zero active users on legacy system
   - [ ] Verify all data migrated to Supabase
   - [ ] Test that no code paths reference legacy tables
   - [ ] Create backup of legacy SQLite database (just in case)
   - [ ] Verify all workspaces exist in Supabase
   - [ ] Verify all collections exist in Supabase

2. **Code Removal** (2 days)
   - [ ] Remove entity files from `src-tauri/src/db/entities/`
   - [ ] Remove library sync code from `src-tauri/src/library/`
   - [ ] Remove keychain IPC commands
   - [ ] Remove legacy GitHub auth components
   - [ ] Update imports and references throughout codebase
   - [ ] Remove legacy table creation from migrations
   - [ ] Run full test suite

3. **Database Migration** (1 day)
   - [ ] Create migration to drop legacy tables:
     ```sql
     DROP TABLE IF EXISTS library_artifacts;
     DROP TABLE IF EXISTS library_variations;
     DROP TABLE IF EXISTS library_catalogs;
     DROP TABLE IF EXISTS library_collections;
     DROP TABLE IF EXISTS library_workspaces;
     ```
   - [ ] Verify app still works without them
   - [ ] Archive backup for 90 days

4. **Documentation** (1 day)
   - [ ] Update architecture docs
   - [ ] Remove references to legacy system
   - [ ] Document what was removed and why
   - [ ] Update onboarding docs

### Safety Checklist

Before deletion:
- [ ] All users migrated to Supabase auth
- [ ] All workspaces exist in Supabase
- [ ] All collections exist in Supabase
- [ ] All catalogs synced to Supabase
- [ ] No active code references legacy tables
- [ ] No active code references legacy library sync functions
- [ ] No active code references keychain storage
- [ ] Backup created and verified
- [ ] Team notified of cleanup date
- [ ] Full regression test suite passes

### What Stays (Not Legacy)

These tables remain in SQLite and are NOT part of cleanup:
- `projects` - Local project folders (not replaced by Supabase)
- `plans` - Local plan data (not replaced by Supabase)
- `plan_phases` - Local plan phases
- `plan_milestones` - Local plan milestones
- `plan_documents` - Local plan documents
- `checkpoints` - Local git checkpoints
- `commits` - Local commit tracking
- `tasks` - Local task management

These remain because they're tied to local file system projects, not cloud workspaces.
