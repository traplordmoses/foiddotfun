/**
 * FOID Wallet v3 — BIP-39 mnemonic / BIP-32 HD key derivation.
 *
 * Uses @scure/bip39 and @scure/bip32 from the audited noble crypto suite.
 * Generates 12-word English mnemonics and derives keys via BIP-44 path.
 */

import { generateMnemonic as bip39Generate, mnemonicToSeedSync, validateMnemonic as bip39Validate } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { privateKeyToAccount } from 'viem/accounts';
import { toHex } from 'viem';

/** BIP-44 derivation path for Ethereum: m/44'/60'/0'/0/0 */
const BIP44_ETH_PATH = "m/44'/60'/0'/0/0";

/**
 * Generate a new 12-word BIP-39 mnemonic phrase.
 */
export function generateMnemonic(): string {
  return bip39Generate(wordlist, 128); // 128 bits = 12 words
}

/**
 * Validate a BIP-39 mnemonic phrase (checksum + wordlist).
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39Validate(mnemonic.trim().toLowerCase(), wordlist);
}

/**
 * Derive a private key and address from a BIP-39 mnemonic.
 * Uses BIP-44 path: m/44'/60'/0'/0/0
 *
 * @param mnemonic - 12-word BIP-39 mnemonic phrase.
 * @returns Private key (hex with 0x prefix) and Ethereum address.
 * @throws If mnemonic is invalid.
 */
export function mnemonicToPrivateKey(mnemonic: string): {
  privateKey: `0x${string}`;
  address: string;
} {
  const cleaned = mnemonic.trim().toLowerCase();
  if (!validateMnemonic(cleaned)) {
    throw new Error('Invalid mnemonic phrase. Please check your words and try again.');
  }

  const seed = mnemonicToSeedSync(cleaned);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(BIP44_ETH_PATH);

  if (!child.privateKey) {
    throw new Error('Failed to derive private key from mnemonic.');
  }

  const privateKey = toHex(child.privateKey) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  // Zero the seed bytes
  seed.fill(0);

  return {
    privateKey,
    address: account.address,
  };
}

/**
 * Payload format for v3 vault inner data.
 * Stores both the private key and mnemonic together.
 */
export interface VaultPayload {
  privateKey: string;
  mnemonic?: string;
}

/**
 * Encode vault payload for encryption.
 * v3 wallets store JSON; legacy v1 wallets stored raw hex.
 */
export function encodeVaultPayload(payload: VaultPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Decode vault payload after decryption.
 * Detects whether the decrypted data is v3 JSON or legacy raw hex.
 */
export function decodeVaultPayload(plaintext: ArrayBuffer): VaultPayload {
  const bytes = new Uint8Array(plaintext);
  const text = new TextDecoder().decode(bytes);

  // v3 format: JSON object
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text) as VaultPayload;
    } catch {
      // Fall through to legacy format
    }
  }

  // Legacy v1/v2 format: raw private key hex (starts with 0x or is raw bytes)
  if (text.startsWith('0x')) {
    return { privateKey: text };
  }

  // Raw bytes — convert to hex
  return { privateKey: toHex(bytes) };
}
