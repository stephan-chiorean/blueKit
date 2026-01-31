---
id: supabase-foundation
alias: Supabase Foundation & Architecture
type: walkthrough
is_base: true
version: 1
tags:
  - supabase
  - authentication
  - architecture
description: Comprehensive guide to BlueKit's Supabase implementation, covering authentication, data architecture, and the GitHub integration pattern.
complexity: comprehensive
format: architecture
---
# Supabase Foundation

This document serves as the comprehensive guide ("The Bible") for Supabase implementation within BlueKit. It details the architecture, authentication flows, and integration patterns that form the backbone of our cloud connectivity.

## Core Architecture

BlueKit uses a **Hybrid Architecture**:
- **Local First**: Files and Git operations happen locally on the user's machine.
- **Cloud Enhanced**: Supabase provides identity, sync, and integration management.

### The Client Singleton
The Supabase client is initialized as a singleton in `src/lib/supabase.ts`. This ensures a single connection state across the application.
- **Env Variables**: Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Usage**: Import `supabase` from `@/lib/supabase` for raw access, but prefer Context hooks.

## Authentication System

We use **Supabase Auth** as the source of truth for user identity.

### Desktop OAuth Flow
Since BlueKit is a Tauri desktop app, standard web OAuth redirects don't work out of the box. We implement a PKCE flow with a local loopback server:

1.  **Initiation**: User clicks "Sign in with Google/GitHub".
2.  **Local Server**: Tauri backend starts a temporary local HTTP server (e.g., ports 8000-8010).
3.  **Browser**: System browser opens the Supabase OAuth URL with `redirect_to` pointing to localhost.
4.  **Callback**:
    - Supabase redirects to `http://localhost:PORT/auth/callback`.
    - Local server captures the auth code/tokens.
    - Local server emits a `supabase-auth-callback` event to the frontend.
5.  **Session Establishment**: `SupabaseAuthContext` receives the tokens and calls `supabase.auth.setSession()`.

### Context & Hooks
-   **`SupabaseAuthContext`**: Manages the user session.
-   **`useSupabaseAuth()`**: Hook to access `user`, `session`, `isAuthenticated`, and auth methods.

## Integrations (GitHub)

We have migrated away from system Keychain storage for third-party tokens. Instead, we use Supabase as a secure vault for integration tokens.

### The `user_integrations` Table
This table stores access tokens for third-party services linked to a Supabase user.

**Schema Pattern:**
- `user_id`: Link to `auth.users`
- `provider`: 'github'
- `access_token`: The OAuth access token
- `refresh_token`: (Optional) for refreshing access
- `provider_user_id`: ID from the provider (e.g., GitHub User ID)

### Migration from Keychain
Legacy BlueKit used the OS Keychain. The new architecture:
1.  **Frontend Responsibility**: `GitHubIntegrationContext` handles the mechanics of connecting.
2.  **Storage**: Upon successful OAuth, tokens are upserted into `user_integrations` via RLS (Row Level Security) policies ensuring users can only manage their own tokens.
3.  **Usage**:
    - Frontend retrieves the token from Supabase context.
    - Frontend passes the token **explicitly** to Rust backend commands.
    - **Backend is stateless**: The Rust backend does not persist the token; it uses it for the duration of the request.

### Implementation Details
-   **Context**: `src/contexts/GitHubIntegrationContext.tsx`
-   **Key Hook**: `useGitHubIntegration()` provides `accessToken`.
-   **IPC Pattern**:
    ```typescript
    // Old (Backend pulls from Keychain)
    await invoke('github_get_user');

    // New (Frontend passes token)
    const { accessToken } = useGitHubIntegration();
    await invoke('github_get_user', { accessToken });
    ```

## Security Best Practices

1.  **Row Level Security (RLS)**:
    -   NEVER turn off RLS on tables containing user data.
    -   Policies must ensure `auth.uid() = user_id`.

2.  **Token Handling**:
    -   Tokens are kept in memory in the Frontend (Context).
    -   They are persisted only in Supabase (encrypted at rest by database/disk level, controlled by RLS).
    -   They are passed securely via Tauri IPC to the backend.

3.  **Backend Verification**:
    -   Although the backend accepts tokens blindly from the frontend, the GitHub API itself validates them.

## Troubleshooting

-   **"Auth server failed to start"**: Check if local ports (8000+) are blocked.
-   **No GitHub Data**: Ensure logic checks `isAuthenticated` (Supabase) before `isConnected` (GitHub).
-   **Build Errors**: Ensure `VITE_SUPABASE_*` env vars are present.
