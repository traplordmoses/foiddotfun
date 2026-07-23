/**
 * FOID Wallet v3 — WebAuthn / Passkey integration.
 *
 * Handles passkey creation and authentication, including the PRF
 * (Pseudo-Random Function) extension for additional encryption.
 *
 * Platform authenticator is preferred (Touch ID, Face ID, Windows Hello)
 * over third-party password managers that may not support PRF.
 */

import { rand, toB64Url, fromB64Url } from './crypto';
import { PRF_SALT } from './constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PasskeyResult {
  credentialId: string;
  prfOutput: ArrayBuffer | null;
}

export interface AuthResult {
  prfOutput: ArrayBuffer | null;
}

// ─── Feature Detection ──────────────────────────────────────────────────────

/**
 * Check whether WebAuthn passkeys are available on this device.
 */
export async function isPasskeyAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ─── Error Handling ─────────────────────────────────────────────────────────

function mapPasskeyError(err: unknown, operation: 'create' | 'authenticate'): Error {
  if (!(err instanceof DOMException)) {
    return err instanceof Error ? err : new Error(String(err));
  }

  switch (err.name) {
    case 'AbortError':
      return new Error('Passkey prompt cancelled.');
    case 'NotAllowedError':
      return new Error(
        operation === 'create'
          ? 'Passkey creation was cancelled or timed out. Please try again.'
          : 'Passkey authentication was cancelled or timed out. Please try again.',
      );
    case 'InvalidStateError':
      return new Error(
        'This passkey may have been deleted from your device. ' +
        'You can restore your wallet from a backup file or seed phrase.',
      );
    case 'NotSupportedError':
      return new Error(
        'Your browser does not support passkeys. ' +
        'Please use a modern browser (Chrome, Safari, Firefox, Edge).',
      );
    case 'SecurityError':
      return new Error(
        'Passkey operation blocked by browser security policy. ' +
        'Make sure you are on a secure (HTTPS) connection.',
      );
    default:
      return new Error(`Passkey ${operation} failed: ${err.message}`);
  }
}

// ─── Passkey Creation ────────────────────────────────────────────────────────

/**
 * Create a new WebAuthn passkey for wallet authentication.
 *
 * Requests a platform authenticator with the PRF extension.
 * If PRF is supported, the output is used as an additional encryption layer.
 * If not, encryption falls back to PIN-only (still AES-256-GCM).
 *
 * @param userId - Unique user identifier (random UUID).
 * @param userName - Display name for the passkey.
 * @returns Credential ID and optional PRF output.
 * @throws If passkey creation is cancelled or fails.
 */
export async function createPasskey(
  userId: string,
  userName: string,
  signal?: AbortSignal,
): Promise<PasskeyResult> {
  const challenge = rand(32);

  const createOptions: Record<string, unknown> = {
    signal,
    publicKey: {
      challenge,
      // Without an explicit timeout browsers wait ~5 minutes; if the OS
      // prompt never appears the modal spins forever. 60s keeps a stuck
      // prompt recoverable.
      timeout: 60_000,
      rp: { name: 'FOID', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      hints: ['client-device'],
      extensions: {
        prf: { eval: { first: PRF_SALT } },
      },
    },
  };

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create(
      createOptions,
    )) as PublicKeyCredential | null;
  } catch (err) {
    throw mapPasskeyError(err, 'create');
  }

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

// ─── Passkey Authentication ──────────────────────────────────────────────────

/**
 * Authenticate with an existing passkey.
 *
 * If `withPrf` is true and the device supports it, returns PRF output
 * for decryption. Otherwise returns null PRF (PIN-only decryption).
 *
 * @param credentialId - The credential ID from wallet creation.
 * @param withPrf - Whether to request PRF output.
 * @returns PRF output (or null if PRF unavailable/not requested).
 * @throws If authentication is cancelled or fails.
 */
export async function authenticatePasskey(
  credentialId: string,
  withPrf: boolean,
  signal?: AbortSignal,
): Promise<AuthResult> {
  const challenge = rand(32);

  const getOptions: Record<string, unknown> = {
    signal,
    publicKey: {
      challenge,
      timeout: 60_000,
      allowCredentials: [
        { id: fromB64Url(credentialId), type: 'public-key' },
      ],
      userVerification: 'required',
      hints: ['client-device'],
      extensions: withPrf
        ? { prf: { eval: { first: PRF_SALT } } }
        : {},
    },
  };

  let assertion: PublicKeyCredential;
  try {
    assertion = (await navigator.credentials.get(
      getOptions,
    )) as PublicKeyCredential;
  } catch (err) {
    throw mapPasskeyError(err, 'authenticate');
  }

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
      // PRF not available on this authenticator
    }
  }

  return { prfOutput };
}
