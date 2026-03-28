/**
 * FOID Wallet v3 — PIN attempt rate limiting with vault-stamped nonce.
 *
 * Tracks failed PIN attempts in localStorage with exponential backoff.
 * After MAX_PIN_ATTEMPTS failures, the wallet is locked for PIN_LOCKOUT_MS.
 *
 * v3 improvement: a random nonce is stored in both the vault blob and the
 * throttle state. If an attacker clears localStorage to reset the counter,
 * the nonce mismatch is detected on next unlock and max lockout is re-applied.
 * Combined with Argon2id (64MB memory-hard), this makes both interactive
 * and offline brute-force attacks impractical.
 */

import { THROTTLE_KEY, MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MS } from './constants';
import { rand, toB64 } from './crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThrottleState {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number;
  nonce?: string; // must match vault's throttleNonce
}

export interface ThrottleCheck {
  allowed: boolean;
  waitMs?: number;
  attemptsRemaining?: number;
}

// ─── State Management ────────────────────────────────────────────────────────

function loadState(): ThrottleState {
  if (typeof window === 'undefined') {
    return { count: 0, lastAttemptAt: 0, lockedUntil: 0 };
  }
  try {
    const raw = localStorage.getItem(THROTTLE_KEY);
    if (!raw) return { count: 0, lastAttemptAt: 0, lockedUntil: 0 };
    return JSON.parse(raw) as ThrottleState;
  } catch {
    return { count: 0, lastAttemptAt: 0, lockedUntil: 0 };
  }
}

function saveState(state: ThrottleState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
}

// ─── Nonce Management ───────────────────────────────────────────────────────

/**
 * Generate a random throttle nonce. Stored in both the vault and throttle state.
 */
export function generateThrottleNonce(): string {
  return toB64(rand(16).buffer);
}

/**
 * Verify that the throttle nonce matches the vault's nonce.
 * A mismatch means the throttle state was tampered with (cleared from localStorage).
 * Returns true if nonces match or if the vault has no nonce (v1 wallet).
 */
export function verifyThrottleNonce(vaultNonce: string | undefined): boolean {
  if (!vaultNonce) return true; // v1 wallets don't have nonces
  const state = loadState();
  if (!state.nonce) return false; // throttle was cleared — nonce missing
  return state.nonce === vaultNonce;
}

/**
 * Apply max lockout when nonce mismatch is detected.
 * This prevents attackers from resetting the counter by clearing localStorage.
 */
export function applyNonceMismatchLockout(vaultNonce: string): void {
  const now = Date.now();
  saveState({
    count: MAX_PIN_ATTEMPTS,
    lastAttemptAt: now,
    lockedUntil: now + PIN_LOCKOUT_MS,
    nonce: vaultNonce,
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check whether PIN entry is currently throttled.
 *
 * @returns `{ allowed: true }` if PIN entry is permitted.
 * @returns `{ allowed: false, waitMs, attemptsRemaining }` if throttled.
 */
export function checkThrottle(): ThrottleCheck {
  const state = loadState();
  const now = Date.now();

  // Check hard lockout
  if (state.lockedUntil > now) {
    return {
      allowed: false,
      waitMs: state.lockedUntil - now,
      attemptsRemaining: 0,
    };
  }

  // Check exponential backoff delay
  if (state.count > 0) {
    const backoffMs = Math.min(1000 * Math.pow(2, state.count - 1), PIN_LOCKOUT_MS);
    const readyAt = state.lastAttemptAt + backoffMs;
    if (now < readyAt) {
      return {
        allowed: false,
        waitMs: readyAt - now,
        attemptsRemaining: Math.max(0, MAX_PIN_ATTEMPTS - state.count),
      };
    }
  }

  return {
    allowed: true,
    attemptsRemaining: MAX_PIN_ATTEMPTS - state.count,
  };
}

/**
 * Record a failed PIN attempt. Increments counter and applies backoff.
 * After MAX_PIN_ATTEMPTS, triggers a hard lockout.
 *
 * @param vaultNonce - The vault's throttle nonce (for v3 wallets).
 */
export function recordFailure(vaultNonce?: string): void {
  const state = loadState();
  const now = Date.now();

  state.count += 1;
  state.lastAttemptAt = now;
  if (vaultNonce) state.nonce = vaultNonce;

  if (state.count >= MAX_PIN_ATTEMPTS) {
    state.lockedUntil = now + PIN_LOCKOUT_MS;
  }

  saveState(state);
}

/**
 * Record a successful PIN entry. Resets the throttle counter.
 * Preserves the nonce so it continues to match the vault.
 *
 * @param vaultNonce - The vault's throttle nonce (for v3 wallets).
 */
export function recordSuccess(vaultNonce?: string): void {
  if (typeof window === 'undefined') return;
  if (vaultNonce) {
    // Reset counter but keep nonce aligned with vault
    saveState({
      count: 0,
      lastAttemptAt: 0,
      lockedUntil: 0,
      nonce: vaultNonce,
    });
  } else {
    localStorage.removeItem(THROTTLE_KEY);
  }
}

/**
 * Get a human-readable description of the current throttle state.
 */
export function getThrottleMessage(): string | null {
  const result = checkThrottle();
  if (result.allowed) return null;

  const secs = Math.ceil((result.waitMs ?? 0) / 1000);
  if (result.attemptsRemaining === 0) {
    return `Too many failed attempts. Locked for ${secs}s.`;
  }
  return `Please wait ${secs}s before trying again. ${result.attemptsRemaining} attempts remaining.`;
}
