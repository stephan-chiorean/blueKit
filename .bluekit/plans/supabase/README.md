# Supabase Integration Plan

**Last Updated:** 2026-01-20

---

## Overview

Supabase provides the identity backbone for BlueKit. Before migrating auth, we first refactor GitHub OAuth to its proper role. Future phases add Vault sync and collaboration.

```
┌─────────────────────────────────────────────────────────────┐
│               PHASE 1: GITHUB INTEGRATION REFACTOR           │
│                      (Current Focus)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Move GitHub OAuth from sign-in to optional integration:    │
│  • Remove GitHub as identity provider                       │
│  • Add "Connect GitHub" button to unlock features           │
│  • Similar pattern to project-level git connection          │
│                                                              │
│  GitHub features (Timeline, etc) work after connection      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 2: SUPABASE AUTH                   │
│                        (Future)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Replace temp auth with Supabase Auth:                      │
│  • Google sign-in                                           │
│  • GitHub sign-in (for identity, not integration)           │
│  • Email magic link                                         │
│                                                              │
│  GitHub integration stays separate from identity            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 3: VAULT SYNC                      │
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
│                   PHASE 4: COLLABORATION                     │
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
│                    PHASE 5: MARKETPLACE                      │
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
| `github-integration-phase1.md` | **Implementation plan for Phase 1** (current focus) |
| `auth-phase2.md` | Implementation plan for Phase 2 (Supabase Auth) |
| `archive/` | Reference docs for future phases |

---

## Phase 1 Summary: GitHub Integration Refactor

**Goal:** Move GitHub OAuth from sign-in identity to optional feature integration

**What Changes:**
- GitHub OAuth no longer required at sign-in
- New: "Connect GitHub" button in header/settings to unlock features
- Timeline, activity feed, etc. gated behind GitHub connection
- Pattern mirrors project-level git connection (`ProjectsTabContent.tsx`)

**What Stays:**
- Local SQLite for projects, tasks, plans
- File watchers, kit rendering, everything else
- All GitHub API features (just accessed differently)

**Why First?**
- Separates identity from integration before Supabase migration
- GitHub connection pattern needed for Phase 2 anyway
- Reduces scope of Phase 2 (Supabase handles identity only)

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
