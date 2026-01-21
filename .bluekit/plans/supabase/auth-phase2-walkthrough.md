# Phase 2: Supabase Auth Migration - Walkthrough

**Completed:** 2026-01-21

## Summary

Implemented Supabase Auth as the identity provider for BlueKit, supporting multi-provider authentication (Google, GitHub, Email magic link). 

**Major Update (Jan 21, 2026):** Completed the migration of GitHub integration tokens from system Keychain to Supabase `user_integrations` table. The backend is now stateless regarding GitHub tokens, accepting them explicitly from the frontend. Legacy Keychain code has been fully removed.

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/contexts/SupabaseAuthContext.tsx` | Auth provider with multi-provider support |
| `src/components/auth/AuthScreen.tsx` | Sign-in UI with Google/GitHub/Email |
| `src/components/shared/UserProfileButton.tsx` | User profile menu with integration status |
| `src/vite-env.d.ts` | Vite environment type definitions |
| `.bluekit/plans/supabase/schema.sql` | Database schema for Supabase |

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Wrapped with `SupabaseAuthProvider` as outermost provider |
| `src/components/Header.tsx` | Replaced `GitHubConnectionButton` with `UserProfileButton` |
| `package.json` | Added `@supabase/supabase-js` dependency |
| `src/ipc/github.ts` | Updated to accept `accessToken` argument |
| `src/ipc/index.ts` | Removed keychain exports |
| `src-tauri/src/commands.rs` | Updated commands to accept `access_token` |
| `src-tauri/src/integrations/github/auth.rs` | Removed keychain dependency |
| `src-tauri/src/integrations/github/github.rs` | Removed `from_keychain`, added `new(token)` |
| `src-tauri/src/integrations/github/mod.rs` | Removed keychain module export |

## Files Deleted

| File | Reason |
|------|--------|
| `src/ipc/keychain.ts` | Replaced by Supabase `user_integrations` |
| `src-tauri/src/integrations/github/keychain.rs` | Replaced by Supabase `user_integrations` |

## Architecture

```
SupabaseAuthProvider (identity)
  └── GitHubIntegrationProvider (optional integration)
        └── ... rest of app
```

**Key Design Decisions:**
- Supabase handles all identity/authentication
- GitHub is now an optional integration, not required for sign-in
- **Token Storage**: GitHub tokens are stored in Supabase `user_integrations` table via RLS.
- **Token Usage**: Frontend (`GitHubIntegrationContext`) retrieves token and passes it explicitly to Rust backend.
- **Backend Statelessness**: Backend no longer accesses system Keychain.
- `UserProfileButton` shows both auth status and GitHub integration status

## Supabase Dashboard Setup Required

1. **Create Project** at https://supabase.com/dashboard

2. **Configure Auth Providers:**
   - Google: Add OAuth 2.0 credentials from Google Cloud Console
   - GitHub: Create a NEW OAuth app (separate from existing BlueKit OAuth app)
   - Email: Enable magic links

3. **Set Redirect URLs:**
   - Development: `http://localhost:1420`
   - Production: Your production URL and/or Tauri deep link

4. **Run Schema SQL:**
   - Go to SQL Editor in Supabase Dashboard
   - Run `.bluekit/plans/supabase/schema.sql`

5. **Verify Environment Variables:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Verification Checklist

- [x] Supabase client created
- [x] SupabaseAuthContext with multi-provider support
- [x] AuthScreen UI component
- [x] UserProfileButton for header
- [x] App wrapped with SupabaseAuthProvider
- [x] Header updated to use UserProfileButton
- [x] Dev server runs without errors
- [ ] Test Google sign-in (requires Supabase setup)
- [ ] Test GitHub sign-in (requires Supabase setup)
- [ ] Test email magic link
- [ ] Verify session persistence
- [ ] Verify sign-out works

## Future Work

- **Phase 3 (Vault Sync):** Add vault sync tables
- **Phase 4 (Collaboration):** Add project_members table
- **Library Revamp:** Update Library components to use new auth flow (currently stubbed)
- Delete legacy React auth files (if not already done):
  - `src/auth/github/GitHubAuthProvider.tsx`
  - `src/auth/github/GitHubAuthScreen.tsx`
