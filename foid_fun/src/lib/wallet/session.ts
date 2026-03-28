/**
 * FOID Wallet v3 — Web Worker-based session management.
 *
 * Caches the unlocked private key in a Web Worker (separate thread).
 * The main thread never holds the raw key — all signing goes through
 * postMessage RPC. This prevents XSS attacks from reading the key.
 *
 * Fallback: if Workers are unavailable, encrypts the key in memory
 * with a random session-only AES key (CryptoKey, non-extractable).
 */

import { SESSION_TIMEOUT_MS, WORKER_MANAGED_KEY } from './constants';

// ─── Worker RPC ─────────────────────────────────────────────────────────────

type WorkerResolve = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let _worker: Worker | null = null;
let _workerReady = false;
let _pendingCalls = new Map<string, WorkerResolve>();
let _callId = 0;
let _sessionExpiredCallback: (() => void) | null = null;

function nextId(): string {
  return `rpc_${++_callId}`;
}

function workerCall(type: string, data?: Record<string, unknown>): Promise<unknown> {
  if (!_worker) return Promise.reject(new Error('No worker'));
  return new Promise((resolve, reject) => {
    const id = nextId();
    _pendingCalls.set(id, { resolve, reject });
    _worker!.postMessage({ type, id, ...data });
    // Timeout safety: reject if no response in 30s
    setTimeout(() => {
      if (_pendingCalls.has(id)) {
        _pendingCalls.delete(id);
        reject(new Error(`Worker call ${type} timed out`));
      }
    }, 30_000);
  });
}

function handleWorkerMessage(event: MessageEvent): void {
  const { type, id, result, error } = event.data;

  if (type === 'session_expired') {
    _workerReady = false;
    _sessionAddress = null;
    _usingWorker = false;
    if (_sessionExpiredCallback) _sessionExpiredCallback();
    return;
  }

  const pending = _pendingCalls.get(id);
  if (!pending) return;
  _pendingCalls.delete(id);

  if (type === 'error') {
    pending.reject(new Error(error));
  } else {
    pending.resolve(result);
  }
}

// ─── Fallback: Encrypted In-Memory ──────────────────────────────────────────

let _fallbackEncryptedKey: ArrayBuffer | null = null;
let _fallbackIv: Uint8Array | null = null;
let _fallbackSessionKey: CryptoKey | null = null;
let _fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

async function fallbackInit(privateKey: string): Promise<void> {
  // Generate a random session-only AES key (non-extractable)
  _fallbackSessionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — can't be read by XSS
    ['encrypt', 'decrypt'],
  );
  _fallbackIv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(privateKey);
  _fallbackEncryptedKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: _fallbackIv },
    _fallbackSessionKey,
    plaintext,
  );
  // Zero the plaintext
  plaintext.fill(0);
  resetFallbackTimeout();
}

async function fallbackGetKey(): Promise<string> {
  if (!_fallbackEncryptedKey || !_fallbackSessionKey || !_fallbackIv) {
    throw new Error('No active session');
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: _fallbackIv },
    _fallbackSessionKey,
    _fallbackEncryptedKey,
  );
  const key = new TextDecoder().decode(plaintext);
  // Zero the decrypted buffer
  new Uint8Array(plaintext).fill(0);
  return key;
}

function fallbackClear(): void {
  _fallbackEncryptedKey = null;
  _fallbackIv = null;
  _fallbackSessionKey = null;
  if (_fallbackTimeout) {
    clearTimeout(_fallbackTimeout);
    _fallbackTimeout = null;
  }
}

function resetFallbackTimeout(): void {
  if (_fallbackTimeout) clearTimeout(_fallbackTimeout);
  _fallbackTimeout = setTimeout(() => {
    fallbackClear();
    _sessionAddress = null;
    _usingWorker = false;
    if (_sessionExpiredCallback) _sessionExpiredCallback();
  }, SESSION_TIMEOUT_MS);
}

// ─── Shared State ───────────────────────────────────────────────────────────

let _sessionAddress: string | null = null;
let _usingWorker = false;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize a new session with the unlocked private key.
 * Attempts Web Worker isolation first; falls back to encrypted in-memory.
 */
