/**
 * PKCE utility tests — validates RFC 7636 compliance
 *
 * Run: npm test
 * Reference: https://iamdevbox.com/posts/how-to-implement-authorization-code-flow-with-pkce-in-a-single-page-application-spa/
 */

import { describe, it, expect } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateSecureState,
  validateCodeVerifier,
  verifyTestVector,
  base64UrlEncode,
} from './pkce';

describe('generateCodeVerifier', () => {
  it('returns a string of 43 chars (32 bytes base64url-encoded)', () => {
    const verifier = generateCodeVerifier();
    expect(typeof verifier).toBe('string');
    // 32 bytes → ceil(32 * 4/3) = 43 chars after stripping padding
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('produces only unreserved characters (RFC 7636 §4.1)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it('generates unique values each call (no static seeds)', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('generateCodeChallenge', () => {
  it('passes RFC 7636 Appendix B test vector', async () => {
    const result = await verifyTestVector();
    expect(result).toBe(true);
  });

  it('produces consistent output for same input', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it('produces different challenges for different verifiers', async () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    const c1 = await generateCodeChallenge(v1);
    const c2 = await generateCodeChallenge(v2);
    expect(c1).not.toBe(c2);
  });

  it('output contains no +, /, or = characters (base64url-encoded)', async () => {
    for (let i = 0; i < 10; i++) {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });
});

describe('generateSecureState', () => {
  it('generates a non-empty string', () => {
    const state = generateSecureState();
    expect(state.length).toBeGreaterThan(0);
  });

  it('generates unique values', () => {
    const states = new Set(Array.from({ length: 100 }, () => generateSecureState()));
    expect(states.size).toBe(100);
  });
});

describe('validateCodeVerifier', () => {
  it('accepts valid verifier (43-128 unreserved chars)', () => {
    expect(validateCodeVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(true);
  });

  it('rejects verifiers shorter than 43 chars', () => {
    expect(validateCodeVerifier('short')).toBe(false);
  });

  it('rejects verifiers with reserved characters', () => {
    expect(validateCodeVerifier('a'.repeat(42) + '+')).toBe(false);
    expect(validateCodeVerifier('a'.repeat(42) + '/')).toBe(false);
    expect(validateCodeVerifier('a'.repeat(42) + '=')).toBe(false);
  });
});

describe('base64UrlEncode', () => {
  it('replaces + with -', () => {
    // All 0xFF bytes produce base64 with / characters
    const result = base64UrlEncode(new Uint8Array(3).fill(0xfb));
    expect(result).not.toContain('+');
  });

  it('produces no padding characters', () => {
    for (let len = 1; len <= 10; len++) {
      const result = base64UrlEncode(new Uint8Array(len).fill(0xff));
      expect(result).not.toContain('=');
    }
  });
});
