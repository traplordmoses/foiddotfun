/**
 * FOID Embedded Wallet — Simple, secure, yours.
 *
 * Security model:
 *   - Private key is AES-256-GCM encrypted at rest. Always.
 *   - Encryption key is derived from a user-chosen PIN/password via PBKDF2.
 *   - PIN never stored anywhere. User remembers it.
 *   - Passkey (biometric) provides device authentication on top.
 *   - If the device supports WebAuthn PRF, we use it as an ADDITIONAL
 *     encryption layer — but we don't depend on it.
 *
 * Threat model:
 *   - XSS attacker reads localStorage -> gets encrypted blob, no key
 *   - Malicious extension reads storage -> same, encrypted blob, no key
 *   - Physical device access -> needs PIN + biometric to unlock
 *   - NOT designed for: state-level adversaries, >$1000 in value
 *
 * What this is NOT:
 *   - Not MPC. Not Shamir. Not audited by a third party.
 *   - Users who hold serious value should use MetaMask.
 */

import { ethers } from 'ethers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoidWallet {
  version: 1;
  vault: {
    ciphertext: string; // base64
    iv: string;         // base64 (12 bytes)
    salt: string;       // base64 (32 bytes, PBKDF2 salt)
  };
  address: string;
  credentialId?: string;
  prfActive: boolean;
  createdAt: string;
}

export interface UnlockedWallet {
  privateKey: string;
  address: string;
  lock: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GCM_IV_BYTES = 12;
const PBKDF2_SALT_BYTES = 32;
const PBKDF2_ITERATIONS = 600_000;
const HKDF_INFO = new TextEncoder().encode('foid-wallet-v1');
const PRF_SALT = new TextEncoder().encode('foid:wallet:prf:v1');
const STORAGE_KEY = 'foid_wallet';

// ─── Encoding ─────────────────────────────────────────────────────────────────

const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
};
const toB64Url = (b: ArrayBuffer) =>
  toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => {
  let b = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  return fromB64(b);
};

// ─── Crypto Primitives ────────────────────────────────────────────────────────

function rand(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function pinToKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
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

async function pinToExtractableKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
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

async function prfToKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
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

async function combineKeys(pinKey: CryptoKey, prfKey: CryptoKey): Promise<CryptoKey> {
  const pinRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pinKey));
  const prfRaw = new Uint8Array(await crypto.subtle.exportKey('raw', prfKey));
  const combined = new Uint8Array(32);
  for (let i = 0; i < 32; i++) combined[i] = pinRaw[i] ^ prfRaw[i];
  pinRaw.fill(0);
  prfRaw.fill(0);
  const key = await crypto.subtle.importKey(
    'raw',
    combined,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  combined.fill(0);
  return key;
}

// ─── WebAuthn / PRF ───────────────────────────────────────────────────────────

interface PasskeyResult {
  credentialId: string;
  prfOutput: ArrayBuffer | null;
}

async function createPasskey(userId: string, userName: string): Promise<PasskeyResult> {
  const challenge = rand(32);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'FOID', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      extensions: {
        // @ts-expect-error PRF not in stable types
        prf: { eval: { first: PRF_SALT } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey creation cancelled.');

  const credentialId = toB64Url(credential.rawId);

  let prfOutput: ArrayBuffer | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ext = credential.getClientExtensionResults() as any;
    const result = ext?.prf?.results?.first;
    if (result && result.byteLength > 0) {
      prfOutput = result;
    }
  } catch {
    // PRF inspection failed — prfOutput stays null
  }

  return { credentialId, prfOutput };
}

async function authenticatePasskey(
  credentialId: string,
  withPrf: boolean,
): Promise<{ prfOutput: ArrayBuffer | null }> {
  const challenge = rand(32);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        { id: fromB64Url(credentialId), type: 'public-key' },
      ],
      userVerification: 'required',
      extensions: withPrf
        // @ts-expect-error PRF not in stable types
        ? { prf: { eval: { first: PRF_SALT } } }
        : {},
    },
  })) as PublicKeyCredential;

  let prfOutput: ArrayBuffer | null = null;
  if (withPrf) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ext = assertion.getClientExtensionResults() as any;
      const result = ext?.prf?.results?.first;
      if (result && result.byteLength > 0) {
        prfOutput = result;
      }
    } catch {
      // no PRF
    }
  }

  return { prfOutput };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CREATE a new wallet.
 * User provides a PIN (min 6 chars). Passkey is created for biometric auth.
 * If PRF works, it's layered on top of PIN encryption via XOR.
 */
