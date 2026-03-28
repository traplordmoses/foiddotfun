/**
 * FOID Wallet v3 — Web Worker for private key isolation.
 *
 * This Worker holds the unlocked private key in a separate thread.
 * The main thread never sees the raw key after initialization.
 * All signing operations go through postMessage RPC.
 *
 * The Worker auto-clears the key after SESSION_TIMEOUT_MS of inactivity.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { serializeTransaction, type TransactionSerializable } from 'viem';
import { SESSION_TIMEOUT_MS } from './constants';

// ─── Worker State ───────────────────────────────────────────────────────────

let _privateKey: `0x${string}` | null = null;
let _address: string | null = null;
let _timeoutId: ReturnType<typeof setTimeout> | null = null;

function resetTimeout(): void {
  if (_timeoutId) clearTimeout(_timeoutId);
  _timeoutId = setTimeout(() => {
    _privateKey = null;
    _address = null;
    self.postMessage({ type: 'session_expired' });
  }, SESSION_TIMEOUT_MS);
}

function clearState(): void {
  _privateKey = null;
  _address = null;
  if (_timeoutId) {
    clearTimeout(_timeoutId);
    _timeoutId = null;
  }
}

// ─── Message Handler ────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const { type, id } = event.data;

  try {
    switch (type) {
      case 'init': {
        _privateKey = event.data.privateKey as `0x${string}`;
        _address = event.data.address as string;
        resetTimeout();
        self.postMessage({ type: 'init_ok', id });
        break;
      }

      case 'sign': {
        if (!_privateKey) {
          self.postMessage({ type: 'error', id, error: 'No active session' });
          return;
        }
        resetTimeout();
        const account = privateKeyToAccount(_privateKey);
        const signature = await account.signMessage({
          message: { raw: event.data.message as `0x${string}` },
        });
        self.postMessage({ type: 'result', id, result: signature });
        break;
      }

      case 'signTypedData': {
        if (!_privateKey) {
          self.postMessage({ type: 'error', id, error: 'No active session' });
          return;
        }
        resetTimeout();
        const account2 = privateKeyToAccount(_privateKey);
        const typedData = event.data.typedData;
        const sig = await account2.signTypedData({
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        });
        self.postMessage({ type: 'result', id, result: sig });
        break;
      }

      case 'signTransaction': {
        if (!_privateKey) {
          self.postMessage({ type: 'error', id, error: 'No active session' });
          return;
        }
        resetTimeout();
        const account3 = privateKeyToAccount(_privateKey);
        const tx = event.data.transaction as TransactionSerializable;
        const signature3 = await account3.signTransaction(tx);
        self.postMessage({ type: 'result', id, result: signature3 });
        break;
      }

      case 'getAddress': {
        self.postMessage({ type: 'result', id, result: _address });
        break;
      }

      case 'refresh': {
        if (_privateKey) resetTimeout();
        self.postMessage({ type: 'result', id, result: !!_privateKey });
        break;
      }

      case 'isActive': {
        self.postMessage({ type: 'result', id, result: !!_privateKey });
        break;
      }

      case 'clear': {
        clearState();
        self.postMessage({ type: 'result', id, result: true });
        break;
      }

      default: {
        self.postMessage({ type: 'error', id, error: `Unknown message type: ${type}` });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', id, error: message });
  }
};
