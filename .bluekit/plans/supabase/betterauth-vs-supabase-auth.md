# BetterAuth vs Supabase Auth: When to Use What

**Status:** Research & Analysis
**Created:** 2026-01-15
**Context:** Evaluating whether BetterAuth adds value over Supabase Auth for BlueKit

---

## Executive Summary

**TL;DR: For BlueKit, Supabase Auth is likely sufficient.** BetterAuth would add complexity without clear benefit given our architecture.

BetterAuth is a self-hosted, framework-agnostic authentication library that gives you full control over auth logic and data. Supabase Auth is a managed service tightly integrated with Supabase's database, RLS, and real-time features.

**When BetterAuth makes sense:**
- You want to use a different database (not Supabase)
- You need features Supabase doesn't have (native passkeys, complex org hierarchies)
- You want to avoid per-MAU pricing at scale
- You're building a multi-tenant SaaS with complex auth requirements

**When Supabase Auth makes sense (BlueKit's case):**
- You're already using Supabase for database/storage/real-time
- You want tight RLS integration for authorization
- You want managed infrastructure (no auth servers to maintain)
- Your auth requirements are standard (OAuth, email/password, magic links)

---

## What is BetterAuth?

[BetterAuth](https://www.better-auth.com/) is an open-source authentication framework for TypeScript that runs in your application code, not as a separate service.

### Key Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│                      BetterAuth Model                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your App                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │   Frontend ←→ BetterAuth (in your backend) ←→ DB   │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  • Auth logic lives in YOUR code                            │
│  • Users stored in YOUR database                            │
│  • No external auth service to call                         │
│  • Full control over every auth flow                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Notable Features

- **Native Passkey Support**: Built-in, not via third-party integration
- **Plugin Architecture**: 2FA, organizations, anonymous auth, etc. as plugins
- **Multi-Tenancy**: Organizations, teams, roles, invitations
- **Framework Agnostic**: Works with Next.js, Nuxt, Astro, SvelteKit, etc.
- **Self-Hosted**: No per-user pricing, runs on your infrastructure
- **CLI Schema Generation**: Auto-generates database tables

### Recent News (September 2025)

The Auth.js (formerly NextAuth.js) team joined BetterAuth. Auth.js will receive security patches but BetterAuth is now recommended for new projects. This makes BetterAuth the de-facto standard for self-hosted TypeScript auth.

---

## What is Supabase Auth?

[Supabase Auth](https://supabase.com/auth) is a managed authentication service integrated with Supabase's platform.

### Key Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Auth Model                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your App                     Supabase                       │
│  ┌──────────┐                ┌──────────────────────────┐  │
│  │          │   ←──────→     │  Auth Service            │  │
│  │ Frontend │                │       ↓                  │  │
│  │          │                │  Database (auth.users)   │  │
│  └──────────┘                │       ↓                  │  │
│                              │  RLS Policies            │  │
│                              │       ↓                  │  │
│                              │  Your Tables             │  │
│                              └──────────────────────────┘  │
│                                                              │
│  • Auth managed by Supabase                                 │
│  • Users in auth.users schema                               │
│  • RLS uses auth.uid() automatically                        │
│  • Real-time subscriptions respect RLS                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Notable Features

- **RLS Integration**: `auth.uid()` in policies, automatic enforcement
- **Social Providers**: Google, GitHub, Apple, etc. with minimal config
- **Magic Links & OTP**: Built-in passwordless options
- **SSO/SAML**: Enterprise SSO support (paid plans)
- **Managed Infrastructure**: No auth servers to deploy/maintain
- **Real-time Aware**: Subscriptions automatically respect auth

### Limitations

- **No Native Passkeys**: Requires third-party (Corbado) integration
- **Tied to Supabase**: Can't use with other databases
- **Less Customizable**: Standard flows, limited deep customization
- **MAU-Based Pricing**: Can get expensive at scale

---

## Feature Comparison

| Feature | BetterAuth | Supabase Auth |
|---------|------------|---------------|
| **Email/Password** | ✅ | ✅ |
| **Social OAuth** | ✅ | ✅ |
| **Magic Links** | ✅ | ✅ |
| **OTP/SMS** | ✅ (plugin) | ✅ |
| **Passkeys** | ✅ Native | ⚠️ Third-party |
| **2FA/MFA** | ✅ (plugin) | ✅ |
| **Organizations/Teams** | ✅ (plugin) | ⚠️ Manual |
| **Enterprise SSO** | ✅ | ✅ (paid) |
| **Anonymous Auth** | ✅ (plugin) | ✅ |
| **RLS Integration** | ❌ Manual | ✅ Native |
| **Real-time Auth** | ❌ Manual | ✅ Native |
| **Self-Hosted** | ✅ Required | ❌ Managed only |
| **Compliance Certs** | ❌ | ✅ SOC2, HIPAA |

---

## When to Choose BetterAuth

### 1. You're Not Using Supabase

If your database is Postgres (self-hosted), PlanetScale, Neon, or anything else, BetterAuth gives you full auth without Supabase.

```typescript
// BetterAuth works with any database
import { betterAuth } from "better-auth";
import { prisma } from "./prisma"; // or drizzle, etc.

export const auth = betterAuth({
  database: prisma,
  // ...
});
```

### 2. You Need Native Passkeys

Supabase requires third-party integration (Corbado) for passkeys. BetterAuth has them built-in.

```typescript
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  plugins: [
    passkey(),
  ],
});
```

### 3. Complex Multi-Tenancy

BetterAuth's organization plugin is more flexible than manually implementing teams in Supabase.

```typescript
import { organization } from "@better-auth/organization";

export const auth = betterAuth({
  plugins: [
    organization({
      roles: ["owner", "admin", "member", "viewer"],
      invitations: true,
      teams: true,
    }),
  ],
});
```

### 4. Predictable Costs at Scale

Supabase Auth pricing scales with MAU. BetterAuth is free (you pay for infrastructure).

| MAU | Supabase Pro | BetterAuth (self-hosted) |
|-----|--------------|--------------------------|
| 50K | $25/mo base + overages | ~$20-50/mo (server) |
| 500K | $$$$ | ~$50-100/mo (server) |
| 5M | $$$$$ | ~$100-200/mo (server) |

### 5. Full Control Over Auth Flows

Need custom flows like:
- Multi-step registration with verification
- Custom password policies per organization
- Complex session management (per-device limits)
- Custom token formats

BetterAuth lets you implement these directly.

---

## When to Choose Supabase Auth (BlueKit's Case)

### 1. Already Using Supabase Ecosystem

BlueKit plans to use:
- Supabase Database (synced projects, tasks, checkpoints)
- Supabase Real-time (collaboration presence)
- Supabase Storage (library files)

Adding a separate auth system creates:
- Two user tables to sync
- Manual RLS integration
- Extra infrastructure to maintain

### 2. RLS is Critical

Our multi-provider-auth-strategy.md outlines Row Level Security for project collaboration:

```sql
-- This "just works" with Supabase Auth
CREATE POLICY "Users can view their projects' tasks"
  ON project_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = auth.uid()  -- Automatic!
      AND pm.project_id = ANY(project_tasks.project_ids)
    )
  );
```

With BetterAuth, you'd need to:
1. Sync users to Supabase
2. Pass user ID through service role
3. Or bypass RLS entirely (security risk)

### 3. Real-time Needs Auth Context

Supabase Real-time respects RLS automatically. With BetterAuth:

```typescript
// Supabase Auth: Automatic
const channel = supabase.channel('workspace:123');
// Only receives events user has access to (via RLS)

// BetterAuth: Manual
// Need to implement channel authorization yourself
```

### 4. Managed Infrastructure

BlueKit is a desktop app, not a web SaaS. We don't want to:
- Deploy auth servers
- Handle auth server scaling
- Manage auth server updates

Supabase handles all this.

### 5. Standard Auth Needs

BlueKit's auth requirements (from multi-provider-auth-strategy.md):
- Google OAuth ✅ Supabase has it
- GitHub OAuth ✅ Supabase has it
- Email/Password ✅ Supabase has it
- Magic Links ✅ Supabase has it
- Enterprise SSO ✅ Supabase has it (paid)

We don't need:
- Native passkeys (nice-to-have, not critical)
- Complex org hierarchies (simple project members suffice)
- Custom token formats

---

## Hybrid Approach: BetterAuth + Supabase Database

Some teams use BetterAuth for auth while using Supabase only as a database. This gives:
- Full auth control
- Supabase's excellent Postgres hosting
- Ability to use RLS (with manual user sync)

```typescript
// Possible but adds complexity
import { betterAuth } from "better-auth";
import { supabase } from "./supabase";

export const auth = betterAuth({
  database: {
    // Use Supabase as just a Postgres database
    type: "postgres",
    connectionString: process.env.SUPABASE_DB_URL,
  },
});

// Then sync users to a table that RLS can reference
auth.on("session:created", async (session) => {
  await supabase.from("synced_users").upsert({
    id: session.user.id,
    email: session.user.email,
  });
});
```

**For BlueKit, this adds complexity without clear benefit.**

---

## Decision Matrix

| Factor | Weight | Supabase Auth | BetterAuth |
|--------|--------|---------------|------------|
| RLS Integration | High | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Real-time Integration | High | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Managed Infrastructure | High | ⭐⭐⭐⭐⭐ | ⭐ |
| Standard OAuth | High | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Passkeys | Low | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Multi-Tenancy | Medium | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cost at Scale | Medium | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Customization | Low | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Weighted Score** | | **Higher** | Lower |

---

## Recommendation for BlueKit

**Use Supabase Auth.** Here's why:

### 1. Ecosystem Lock-In is Actually Good Here

We're building on Supabase for database, real-time, and storage. Auth is the glue that ties these together. Using a different auth system means:
- Dual user management
- Manual RLS wiring
- Lost real-time auth features

### 2. Our Needs Are Standard

Looking at multi-provider-auth-strategy.md, we need:
- Multiple OAuth providers ✅
- Email/password ✅
- Feature gating by integration ✅ (we handle this in app code)
- Enterprise SSO ✅ (Supabase supports)

### 3. Complexity Budget

BlueKit already has complexity:
- Desktop app (Tauri) + Web (future)
- Local SQLite + Cloud Supabase sync
- File-based kits + Database metadata
- GitHub integration as linked account

Adding BetterAuth means:
- Another auth system to understand
- Auth server deployment (or Cloudflare Workers)
- User sync between systems
- Custom RLS integration

### 4. When to Reconsider

BetterAuth becomes worth it if:
- Supabase Auth pricing becomes prohibitive (millions of MAU)
- We need native passkeys and Supabase doesn't add them
- We need complex org features that Supabase can't support
- We want to move away from Supabase entirely

---

## Appendix: If We Did Use BetterAuth

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            BetterAuth + Supabase Architecture                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Desktop App (Tauri)                                         │
│       │                                                      │
│       ▼                                                      │
│  Auth API (Cloudflare Worker or Vercel Edge)                │
│  ┌─────────────────────────────────────────┐               │
│  │  BetterAuth                              │               │
│  │  - Handles OAuth flows                   │               │
│  │  - Issues sessions/tokens                │               │
│  │  - Stores users in Supabase             │               │
│  └─────────────────────────────────────────┘               │
│       │                                                      │
│       ▼                                                      │
│  Supabase (Database only)                                   │
│  ┌─────────────────────────────────────────┐               │
│  │  • better_auth_users (auth schema)       │               │
│  │  • synced_projects                       │               │
│  │  • project_members (uses BA user IDs)   │               │
│  │  • RLS with custom auth check           │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### RLS with BetterAuth

```sql
-- Create a function to validate BetterAuth tokens
CREATE OR REPLACE FUNCTION get_better_auth_user_id()
RETURNS UUID AS $$
BEGIN
  -- Extract user ID from custom JWT or session
  RETURN (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Use in RLS policies
CREATE POLICY "Users can view their projects"
  ON synced_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = get_better_auth_user_id()
      AND pm.project_id = synced_projects.id
    )
  );
```

### Additional Infrastructure

- **Auth API**: Cloudflare Worker, Vercel Edge, or dedicated server
- **Session Storage**: Redis or database-backed sessions
- **Token Refresh**: Implement refresh token rotation
- **Monitoring**: Auth-specific monitoring/alerting

---

## Sources

- [BetterAuth Official Site](https://www.better-auth.com/)
- [BetterAuth Introduction Docs](https://www.better-auth.com/docs/introduction)
- [BetterAuth GitHub](https://github.com/better-auth/better-auth)
- [BetterAuth Comparison Page](https://www.better-auth.com/docs/comparison)
- [Supabase Auth vs Better Auth Comparison](https://www.auth0alternatives.com/compare/supabase-auth/vs/better-auth)
- [Migrating from Supabase Auth to Better Auth](https://www.better-auth.com/docs/guides/supabase-migration-guide)
- [SSOJet Comparison](https://ssojet.com/ciam-vendors/comparison/betterauth-vs-supabase_auth/)
- [LogRocket: Is Better Auth the key to solving authentication headaches?](https://blog.logrocket.com/better-auth-authentication/)
- [Top 3 Best Authentication Frameworks for 2025](https://dev.to/martygo/top-3-best-authentication-frameworks-for-2025-51ej)
