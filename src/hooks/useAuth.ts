/**
 * useAuth — React hook for OAuth 2.0 Authorization Code Flow with PKCE
 *
 * Implements RFC 7636 (PKCE) + RFC 6749 (OAuth 2.0) for Single Page Applications.
 * Compatible with Keycloak, ForgeRock AM, Okta, Auth0, Azure AD B2C, and any
 * standards-compliant authorization server.
 *
 * Full tutorial: https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/
 * Keycloak setup: https://iamdevbox.com/posts/keycloak-spring-boot-oauth2-integration-complete-guide/
 * OAuth concepts: https://iamdevbox.com/posts/oauth-20-complete-developer-guide-authorization-authentication/
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateSecureState,
} from '../utils/pkce';
import {
  storePkceVerifier,
  storePkceState,
  storeReturnPath,
  retrievePkceVerifier,
  retrievePkceState,
  retrieveReturnPath,
  clearPkceParams,
  storeRefreshToken,
  retrieveRefreshToken,
  clearAllTokenStorage,
} from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthConfig {
  /** OAuth 2.0 client_id registered with the authorization server */
  clientId: string;
  /** Authorization endpoint URL (e.g. https://auth.example.com/oauth2/authorize) */
  authorizationEndpoint: string;
  /** Token endpoint URL (e.g. https://auth.example.com/oauth2/token) */
  tokenEndpoint: string;
  /** Revocation endpoint URL (optional, for logout) */
  revocationEndpoint?: string;
  /** End-session / logout endpoint URL (optional) */
  endSessionEndpoint?: string;
  /** Registered redirect_uri - must match exactly what's in the auth server */
  redirectUri: string;
  /** Requested OAuth scopes (e.g. ['openid', 'profile', 'email']) */
  scopes: string[];
  /** Optional: additional parameters to include in the authorization request */
  extraAuthParams?: Record<string, string>;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  /** Absolute expiry timestamp (ms since epoch) */
  expires_at?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  idToken: string | null;
  error: string | null;
}

export interface UseAuthReturn extends AuthState {
  login: (returnPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * @example
 * const config: AuthConfig = {
 *   clientId: 'my-spa',
 *   authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
 *   tokenEndpoint: 'https://auth.example.com/oauth2/token',
 *   redirectUri: window.location.origin + '/callback',
 *   scopes: ['openid', 'profile', 'email'],
 * };
 *
 * function App() {
 *   const { isAuthenticated, login, logout, getAccessToken } = useAuth(config);
 *   // ...
 * }
 */
export function useAuth(config: AuthConfig): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    accessToken: null,
    idToken: null,
    error: null,
  });

  // Keep tokens in memory (not in state — avoids exposing in React DevTools)
  const tokenSetRef = useRef<TokenSet | null>(null);

  // ── Token refresh ────────────────────────────────────────────────────────

  const refreshAccessToken = useCallback(async (): Promise<TokenSet | null> => {
    const refreshToken = retrieveRefreshToken();
    if (!refreshToken) return null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
    });

    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      clearAllTokenStorage();
      tokenSetRef.current = null;
      setState(s => ({ ...s, isAuthenticated: false, accessToken: null, idToken: null }));
      return null;
    }

    const tokens: TokenSet = await response.json();
    tokens.expires_at = Date.now() + tokens.expires_in * 1000;
    tokenSetRef.current = tokens;

    if (tokens.refresh_token) {
      storeRefreshToken(tokens.refresh_token);
    }
    setState(s => ({ ...s, isAuthenticated: true, accessToken: tokens.access_token, idToken: tokens.id_token ?? null }));
    return tokens;
  }, [config]);

  // ── getAccessToken (auto-refreshes if expired) ───────────────────────────

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const tokens = tokenSetRef.current;
    if (!tokens) return null;

    // Refresh 60 seconds before expiry
    const expiresAt = tokens.expires_at ?? 0;
    if (Date.now() >= expiresAt - 60_000) {
      const refreshed = await refreshAccessToken();
      return refreshed?.access_token ?? null;
    }

    return tokens.access_token;
  }, [refreshAccessToken]);

  // ── Login (initiate PKCE flow) ────────────────────────────────────────────

  const login = useCallback(async (returnPath = '/') => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateSecureState();

    storePkceVerifier(codeVerifier);
    storePkceState(state);
    storeReturnPath(returnPath);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...config.extraAuthParams,
    });

    window.location.assign(`${config.authorizationEndpoint}?${params.toString()}`);
  }, [config]);

  // ── Handle callback ───────────────────────────────────────────────────────

  const handleCallback = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const receivedState = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // Surface server-side OAuth errors
      if (error) {
        throw new Error(`OAuth error: ${error}${errorDescription ? ` — ${errorDescription}` : ''}`);
      }

      if (!code || !receivedState) {
        throw new Error('Missing authorization code or state in callback URL');
      }

      // CSRF validation — MUST check before using code
      const storedState = retrievePkceState();
      if (receivedState !== storedState) {
        throw new Error('State mismatch — possible CSRF attack. Login aborted.');
      }

      const codeVerifier = retrievePkceVerifier();
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found — session may have expired. Please log in again.');
      }

      const returnPath = retrieveReturnPath();
      clearPkceParams(); // Clean up immediately after retrieval

      // Exchange code for tokens
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        code_verifier: codeVerifier,
      });

      const tokenResponse = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!tokenResponse.ok) {
        const errData = await tokenResponse.json().catch(() => ({}));
        throw new Error(
          `Token exchange failed (HTTP ${tokenResponse.status}): ${errData.error ?? 'unknown'} — ${errData.error_description ?? ''}`
        );
      }

      const tokens: TokenSet = await tokenResponse.json();
      tokens.expires_at = Date.now() + tokens.expires_in * 1000;
      tokenSetRef.current = tokens;

      if (tokens.refresh_token) {
        storeRefreshToken(tokens.refresh_token);
      }

      // Remove code & state from URL (prevents replay on refresh)
      window.history.replaceState({}, document.title, returnPath);

      setState({
        isAuthenticated: true,
        isLoading: false,
        accessToken: tokens.access_token,
        idToken: tokens.id_token ?? null,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      clearPkceParams();
      setState({ isAuthenticated: false, isLoading: false, accessToken: null, idToken: null, error: message });
    }
  }, [config]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const idToken = tokenSetRef.current?.id_token;
    clearAllTokenStorage();
    tokenSetRef.current = null;

    setState({ isAuthenticated: false, isLoading: false, accessToken: null, idToken: null, error: null });

    if (config.endSessionEndpoint) {
      const params = new URLSearchParams({ post_logout_redirect_uri: window.location.origin });
      if (idToken) params.set('id_token_hint', idToken);
      window.location.assign(`${config.endSessionEndpoint}?${params.toString()}`);
    }
  }, [config]);

  // ── Initialization ────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || params.has('error')) {
      handleCallback();
    } else if (retrieveRefreshToken()) {
      // Silently refresh on page load if we have a refresh token
      refreshAccessToken().finally(() => {
        setState(s => ({ ...s, isLoading: false }));
      });
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    login,
    logout,
    getAccessToken,
  };
}
