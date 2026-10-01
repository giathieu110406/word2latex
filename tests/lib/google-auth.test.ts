// tests/lib/google-auth.test.ts
import { describe, it, expect } from 'vitest';
import { initGoogleClient, getAccessToken } from '../../src/lib/google-auth';

describe('Google Auth', () => {
  it('should initialize without error', () => {
    // Basic test just to ensure module exports properly
    expect(typeof initGoogleClient).toBe('function');
    expect(typeof getAccessToken).toBe('function');
  });
});
