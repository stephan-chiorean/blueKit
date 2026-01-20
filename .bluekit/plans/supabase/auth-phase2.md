# Phase 2: Supabase Auth Migration

**Status:** Planned (after Phase 1)
**Goal:** Add Supabase Auth as the identity provider (multi-provider)
**Prerequisite:** Phase 1 complete (GitHub OAuth refactored to integration)

---

## Current State → Target State

```
CURRENT                              TARGET
───────                              ──────
GitHubAuthProvider (identity)   →    SupabaseAuthProvider (identity)
Keychain storage               →    Supabase session (localStorage)
GitHub-only sign-in            →    Google / GitHub / Email options

GitHubAuthProvider             →    GitHubIntegrationContext (optional)
  (demoted to integration for Timeline features)
```

---

## Implementation Steps

### Step 1: Setup

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Add environment variables to .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 2: Create Supabase Client

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

### Step 3: Create SupabaseAuthContext

```typescript
// src/contexts/SupabaseAuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface SupabaseAuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
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
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithEmail = async (email: string) => {
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session,
        signInWithGoogle,
        signInWithGitHub,
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
}
```

### Step 4: Create Auth Screen

```typescript
// src/components/auth/AuthScreen.tsx
import { useState } from 'react';
import { VStack, Button, Input, Text, Divider } from '@chakra-ui/react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

export function AuthScreen() {
  const { signInWithGoogle, signInWithGitHub, signInWithEmail } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleEmailSignIn = async () => {
    await signInWithEmail(email);
    setEmailSent(true);
  };

  return (
    <VStack gap={4} p={8} maxW="400px" mx="auto">
      <Text fontSize="2xl" fontWeight="bold">Sign in to BlueKit</Text>

      <Button w="100%" onClick={signInWithGoogle}>
        Continue with Google
      </Button>

      <Button w="100%" onClick={signInWithGitHub}>
        Continue with GitHub
      </Button>

      <Divider />

      {emailSent ? (
        <Text>Check your email for a magic link!</Text>
      ) : (
        <>
          <Input
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button w="100%" onClick={handleEmailSignIn}>
            Continue with Email
          </Button>
        </>
      )}
    </VStack>
  );
}
```

### Step 5: Update App.tsx

```typescript
// src/App.tsx - Update provider hierarchy
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';

function App() {
  return (
    <SupabaseAuthProvider>
      {/* ... rest of app */}
    </SupabaseAuthProvider>
  );
}
```

### Step 6: Create GitHubIntegrationContext (Optional)

For Timeline features that need GitHub API access:

```typescript
// src/contexts/GitHubIntegrationContext.tsx
// Only load when user navigates to Timeline
// Stores token in Supabase user_integrations table
// Provides: isConnected, connectGitHub, disconnectGitHub
```

---

## Database Schema

```sql
-- Run in Supabase SQL Editor

-- User profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GitHub integration tokens (for Timeline, not identity)
CREATE TABLE user_integrations (
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

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own integrations"
  ON user_integrations FOR ALL USING (auth.uid() = user_id);

-- Trigger: Create profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Supabase Dashboard Setup

1. **Create Project** at https://supabase.com/dashboard

2. **Configure Auth Providers:**
   - Google: Add OAuth credentials from Google Cloud Console
   - GitHub: Add OAuth app (separate from your existing BlueKit OAuth app)
   - Email: Enable magic links

3. **Set Redirect URLs:**
   - `http://localhost:1420` (dev)
   - `bluekit://` (Tauri deep link, if using)

4. **Run SQL Schema** in SQL Editor

5. **Get Credentials:**
   - Project URL: Settings → API → Project URL
   - Anon Key: Settings → API → anon/public key

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client |
| `src/contexts/SupabaseAuthContext.tsx` | Auth provider |
| `src/components/auth/AuthScreen.tsx` | Sign-in UI |
| `src/contexts/GitHubIntegrationContext.tsx` | GitHub API integration (optional) |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Wrap in `SupabaseAuthProvider` |
| `src/components/Header.tsx` | Use `useSupabaseAuth` instead of `useGitHubAuth` |
| `src/components/shared/SignInPopover.tsx` | Update to use new auth |

## Files to Deprecate (Later)

| File | Reason |
|------|--------|
| `src/auth/github/GitHubAuthProvider.tsx` | Replaced by Supabase |
| `src/auth/github/GitHubAuthScreen.tsx` | Replaced by AuthScreen |
| `src/ipc/keychain.ts` | No longer needed |
| `src-tauri/src/integrations/github/keychain.rs` | No longer needed |

---

## Verification Checklist

- [ ] Can sign in with Google
- [ ] Can sign in with GitHub
- [ ] Can sign in with email magic link
- [ ] Session persists across app restarts
- [ ] Can sign out
- [ ] No keychain prompts appear
- [ ] User profile created in database
- [ ] (Optional) Timeline features still work with GitHub integration

---

## Extensibility for Future Phases

This schema is ready for:

**Phase 2 (Vault Sync):**
```sql
-- Add when ready
CREATE TABLE vault_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  -- ... vault content
);
```

**Phase 3 (Collaboration):**
```sql
-- Add when ready
CREATE TABLE project_members (
  user_id UUID REFERENCES auth.users(id),
  project_id UUID,
  role TEXT,
  -- ...
);
```

The foundation is in place. Just add tables as needed.
