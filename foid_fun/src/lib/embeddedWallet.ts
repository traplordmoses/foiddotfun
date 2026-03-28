/**
 * DEPRECATED: Import from '@/lib/wallet' instead.
 * This file exists for backward compatibility during migration.
 */

export {
  create,
  unlock,
  exportWallet,
  importWallet,
  save,
  load,
  exists,
  clear,
  getStoredAddress,
  setSession,
  getSession,
  clearSession,
  refreshSession,
  checkThrottle,
  recordFailure,
  recordSuccess,
  getThrottleMessage,
  isWorkerMode,
  sessionSign,
  sessionSignTypedData,
  sessionSignTransaction,
  isPasskeyAvailable,
  validateMnemonic,
  restoreFromMnemonic,
} from '@/lib/wallet';

export type {
  FoidWallet,
  FoidWalletV1,
  FoidWalletV3,
  UnlockedWallet,
} from '@/lib/wallet';
