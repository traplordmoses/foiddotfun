/**
 * DIY Embedded Wallet — browser-side key management with passkey protection
 *
 * Private key generated via viem, encrypted with AES-256-GCM using a key
 * derived from a WebAuthn PRF extension output (passkey biometrics).
 * Falls back to random-secret mode if PRF is not supported.
 *
 * Stored in IndexedDB. No external dependencies.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";

const DB_NAME = "foid-wallet";
const STORE_NAME = "keys";
const KEY_ID = "embedded-wallet-v2";

// Stable salt for PRF evaluation — same salt = same PRF output for same credential
const PRF_SALT = new TextEncoder().encode("foid-wallet-prf-v1");

// ── IndexedDB helpers ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
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
  version: 2;
  address: string;
  encryptedKey: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
  /** WebAuthn credential ID — present if passkey-protected */
  credentialId?: ArrayBuffer;
  /** true if created without PRF (fallback mode) */
  fallbackMode?: boolean;
  /** Random secret stored alongside key when PRF unavailable */
  fallbackSecret?: number[];
};

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

// ── WebAuthn / Passkey helpers ──

/** Check if WebAuthn with PRF extension is available */
async function isPRFAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    // Feature-detect PRF support via getClientCapabilities (very new API)
    const pkc = PublicKeyCredential as unknown as Record<string, unknown>;
    if (typeof pkc.getClientCapabilities === "function") {
      const caps = (await (pkc.getClientCapabilities as () => Promise<Record<string, boolean>>)());
      return caps?.["prf"] === true;
    }
    // Fallback: just try — the worst that happens is PRF isn't in the result
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a passkey and extract the PRF output as encryption secret.
 * Returns the credential ID and the PRF-derived secret.
 */
async function createPasskey(): Promise<{
  credentialId: ArrayBuffer;
  prfSecret: Uint8Array;
} | null> {
  const prfAvail = await isPRFAvailable();
  if (!prfAvail) return null;

  const userId = crypto.getRandomValues(new Uint8Array(32));

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "FOID.FUN" },
      user: {
        id: userId,
        name: "foid-wallet",
        displayName: "FOID Wallet",
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      extensions: {
        // @ts-expect-error — PRF extension not yet in all TS typings
        prf: { eval: { first: PRF_SALT } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential) return null;

  // @ts-expect-error — PRF extension result not in standard typings
  const prfResults = credential.getClientExtensionResults()?.prf?.results;
  if (!prfResults?.first) {
    // PRF not supported by this authenticator — fall back
    return null;
  }

  return {
    credentialId: credential.rawId,
    prfSecret: new Uint8Array(prfResults.first),
  };
}

/**
 * Authenticate with an existing passkey and extract the PRF secret.
 */
async function authenticatePasskey(credentialId: ArrayBuffer): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [
        { type: "public-key", id: credentialId, transports: ["internal"] },
      ],
      userVerification: "required",
      extensions: {
        // @ts-expect-error — PRF extension not yet in all TS typings
        prf: { eval: { first: PRF_SALT } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Passkey authentication cancelled");

  // @ts-expect-error — PRF extension result not in standard typings
  const prfResults = assertion.getClientExtensionResults()?.prf?.results;
  if (!prfResults?.first) {
    throw new Error("PRF output not available from passkey");
  }

  return new Uint8Array(prfResults.first);
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
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Try passkey with PRF first
  const passkey = await createPasskey();

  if (passkey) {
    // Passkey mode — encrypt with PRF-derived secret
    const { encrypted, iv } = await encryptPrivateKey(
      privateKey,
      passkey.prfSecret,
      salt,
    );

    const walletData: StoredWallet = {
      version: 2,
      address: account.address,
      encryptedKey: encrypted,
      iv,
      salt,
      credentialId: passkey.credentialId,
    };

    await dbPut(KEY_ID, walletData);
    return { address: account.address };
  }

  // Fallback — random secret (no passkey protection)
  console.warn("[FOID Wallet] Passkey PRF not available, using fallback mode");
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const { encrypted, iv } = await encryptPrivateKey(privateKey, secret, salt);

  const walletData: StoredWallet = {
    version: 2,
    address: account.address,
    encryptedKey: encrypted,
    iv,
    salt,
    fallbackMode: true,
    fallbackSecret: Array.from(secret),
  };

  await dbPut(KEY_ID, walletData);
  return { address: account.address };
}

export async function getEmbeddedAccount(): Promise<PrivateKeyAccount> {
  const wallet = await dbGet<StoredWallet>(KEY_ID);
  if (!wallet) throw new Error("No embedded wallet found");

  let secret: Uint8Array;

  if (wallet.credentialId && !wallet.fallbackMode) {
    // Passkey mode — authenticate to get PRF secret
    secret = await authenticatePasskey(wallet.credentialId);
  } else if (wallet.fallbackSecret) {
    // Fallback mode — use stored secret
    secret = new Uint8Array(wallet.fallbackSecret);
  } else {
    throw new Error("Wallet data corrupted — no secret available");
  }

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

  let secret: Uint8Array;

  if (wallet.credentialId && !wallet.fallbackMode) {
    secret = await authenticatePasskey(wallet.credentialId);
  } else if (wallet.fallbackSecret) {
    secret = new Uint8Array(wallet.fallbackSecret);
  } else {
    throw new Error("Wallet data corrupted");
  }

  return decryptPrivateKey(wallet.encryptedKey, wallet.iv, secret, wallet.salt);
}

export async function clearEmbeddedWallet(): Promise<void> {
  await dbDelete(KEY_ID);
  if (typeof window !== "undefined") {
    localStorage.removeItem("foid-embedded-active");
  }
}
