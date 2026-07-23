/**
 * FOID Embedded Wallet v3 — Simple, secure, yours.
 *
 * Security model:
 *   - Private key is AES-256-GCM encrypted at rest. Always.
 *   - Encryption key derived from user PIN via Argon2id (64MB memory-hard).
 *   - Fallback: PBKDF2 (600k iterations) for devices without WASM.
 *   - Optional WebAuthn PRF for dual-factor encryption (PIN XOR PRF).
 *   - Vault integrity verified via HMAC-SHA-256.
 *   - PIN attempts rate-limited with exponential backoff + vault-stamped nonce.
 *   - Session key isolated in Web Worker (never on main thread).
 *   - BIP-39 mnemonic for recovery. BIP-44 HD derivation.
 *
 * Threat model:
 *   - XSS reads localStorage → encrypted blob, no key.
 *   - XSS reads main thread memory → key is in Worker, not accessible.
 *   - Malicious extension reads storage → same, encrypted blob.
 *   - Physical access → needs PIN + biometric to unlock.
 *   - Interactive brute-force → throttled after 10 attempts + nonce detection.
 *   - Offline brute-force → Argon2id 64MB makes GPU attacks impractical.
 *   - NOT designed for: state-level adversaries, >$1000 in value.
 */

import { toBytes, toHex } from 'viem';

import { MIN_PIN_LENGTH, WALLET_VERSION } from './constants';
import {
  newSalt,
  deriveEncryptionKey,
  bestAvailableKdf,
  encrypt,
  decrypt,
  computeVaultHmac,
  verifyVaultHmac,
  zeroBuffer,
  fromB64,
  toB64,
  type KdfType,
} from './crypto';
import { createPasskey, authenticatePasskey } from './passkey';
import {
  checkThrottle,
  recordFailure,
  recordSuccess,
  generateThrottleNonce,
  verifyThrottleNonce,
  applyNonceMismatchLockout,
} from './throttle';
import {
  generateMnemonic,
  mnemonicToPrivateKey,
  validateMnemonic,
  encodeVaultPayload,
  decodeVaultPayload,
} from './mnemonic';
import type { FoidWallet, FoidWalletV3, UnlockedWallet } from './storage';
import {
  save as saveToStorage,
  load,
  isV1,
  isV3,
  needsMigration,
  savePendingMigration,
} from './storage';

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type { FoidWallet, FoidWalletV1, FoidWalletV3, UnlockedWallet } from './storage';
export type { PasskeyResult, AuthResult } from './passkey';
export type { KdfType } from './crypto';
export { save, load, exists, clear, getStoredAddress, exportWallet, importWallet } from './storage';
export {
  setSession,
  getSession,
  clearSession,
  refreshSession,
  isWorkerMode,
  sessionSign,
  sessionSignTypedData,
  sessionSignTransaction,
  onSessionExpired,
  getPrivateKeyForExport,
} from './session';
export { checkThrottle, recordFailure, recordSuccess, getThrottleMessage } from './throttle';
export { isPasskeyAvailable } from './passkey';
export { validateMnemonic } from './mnemonic';

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new embedded wallet with BIP-39 mnemonic.
 *
 * 1. Generates a 12-word mnemonic and derives private key via BIP-44.
 * 2. Creates a WebAuthn passkey for biometric authentication.
 * 3. Derives encryption key from PIN via Argon2id (+ optional PRF).
 * 4. Encrypts the private key + mnemonic with AES-256-GCM.
 * 5. Computes HMAC for vault integrity.
 *
 * @param userId - Unique identifier for the passkey (use crypto.randomUUID()).
 * @param userName - Display name for the passkey.
 * @param pin - User-chosen PIN (min 6 characters).
 * @returns The encrypted wallet, PRF status, and mnemonic for backup display.
 * @throws If PIN is too short or passkey creation fails.
 */
