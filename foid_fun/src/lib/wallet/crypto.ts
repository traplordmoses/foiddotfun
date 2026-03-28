/**
 * FOID Wallet v3 — Cryptographic primitives.
 *
 * Pure functions, zero side effects, no DOM or storage dependencies.
 * This module is the auditable security core of the wallet.
 *
 * Primary KDF: Argon2id (memory-hard, GPU-resistant) via hash-wasm WASM.
 * Fallback KDF: PBKDF2-SHA-256 (600k iterations) for devices without WASM.
 * Encryption: AES-256-GCM with random 12-byte IV per operation.
 * Dual-factor: WebAuthn PRF output XOR'd with PIN-derived key.
 * Integrity: HMAC-SHA-256 over vault blob to detect tampering.
 */

import {
  GCM_IV_BYTES,
  PBKDF2_SALT_BYTES,
  PBKDF2_ITERATIONS,
  ARGON2_MEMORY_KB,
  ARGON2_ITERATIONS,
  ARGON2_HASH_LENGTH,
  ARGON2_PARALLELISM,
  HKDF_INFO,
  HMAC_INFO,
} from './constants';

// ─── Argon2id Availability ──────────────────────────────────────────────────

let _argon2Available: boolean | null = null;

/** Feature-detect Argon2id WASM availability. Cached after first call. */
export async function isArgon2Available(): Promise<boolean> {
  if (_argon2Available !== null) return _argon2Available;
  try {
    const { argon2id } = await import('hash-wasm');
    // Quick smoke test with minimal params to verify WASM loads
    await argon2id({
      password: new Uint8Array([0]),
      salt: new Uint8Array(16),
      parallelism: 1,
      iterations: 1,
      memorySize: 1024,
      hashLength: 32,
      outputType: 'binary',
    });
    _argon2Available = true;
  } catch {
    _argon2Available = false;
  }
  return _argon2Available;
}

// ─── Encoding ────────────────────────────────────────────────────────────────

/** Convert ArrayBuffer to base64 string. */
export function toB64(b: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(b)));
}

