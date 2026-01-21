---
id: supabase-setup-runbook
alias: Supabase Setup Runbook
type: walkthrough
is_base: false
version: 1
tags:
  - supabase
  - authentication
  - backend
description: Comprehensive runbook for Supabase project setup, authentication configuration, database management, and workflow optimization
complexity: comprehensive
format: guide
---
# Supabase Setup Runbook

A comprehensive guide to setting up, configuring, and optimizing Supabase for your application.

---

## Table of Contents

1. [Project Creation & Initial Setup](#1-project-creation--initial-setup)
2. [Authentication Configuration](#2-authentication-configuration)
3. [Database Schema & RLS](#3-database-schema--rls)
4. [Environment Configuration](#4-environment-configuration)
5. [Dashboard Exploration](#5-dashboard-exploration)
6. [Common Operations](#6-common-operations)
7. [Optimization & Best Practices](#7-optimization--best-practices)
8. [Troubleshooting](#8-troubleshooting)
9. [Security Checklist](#9-security-checklist)

---

## 1. Project Creation & Initial Setup

### 1.1 Create a New Project

```
Supabase Dashboard → New Project
```

| Field | Recommendation |
|-------|----------------|
| Name | Use your app name (e.g., `bluekit-prod`) |
| Database Password | Generate strong password, save in password manager |
| Region | Choose closest to your users |
| Pricing Plan | Free tier works for development |

> **Tip:** Create separate projects for `dev`, `staging`, and `prod` environments.

### 1.2 Wait for Provisioning

- Takes 1-2 minutes
- Project status changes from "Setting up" to "Active"
- All services (Auth, Database, Storage, Edge Functions) initialize

### 1.3 Get Your Credentials

Navigate to **Settings → API**:

| Credential | Location | Usage |
|------------|----------|-------|
| Project URL | `https://xxxxx.supabase.co` | Client initialization |
| anon/public key | Starts with `eyJ...` | Client-side API calls |
| service_role key | Starts with `eyJ...` | Server-side only (NEVER expose) |

```typescript
// Safe to expose (client-side)
const supabaseUrl = 'https://xxxxx.supabase.co';
const supabaseAnonKey = 'eyJ...';

// NEVER expose (server-side only)
const serviceRoleKey = 'eyJ...'; // Has full database access, bypasses RLS
```

---

## 2. Authentication Configuration

### 2.1 Enable Auth Providers

Navigate to **Authentication → Providers**

#### Email (Magic Links) - Easiest Setup

```
1. Toggle "Email" to enabled
2. Configure options:
   - Confirm email: ON (recommended for production)
   - Secure email change: ON
   - Double confirm email changes: ON (optional)
```

**Email Templates** (Authentication → Email Templates):
- Customize confirmation, magic link, and password reset emails
- Use `{{ .ConfirmationURL }}` for the magic link

#### Google OAuth

```
1. Enable Google provider in Supabase
2. Go to Google Cloud Console:
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URI: https://YOUR-PROJECT.supabase.co/auth/v1/callback
3. Copy Client ID and Secret to Supabase
```

#### GitHub OAuth

```
1. Enable GitHub provider in Supabase
2. Go to GitHub → Settings → Developer Settings → OAuth Apps → New
   - Homepage URL: http://localhost:1420 (or your domain)
   - Authorization callback: https://YOUR-PROJECT.supabase.co/auth/v1/callback
3. Copy Client ID and Secret to Supabase
```

### 2.2 Configure Redirect URLs

Navigate to **Authentication → URL Configuration**

```
Site URL:
  http://localhost:1420

Redirect URLs:
  http://localhost:1420
  http://localhost:1420/**
  https://yourdomain.com
  https://yourdomain.com/**
  your-app://auth/callback  (for mobile/desktop deep links)
```

### 2.3 Auth Settings

Navigate to **Authentication → Settings**

| Setting | Development | Production |
|---------|-------------|------------|
| Site URL | `http://localhost:1420` | `https://yourdomain.com` |
| JWT expiry | 3600 (1 hour) | 3600 |
| Enable signup | ON | ON (or OFF for invite-only) |
| Enable email confirmations | OFF | ON |

---

## 3. Database Schema & RLS

### 3.1 Access SQL Editor

Navigate to **SQL Editor → New query**

### 3.2 Create Tables with RLS

```sql
-- ============================================
-- USER MANAGEMENT TABLES
-- ============================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- External integrations (GitHub, etc.)
CREATE TABLE IF NOT EXISTS user_integrations (
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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User integrations policies
CREATE POLICY "Users can manage own integrations"
  ON user_integrations FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 3.3 Verify RLS is Enabled

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE schemaname = 'public';
```

In Table Editor: Click table → Click **"RLS policy"** button in toolbar

---

## 4. Environment Configuration

### 4.1 Local Development (.env)

```bash
# .env (add to .gitignore!)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.2 Environment-Specific Configs

```bash
# .env.development
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...dev...

# .env.production
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...prod...
```

### 4.3 Supabase Client Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

---

## 5. Dashboard Exploration

### 5.1 Table Editor

**Location:** Left sidebar → Table Editor

| Feature | Usage |
|---------|-------|
| View/Edit rows | Click table → Edit cells inline |
| Filter data | Click "Filter" → Add conditions |
| Sort data | Click "Sort" → Add sort rules |
| Insert row | Click "Insert" → "Insert row" |
| Import CSV | Click "Insert" → "Import data from CSV" |
| Export | Not directly available, use SQL |

**Pro Tips:**
- Use filters to debug RLS policies (switch user context)
- Right-click column header for quick actions

### 5.2 SQL Editor

**Location:** Left sidebar → SQL Editor

| Feature | How to Use |
|---------|------------|
| Save queries | Click "Save" → Name your query |
| Run selection | Highlight code → Cmd/Ctrl+Enter |
| Query history | Click clock icon |
| Keyboard shortcuts | Cmd/Ctrl+Enter to run |

**Useful Queries:**

```sql
-- View all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- View table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'your_table';

-- View RLS policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Check table sizes
SELECT 
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### 5.3 Authentication Dashboard

**Location:** Left sidebar → Authentication

| Tab | Purpose |
|-----|---------|
| Users | View/manage all users, create test users |
| Providers | Enable/configure OAuth providers |
| Policies | JWT settings, email confirmations |
| Email Templates | Customize auth emails |
| URL Configuration | Redirect URLs, site URL |
| Hooks | Auth event webhooks (Pro feature) |

**User Management:**
- Click user → View metadata, auth providers used
- "Ban user" → Temporarily disable account
- "Delete user" → Permanent removal (cascades to related data)

### 5.4 Database Settings

**Location:** Settings → Database

| Feature | Purpose |
|---------|---------|
| Connection string | Direct database access (psql, pgAdmin) |
| Connection pooling | Supavisor settings for high traffic |
| SSL enforcement | Require SSL for connections |
| Network restrictions | IP allowlist (Pro feature) |

### 5.5 API Documentation

**Location:** Left sidebar → API Docs

- Auto-generated docs for your tables
- Copy-paste code snippets (JavaScript, cURL)
- Test API calls directly

### 5.6 Logs & Monitoring

**Location:** Left sidebar → Logs

| Log Type | What It Shows |
|----------|--------------|
| Postgres | Database queries, errors |
| Auth | Login attempts, token refreshes |
| Storage | File uploads/downloads |
| Realtime | WebSocket connections |
| Edge Functions | Function executions |

**Filtering:**
```
-- Filter by severity
severity:error

-- Filter by time
timestamp:[2024-01-01 TO 2024-01-02]

-- Filter by event
event_message:~"failed"
```

---

## 6. Common Operations

### 6.1 User Management via SQL

```sql
-- List all users with profiles
SELECT 
  au.id,
  au.email,
  au.created_at,
  up.display_name,
  up.username
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id;

-- Find user by email
SELECT * FROM auth.users WHERE email = 'user@example.com';

-- Delete user (cascades to related data)
DELETE FROM auth.users WHERE id = 'user-uuid-here';
```

### 6.2 Debug RLS Policies

```sql
-- Test policy as specific user
SET request.jwt.claims = '{"sub": "user-uuid-here"}';
SELECT * FROM user_profiles;
RESET request.jwt.claims;

-- View all policies on a table
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- Temporarily disable RLS (DANGEROUS - dev only)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
-- Re-enable after debugging
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

### 6.3 Backup & Restore

**Daily Backups:** Automatic on Pro plan

**Manual Export:**
```sql
-- Export table to CSV (run in psql, not SQL Editor)
\copy user_profiles TO '/path/to/backup.csv' CSV HEADER;
```

**Point-in-Time Recovery:** Settings → Database → PITR (Pro feature)

### 6.4 Database Migrations

Store migrations in your codebase:

```
supabase/
  migrations/
    20240101000000_create_user_profiles.sql
    20240102000000_add_username_column.sql
```

```sql
-- 20240102000000_add_username_column.sql
ALTER TABLE user_profiles ADD COLUMN username TEXT UNIQUE;
```

Use Supabase CLI for local development:
```bash
supabase init
supabase db push  # Apply migrations
supabase db pull  # Pull remote schema
```

---

## 7. Optimization & Best Practices

### 7.1 Indexing

```sql
-- Add index for frequently queried columns
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Partial index for active users only
CREATE INDEX idx_active_users ON user_profiles(id) 
WHERE deleted_at IS NULL;

-- Check existing indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'user_profiles';
```

### 7.2 Query Optimization

```sql
-- Use EXPLAIN ANALYZE to debug slow queries
EXPLAIN ANALYZE 
SELECT * FROM user_profiles WHERE username = 'john';

-- Add missing indexes based on EXPLAIN output
-- Look for "Seq Scan" (bad) vs "Index Scan" (good)
```

### 7.3 Connection Pooling

For high-traffic apps, use Supavisor (Settings → Database → Connection Pooling):

```typescript
// Use pooler URL for serverless/edge functions
const supabase = createClient(
  'https://xxxxx.supabase.co',
  'eyJ...',
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-connection-pool': 'true' },
    },
  }
);
```

### 7.4 RLS Performance Tips

```sql
-- BAD: Function call in every row check
CREATE POLICY "slow" ON items
  USING (owner_id = get_current_user_id());

-- GOOD: Direct comparison with auth.uid()
CREATE POLICY "fast" ON items
  USING (owner_id = auth.uid());

-- GOOD: Use security definer functions for complex logic
CREATE FUNCTION is_team_member(team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = $1 AND user_id = auth.uid()
  );
END;
$$;
```

### 7.5 Realtime Optimization

```typescript
// Subscribe only to what you need
const channel = supabase
  .channel('changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',  // Be specific: INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'messages',
      filter: 'room_id=eq.123',  // Filter at database level
    },
    (payload) => console.log(payload)
  )
  .subscribe();

// Always unsubscribe when done
channel.unsubscribe();
```

### 7.6 Storage Best Practices

```typescript
// Use signed URLs for private files
const { data } = await supabase.storage
  .from('avatars')
  .createSignedUrl('user123/avatar.png', 3600); // 1 hour expiry

// Resize images on upload (use Edge Functions)
// Set up storage policies similar to RLS
```

---

## 8. Troubleshooting

### 8.1 Authentication Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid API key" | Wrong key used | Check anon key, not service_role |
| "Email not confirmed" | Confirmation required | Check email or disable in dev |
| "Redirect URI mismatch" | OAuth misconfigured | Verify callback URL matches exactly |
| "User already registered" | Duplicate signup | Use signInWithOtp or reset password |

### 8.2 RLS Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Empty results | RLS blocking | Check policy, verify auth.uid() |
| "permission denied" | No matching policy | Add appropriate policy |
| Can't insert | INSERT policy missing | Add WITH CHECK policy |
| Slow queries | Complex RLS | Simplify policy, add indexes |

**Debug Checklist:**
1. Is RLS enabled? `SELECT rowsecurity FROM pg_tables WHERE tablename = 'x'`
2. Are policies created? `SELECT * FROM pg_policies WHERE tablename = 'x'`
3. Is user authenticated? `SELECT auth.uid()` should return UUID
4. Does policy logic match? Test with direct SQL

### 8.3 Connection Issues

```bash
# Test connection with psql
psql "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Check Supabase status
curl https://xxxxx.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
```

### 8.4 Performance Issues

```sql
-- Find slow queries
SELECT 
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table bloat
SELECT 
  relname,
  n_dead_tup,
  n_live_tup,
  round(n_dead_tup * 100.0 / nullif(n_live_tup, 0), 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 0;

-- Vacuum if needed (usually automatic)
VACUUM ANALYZE user_profiles;
```

---

## 9. Security Checklist

### Pre-Production Checklist

- [ ] **RLS enabled** on all public tables
- [ ] **Policies tested** with different user contexts
- [ ] **Service role key** not exposed in client code
- [ ] **Email confirmations** enabled in production
- [ ] **Redirect URLs** restricted to your domains only
- [ ] **Database password** is strong and stored securely
- [ ] **SSL enforced** for database connections
- [ ] **API rate limiting** configured (Pro feature)
- [ ] **Backups enabled** and tested

### Security Best Practices

```sql
-- Never store sensitive data unencrypted
-- Use pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash sensitive lookup fields
CREATE INDEX idx_email_hash ON users(digest(email, 'sha256'));

-- Audit logging for sensitive operations
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Quick Reference

### Useful Links

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase GitHub](https://github.com/supabase/supabase)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

### CLI Commands

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref xxxxx

# Pull remote schema
supabase db pull

# Push local migrations
supabase db push

# Generate TypeScript types
supabase gen types typescript --project-id xxxxx > src/types/supabase.ts

# Start local development
supabase start
supabase stop
```

### Keyboard Shortcuts (SQL Editor)

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + Enter | Run query |
| Cmd/Ctrl + S | Save query |
| Cmd/Ctrl + / | Toggle comment |
| Cmd/Ctrl + D | Duplicate line |
