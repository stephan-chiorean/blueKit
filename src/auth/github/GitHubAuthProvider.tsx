/**
 * GitHub Authentication Provider.
 * 
 * This React context provider manages GitHub authentication state throughout the app.
 * It handles token loading, authentication status, and provides auth actions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GitHubToken, AuthStatus, GitHubUser } from '@/types/github';
import {
  invokeKeychainRetrieveToken,
  invokeKeychainDeleteToken,
  invokeAuthGetStatus,
  invokeGitHubGetUser,
} from '@/ipc';

interface GitHubAuthContextValue {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GitHubUser | null;
  token: GitHubToken | null;

  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setToken: (token: GitHubToken) => void;
  setUser: (user: GitHubUser | null) => void;
}

const GitHubAuthContext = createContext<GitHubAuthContextValue | undefined>(undefined);

export function GitHubAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<GitHubToken | null>(null);

  // Load token and user info from keychain on mount
  const loadStoredToken = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedToken = await invokeKeychainRetrieveToken();
      setToken(storedToken);
      setIsAuthenticated(true);
      
      // Fetch user info from GitHub API
      try {
        const userInfo = await invokeGitHubGetUser();
        setUser(userInfo);
      } catch (error) {
        // Failed to fetch user info, but token is valid
        console.warn('Failed to fetch user info:', error);
      }
    } catch (error) {
      // No token stored, user is not authenticated
      setToken(null);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load token on mount
  useEffect(() => {
    loadStoredToken();
  }, [loadStoredToken]);

  // Sign in (token should be set via setToken after device flow completes)
  const signIn = useCallback(async () => {
    // This will be called after device flow completes
    // The actual device flow is handled in GitHubAuthScreen
    await loadStoredToken();
  }, [loadStoredToken]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await invokeKeychainDeleteToken();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }, []);

  // Refresh authentication status
  const refreshAuth = useCallback(async () => {
    try {
      const status = await invokeAuthGetStatus();
      if (status.type === 'authorized') {
        setToken(status.token);
        setIsAuthenticated(true);
        // Fetch user info from GitHub API
        try {
          const userInfo = await invokeGitHubGetUser();
          setUser(userInfo);
        } catch (error) {
          console.warn('Failed to fetch user info:', error);
        }
      } else {
        setToken(null);
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      setToken(null);
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  // Set token (called after successful device flow)
  const handleSetToken = useCallback(async (newToken: GitHubToken) => {
    setToken(newToken);
    setIsAuthenticated(true);
    
    // Fetch user info from GitHub API
    try {
      const userInfo = await invokeGitHubGetUser();
      setUser(userInfo);
    } catch (error) {
      console.warn('Failed to fetch user info:', error);
    }
  }, []);

  // Set user (called after fetching user info from API)
  const handleSetUser = useCallback((newUser: GitHubUser | null) => {
    setUser(newUser);
  }, []);

  const value: GitHubAuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    token,
    signIn,
    signOut,
    refreshAuth,
    setToken: handleSetToken,
    setUser: handleSetUser,
  };

  return (
    <GitHubAuthContext.Provider value={value}>
      {children}
    </GitHubAuthContext.Provider>
  );
}

export function useGitHubAuth() {
  const context = useContext(GitHubAuthContext);
  if (!context) {
    throw new Error('useGitHubAuth must be used within GitHubAuthProvider');
  }
  return context;
}