/** Convert base64 string to ArrayBuffer. */
export function fromB64(s: string): ArrayBuffer {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

/** Convert ArrayBuffer to URL-safe base64 (no padding). */
export function toB64Url(b: ArrayBuffer): string {
  return toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Convert URL-safe base64 to ArrayBuffer. */
export function fromB64Url(s: string): ArrayBuffer {
  let b = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  return fromB64(b);
}

// ─── Random ──────────────────────────────────────────────────────────────────

/** Generate cryptographically secure random bytes. */
export function rand(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

// ─── Memory Cleanup ──────────────────────────────────────────────────────────

/** Zero out a Uint8Array to remove sensitive data from memory. */
export function zeroBuffer(buf: Uint8Array): void {
  buf.fill(0);
}

// ─── Key Derivation: Argon2id (Primary) ─────────────────────────────────────

/**
 * Derive a non-extractable AES-256-GCM key from a PIN via Argon2id.
 * Memory-hard: 64MB memory, 3 iterations. Resists GPU brute-force.
 */
export async function pinToKeyArgon2(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const { argon2id } = await import('hash-wasm');
  const hash = await argon2id({
    password: new TextEncoder().encode(pin),
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary',
  });
  const key = await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  zeroBuffer(hash);
  return key;
}

/**
 * Derive an extractable AES-256-GCM key from a PIN via Argon2id.
 * Extractable so we can XOR it with a PRF-derived key.
 */
export async function pinToExtractableKeyArgon2(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const { argon2id } = await import('hash-wasm');
  const hash = await argon2id({
    password: new TextEncoder().encode(pin),
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary',
  });
  const key = await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  zeroBuffer(hash);
  return key;
}

// ─── Key Derivation: PBKDF2 (Fallback + Migration) ─────────────────────────

/**
 * Derive a non-extractable AES-256-GCM key from a PIN via PBKDF2.
 * Used for v1 vault migration and as Argon2id fallback.
 */
export async function pinToKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Derive an extractable AES-256-GCM key from a PIN via PBKDF2.
 * Extractable so we can XOR it with a PRF-derived key.
 */
export async function pinToExtractableKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// ─── Key Derivation: PRF ────────────────────────────────────────────────────

/**
 * Derive an extractable AES-256-GCM key from WebAuthn PRF output via HKDF.
 */
export async function prfToKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const hkdf = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: HKDF_INFO },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Combine PIN-derived and PRF-derived keys via XOR.
 * Both input keys are exported, XOR'd, and the raw material is zeroed.
 * Returns a non-extractable combined key.
 */
export async function combineKeys(pinKey: CryptoKey, prfKey: CryptoKey): Promise<CryptoKey> {
  const pinRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pinKey));
  const prfRaw = new Uint8Array(await crypto.subtle.exportKey('raw', prfKey));
  const combined = new Uint8Array(32);
  for (let i = 0; i < 32; i++) combined[i] = pinRaw[i] ^ prfRaw[i];
  zeroBuffer(pinRaw);
  zeroBuffer(prfRaw);
  const key = await crypto.subtle.importKey(
    'raw',
    combined,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  zeroBuffer(combined);
  return key;
}

// ─── Unified Key Derivation ─────────────────────────────────────────────────

export type KdfType = 'argon2id' | 'pbkdf2';

/**
 * Derive the final encryption key from PIN and optional PRF output.
 * Dispatches to Argon2id or PBKDF2 based on the `kdf` parameter.
 *
 * @param kdf - Which KDF to use. v3 wallets use 'argon2id', v1 uses 'pbkdf2'.
 * @returns The encryption key and whether PRF was used.
 */
export async function deriveEncryptionKey(
  pin: string,
  salt: Uint8Array,
  kdf: KdfType,
  prfOutput?: ArrayBuffer | null,
): Promise<{ key: CryptoKey; prfActive: boolean }> {
  const needsExtractable = prfOutput && prfOutput.byteLength > 0;

  if (needsExtractable) {
    const pKey = kdf === 'argon2id'
      ? await pinToExtractableKeyArgon2(pin, salt)
      : await pinToExtractableKey(pin, salt);
    const rKey = await prfToKey(prfOutput);
    const key = await combineKeys(pKey, rKey);
    return { key, prfActive: true };
  }

  const key = kdf === 'argon2id'
    ? await pinToKeyArgon2(pin, salt)
    : await pinToKey(pin, salt);
  return { key, prfActive: false };
}

/**
 * Determine the best available KDF for new wallets.
 * Prefers Argon2id, falls back to PBKDF2.
 */
export async function bestAvailableKdf(): Promise<KdfType> {
  return (await isArgon2Available()) ? 'argon2id' : 'pbkdf2';
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64
}

/**
 * Encrypt plaintext bytes with AES-256-GCM.
 * Generates a fresh random IV for each call.
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = rand(GCM_IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );
  return {
    ciphertext: toB64(ciphertext),
    iv: toB64(iv.buffer),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * @throws On wrong key or tampered data.
 */
export async function decrypt(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.iv) },
    key,
    fromB64(payload.ciphertext),
  );
}

// ─── Vault Integrity (HMAC) ─────────────────────────────────────────────────

/**
 * Compute HMAC-SHA-256 over vault data for tamper detection.
 * The HMAC key is derived from the salt via HKDF (no PIN needed — the goal
 * is integrity, not confidentiality; the vault is already encrypted).
 */
export async function computeVaultHmac(
  ciphertext: string,
  iv: string,
  salt: string,
): Promise<string> {
  const saltBytes = new Uint8Array(fromB64(salt));
  const hkdfKey = await crypto.subtle.importKey('raw', saltBytes, 'HKDF', false, [
    'deriveKey',
  ]);
  const hmacKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: HMAC_INFO },
    hkdfKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(ciphertext + '|' + iv);
  const signature = await crypto.subtle.sign('HMAC', hmacKey, data);
  return toB64(signature);
}

/**
 * Verify vault HMAC. Returns true if valid, false if tampered.
 */
export async function verifyVaultHmac(
  ciphertext: string,
  iv: string,
  salt: string,
  expectedHmac: string,
): Promise<boolean> {
  const computed = await computeVaultHmac(ciphertext, iv, salt);
  // Constant-time-ish comparison via subtle crypto
  if (computed.length !== expectedHmac.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Generate a new PBKDF2/Argon2id salt. */
export function newSalt(): Uint8Array {
  return rand(PBKDF2_SALT_BYTES);
}
