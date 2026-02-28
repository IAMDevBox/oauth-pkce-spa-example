/**
 * App.tsx — Root component demonstrating OAuth 2.0 PKCE flow
 *
 * This example works with any OIDC-compliant provider:
 *   - Keycloak (see https://iamdevbox.com/posts/keycloak-spring-boot-oauth2-integration-complete-guide/)
 *   - ForgeRock AM (see https://iamdevbox.com/posts/forgerock-am-oauth2-client-configuration/)
 *   - Okta, Auth0, Azure AD B2C
 *
 * Full tutorial: https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/
 */

import React from 'react';
import { useAuth, AuthConfig } from './hooks/useAuth';

// ─── Configuration ────────────────────────────────────────────────────────────
// Copy .env.example → .env and fill in your values

const authConfig: AuthConfig = {
  clientId: import.meta.env.VITE_CLIENT_ID || 'my-spa-client',
  authorizationEndpoint:
    import.meta.env.VITE_AUTH_ENDPOINT ||
    'https://auth.example.com/oauth2/authorize',
  tokenEndpoint:
    import.meta.env.VITE_TOKEN_ENDPOINT ||
    'https://auth.example.com/oauth2/token',
  endSessionEndpoint:
    import.meta.env.VITE_END_SESSION_ENDPOINT || undefined,
  redirectUri: window.location.origin + '/callback',
  scopes: ['openid', 'profile', 'email'],
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { isAuthenticated, isLoading, accessToken, idToken, error, login, logout, getAccessToken } =
    useAuth(authConfig);
  const [apiResult, setApiResult] = React.useState<string>('');

  const callProtectedApi = async () => {
    const token = await getAccessToken();
    if (!token) {
      setApiResult('No access token available');
      return;
    }
    // Replace with your actual protected API endpoint
    setApiResult(`Bearer ${token.substring(0, 40)}... (truncated)`);
  };

  if (isLoading) {
    return (
      <div style={styles.center}>
        <p>Authenticating…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <h2 style={{ color: 'red' }}>Authentication Error</h2>
        <pre style={styles.code}>{error}</pre>
        <button onClick={() => login()}>Try again</button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={styles.center}>
        <h1>OAuth 2.0 PKCE Demo</h1>
        <p>
          This SPA demonstrates <strong>Authorization Code Flow with PKCE</strong> (RFC 7636).
          <br />
          <a
            href="https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/"
            target="_blank"
            rel="noreferrer"
          >
            Read the full tutorial →
          </a>
        </p>
        <button style={styles.button} onClick={() => login()}>
          Login with OAuth 2.0 + PKCE
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>OAuth 2.0 PKCE Demo — Authenticated</h1>

      <section>
        <h2>Access Token (first 40 chars)</h2>
        <pre style={styles.code}>{accessToken?.substring(0, 40)}…</pre>
      </section>

      {idToken && (
        <section>
          <h2>ID Token (first 40 chars)</h2>
          <pre style={styles.code}>{idToken?.substring(0, 40)}…</pre>
        </section>
      )}

      <section>
        <h2>Call Protected API</h2>
        <button style={styles.button} onClick={callProtectedApi}>
          GET /api/me (with Bearer token)
        </button>
        {apiResult && <pre style={styles.code}>{apiResult}</pre>}
      </section>

      <section>
        <button style={{ ...styles.button, background: '#c0392b' }} onClick={logout}>
          Logout
        </button>
      </section>

      <footer style={styles.footer}>
        Learn more at{' '}
        <a href="https://iamdevbox.com" target="_blank" rel="noreferrer">
          iamdevbox.com
        </a>{' '}
        — IAM tutorials for developers
      </footer>
    </div>
  );
}

// ─── Styles (inline for simplicity — use CSS modules or Tailwind in prod) ─────

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
    fontFamily: 'system-ui, sans-serif',
  },
  container: {
    maxWidth: 700,
    margin: '2rem auto',
    padding: '0 1rem',
    fontFamily: 'system-ui, sans-serif',
  },
  code: {
    background: '#f4f4f4',
    padding: '0.75rem',
    borderRadius: 4,
    overflow: 'auto',
    fontSize: '0.85rem',
  },
  button: {
    background: '#2c3e50',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '1rem',
  },
  footer: {
    marginTop: '3rem',
    fontSize: '0.85rem',
    color: '#666',
  },
};

export default App;
