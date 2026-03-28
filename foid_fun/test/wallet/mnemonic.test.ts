import { describe, it, expect } from 'vitest';
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToPrivateKey,
  encodeVaultPayload,
  decodeVaultPayload,
} from '@/lib/wallet/mnemonic';

describe('mnemonic', () => {
  describe('generateMnemonic', () => {
    it('generates 12 words', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');
      expect(words.length).toBe(12);
    });

    it('generates valid mnemonic', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it('generates different mnemonics each time', () => {
      const a = generateMnemonic();
      const b = generateMnemonic();
      expect(a).not.toBe(b);
    });
  });

  describe('validateMnemonic', () => {
    it('accepts valid mnemonic', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it('rejects garbage', () => {
      expect(validateMnemonic('foo bar baz')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateMnemonic('')).toBe(false);
    });

    it('handles leading/trailing whitespace', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(`  ${mnemonic}  `)).toBe(true);
    });

    it('handles uppercase', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(mnemonic.toUpperCase())).toBe(true);
    });
  });

  describe('mnemonicToPrivateKey', () => {
    it('derives a private key and address', () => {
      const mnemonic = generateMnemonic();
      const { privateKey, address } = mnemonicToPrivateKey(mnemonic);
      expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/);
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('derives deterministic key from same mnemonic', () => {
      const mnemonic = generateMnemonic();
      const r1 = mnemonicToPrivateKey(mnemonic);
      const r2 = mnemonicToPrivateKey(mnemonic);
      expect(r1.privateKey).toBe(r2.privateKey);
      expect(r1.address).toBe(r2.address);
    });

    it('derives different keys from different mnemonics', () => {
      const m1 = generateMnemonic();
      const m2 = generateMnemonic();
      const r1 = mnemonicToPrivateKey(m1);
      const r2 = mnemonicToPrivateKey(m2);
      expect(r1.privateKey).not.toBe(r2.privateKey);
    });

    // Test vector: known mnemonic → known address
    it('matches known test vector', () => {
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const { address } = mnemonicToPrivateKey(testMnemonic);
      // BIP-44 m/44'/60'/0'/0/0 for this mnemonic
      expect(address.toLowerCase()).toBe('0x9858effd232b4033e47d90003d41ec34ecaeda94');
    });

    it('throws on invalid mnemonic', () => {
      expect(() => mnemonicToPrivateKey('invalid words here')).toThrow('Invalid mnemonic');
    });
  });

  describe('vault payload encoding', () => {
    it('encodeVaultPayload creates JSON', () => {
      const payload = { privateKey: '0xabc', mnemonic: 'word1 word2' };
      const encoded = encodeVaultPayload(payload);
      const decoded = JSON.parse(new TextDecoder().decode(encoded));
      expect(decoded.privateKey).toBe('0xabc');
      expect(decoded.mnemonic).toBe('word1 word2');
    });

    it('decodeVaultPayload parses v3 JSON', () => {
      const json = JSON.stringify({ privateKey: '0xdef', mnemonic: 'test words' });
      const buf = new TextEncoder().encode(json).buffer;
      const result = decodeVaultPayload(buf);
      expect(result.privateKey).toBe('0xdef');
      expect(result.mnemonic).toBe('test words');
    });

    it('decodeVaultPayload handles legacy hex format', () => {
      const hex = '0x1234567890abcdef';
      const buf = new TextEncoder().encode(hex).buffer;
      const result = decodeVaultPayload(buf);
      expect(result.privateKey).toBe(hex);
      expect(result.mnemonic).toBeUndefined();
    });
  });
});
