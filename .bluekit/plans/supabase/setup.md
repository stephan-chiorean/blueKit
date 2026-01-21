# Supabase Setup Guide

**Purpose:** Configure Supabase for BlueKit authentication (Phase 2)

---

## Step 1: Get Your Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your BlueKit project
3. Navigate to **Settings** → **API**
4. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

---

## Step 2: Add Environment Variables

Create or update `.env` in your project root:

```bash
# .env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Security Note:** The anon key is safe to expose in client-side code. It only allows access based on Row Level Security (RLS) policies.

---

## Step 3: Configure Auth Providers

In Supabase Dashboard → **Authentication** → **Providers**:

### Google OAuth

1. Enable Google provider
2. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret to Supabase

### GitHub OAuth

1. Enable GitHub provider
2. Go to [GitHub Developer Settings](https://github.com/settings/developers)
3. Create a **new** OAuth App (separate from existing BlueKit app)
   - Homepage URL: `http://localhost:1420` (or your domain)
   - Callback URL: `https://your-project-id.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

### Email (Magic Link)

1. Enable Email provider
2. Optionally customize email templates in **Authentication** → **Email Templates**

---

## Step 4: Configure Redirect URLs

In Supabase Dashboard → **Authentication** → **URL Configuration**:

**Site URL:**
```
http://localhost:1420
```

**Redirect URLs (add all):**
```
http://localhost:1420
http://localhost:1420/**
bluekit://auth/callback
```

> The `bluekit://` scheme is for Tauri deep links (future enhancement).

---

## Step 5: Run Database Schema

In Supabase Dashboard → **SQL Editor** → **New query**

Copy and run this schema:

```sql
-- ============================================
-- BLUEKIT USER SCHEMA
-- Run this in Supabase SQL Editor
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

-- GitHub integration tokens (for Timeline, not identity)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'github'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  provider_user_id TEXT,
  provider_username TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own integrations"
  ON user_integrations FOR ALL
  USING (auth.uid() = user_id);

-- Trigger: Auto-create profile on signup
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

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Verify setup
SELECT 'Schema created successfully!' as status;
```

After running, you should see:
- `user_profiles` table in **Table Editor**
- `user_integrations` table in **Table Editor**
- RLS policies enabled (lock icon on tables)

---

## Step 6: Verify Setup

### Test the configuration:

1. **Check tables exist:**
   - Go to **Table Editor**
   - You should see `user_profiles` and `user_integrations`

2. **Check RLS is enabled:**
   - Click on a table, then click **"RLS policy"** button in the toolbar
   - You should see your policies listed (e.g., "Users can view own profile")

3. **Test auth provider:**
   - Go to **Authentication** → **Users**
   - Click "Add user" → "Create new user" to test email signup
   - Or proceed to Phase 2 implementation to test OAuth

---

## Checklist

Before proceeding to Phase 2 implementation:

- [ ] `.env` file has `VITE_SUPABASE_URL`
- [ ] `.env` file has `VITE_SUPABASE_ANON_KEY`
- [ ] Google OAuth configured (optional but recommended)
- [ ] GitHub OAuth configured (optional but recommended)
- [ ] Email auth enabled
- [ ] Database schema executed
- [ ] `user_profiles` table exists with RLS
- [ ] `user_integrations` table exists with RLS

---

## Troubleshooting

### "Invalid API key"
- Double-check you copied the **anon** key, not the service_role key
- Ensure no extra whitespace in `.env`

### "Redirect URI mismatch" (OAuth)
- Verify callback URL in provider settings matches exactly:
  `https://your-project-id.supabase.co/auth/v1/callback`

### "RLS policy violation"
- User is trying to access data they don't own
- Check `auth.uid()` matches the row's user_id

### Tables not appearing
- Refresh the Table Editor
- Check SQL Editor for any error messages

---

## Next Steps

Once setup is complete, run Phase 2 implementation:
```
implement @.bluekit/plans/supabase/auth-phase2.md
```
