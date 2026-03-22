# oauth-pkce-spa-example

> Production-ready OAuth 2.0 **Authorization Code Flow with PKCE** (RFC 7636) for Single Page Applications — built with React + TypeScript.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![RFC 7636](https://img.shields.io/badge/RFC-7636%20PKCE-green.svg)](https://www.rfc-editor.org/rfc/rfc7636)
[![OAuth 2.0](https://img.shields.io/badge/OAuth-2.0-orange.svg)](https://oauth.net/2/)

A companion repository for the tutorial: **[How to Implement Authorization Code Flow with PKCE in a Single Page Application](https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** on [iamdevbox.com](https://iamdevbox.com/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example).

---

## Why PKCE for SPAs?

The OAuth 2.0 Implicit Flow is **deprecated** (OAuth 2.0 Security BCP, RFC 9700). Authorization Code Flow with PKCE is the current best practice for SPAs because:

- **No client secret required** — SPAs can't store secrets securely
- **Cryptographic binding** — links the authorization request to the token request via SHA-256 code challenge
- **Single-use codes** — prevents authorization code interception attacks
- **Refresh token support** — enables long-lived sessions without re-authentication

> 89% of OAuth providers now require PKCE for SPAs (Auth0, Okta, Keycloak, ForgeRock, Ping Identity).

---

## Features

- ✅ **RFC 7636 compliant** PKCE implementation (`S256` method)
- ✅ **CSRF protection** via cryptographically secure state parameter
- ✅ **Silent token refresh** — auto-refreshes access tokens before expiry
- ✅ **Secure storage** — access tokens in-memory, PKCE params in sessionStorage only
- ✅ **Error handling** — surfaces OAuth errors with descriptive messages
- ✅ **URL cleanup** — removes `code` and `state` after token exchange (prevents replay)
- ✅ **TypeScript strict mode** — fully typed API
- ✅ **Unit tested** — RFC 7636 test vector validation included
- ✅ Compatible with **Keycloak, ForgeRock AM, Okta, Auth0, Azure AD B2C**, and any OIDC provider

---

## Quick Start

```bash
git clone https://github.com/IAMDevBox/oauth-pkce-spa-example.git
cd oauth-pkce-spa-example

npm install

cp .env.example .env
# Edit .env with your authorization server details

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
oauth-pkce-spa-example/
├── src/
│   ├── hooks/
│   │   └── useAuth.ts          # React hook: login, logout, getAccessToken, auto-refresh
│   ├── utils/
│   │   ├── pkce.ts             # RFC 7636: generateCodeVerifier, generateCodeChallenge
│   │   ├── pkce.test.ts        # Unit tests (RFC 7636 test vector + edge cases)
│   │   └── storage.ts          # Secure sessionStorage helpers for PKCE params
│   ├── App.tsx                 # Root component + usage example
│   └── main.tsx                # React entry point
├── public/
│   └── index.html
├── .env.example                # Config template (Keycloak, ForgeRock, generic OIDC)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your authorization server details:

```env
VITE_CLIENT_ID=my-spa-client
VITE_AUTH_ENDPOINT=https://auth.example.com/oauth2/authorize
VITE_TOKEN_ENDPOINT=https://auth.example.com/oauth2/token
VITE_END_SESSION_ENDPOINT=https://auth.example.com/oauth2/logout
```

### Keycloak Setup

1. Create a new client in Keycloak Admin → **Clients → Create**
2. Set **Client type**: `OpenID Connect`
3. Set **Client authentication**: `Off` (public client — no secret)
4. Enable **Standard flow** (Authorization Code Flow)
5. Set **Valid redirect URIs**: `http://localhost:3000/*`
6. Set **Web origins**: `http://localhost:3000`

Then in `.env`:
```env
VITE_CLIENT_ID=my-spa-client
VITE_AUTH_ENDPOINT=http://localhost:8080/realms/myrealm/protocol/openid-connect/auth
VITE_TOKEN_ENDPOINT=http://localhost:8080/realms/myrealm/protocol/openid-connect/token
VITE_END_SESSION_ENDPOINT=http://localhost:8080/realms/myrealm/protocol/openid-connect/logout
```

For a full Spring Boot + Keycloak resource server example, see: **[Keycloak Spring Boot OAuth2 Integration](https://iamdevbox.com/posts/keycloak-spring-boot-oauth2-integration-complete-guide/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)**

### ForgeRock AM Setup

Register an OAuth2 client in ForgeRock AM → **OAuth2 Provider → Clients**:
- **Client ID**: `pkce-spa-client`
- **Client Type**: `Public`
- **Redirect URIs**: `http://localhost:3000/callback`
- **Response Types**: `code`
- **Token Endpoint Auth Method**: `none`

Then in `.env`:
```env
VITE_CLIENT_ID=pkce-spa-client
VITE_AUTH_ENDPOINT=https://openam.example.com/openam/oauth2/realms/root/authorize
VITE_TOKEN_ENDPOINT=https://openam.example.com/openam/oauth2/realms/root/access_token
```

---

## Core Implementation

### `useAuth` hook

```typescript
import { useAuth, AuthConfig } from './hooks/useAuth';

const config: AuthConfig = {
  clientId: 'my-spa-client',
  authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
  tokenEndpoint: 'https://auth.example.com/oauth2/token',
  redirectUri: window.location.origin + '/callback',
  scopes: ['openid', 'profile', 'email'],
};

function MyComponent() {
  const { isAuthenticated, isLoading, error, login, logout, getAccessToken } = useAuth(config);

  // Auto-refreshes before expiry — safe to call before every API request
  const callApi = async () => {
    const token = await getAccessToken();
    const res = await fetch('/api/data', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  };

  if (isLoading) return <div>Loading…</div>;
  if (!isAuthenticated) return <button onClick={() => login()}>Login</button>;

  return <button onClick={callApi}>Call API</button>;
}
```

### PKCE Utilities

```typescript
import { generateCodeVerifier, generateCodeChallenge, verifyTestVector } from './utils/pkce';

// RFC 7636 compliant PKCE generation
const verifier = generateCodeVerifier();           // 32 bytes, base64url-encoded
const challenge = await generateCodeChallenge(verifier); // SHA-256(verifier), base64url-encoded

// Validate your implementation against RFC 7636 Appendix B test vector
const isValid = await verifyTestVector(); // Must be true
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_grant: PKCE verification failed` | Code challenge ≠ SHA-256(verifier) | Use `S256`, not `plain`. Use base64**url** encoding (replace `+→-`, `/→_`, strip `=`) |
| `State parameter mismatch` | CSRF attack or tab duplication | Always validate `state` before processing `code`. Generate with `crypto.getRandomValues()` |
| `invalid_client: redirect_uri_mismatch` | Registered URI doesn't match exactly | Use exact same URI including trailing slash. Use `window.location.origin + '/callback'` |
| `Code verifier not found` | sessionStorage cleared (page refresh mid-flow) | Store verifier in sessionStorage before redirect; handle refresh with BFF pattern |

Full error reference: **[PKCE Implementation Errors — 100+ Debugged](https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example#common-pkce-implementation-errors-ive-debugged-100-times)**

---

## Running Tests

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
```

Tests validate:
- RFC 7636 Appendix B test vector (code verifier → challenge)
- Base64-URL encoding correctness (no `+`, `/`, `=`)
- State uniqueness (no static seeds)
- Code verifier format validation

---

## Security Notes

- **Access tokens**: stored in-memory (React ref) — never in localStorage
- **Refresh tokens**: stored in sessionStorage in this demo. In production, use a **Backend-for-Frontend (BFF)** to store refresh tokens in httpOnly cookies.
- **PKCE parameters**: cleared immediately after token exchange
- **State validation**: checked before processing the authorization code (CSRF protection)
- **URL cleanup**: `code` and `state` removed from browser history after exchange

For production deployment security considerations, see: **[OAuth 2.1 Security Best Practices](https://iamdevbox.com/posts/oauth-21-security-best-practices-mandatory-pkce-and-token-binding/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)**

---

## Related Resources

- 📖 **[Full Tutorial: PKCE in SPAs](https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** — step-by-step implementation guide with React hooks
- 🔑 **[OAuth 2.0 Complete Developer Guide](https://iamdevbox.com/posts/oauth-20-complete-developer-guide-authorization-authentication/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** — full OAuth 2.0 reference covering all grant types
- 🌐 **[OAuth 2.0 Authorization Flow in Node.js](https://iamdevbox.com/posts/oauth-20-authorization-flow-using-nodejs-and-express/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** — server-side Authorization Code Flow with Express
- 🔒 **[OAuth 2.1 Security Best Practices](https://iamdevbox.com/posts/oauth-21-security-best-practices-mandatory-pkce-and-token-binding/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** — mandatory PKCE, token binding, and DPoP
- 🛠️ **[JWT Decoder Tool](https://iamdevbox.com/tools/jwt-decode/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** — decode and inspect JWT access tokens in your browser
- 🔧 **[PKCE Generator Tool](https://iamdevbox.com/tools/pkce-generator/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example)** — generate code verifier and challenge pairs interactively

---

## Standards References

- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636) — Proof Key for Code Exchange by OAuth Public Clients
- [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) — The OAuth 2.0 Authorization Framework
- [OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700) — Current best practices (deprecates Implicit Flow)
- [OAuth 2.1](https://oauth.net/2.1/) — Draft consolidating OAuth 2.0 + PKCE + BCP

---

## License

MIT © [IAMDevBox](https://iamdevbox.com/?utm_source=github&utm_medium=companion-repo&utm_campaign=oauth-pkce-spa-example) — IAM tutorials and tools for developers.
