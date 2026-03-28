import { describe, it, expect, beforeEach } from 'vitest';
import {
  save,
  load,
  exists,
  clear,
  getStoredAddress,
  exportWallet,
  importWallet,
  needsMigration,
  isV1,
  isV3,
  type FoidWalletV1,
  type FoidWalletV3,
} from '@/lib/wallet/storage';
import { STORAGE_KEY, PENDING_KEY } from '@/lib/wallet/constants';

const mockV1Wallet: FoidWalletV1 = {
  version: 1,
  vault: {
    ciphertext: 'dGVzdA==',
    iv: 'dGVzdA==',
    salt: 'dGVzdA==',
  },
  address: '0x1234567890abcdef1234567890abcdef12345678',
  prfActive: false,
  createdAt: '2024-01-01T00:00:00.000Z',
};

const mockV3Wallet: FoidWalletV3 = {
  version: 3,
  kdf: 'argon2id',
  vault: {
    ciphertext: 'dGVzdA==',
    iv: 'dGVzdA==',
    salt: 'dGVzdA==',
    hmac: 'dGVzdA==',
  },
  address: '0xabcdef1234567890abcdef1234567890abcdef12',
  prfActive: true,
  createdAt: '2024-06-01T00:00:00.000Z',
  hasMnemonic: true,
  throttleNonce: 'abc123',
};

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('save / load', () => {
    it('roundtrips a v1 wallet', () => {
      save(mockV1Wallet);
      const loaded = load();
      expect(loaded).toEqual(mockV1Wallet);
    });

    it('roundtrips a v3 wallet', () => {
      save(mockV3Wallet);
      const loaded = load();
      expect(loaded).toEqual(mockV3Wallet);
    });

    it('returns null when no wallet exists', () => {
      expect(load()).toBeNull();
    });

    it('returns null for corrupt data', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');
      expect(load()).toBeNull();
    });
  });

  describe('exists / clear', () => {
    it('returns false when no wallet', () => {
      expect(exists()).toBe(false);
    });

    it('returns true after save', () => {
      save(mockV1Wallet);
      expect(exists()).toBe(true);
    });

    it('clears wallet and pending key', () => {
      save(mockV1Wallet);
      localStorage.setItem(PENDING_KEY, 'something');
      clear();
      expect(exists()).toBe(false);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    });
  });

  describe('getStoredAddress', () => {
    it('returns address from stored wallet', () => {
      save(mockV1Wallet);
      expect(getStoredAddress()).toBe(mockV1Wallet.address);
    });

    it('returns null when no wallet', () => {
      expect(getStoredAddress()).toBeNull();
    });
  });

  describe('exportWallet / importWallet', () => {
    it('roundtrips v1 wallet', () => {
      const json = exportWallet(mockV1Wallet);
      const imported = importWallet(json);
      expect(imported).toEqual(mockV1Wallet);
    });

    it('roundtrips v3 wallet', () => {
      const json = exportWallet(mockV3Wallet);
      const imported = importWallet(json);
      expect(imported).toEqual(mockV3Wallet);
    });

    it('rejects invalid JSON', () => {
      expect(() => importWallet('not json')).toThrow('Could not parse JSON');
    });

    it('rejects unsupported version', () => {
      expect(() => importWallet('{"version":99}')).toThrow('Unsupported wallet version');
    });

    it('rejects missing vault fields', () => {
      expect(() => importWallet('{"version":1,"vault":{}}')).toThrow('missing vault fields');
    });

    it('rejects missing address', () => {
      expect(() =>
        importWallet('{"version":1,"vault":{"ciphertext":"a","iv":"b","salt":"c"}}'),
      ).toThrow('missing address');
    });
  });

  describe('type guards', () => {
    it('isV1 identifies v1 wallets', () => {
      expect(isV1(mockV1Wallet)).toBe(true);
      expect(isV1(mockV3Wallet)).toBe(false);
    });

    it('isV3 identifies v3 wallets', () => {
      expect(isV3(mockV3Wallet)).toBe(true);
      expect(isV3(mockV1Wallet)).toBe(false);
    });
  });

  describe('needsMigration', () => {
    it('v1 needs migration', () => {
      expect(needsMigration(mockV1Wallet)).toBe(true);
    });

    it('v3 does not need migration', () => {
      expect(needsMigration(mockV3Wallet)).toBe(false);
    });
  });

  describe('pending migration recovery', () => {
    it('recovers from pending migration on load', () => {
      localStorage.setItem(PENDING_KEY, JSON.stringify(mockV3Wallet));
      const loaded = load();
      expect(loaded).toEqual(mockV3Wallet);
      // Pending key should be cleared
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
      // Wallet should be saved to main key
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(mockV3Wallet));
    });
  });
});