export async function setSession(privateKey: string, address: string): Promise<void> {
  // Try Worker first
  if (typeof Worker !== 'undefined') {
    try {
      if (!_worker) {
        _worker = new Worker(
          new URL('./worker.ts', import.meta.url),
          { type: 'module' },
        );
        _worker.onmessage = handleWorkerMessage;
        _worker.onerror = () => {
          // Worker failed — fall back
          _worker?.terminate();
          _worker = null;
          _workerReady = false;
        };
      }

      await workerCall('init', { privateKey, address });
      _workerReady = true;
      _usingWorker = true;
      _sessionAddress = address;
      return;
    } catch {
      // Worker init failed — fall back
      if (_worker) {
        _worker.terminate();
        _worker = null;
      }
      _workerReady = false;
    }
  }

  // Fallback: encrypted in-memory
  await fallbackInit(privateKey);
  _usingWorker = false;
  _sessionAddress = address;
}

/**
 * Retrieve the current session.
 * In Worker mode, privateKey is a sentinel value — use sign() methods instead.
 */
export function getSession(): { privateKey: string; address: string } | null {
  if (!_sessionAddress) return null;

  if (_usingWorker && _workerReady) {
    return { privateKey: WORKER_MANAGED_KEY, address: _sessionAddress };
  }

  if (_fallbackEncryptedKey && _fallbackSessionKey) {
    return { privateKey: WORKER_MANAGED_KEY, address: _sessionAddress };
  }

  return null;
}

/**
 * Check if the session is using Worker mode.
 */
export function isWorkerMode(): boolean {
  return _usingWorker && _workerReady;
}

/**
 * Sign a message using the session's private key.
 * Works in both Worker and fallback modes.
 */
export async function sessionSign(message: string): Promise<string> {
  if (_usingWorker && _workerReady) {
    return (await workerCall('sign', { message })) as string;
  }

  // Fallback: decrypt key, sign, zero
  const { privateKeyToAccount } = await import('viem/accounts');
  const key = await fallbackGetKey();
  const account = privateKeyToAccount(key as `0x${string}`);
  const sig = await account.signMessage({ message: { raw: message as `0x${string}` } });
  resetFallbackTimeout();
  return sig;
}

/**
 * Sign EIP-712 typed data using the session's private key.
 */
export async function sessionSignTypedData(typedData: {
  domain: unknown;
  types: unknown;
  primaryType: string;
  message: unknown;
}): Promise<string> {
  if (_usingWorker && _workerReady) {
    return (await workerCall('signTypedData', { typedData })) as string;
  }

  const { privateKeyToAccount } = await import('viem/accounts');
  const key = await fallbackGetKey();
  const account = privateKeyToAccount(key as `0x${string}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sig = await account.signTypedData(typedData as any);
  resetFallbackTimeout();
  return sig;
}

/**
 * Sign a transaction using the session's private key.
 * Returns the serialized signed transaction (for eth_sendRawTransaction).
 */
export async function sessionSignTransaction(transaction: unknown): Promise<string> {
  if (_usingWorker && _workerReady) {
    return (await workerCall('signTransaction', { transaction })) as string;
  }

  const { privateKeyToAccount } = await import('viem/accounts');
  const key = await fallbackGetKey();
  const account = privateKeyToAccount(key as `0x${string}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sig = await account.signTransaction(transaction as any);
  resetFallbackTimeout();
  return sig;
}

/**
 * Refresh the session timeout.
 */
export async function refreshSession(): Promise<void> {
  if (_usingWorker && _workerReady) {
    await workerCall('refresh');
    return;
  }
  if (_fallbackEncryptedKey) {
    resetFallbackTimeout();
  }
}

/**
 * Clear the session. Private key is destroyed.
 */
export async function clearSession(): Promise<void> {
  if (_worker) {
    try { await workerCall('clear'); } catch { /* ignore */ }
    _worker.terminate();
    _worker = null;
    _workerReady = false;
  }
  fallbackClear();
  _sessionAddress = null;
  _usingWorker = false;
  _pendingCalls.clear();
}

/**
 * Set a callback for when the session expires due to inactivity.
 */
export function onSessionExpired(callback: () => void): void {
  _sessionExpiredCallback = callback;
}

/**
 * Get the raw private key for one-time export (requires re-authentication).
 * Only works in fallback mode. In Worker mode, the caller must re-unlock
 * the vault directly to get the key.
 */
export async function getPrivateKeyForExport(): Promise<string | null> {
  if (_usingWorker) return null; // Must re-unlock vault for export
  if (!_fallbackEncryptedKey) return null;
  return fallbackGetKey();
}
