/**
 * DIY Embedded Wallet — browser-side key management
 *
 * Private key generated via viem, encrypted with WebCrypto AES-256-GCM,
 * stored in IndexedDB. No external dependencies.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";

const DB_NAME = "foid-wallet";
const STORE_NAME = "keys";
const KEY_ID = "embedded-wallet-v1";

// ── IndexedDB helpers ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Encryption helpers ──

type StoredWallet = {
  address: string;
  encryptedKey: ArrayBuffer;
  iv: Uint8Array;
  wrappedCryptoKey: ArrayBuffer;
  salt: Uint8Array;
};

/**
 * Generate a random AES-256-GCM key via WebCrypto.
 * We derive it from a random 32-byte secret + salt using PBKDF2
 * so we can store the secret and reconstruct later.
 */
async function deriveAESKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    secret,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPrivateKey(
  privateKey: string,
  secret: Uint8Array,
  salt: Uint8Array,
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const aesKey = await deriveAESKey(secret, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(privateKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded,
  );
  return { encrypted, iv };
}

async function decryptPrivateKey(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  secret: Uint8Array,
  salt: Uint8Array,
): Promise<string> {
  const aesKey = await deriveAESKey(secret, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
}

// ── Session secret ──
// A random 32-byte secret is generated once per wallet creation and stored
// alongside the encrypted key in IndexedDB. This isn't password-based —
// it's a device-local encryption key that protects at rest.

const SECRET_KEY = "foid-wallet-secret";

function getOrCreateSecret(): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array(32);
  const stored = sessionStorage.getItem(SECRET_KEY);
  if (stored) {
    return new Uint8Array(JSON.parse(stored));
  }
  // Check IndexedDB for persisted secret (set during wallet creation)
  return new Uint8Array(32); // placeholder, actual retrieval is async
}

async function getSecretAsync(): Promise<Uint8Array> {
  // First check sessionStorage (fast path)
  const stored = sessionStorage.getItem(SECRET_KEY);
  if (stored) return new Uint8Array(JSON.parse(stored));

  // Then check IndexedDB
  const persisted = await dbGet<number[]>("wallet-secret");
  if (persisted) {
    const secret = new Uint8Array(persisted);
    sessionStorage.setItem(SECRET_KEY, JSON.stringify(Array.from(secret)));
    return secret;
  }

  throw new Error("No wallet secret found");
}

function storeSecret(secret: Uint8Array): void {
  sessionStorage.setItem(SECRET_KEY, JSON.stringify(Array.from(secret)));
}

// ── Public API ──

export async function hasEmbeddedWallet(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const wallet = await dbGet<StoredWallet>(KEY_ID);
    return !!wallet;
  } catch {
    return false;
  }
}

export async function getEmbeddedAddress(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const wallet = await dbGet<StoredWallet>(KEY_ID);
    return wallet?.address ?? null;
  } catch {
    return null;
  }
}

export async function createEmbeddedWallet(): Promise<{ address: string }> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const secret = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { encrypted, iv } = await encryptPrivateKey(privateKey, secret, salt);

  const walletData: StoredWallet = {
    address: account.address,
    encryptedKey: encrypted,
    iv,
    wrappedCryptoKey: new ArrayBuffer(0), // unused, kept for compat
    salt,
  };

  await dbPut(KEY_ID, walletData);
  await dbPut("wallet-secret", Array.from(secret));
  storeSecret(secret);

  return { address: account.address };
}

export async function getEmbeddedAccount(): Promise<PrivateKeyAccount> {
  const wallet = await dbGet<StoredWallet>(KEY_ID);
  if (!wallet) throw new Error("No embedded wallet found");

  const secret = await getSecretAsync();
  const privateKey = await decryptPrivateKey(
    wallet.encryptedKey,
    wallet.iv,
    secret,
    wallet.salt,
  );

  return privateKeyToAccount(privateKey as `0x${string}`);
}

export async function exportPrivateKey(): Promise<string> {
  const wallet = await dbGet<StoredWallet>(KEY_ID);
  if (!wallet) throw new Error("No embedded wallet found");

  const secret = await getSecretAsync();
  return decryptPrivateKey(wallet.encryptedKey, wallet.iv, secret, wallet.salt);
}

export async function clearEmbeddedWallet(): Promise<void> {
  await dbDelete(KEY_ID);
  await dbDelete("wallet-secret");
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SECRET_KEY);
  }
}