export async function create(
  userId: string,
  userName: string,
  pin: string,
): Promise<{ wallet: FoidWallet; prfActive: boolean }> {
  if (pin.length < 6) throw new Error('PIN must be at least 6 characters.');

  const ethWallet = ethers.Wallet.createRandom();
  const privateKeyBytes = ethers.getBytes(ethWallet.privateKey);

  try {
    const { credentialId, prfOutput } = await createPasskey(userId, userName);

    const salt = rand(PBKDF2_SALT_BYTES);
    let encKey: CryptoKey;
    let prfActive = false;

    if (prfOutput) {
      const pKey = await pinToExtractableKey(pin, salt);
      const rKey = await prfToKey(prfOutput);
      encKey = await combineKeys(pKey, rKey);
      prfActive = true;
    } else {
      encKey = await pinToKey(pin, salt);
    }

    const iv = rand(GCM_IV_BYTES);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encKey,
      privateKeyBytes,
    );

    privateKeyBytes.fill(0);

    const wallet: FoidWallet = {
      version: 1,
      vault: {
        ciphertext: toB64(ciphertext),
        iv: toB64(iv.buffer),
        salt: toB64(salt.buffer),
      },
      address: ethWallet.address,
      credentialId,
      prfActive,
      createdAt: new Date().toISOString(),
    };

    return { wallet, prfActive };
  } catch (err) {
    privateKeyBytes.fill(0);
    throw err;
  }
}

/**
 * UNLOCK an existing wallet.
 * User provides PIN. Passkey biometric is triggered.
 * If wallet was created with PRF, PRF is used again automatically.
 */
export async function unlock(
  wallet: FoidWallet,
  pin: string,
): Promise<UnlockedWallet> {
  if (!wallet.credentialId) {
    throw new Error('Wallet has no passkey. Cannot authenticate.');
  }

  const { prfOutput } = await authenticatePasskey(
    wallet.credentialId,
    wallet.prfActive,
  );

  if (wallet.prfActive && !prfOutput) {
    throw new Error(
      'This wallet was secured with biometric + PIN, but biometric key derivation ' +
        'is no longer available on this device. You may need to recover from backup ' +
        'or use the original device.',
    );
  }

  const salt = new Uint8Array(fromB64(wallet.vault.salt));
  let decKey: CryptoKey;

  if (wallet.prfActive && prfOutput) {
    const pKey = await pinToExtractableKey(pin, salt);
    const rKey = await prfToKey(prfOutput);
    decKey = await combineKeys(pKey, rKey);
  } else {
    decKey = await pinToKey(pin, salt);
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(wallet.vault.iv) },
      decKey,
      fromB64(wallet.vault.ciphertext),
    );
  } catch {
    throw new Error('Wrong PIN. Decryption failed.');
  }

  const privateKeyHex = ethers.hexlify(new Uint8Array(plaintext));
  const address = wallet.address;

  let locked = false;
  return {
    privateKey: privateKeyHex,
    address,
    lock() {
      if (!locked) {
        new Uint8Array(plaintext).fill(0);
        locked = true;
      }
    },
  };
}

/**
 * EXPORT the encrypted wallet blob (for backup). Safe to store anywhere.
 */
export function exportWallet(wallet: FoidWallet): string {
  return JSON.stringify(wallet);
}

/**
 * IMPORT a wallet from backup.
 */
export function importWallet(json: string): FoidWallet {
  const w = JSON.parse(json) as FoidWallet;
  if (w.version !== 1) throw new Error(`Unsupported wallet version: ${w.version}`);
  if (!w.vault?.ciphertext || !w.vault?.iv || !w.vault?.salt) {
    throw new Error('Invalid wallet data.');
  }
  return w;
}

// ─── Local Storage ────────────────────────────────────────────────────────────

export function save(wallet: FoidWallet): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
}

export function load(): FoidWallet | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FoidWallet;
  } catch {
    return null;
  }
}

export function exists(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function clear(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStoredAddress(): string | null {
  const w = load();
  return w?.address ?? null;
}

// ─── Session Management ───────────────────────────────────────────────────────
// In-memory cache of the unlocked private key for the current session.
// Cleared on disconnect or page reload. Never persisted to storage.

let _sessionPrivateKey: string | null = null;
let _sessionAddress: string | null = null;

export function setSession(privateKey: string, address: string): void {
  _sessionPrivateKey = privateKey;
  _sessionAddress = address;
}

export function getSession(): { privateKey: string; address: string } | null {
  if (!_sessionPrivateKey || !_sessionAddress) return null;
  return { privateKey: _sessionPrivateKey, address: _sessionAddress };
}

export function clearSession(): void {
  _sessionPrivateKey = null;
  _sessionAddress = null;
}