export async function create(
  userId: string,
  userName: string,
  pin: string,
  signal?: AbortSignal,
): Promise<{ wallet: FoidWalletV3; prfActive: boolean; mnemonic: string }> {
  if (pin.length < MIN_PIN_LENGTH) {
    throw new Error(`PIN must be at least ${MIN_PIN_LENGTH} characters.`);
  }

  // Generate mnemonic and derive key
  const mnemonic = generateMnemonic();
  const { privateKey, address } = mnemonicToPrivateKey(mnemonic);

  // Encode payload (private key + mnemonic together)
  const payload = encodeVaultPayload({ privateKey, mnemonic });

  try {
    const { credentialId, prfOutput } = await createPasskey(userId, userName, signal);

    const salt = newSalt();
    const kdf = await bestAvailableKdf();
    const { key: encKey, prfActive } = await deriveEncryptionKey(pin, salt, kdf, prfOutput);

    const { ciphertext, iv } = await encrypt(payload, encKey);
    zeroBuffer(payload);

    const saltB64 = toB64(salt.buffer);
    const hmac = await computeVaultHmac(ciphertext, iv, saltB64);
    const throttleNonce = generateThrottleNonce();

    // Initialize throttle with nonce
    recordSuccess(throttleNonce);

    const wallet: FoidWalletV3 = {
      version: WALLET_VERSION,
      kdf,
      vault: { ciphertext, iv, salt: saltB64, hmac },
      address,
      credentialId,
      prfActive,
      createdAt: new Date().toISOString(),
      hasMnemonic: true,
      throttleNonce,
    };

    return { wallet, prfActive, mnemonic };
  } catch (err) {
    zeroBuffer(payload);
    throw err;
  }
}

// ─── Unlock ──────────────────────────────────────────────────────────────────

/**
 * Unlock an existing wallet.
 *
 * 1. Checks PIN throttle (rate limiting + nonce verification).
 * 2. Authenticates via WebAuthn passkey.
 * 3. Derives decryption key from PIN (Argon2id or PBKDF2 based on vault).
 * 4. Verifies vault HMAC integrity (v3 only).
 * 5. Decrypts the private key (+ mnemonic if v3).
 * 6. Migrates v1 → v3 transparently on success.
 *
 * @param wallet - The encrypted wallet from storage.
 * @param pin - The user's PIN.
 * @returns The unlocked wallet with private key, optional mnemonic, and lock().
 * @throws If throttled, passkey fails, wrong PIN, or vault tampered.
 */
export async function unlock(
  wallet: FoidWallet,
  pin: string,
  signal?: AbortSignal,
): Promise<UnlockedWallet> {
  // Check throttle nonce (v3 only)
  if (isV3(wallet) && !verifyThrottleNonce(wallet.throttleNonce)) {
    applyNonceMismatchLockout(wallet.throttleNonce);
    throw new Error('Security check failed. Please wait before trying again.');
  }

  // Check rate limit
  const throttle = checkThrottle();
  if (!throttle.allowed) {
    const secs = Math.ceil((throttle.waitMs ?? 0) / 1000);
    throw new Error(
      throttle.attemptsRemaining === 0
        ? `Too many failed attempts. Please wait ${secs} seconds.`
        : `Please wait ${secs} seconds before trying again.`,
    );
  }

  if (!wallet.credentialId) {
    throw new Error('Wallet has no passkey. Cannot authenticate.');
  }

  // Authenticate via passkey
  const { prfOutput } = await authenticatePasskey(
    wallet.credentialId,
    wallet.prfActive,
    signal,
  );

  if (wallet.prfActive && !prfOutput) {
    throw new Error(
      'This wallet was secured with biometric + PIN, but biometric key derivation ' +
      'is no longer available on this device. You can restore from backup or seed phrase.',
    );
  }

  // Determine KDF
  const kdf: KdfType = isV3(wallet) ? wallet.kdf : 'pbkdf2';

  // Derive decryption key
  const saltBytes = new Uint8Array(fromB64(wallet.vault.salt));
  const { key: decKey } = await deriveEncryptionKey(pin, saltBytes, kdf, prfOutput);

  // Verify HMAC integrity (v3 only)
  if (isV3(wallet) && wallet.vault.hmac) {
    const valid = await verifyVaultHmac(
      wallet.vault.ciphertext,
      wallet.vault.iv,
      wallet.vault.salt,
      wallet.vault.hmac,
    );
    if (!valid) {
      const nonce = isV3(wallet) ? wallet.throttleNonce : undefined;
      recordFailure(nonce);
      throw new Error('Wallet data integrity check failed. The vault may have been tampered with.');
    }
  }

  // Decrypt
  let plaintext: ArrayBuffer;
  try {
    plaintext = await decrypt(
      { ciphertext: wallet.vault.ciphertext, iv: wallet.vault.iv },
      decKey,
    );
  } catch {
    const nonce = isV3(wallet) ? wallet.throttleNonce : undefined;
    recordFailure(nonce);
    throw new Error('Wrong PIN. Decryption failed.');
  }

  // Success — reset throttle
  const nonce = isV3(wallet) ? wallet.throttleNonce : undefined;
  recordSuccess(nonce);

  // Decode payload
  const decoded = decodeVaultPayload(plaintext);
  const privateKeyHex = decoded.privateKey;
  const mnemonicText = decoded.mnemonic;
  const address = wallet.address;

  // Migrate v1 → v3 if needed (transparent to user)
  if (needsMigration(wallet)) {
    try {
      await migrateToV3(wallet, pin, prfOutput, decoded);
    } catch {
      // Migration failure is non-fatal — wallet still works
    }
  }

  let locked = false;
  return {
    privateKey: privateKeyHex,
    address,
    mnemonic: mnemonicText,
    lock() {
      if (!locked) {
        new Uint8Array(plaintext).fill(0);
        locked = true;
      }
    },
  };
}

