/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * RFC 7636 compliant implementation for OAuth 2.0 Authorization Code Flow
 *
 * Tutorial: https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/
 */

/**
 * Generate a cryptographically random code verifier (43-128 chars, RFC 7636 §4.1)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Derive code challenge from verifier using SHA-256 (S256 method, RFC 7636 §4.2)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64-URL encoding without padding (RFC 4648 §5)
 * IMPORTANT: Must replace +, /, = for OAuth compliance
 */
export function base64UrlEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array));
  return base64
    .replace(/\+/g, '-')  // + → -
    .replace(/\//g, '_')  // / → _
    .replace(/=/g, '');   // strip padding
}

/**
 * Generate cryptographically secure random string for OAuth state parameter (CSRF protection)
 */
export function generateSecureState(byteLength = 32): string {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Validate PKCE code_verifier format per RFC 7636 §4.1
 * Must be 43-128 chars of unreserved ASCII characters
 */
export function validateCodeVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);
}

/**
 * Test vector from RFC 7636 Appendix B for implementation validation
 *   code_verifier:  dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
 *   code_challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
 */
export async function verifyTestVector(): Promise<boolean> {
  const testVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const computed = await generateCodeChallenge(testVerifier);
  return computed === expectedChallenge;
}
