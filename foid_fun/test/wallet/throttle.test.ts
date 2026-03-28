import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkThrottle,
  recordFailure,
  recordSuccess,
  getThrottleMessage,
  generateThrottleNonce,
  verifyThrottleNonce,
  applyNonceMismatchLockout,
} from '@/lib/wallet/throttle';
import { THROTTLE_KEY, MAX_PIN_ATTEMPTS } from '@/lib/wallet/constants';

describe('throttle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('checkThrottle', () => {
    it('allows first attempt', () => {
      const result = checkThrottle();
      expect(result.allowed).toBe(true);
      expect(result.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS);
    });

    it('allows after recording a success', () => {
      recordFailure();
      recordSuccess();
      const result = checkThrottle();
      expect(result.allowed).toBe(true);
    });
  });

  describe('recordFailure', () => {
    it('decrements attempts remaining', () => {
      recordFailure();
      // After recent failure, exponential backoff kicks in
      // But we can check the state directly
      const state = JSON.parse(localStorage.getItem(THROTTLE_KEY)!);
      expect(state.count).toBe(1);
    });

    it('triggers lockout after max attempts', () => {
      for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
        recordFailure();
      }
      const result = checkThrottle();
      expect(result.allowed).toBe(false);
      expect(result.attemptsRemaining).toBe(0);
    });
  });

  describe('recordSuccess', () => {
    it('resets throttle counter', () => {
      recordFailure();
      recordFailure();
      recordSuccess();
      const result = checkThrottle();
      expect(result.allowed).toBe(true);
      expect(result.attemptsRemaining).toBe(MAX_PIN_ATTEMPTS);
    });

    it('preserves nonce when provided', () => {
      recordSuccess('test-nonce');
      const state = JSON.parse(localStorage.getItem(THROTTLE_KEY)!);
      expect(state.nonce).toBe('test-nonce');
      expect(state.count).toBe(0);
    });

    it('clears localStorage when no nonce', () => {
      recordFailure();
      recordSuccess();
      expect(localStorage.getItem(THROTTLE_KEY)).toBeNull();
    });
  });

  describe('getThrottleMessage', () => {
    it('returns null when allowed', () => {
      expect(getThrottleMessage()).toBeNull();
    });

    it('returns message when locked out', () => {
      for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
        recordFailure();
      }
      const msg = getThrottleMessage();
      expect(msg).toContain('Too many failed attempts');
    });
  });

  describe('nonce management', () => {
    it('generates a non-empty nonce', () => {
      const nonce = generateThrottleNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('generates unique nonces', () => {
      const a = generateThrottleNonce();
      const b = generateThrottleNonce();
      expect(a).not.toBe(b);
    });

    it('verifyThrottleNonce returns true when nonces match', () => {
      const nonce = 'test-nonce-123';
      recordSuccess(nonce);
      expect(verifyThrottleNonce(nonce)).toBe(true);
    });

    it('verifyThrottleNonce returns false when nonces mismatch', () => {
      recordSuccess('nonce-a');
      expect(verifyThrottleNonce('nonce-b')).toBe(false);
    });

    it('verifyThrottleNonce returns false when throttle was cleared', () => {
      recordSuccess('nonce-a');
      localStorage.removeItem(THROTTLE_KEY);
      expect(verifyThrottleNonce('nonce-a')).toBe(false);
    });

    it('verifyThrottleNonce returns true for v1 wallets (no nonce)', () => {
      expect(verifyThrottleNonce(undefined)).toBe(true);
    });

    it('applyNonceMismatchLockout locks the wallet', () => {
      applyNonceMismatchLockout('vault-nonce');
      const result = checkThrottle();
      expect(result.allowed).toBe(false);
      expect(result.attemptsRemaining).toBe(0);
    });
  });
});
