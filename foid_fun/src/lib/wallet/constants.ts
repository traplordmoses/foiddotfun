/**
 * FOID Wallet v3 constants — single source of truth for all wallet configuration.
 */

// ─── Crypto ──────────────────────────────────────────────────────────────────

/** AES-GCM initialization vector size (NIST recommended). */
export const GCM_IV_BYTES = 12;

/** PBKDF2 / Argon2id salt size. */
export const PBKDF2_SALT_BYTES = 32;

/** PBKDF2 iteration count (OWASP 2023 recommendation for SHA-256). */
export const PBKDF2_ITERATIONS = 600_000;

// ─── Argon2id ────────────────────────────────────────────────────────────────

/** Argon2id memory cost in KiB (64 MB). */
export const ARGON2_MEMORY_KB = 65_536;

/** Argon2id time cost (iterations). */
export const ARGON2_ITERATIONS = 3;

/** Argon2id output hash length in bytes. */
export const ARGON2_HASH_LENGTH = 32;

/** Argon2id parallelism factor. */
export const ARGON2_PARALLELISM = 1;

// ─── Key Derivation Info ────────────────────────────────────────────────────

/** HKDF info field for PRF-derived keys. */
export const HKDF_INFO = new TextEncoder().encode('foid-wallet-v1');

/** PRF salt for WebAuthn passkey extension. */
export const PRF_SALT = new TextEncoder().encode('foid:wallet:prf:v1');

/** HMAC key info for vault integrity. */
export const HMAC_INFO = new TextEncoder().encode('foid-wallet-hmac-v3');

// ─── Wallet Format ───────────────────────────────────────────────────────────

/** Current wallet vault version. */
export const WALLET_VERSION = 3 as const;

/** Minimum accepted wallet version for import. */
export const MIN_WALLET_VERSION = 1;

// ─── Storage ─────────────────────────────────────────────────────────────────

/** localStorage key for the encrypted wallet blob. */
export const STORAGE_KEY = 'foid_wallet';

/** localStorage key indicating embedded wallet is active (wagmi connector). */
export const ACTIVE_KEY = 'foid-embedded-active';

/** localStorage key for PIN throttle state. */
export const THROTTLE_KEY = 'foid_pin_throttle';

/** localStorage key for crash-safe migration pending vault. */
export const PENDING_KEY = 'foid_wallet_pending';

// ─── PIN ─────────────────────────────────────────────────────────────────────

/** Minimum PIN length. */
export const MIN_PIN_LENGTH = 6;

/** Maximum consecutive failed PIN attempts before lockout. */
export const MAX_PIN_ATTEMPTS = 10;

/** Lockout duration after max failed attempts (5 minutes). */
export const PIN_LOCKOUT_MS = 5 * 60 * 1000;

// ─── Session ─────────────────────────────────────────────────────────────────

/** In-memory session timeout (30 minutes). */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Sentinel value for worker-managed private keys. */
export const WORKER_MANAGED_KEY = '__WORKER_MANAGED__' as const;
