'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { resolveWalletRequest } from '@/lib/connectors/onboardingBridge';
import { create, unlock, load, save } from '@/lib/embeddedWallet';

type Mode = 'create' | 'unlock';
type Step = 'explain' | 'pin' | 'working' | 'backup';

export default function FoidWalletOnboarding() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState<Step>('explain');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [prfActive, setPrfActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // Listen for bridge events
  useEffect(() => {
    const handleCreate = () => {
      resetState();
      setMode('create');
      setStep('explain');
      setOpen(true);
      dismissRainbowKit();
    };

    const handleUnlock = () => {
      resetState();
      setMode('unlock');
      setStep('pin');
      setOpen(true);
      dismissRainbowKit();
    };

    window.addEventListener('foid-wallet:request-create', handleCreate);
    window.addEventListener('foid-wallet:request-unlock', handleUnlock);
    return () => {
      window.removeEventListener('foid-wallet:request-create', handleCreate);
      window.removeEventListener('foid-wallet:request-unlock', handleUnlock);
    };
  }, []);

  // Auto-focus PIN input
  useEffect(() => {
    if (step === 'pin' && pinRef.current) {
      setTimeout(() => pinRef.current?.focus(), 100);
    }
  }, [step]);

  function resetState() {
    setPin('');
    setPinConfirm('');
    setShowPin(false);
    setAddress(null);
    setPrivateKey(null);
    setPrfActive(false);
    setError(null);
    setCopied(false);
  }

  function dismissRainbowKit() {
    // Hide RainbowKit modal immediately via CSS, then try to properly close it.
    // This prevents the "two modals stacked" problem.
    const hideRk = () => {
      // Force-hide any RainbowKit overlay/modal elements
      document.querySelectorAll<HTMLElement>('[data-rk]').forEach((el) => {
        const dialog = el.querySelector<HTMLElement>('[role="dialog"]');
        if (dialog) {
          // Hide the entire RainbowKit modal container
          const container = dialog.closest<HTMLElement>('[data-rk]');
          if (container) container.style.display = 'none';
        }
      });

      // Also try clicking the close button for a clean teardown
      const closeBtn = document.querySelector<HTMLElement>(
        '[data-rk] [aria-label="Close"]',
      );
      if (closeBtn) {
        closeBtn.click();
        return;
      }
      const backdrop = document.querySelector<HTMLElement>(
        '[data-rk] [role="dialog"]',
      );
      const parent = backdrop?.parentElement;
      if (parent && parent !== document.body) parent.click();
    };

    // Try immediately and again after a frame (RainbowKit renders async)
    hideRk();
    requestAnimationFrame(hideRk);
    setTimeout(hideRk, 100);
  }

  function restoreRainbowKit() {
    document.querySelectorAll<HTMLElement>('[data-rk]').forEach((el) => {
      el.style.display = '';
    });
  }

  const handleCancel = useCallback(() => {
    setOpen(false);
    restoreRainbowKit();
    resolveWalletRequest(null);
  }, []);

  const handlePinSubmit = useCallback(async () => {
    setError(null);

    if (pin.length < 6) {
      setError('PIN must be at least 6 characters.');
      return;
    }

    if (mode === 'create' && pin !== pinConfirm) {
      setError('PINs do not match.');
      return;
    }

    setStep('working');

    try {
      if (mode === 'create') {
        const userId = crypto.randomUUID();
        const result = await create(userId, 'FOID Wallet', pin);
        save(result.wallet);
        setAddress(result.wallet.address);
        setPrfActive(result.prfActive);

        // Unlock immediately to get private key for session
        const unlocked = await unlock(result.wallet, pin);
        setPrivateKey(unlocked.privateKey);
        setStep('backup');
      } else {
        const wallet = load();
        if (!wallet) {
          setError('No wallet found. Please create one first.');
          setStep('pin');
          return;
        }
        const unlocked = await unlock(wallet, pin);
        setAddress(unlocked.address);
        setPrivateKey(unlocked.privateKey);
        // Unlock flow — resolve immediately
        setOpen(false);
        restoreRainbowKit();
        resolveWalletRequest({
          address: unlocked.address,
          privateKey: unlocked.privateKey,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setError(msg);
      setStep('pin');
    }
  }, [mode, pin, pinConfirm]);

  const handleExportBackup = useCallback(async () => {
    const wallet = load();
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(wallet, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  }, []);

  const handleContinue = useCallback(() => {
    setOpen(false);
    restoreRainbowKit();
    if (address && privateKey) {
      resolveWalletRequest({ address, privateKey });
    } else {
      resolveWalletRequest(null);
    }
  }, [address, privateKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && step === 'pin') {
        e.preventDefault();
        handlePinSubmit();
      }
    },
    [step, handlePinSubmit],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
      }}
    >
      <div
        className="relative w-[90vw] max-w-md rounded-2xl border border-white/15 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,.5)]"
        style={{ background: 'rgba(20,20,30,0.92)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-wide">FOID WALLET</div>
          <div className="mt-1 text-xs text-white/50 tracking-widest uppercase">
            {step === 'explain' && 'Setup'}
            {step === 'pin' && (mode === 'create' ? 'Choose a PIN' : 'Enter PIN')}
            {step === 'working' && (mode === 'create' ? 'Creating...' : 'Unlocking...')}
            {step === 'backup' && 'Backup'}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Step: Explain (create only) */}
        {step === 'explain' && (
          <div className="space-y-4">
            <p className="text-sm text-white/80 leading-relaxed">
              FOID Wallet creates a secure wallet on your device. Your private
              key is encrypted with a PIN you choose, plus biometric
              authentication.
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              No browser extension needed. No seed phrase. Just a short PIN and
              your fingerprint or face. Your PIN is never stored anywhere.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('pin')}
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step: PIN input */}
        {step === 'pin' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
                {mode === 'create' ? 'Choose a PIN (6+ characters)' : 'Enter your PIN'}
              </label>
              <div className="relative">
                <input
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 pr-16 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/40 hover:text-white/60 px-2 py-1"
                >
                  {showPin ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            {mode === 'create' && (
              <div>
                <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
                  Confirm PIN
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  placeholder="Confirm PIN"
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono tracking-wider"
                />
              </div>
            )}

            <p className="text-[11px] text-white/40 leading-relaxed">
              {mode === 'create'
                ? 'Your PIN encrypts your private key. It is never stored. If you forget it, you will need your backup to recover.'
                : 'You will also be prompted for biometric authentication (fingerprint or face).'}
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={pin.length < 6 || (mode === 'create' && !pinConfirm)}
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {mode === 'create' ? 'Create Wallet' : 'Unlock'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Working */}
        {step === 'working' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-sm text-white/70">
              {mode === 'create' ? 'Creating your wallet...' : 'Unlocking...'}
            </p>
            <p className="text-xs text-white/40">
              You may see a biometric prompt from your device.
            </p>
          </div>
        )}

        {/* Step: Backup (create only) */}
        {step === 'backup' && (
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              Your wallet has been created. Save your address and keep your PIN safe.
            </p>

            {/* Security status */}
            <div
              className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{
                background: prfActive
                  ? 'rgba(72,255,171,0.08)'
                  : 'rgba(168,85,247,0.08)',
                border: `1px solid ${
                  prfActive
                    ? 'rgba(72,255,171,0.25)'
                    : 'rgba(168,85,247,0.25)'
                }`,
                color: prfActive
                  ? 'rgba(72,255,171,0.9)'
                  : 'rgba(168,85,247,0.9)',
              }}
            >
              <span style={{ fontSize: 14 }}>{prfActive ? '\u2713' : '\u2713'}</span>
              <span>
                {prfActive
                  ? 'Secured with biometric + PIN'
                  : 'Secured with PIN encryption'}
              </span>
            </div>

            {/* Address display */}
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <div className="text-[10px] text-white/40 tracking-widest uppercase mb-1">
                Address
              </div>
              <div className="font-mono text-xs text-white/90 break-all">
                {address}
              </div>
            </div>

            {/* Export backup */}
            <button
              onClick={handleExportBackup}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              {copied ? 'Copied to clipboard!' : 'Copy Encrypted Backup'}
            </button>

            <p className="text-[11px] text-white/40 leading-relaxed">
              This copies your encrypted wallet data. It&apos;s safe to store — the
              data is encrypted with your PIN. You&apos;ll need both the backup and
              your PIN to recover.
            </p>

            <button
              onClick={handleContinue}
              className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
