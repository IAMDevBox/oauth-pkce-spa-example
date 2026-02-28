/**
 * Secure token storage utilities for OAuth 2.0 PKCE flow in SPAs
 *
 * Storage strategy comparison:
 * - In-memory (module variable): Most secure, lost on page refresh
 * - sessionStorage: Survives same-tab refresh, cleared when tab closes
 * - localStorage: Persists across tabs/sessions, vulnerable to XSS
 * - httpOnly cookie (via BFF): Most secure for refresh tokens
 *
 * This implementation uses in-memory for access tokens + sessionStorage
 * for short-lived PKCE parameters only.
 *
 * Reference: https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/
 */

const PKCE_VERIFIER_KEY = 'pkce_code_verifier';
const PKCE_STATE_KEY = 'pkce_state';
const PKCE_REDIRECT_KEY = 'pkce_return_path';

// ─── PKCE parameter storage (sessionStorage only — never tokens) ───────────

export function storePkceVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export function retrievePkceVerifier(): string | null {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY);
}

export function storePkceState(state: string): void {
  sessionStorage.setItem(PKCE_STATE_KEY, state);
}

export function retrievePkceState(): string | null {
  return sessionStorage.getItem(PKCE_STATE_KEY);
}

export function storeReturnPath(path: string): void {
  sessionStorage.setItem(PKCE_REDIRECT_KEY, path);
}

export function retrieveReturnPath(): string {
  return sessionStorage.getItem(PKCE_REDIRECT_KEY) || '/';
}

/**
 * Clear all PKCE parameters after successful token exchange.
 * MUST be called after every token exchange — successful or failed.
 */
export function clearPkceParams(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_REDIRECT_KEY);
}

// ─── Refresh token storage (sessionStorage — use BFF/httpOnly cookie in prod) ─

const REFRESH_TOKEN_KEY = 'rt';

export function storeRefreshToken(token: string): void {
  // TODO: In production, store via BFF in an httpOnly cookie instead.
  // See: https://iamdevbox.com/posts/oauth-20-authorization-flow-using-nodejs-and-express/
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function retrieveRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearRefreshToken(): void {
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAllTokenStorage(): void {
  clearPkceParams();
  clearRefreshToken();
}
