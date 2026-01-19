# Supabase Integration Plan

**Last Updated:** 2026-01-19

---

## Overview

Supabase provides the identity backbone for BlueKit. Phase 1 focuses on auth migration. Future phases add Vault sync and collaboration.

```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1: IDENTITY                        │
│                      (Current Focus)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Replace GitHub OAuth with Supabase Auth:                   │
│  • Google sign-in                                           │
│  • GitHub sign-in (for identity, not integration)           │
│  • Email magic link                                         │
│                                                              │
│  GitHub stays as optional integration for Timeline features │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 2: VAULT SYNC                      │
│                        (Future)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Sync personal Vault to cloud:                              │
│  • Notebook, Toolkit (Kits, Walkthroughs, Agents, Skills)   │
│  • One unified sync (not separate parts)                    │
│  • MCP API for AI access to Toolkit                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   PHASE 3: COLLABORATION                     │
│                        (Future)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Project collaboration metadata:                            │
│  • Task sync between teammates                              │
│  • Checkpoints, activity feeds                              │
│  • Project invites                                          │
│                                                              │
│  Note: Files still sync via git, not Supabase              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 4: MARKETPLACE                      │
│                        (Future)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Publish from Toolkit to community:                         │
│  • Public artifact discovery                                │
│  • Import to personal Vault                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `auth-phase1.md` | **Implementation plan for Phase 1** |
| `archive/` | Reference docs for future phases |

---

## Phase 1 Summary

**Goal:** Replace GitHub-only auth with Supabase Auth (multi-provider)

**What Changes:**
- New: `SupabaseAuthContext` as primary identity
- New: Sign-in screen with Google/GitHub/Email options
- Demoted: `GitHubAuthProvider` becomes optional integration for Timeline
- Removed: Keychain storage (Supabase handles tokens)

**What Stays:**
- Local SQLite for projects, tasks, plans
- File watchers, kit rendering, everything else
- GitHub API for Timeline features (via integration, not identity)

**Extensibility:**
- User profiles table ready for Vault sync
- `user_integrations` table for future integrations
- RLS policies in place for when we add Vault tables

---

## Quick Start

1. Create Supabase project at https://supabase.com/dashboard
2. Configure auth providers (Google, GitHub, Email)
3. Get project URL and anon key
4. Follow `auth-phase1.md` implementation steps

---

## Architecture Decision

**Why Supabase?**
- Built-in auth with multiple providers
- PostgreSQL with RLS for secure multi-tenant data
- Storage for Vault sync
- Edge Functions for future API needs
- Generous free tier

**Why not just enhance GitHub OAuth?**
- GitHub is for code, not identity
- Want Google sign-in for non-developers
- Email magic link for enterprise
- Clean separation: identity (Supabase) vs integration (GitHub API)
