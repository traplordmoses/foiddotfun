'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { resolveWalletRequest } from '@/lib/connectors/onboardingBridge';
import {
  create,
  unlock,
  load,
  save,
  exists,
  importWallet,
} from '@/lib/embeddedWallet';

type Mode = 'create' | 'unlock' | 'restore';
type Step = 'explain' | 'pin' | 'working' | 'backup' | 'restore-input';

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
  const [downloaded, setDownloaded] = useState(false);
  const [restoreJson, setRestoreJson] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setDownloaded(false);
    setRestoreJson('');
  }

  function dismissRainbowKit() {
    const hideRk = () => {
      document.querySelectorAll<HTMLElement>('[data-rk]').forEach((el) => {
        const dialog = el.querySelector<HTMLElement>('[role="dialog"]');
        if (dialog) {
          const container = dialog.closest<HTMLElement>('[data-rk]');
          if (container) container.style.display = 'none';
        }
      });
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

  // ─── Download backup as file ───

  const downloadBackup = useCallback(() => {
    const wallet = load();
    if (!wallet) return;
    const blob = new Blob([JSON.stringify(wallet, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foid-wallet-${wallet.address.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }, []);

  const copyBackup = useCallback(async () => {
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

  const emailBackup = useCallback(() => {
    const wallet = load();
    if (!wallet) return;
    const body = encodeURIComponent(
      `FOID Wallet Backup\n\nAddress: ${wallet.address}\nCreated: ${wallet.createdAt}\n\n--- ENCRYPTED WALLET DATA (keep this safe) ---\n\n${JSON.stringify(wallet)}\n\n--- END ---\n\nYou will need your PIN to restore this wallet.`,
    );
    const subject = encodeURIComponent(
      `FOID Wallet Backup — ${wallet.address.slice(0, 8)}...${wallet.address.slice(-4)}`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  }, []);

  // ─── Restore from backup ───

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setRestoreJson(reader.result as string);
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleRestore = useCallback(async () => {
    setError(null);
    if (!restoreJson.trim()) {
      setError('Please paste or upload your backup data.');
      return;
    }
    if (pin.length < 6) {
      setError('Enter your PIN to decrypt the wallet.');
      return;
    }
    try {
      const wallet = importWallet(restoreJson.trim());
      // Verify PIN works by unlocking
      const unlocked = await unlock(wallet, pin);
      // Save restored wallet
      save(wallet);
      setAddress(unlocked.address);
      setPrivateKey(unlocked.privateKey);
      setOpen(false);
      restoreRainbowKit();
      resolveWalletRequest({
        address: unlocked.address,
        privateKey: unlocked.privateKey,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      setError(msg);
    }
  }, [restoreJson, pin]);

  // ─── Create / Unlock ───

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
        style={{ background: 'rgba(20,20,30,0.92)', maxHeight: '90vh', overflowY: 'auto' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-wide">FOID WALLET</div>
          <div className="mt-1 text-xs text-white/50 tracking-widest uppercase">
            {step === 'explain' && 'Setup'}
            {step === 'pin' && (mode === 'create' ? 'Choose a PIN' : mode === 'unlock' ? 'Enter PIN' : 'Restore')}
            {step === 'working' && (mode === 'create' ? 'Creating...' : 'Unlocking...')}
            {step === 'backup' && 'Save Your Backup'}
            {step === 'restore-input' && 'Restore Wallet'}
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
              key is encrypted with a PIN you choose, plus passkey
              authentication.
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              No browser extension needed. No seed phrase. Just a short PIN and
              your passkey. Your PIN is never stored anywhere.
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
                Create New
              </button>
            </div>
            {/* Restore option */}
            <button
              onClick={() => {
                setMode('restore');
                setStep('restore-input');
              }}
              className="w-full text-center text-[11px] text-white/35 hover:text-white/60 transition-colors pt-1"
            >
              Have a backup? Restore existing wallet
            </button>
          </div>
        )}

        {/* Step: PIN input (create or unlock) */}
        {step === 'pin' && (mode === 'create' || mode === 'unlock') && (
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
                : 'You will also be prompted for passkey authentication.'}
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
              You may see a passkey prompt from your device or password manager.
            </p>
          </div>
        )}

        {/* Step: Backup (after create) */}
        {step === 'backup' && (
          <div className="space-y-4">
            {/* Security status */}
            <div
              className="rounded-lg px-3 py-2.5 text-xs"
              style={{
                background: 'rgba(72,255,171,0.06)',
                border: '1px solid rgba(72,255,171,0.2)',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5" style={{ color: 'rgba(72,255,171,0.9)' }}>
                <span style={{ fontSize: 14 }}>{'\u2713'}</span>
                <span className="font-medium">
                  Secured with passkey + PIN encryption
                </span>
              </div>
              <p style={{ color: 'rgba(72,255,171,0.55)', fontSize: 11, lineHeight: 1.5, paddingLeft: 22 }}>
                {prfActive
                  ? 'Your key is encrypted with both your PIN and biometric data. Maximum security.'
                  : 'Your passkey authenticates you. Your PIN encrypts the key. Both are needed to access your wallet.'}
              </p>
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

            {/* IMPORTANT: Backup warning */}
            <div
              className="rounded-lg px-3 py-2.5 text-xs"
              style={{
                background: 'rgba(255,184,0,0.06)',
                border: '1px solid rgba(255,184,0,0.2)',
                color: 'rgba(255,184,0,0.85)',
              }}
            >
              <div className="flex items-center gap-2 mb-1" style={{ fontWeight: 600 }}>
                <span style={{ fontSize: 13 }}>{'\u26A0'}</span>
                Save your backup now
              </div>
              <p style={{ color: 'rgba(255,184,0,0.6)', fontSize: 11, lineHeight: 1.5, paddingLeft: 22 }}>
                If you clear your browser data, switch browsers, or lose this device,
                your wallet is gone without a backup. Download it now.
              </p>
            </div>

            {/* Backup actions */}
            <div className="space-y-2">
              <button
                onClick={downloadBackup}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {downloaded ? 'Downloaded!' : 'Download Backup File'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={emailBackup}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white/80"
                >
                  Email to myself
                </button>
                <button
                  onClick={copyBackup}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white/80"
                >
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step: Restore from backup */}
        {step === 'restore-input' && (
          <div className="space-y-4">
            <p className="text-sm text-white/80 leading-relaxed">
              Paste your backup data or upload your backup file. You&apos;ll need your
              original PIN to decrypt it.
            </p>

            {/* File upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/60 transition hover:bg-white/10 hover:border-white/30"
            >
              {restoreJson ? 'File loaded' : 'Upload backup file (.json)'}
            </button>

            {/* Or paste */}
            <div className="relative">
              <div className="text-[10px] text-white/40 tracking-widest uppercase mb-1.5">
                Or paste backup data
              </div>
              <textarea
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                placeholder='{"version":1,"vault":{...}}'
                rows={3}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none font-mono resize-none"
              />
            </div>

            {/* PIN */}
            <div>
              <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
                Your PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your original PIN"
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

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => {
                  setMode('create');
                  setStep('explain');
                  setRestoreJson('');
                  setPin('');
                  setError(null);
                }}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Back
              </button>
              <button
                onClick={handleRestore}
                disabled={!restoreJson.trim() || pin.length < 6}
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Restore Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
