/**
 * FOID Wallet v3 — Storage layer.
 *
 * Handles localStorage persistence, backup export/import,
 * and vault version validation with v1→v3 migration support.
 */

import { STORAGE_KEY, MIN_WALLET_VERSION, WALLET_VERSION, PENDING_KEY } from './constants';
import type { KdfType } from './crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

/** v1 wallet format (original monolith). */
export interface FoidWalletV1 {
  version: 1;
  vault: {
    ciphertext: string;
    iv: string;
    salt: string;
  };
  address: string;
  credentialId?: string;
  prfActive: boolean;
  createdAt: string;
}

/** v3 wallet format (Argon2id, HMAC, mnemonic, throttle nonce). */
export interface FoidWalletV3 {
  version: 3;
  kdf: KdfType;
  vault: {
    ciphertext: string;
    iv: string;
    salt: string;
    hmac: string;
  };
  address: string;
  credentialId?: string;
  prfActive: boolean;
  createdAt: string;
  hasMnemonic: boolean;
  throttleNonce: string;
}

export type FoidWallet = FoidWalletV1 | FoidWalletV3;

export interface UnlockedWallet {
  privateKey: string;
  address: string;
  mnemonic?: string;
  lock: () => void;
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

export function isV1(wallet: FoidWallet): wallet is FoidWalletV1 {
  return wallet.version === 1;
}

export function isV3(wallet: FoidWallet): wallet is FoidWalletV3 {
  return wallet.version === 3;
}

// ─── localStorage Operations ────────────────────────────────────────────────

/** Persist the encrypted wallet blob to localStorage. */
export function save(wallet: FoidWallet): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
  // Clear any pending migration
  localStorage.removeItem(PENDING_KEY);
}

/** Load the encrypted wallet blob from localStorage. Returns null if absent or corrupt. */
export function load(): FoidWallet | null {
  if (typeof window === 'undefined') return null;

  // Check for pending migration first (crash recovery)
  const pending = localStorage.getItem(PENDING_KEY);
  if (pending) {
    try {
      const wallet = JSON.parse(pending) as FoidWallet;
      // Complete the interrupted migration
      localStorage.setItem(STORAGE_KEY, pending);
      localStorage.removeItem(PENDING_KEY);
      return wallet;
    } catch {
      localStorage.removeItem(PENDING_KEY);
    }
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FoidWallet;
  } catch {
    return null;
  }
}

/** Check if a wallet exists in localStorage. */
export function exists(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Remove the wallet from localStorage. */
export function clear(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
}

/** Get the stored wallet address without loading the full wallet. */
export function getStoredAddress(): string | null {
  const w = load();
  return w?.address ?? null;
}

// ─── Export / Import ─────────────────────────────────────────────────────────

/**
 * Export the encrypted wallet blob as a JSON string (for backup).
 * The blob is safe to store anywhere — it's encrypted.
 */
export function exportWallet(wallet: FoidWallet): string {
  return JSON.stringify(wallet);
}

/**
 * Import a wallet from a backup JSON string.
 * Validates the structure and version before returning.
 *
 * @throws On invalid JSON, unsupported version, or missing vault fields.
 */
export function importWallet(json: string): FoidWallet {
  let w: FoidWallet;
  try {
    w = JSON.parse(json) as FoidWallet;
  } catch {
    throw new Error('Invalid backup data. Could not parse JSON.');
  }

  if (!w.version || w.version < MIN_WALLET_VERSION || w.version > WALLET_VERSION) {
    throw new Error(`Unsupported wallet version: ${w.version}`);
  }
  if (!w.vault?.ciphertext || !w.vault?.iv || !w.vault?.salt) {
    throw new Error('Invalid wallet data: missing vault fields.');
  }
  if (!w.address) {
    throw new Error('Invalid wallet data: missing address.');
  }

  return w;
}

// ─── Migration ──────────────────────────────────────────────────────────────

/** Check if a wallet needs migration to the current version. */
export function needsMigration(wallet: FoidWallet): boolean {
  return wallet.version < WALLET_VERSION;
}

/**
 * Save a v3 wallet to the pending key first (crash-safe migration).
 * Call `save()` after successful verification to complete the migration.
 */
export function savePendingMigration(wallet: FoidWalletV3): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(wallet));
}
