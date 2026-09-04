// Tiny, dependency-free flag module (audit G5). Lives apart from
// FoidWalletOnboarding so PrayApp's nudge can read it without dragging the
// whole wallet stack (bip39 wordlist, passkey, Argon2) into its bundle.
export const BACKUP_PENDING_KEY = "foid_wallet_backup_pending";

export function isBackupPending(address?: string | null): boolean {
  if (!address) return false;
  try {
    return localStorage.getItem(BACKUP_PENDING_KEY) === address.toLowerCase();
  } catch {
    return false;
  }
}

export function setBackupPending(address: string | null): void {
  try {
    if (address) localStorage.setItem(BACKUP_PENDING_KEY, address.toLowerCase());
    else localStorage.removeItem(BACKUP_PENDING_KEY);
  } catch {
    /* private mode */
  }
}