// ─── Restore from Mnemonic ──────────────────────────────────────────────────

/**
 * Create a new wallet from an existing mnemonic seed phrase.
 * Derives the same private key and creates a fresh v3 vault.
 *
 * @param mnemonic - 12-word BIP-39 mnemonic.
 * @param pin - New PIN for the wallet.
 * @returns The encrypted wallet and PRF status.
 * @throws If mnemonic is invalid or PIN is too short.
 */
export async function restoreFromMnemonic(
  mnemonic: string,
  userId: string,
  userName: string,
  pin: string,
  signal?: AbortSignal,
): Promise<{ wallet: FoidWalletV3; prfActive: boolean }> {
  if (pin.length < MIN_PIN_LENGTH) {
    throw new Error(`PIN must be at least ${MIN_PIN_LENGTH} characters.`);
  }
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase. Please check your words and try again.');
  }

  const { privateKey, address } = mnemonicToPrivateKey(mnemonic);
  const payload = encodeVaultPayload({ privateKey, mnemonic: mnemonic.trim().toLowerCase() });

  try {
    const { credentialId, prfOutput } = await createPasskey(userId, userName, signal);

    const salt = newSalt();
    const kdf = await bestAvailableKdf();
    const { key: encKey, prfActive } = await deriveEncryptionKey(pin, salt, kdf, prfOutput);

    const { ciphertext, iv } = await encrypt(payload, encKey);
    zeroBuffer(payload);

    const saltB64 = toB64(salt.buffer);
    const hmac = await computeVaultHmac(ciphertext, iv, saltB64);
    const throttleNonce = generateThrottleNonce();
    recordSuccess(throttleNonce);

    const wallet: FoidWalletV3 = {
      version: WALLET_VERSION,
      kdf,
      vault: { ciphertext, iv, salt: saltB64, hmac },
      address,
      credentialId,
      prfActive,
      createdAt: new Date().toISOString(),
      hasMnemonic: true,
      throttleNonce,
    };

    return { wallet, prfActive };
  } catch (err) {
    zeroBuffer(payload);
    throw err;
  }
}

// ─── Internal: v1 → v3 Migration ───────────────────────────────────────────

async function migrateToV3(
  oldWallet: FoidWallet,
  pin: string,
  prfOutput: ArrayBuffer | null | undefined,
  decoded: { privateKey: string; mnemonic?: string },
): Promise<void> {
  // Re-encrypt with best available KDF
  const kdf = await bestAvailableKdf();
  const salt = newSalt();
  const { key: encKey, prfActive } = await deriveEncryptionKey(pin, salt, kdf, prfOutput);

  const payload = encodeVaultPayload(decoded);
  const { ciphertext, iv } = await encrypt(payload, encKey);
  zeroBuffer(payload);

  const saltB64 = toB64(salt.buffer);
  const hmac = await computeVaultHmac(ciphertext, iv, saltB64);
  const throttleNonce = generateThrottleNonce();

  const migrated: FoidWalletV3 = {
    version: WALLET_VERSION,
    kdf,
    vault: { ciphertext, iv, salt: saltB64, hmac },
    address: oldWallet.address,
    credentialId: oldWallet.credentialId,
    prfActive,
    createdAt: oldWallet.createdAt,
    hasMnemonic: !!decoded.mnemonic,
    throttleNonce,
  };

  // Crash-safe: write to pending key first, then finalize
  savePendingMigration(migrated);
  saveToStorage(migrated);
  recordSuccess(throttleNonce);
}
