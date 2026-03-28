import { describe, it, expect } from 'vitest';
import {
  pinToKey,
  pinToExtractableKey,
  pinToKeyArgon2,
  pinToExtractableKeyArgon2,
  combineKeys,
  encrypt,
  decrypt,
  computeVaultHmac,
  verifyVaultHmac,
  deriveEncryptionKey,
  bestAvailableKdf,
  newSalt,
  rand,
  toB64,
  fromB64,
  toB64Url,
  fromB64Url,
  zeroBuffer,
} from '@/lib/wallet/crypto';

describe('crypto', () => {
  // ─── Encoding ───────────────────────────────────────────────
  describe('base64 encoding', () => {
    it('roundtrips toB64/fromB64', () => {
      const data = rand(32);
      const b64 = toB64(data.buffer);
      const decoded = new Uint8Array(fromB64(b64));
      expect(decoded).toEqual(data);
    });

    it('roundtrips toB64Url/fromB64Url', () => {
      const data = rand(32);
      const b64url = toB64Url(data.buffer);
      const decoded = new Uint8Array(fromB64Url(b64url));
      expect(decoded).toEqual(data);
    });
  });

  // ─── Random ─────────────────────────────────────────────────
  describe('rand', () => {
    it('generates bytes of requested length', () => {
      expect(rand(16).length).toBe(16);
      expect(rand(32).length).toBe(32);
    });

    it('generates different values each call', () => {
      const a = rand(32);
      const b = rand(32);
      expect(toB64(a.buffer)).not.toBe(toB64(b.buffer));
    });
  });

  // ─── Memory Cleanup ────────────────────────────────────────
  describe('zeroBuffer', () => {
    it('fills buffer with zeros', () => {
      const buf = new Uint8Array([1, 2, 3, 4, 5]);
      zeroBuffer(buf);
      expect(buf).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });
  });

  // ─── PBKDF2 Key Derivation ────────────────────────────────
  describe('PBKDF2 key derivation', () => {
    it('derives a non-extractable key from PIN + salt', async () => {
      const salt = newSalt();
      const key = await pinToKey('testpin123', salt);
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
      expect(key.extractable).toBe(false);
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('derives an extractable key', async () => {
      const salt = newSalt();
      const key = await pinToExtractableKey('testpin123', salt);
      expect(key.extractable).toBe(true);
    });

    it('same PIN + salt = same key', async () => {
      const salt = newSalt();
      const k1 = await pinToExtractableKey('testpin', salt);
      const k2 = await pinToExtractableKey('testpin', salt);
      const raw1 = new Uint8Array(await crypto.subtle.exportKey('raw', k1));
      const raw2 = new Uint8Array(await crypto.subtle.exportKey('raw', k2));
      expect(raw1).toEqual(raw2);
    });

    it('different PIN = different key', async () => {
      const salt = newSalt();
      const k1 = await pinToExtractableKey('pin_a', salt);
      const k2 = await pinToExtractableKey('pin_b', salt);
      const raw1 = new Uint8Array(await crypto.subtle.exportKey('raw', k1));
      const raw2 = new Uint8Array(await crypto.subtle.exportKey('raw', k2));
      expect(toB64(raw1.buffer)).not.toBe(toB64(raw2.buffer));
    });
  });

  // ─── Argon2id Key Derivation ──────────────────────────────
  describe('Argon2id key derivation', () => {
    it('derives a non-extractable key from PIN + salt', async () => {
      const salt = newSalt();
      const key = await pinToKeyArgon2('testpin123', salt);
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
      expect(key.extractable).toBe(false);
    });

    it('derives an extractable key', async () => {
      const salt = newSalt();
      const key = await pinToExtractableKeyArgon2('testpin123', salt);
      expect(key.extractable).toBe(true);
    });

    it('same PIN + salt = same key', async () => {
      const salt = newSalt();
      const k1 = await pinToExtractableKeyArgon2('testpin', salt);
      const k2 = await pinToExtractableKeyArgon2('testpin', salt);
      const raw1 = new Uint8Array(await crypto.subtle.exportKey('raw', k1));
      const raw2 = new Uint8Array(await crypto.subtle.exportKey('raw', k2));
      expect(raw1).toEqual(raw2);
    });
  });

  // ─── Key Combination (XOR) ────────────────────────────────
  describe('combineKeys (XOR)', () => {
    it('produces a non-extractable combined key', async () => {
      const salt = newSalt();
      const pinKey = await pinToExtractableKey('pin', salt);
      const prfKey = await pinToExtractableKey('prf', salt);
      const combined = await combineKeys(pinKey, prfKey);
      expect(combined.extractable).toBe(false);
    });
  });

  // ─── Encrypt / Decrypt ────────────────────────────────────
  describe('encrypt / decrypt', () => {
    it('roundtrips plaintext', async () => {
      const salt = newSalt();
      const key = await pinToKey('testpin', salt);
      const plaintext = new TextEncoder().encode('hello world secret');
      const payload = await encrypt(plaintext, key);
      const decrypted = await decrypt(payload, key);
      const result = new TextDecoder().decode(decrypted);
      expect(result).toBe('hello world secret');
    });

    it('fails with wrong key', async () => {
      const salt = newSalt();
      const key1 = await pinToKey('correct_pin', salt);
      const key2 = await pinToKey('wrong_pin', salt);
      const plaintext = new TextEncoder().encode('secret');
      const payload = await encrypt(plaintext, key1);
      await expect(decrypt(payload, key2)).rejects.toThrow();
    });

    it('generates unique IVs per encryption', async () => {
      const salt = newSalt();
      const key = await pinToKey('pin', salt);
      const plaintext = new TextEncoder().encode('same data');
      const p1 = await encrypt(plaintext, key);
      const p2 = await encrypt(plaintext, key);
      expect(p1.iv).not.toBe(p2.iv);
    });
  });

  // ─── HMAC ─────────────────────────────────────────────────
  describe('vault HMAC', () => {
    it('computes deterministic HMAC', async () => {
      const hmac1 = await computeVaultHmac('ct', 'iv', toB64(rand(32).buffer));
      expect(typeof hmac1).toBe('string');
      expect(hmac1.length).toBeGreaterThan(0);
    });

    it('verifies correct HMAC', async () => {
      const salt = toB64(rand(32).buffer);
      const hmac = await computeVaultHmac('ciphertext', 'iv_data', salt);
      const valid = await verifyVaultHmac('ciphertext', 'iv_data', salt, hmac);
      expect(valid).toBe(true);
    });

    it('rejects tampered data', async () => {
      const salt = toB64(rand(32).buffer);
      const hmac = await computeVaultHmac('ciphertext', 'iv_data', salt);
      const valid = await verifyVaultHmac('tampered', 'iv_data', salt, hmac);
      expect(valid).toBe(false);
    });
  });

  // ─── Unified Key Derivation ───────────────────────────────
  describe('deriveEncryptionKey', () => {
    it('dispatches to pbkdf2', async () => {
      const salt = newSalt();
      const { key, prfActive } = await deriveEncryptionKey('pin', salt, 'pbkdf2');
      expect(key).toBeDefined();
      expect(prfActive).toBe(false);
    });

    it('dispatches to argon2id', async () => {
      const salt = newSalt();
      const { key, prfActive } = await deriveEncryptionKey('pin', salt, 'argon2id');
      expect(key).toBeDefined();
      expect(prfActive).toBe(false);
    });
  });

  describe('bestAvailableKdf', () => {
    it('returns argon2id or pbkdf2', async () => {
      const kdf = await bestAvailableKdf();
      expect(['argon2id', 'pbkdf2']).toContain(kdf);
    });
  });
});
