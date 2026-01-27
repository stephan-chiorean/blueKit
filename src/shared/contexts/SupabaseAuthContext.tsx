/**
 * Supabase Auth Context.
 * 
 * Manages user identity/authentication via Supabase.
 * Supports multiple providers: Google, GitHub, Email magic link.
 * 
 * OAuth uses PKCE flow with system browser and loopback callback:
 * 1. Start local callback server on random port
 * 2. Open OAuth URL in system browser
 * 3. Browser redirects to localhost callback
 * 4. Server captures tokens and emits Tauri event
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/shell';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface SupabaseAuthContextValue {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithGitHub: () => Promise<void>;
    signInWithEmail: (email: string) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
}

interface AuthCallbackPayload {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    code?: string;
    error?: string;
    error_description?: string;
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
                setIsLoading(false);
            }
        );

        // Listen for OAuth callback from Tauri backend
        let unlisten: UnlistenFn | null = null;

        listen<AuthCallbackPayload>('supabase-auth-callback', async (event) => {
            console.log('[SupabaseAuth] Received auth callback:', event.payload);

            const payload = event.payload;

            if (payload.error) {
                console.error('[SupabaseAuth] OAuth error:', payload.error, payload.error_description);
                return;
            }

            // Handle token response (implicit flow from Supabase)
            if (payload.access_token && payload.refresh_token) {
                console.log('[SupabaseAuth] Setting session from tokens');
                try {
                    const { data, error } = await supabase.auth.setSession({
                        access_token: payload.access_token,
                        refresh_token: payload.refresh_token,
                    });

                    if (error) {
                        console.error('[SupabaseAuth] Error setting session:', error);
                    } else {
                        console.log('[SupabaseAuth] Session set successfully');
                    }
                } catch (err) {
                    console.error('[SupabaseAuth] Failed to set session:', err);
                }
            }

            // Handle code response (PKCE flow - exchange code for session)
            if (payload.code) {
                console.log('[SupabaseAuth] Exchanging code for session');
                try {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(payload.code);

                    if (error) {
                        console.error('[SupabaseAuth] Error exchanging code:', error);
                    } else {
                        console.log('[SupabaseAuth] Session obtained from code');
                    }
                } catch (err) {
                    console.error('[SupabaseAuth] Failed to exchange code:', err);
                }
            }

            // Stop auth server after handling callback
            try {
                await invoke('stop_supabase_auth_server');
            } catch (e) {
                // Ignore errors stopping server
            }
        }).then(fn => {
            unlisten = fn;
        });

        return () => {
            subscription.unsubscribe();
            if (unlisten) unlisten();
        };
    }, []);

    // Start auth server, get OAuth URL, open in system browser
    const signInWithProvider = useCallback(async (provider: 'google' | 'github') => {
        try {
            // Start the local callback server
            const port = await invoke<number>('start_supabase_auth_server');
            console.log(`[SupabaseAuth] Auth server started on port ${port}`);

            // Get OAuth URL with redirect to our local server
            const redirectUrl = `http://localhost:${port}/auth/callback`;

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                console.error('[SupabaseAuth] OAuth error:', error);
                throw error;
            }

            if (data?.url) {
                console.log(`[SupabaseAuth] Opening ${provider} OAuth in browser`);
                await open(data.url);
            }
        } catch (err) {
            console.error('[SupabaseAuth] Sign in failed:', err);
            // Stop server on error
            try {
                await invoke('stop_supabase_auth_server');
            } catch (e) {
                // Ignore
            }
            throw err;
        }
    }, []);

    const signInWithGoogle = useCallback(async () => {
        await signInWithProvider('google');
    }, [signInWithProvider]);

    const signInWithGitHub = useCallback(async () => {
        await signInWithProvider('github');
    }, [signInWithProvider]);

    const signInWithEmail = useCallback(async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin },
        });
        return { error };
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

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
