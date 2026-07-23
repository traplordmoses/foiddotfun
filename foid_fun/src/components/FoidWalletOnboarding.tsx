'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { resolveWalletRequest } from '@/lib/connectors/onboardingBridge';
import {
  create,
  unlock,
  load,
  save,
  importWallet,
  restoreFromMnemonic,
  validateMnemonic,
} from '@/lib/wallet';

type Mode = 'create' | 'unlock' | 'restore' | 'restore-mnemonic';
type Step = 'explain' | 'pin' | 'working' | 'mnemonic' | 'backup' | 'restore-input' | 'restore-mnemonic-input';

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
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [mnemonicWritten, setMnemonicWritten] = useState(false);
  const [restoreMnemonic, setRestoreMnemonic] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Aborts an in-flight passkey prompt (create/unlock/restore) so the
  // "working" step is always escapable — without this, a hung OS prompt
  // pinned the modal open with no way out.
  const abortRef = useRef<AbortController | null>(null);

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
    setMnemonic(null);
    setMnemonicWritten(false);
    setRestoreMnemonic('');
  }

  // Close RainbowKit's connect dialog so our onboarding modal stands alone.
  // NEVER hide `[data-rk]` wholesale: RainbowKitProvider wraps the entire
  // app in a single `<div data-rk>`, so display:none on it blanks the whole
  // site (the old "wallet crash"). Only the dialog's close button is safe.
  function dismissRainbowKit() {
    const hideRk = () => {
      // RainbowKit titles its dialogs with rk_* ids — scoping to that
      // avoids clicking the close button of unrelated dialogs (CHAT.EXE
      // renders a role="dialog" of its own inside the same [data-rk]
      // app wrapper).
      const closeBtn = document.querySelector<HTMLElement>(
        '[data-rk] [role="dialog"][aria-labelledby^="rk_"] [aria-label="Close"]',
      );
      closeBtn?.click();
    };
    hideRk();
    requestAnimationFrame(hideRk);
    setTimeout(hideRk, 120);
  }

  // Heal any wrapper a previous session may have hidden (pre-fix state
  // persisted only in the DOM, but stay defensive — it's free).
  function restoreRainbowKit() {
    document.querySelectorAll<HTMLElement>('[data-rk]').forEach((el) => {
      if (el.style.display === 'none') el.style.display = '';
    });
  }

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    restoreRainbowKit();
    resolveWalletRequest(null);
  }, []);

  /** Back out of a stuck/slow passkey prompt to the password step. */
  const handleWorkingCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setError(null);
    setStep(mode === 'restore-mnemonic' ? 'restore-mnemonic-input' : 'pin');
  }, [mode]);

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
      `FOID Wallet Backup\n\nAddress: ${wallet.address}\nCreated: ${wallet.createdAt}\n\n--- ENCRYPTED WALLET DATA (keep this safe) ---\n\n${JSON.stringify(wallet)}\n\n--- END ---\n\nYou will need your password to restore this wallet.`,
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
      setError('Enter your password to decrypt the wallet.');
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
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'create' && pin !== pinConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setStep('working');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (mode === 'create') {
        const userId = crypto.randomUUID();
        const result = await create(userId, 'FOID Wallet', pin, controller.signal);
        save(result.wallet);
        setAddress(result.wallet.address);
        setPrfActive(result.prfActive);
        setMnemonic(result.mnemonic);

        // Unlock immediately to get private key for session
        const unlocked = await unlock(result.wallet, pin, controller.signal);
        setPrivateKey(unlocked.privateKey);
        setStep('mnemonic');
      } else {
        const wallet = load();
        if (!wallet) {
          setError('No wallet found. Please create one first.');
          setStep('pin');
          return;
        }
        const unlocked = await unlock(wallet, pin, controller.signal);
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
      // A deliberate cancel already put the UI back — don't surface it
      // as an error.
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setError(msg);
      setStep('pin');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [mode, pin, pinConfirm]);

  const handleContinue = useCallback(() => {
    setOpen(false);
    restoreRainbowKit();
    if (address && privateKey) {
      resolveWalletRequest({ address, privateKey });
      // Emit creation event for post-wallet welcome flow
      if (mode === 'create') {
        window.dispatchEvent(new CustomEvent('foid-wallet:created', { detail: { address } }));
      }
    } else {
      resolveWalletRequest(null);
    }
  }, [address, privateKey, mode]);

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
            {step === 'explain' && 'Forge Your Identity'}
            {step === 'pin' && (mode === 'create' ? 'Choose Your Secret Key' : mode === 'unlock' ? 'Enter Password' : 'Restore')}
            {step === 'working' && (mode === 'create' ? 'Forging...' : 'Unlocking...')}
            {step === 'mnemonic' && 'Your Sacred Words'}
            {step === 'backup' && 'Seal Your Identity'}
            {step === 'restore-input' && 'Restore from Backup'}
            {step === 'restore-mnemonic-input' && 'Restore from Seed Phrase'}
          </div>

          {/* Step indicator (create flow only) */}
          {mode === 'create' && !['restore-input', 'restore-mnemonic-input'].includes(step) && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {[
                { label: 'Identity', active: ['explain', 'pin', 'working'].includes(step) },
                { label: 'Sacred Words', active: ['mnemonic'].includes(step) },
                { label: 'Seal', active: ['backup'].includes(step) },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-3 h-px bg-white/15" />}
                  <div
                    className="px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase transition-all duration-500"
                    style={{
                      background: s.active ? 'rgba(168,130,255,0.25)' : 'rgba(255,255,255,0.05)',
                      color: s.active ? 'rgba(200,180,255,0.9)' : 'rgba(255,255,255,0.25)',
                      border: `1px solid ${s.active ? 'rgba(168,130,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: s.active ? '0 0 12px rgba(168,130,255,0.2)' : 'none',
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
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
              Every voice on FOID has a key. Yours is about to be forged &mdash; right here in your browser,
              encrypted with a secret only you know.
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              No extensions. No seed phrases to memorize upfront. Just a password and your device.
              Your private key never leaves this browser unencrypted.
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
            {/* Restore options */}
            <div className="flex flex-col gap-1 pt-1">
              <button
                onClick={() => {
                  setMode('restore');
                  setStep('restore-input');
                }}
                className="w-full text-center text-[11px] text-white/35 hover:text-white/60 transition-colors"
              >
                Have a backup file? Restore from backup
              </button>
              <button
                onClick={() => {
                  setMode('restore-mnemonic');
                  setStep('restore-mnemonic-input');
                }}
                className="w-full text-center text-[11px] text-white/35 hover:text-white/60 transition-colors"
              >
                Have a seed phrase? Restore from words
              </button>
            </div>
          </div>
        )}

        {/* Step: PIN input (create or unlock) */}
        {step === 'pin' && (mode === 'create' || mode === 'unlock') && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
                {mode === 'create' ? 'Choose your secret key (6+ characters)' : 'Enter your password'}
              </label>
              <div className="relative">
                <input
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter password"
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
                  Confirm password
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono tracking-wider"
                />
              </div>
            )}

            <p className="text-[11px] text-white/40 leading-relaxed">
              {mode === 'create'
                ? 'This encrypts your identity. We never see it, never store it. If you forget it, your sacred words are your only way back.'
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
            {/* Animated forge ring */}
            <div className="relative h-16 w-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-purple-400/30 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-400" />
            </div>
            <p className="text-sm text-white/80 font-medium">
              {mode === 'create' ? 'Forging your identity...' : 'Unlocking...'}
            </p>
            <div className="text-xs text-white/50 text-center leading-relaxed max-w-[280px] space-y-2">
              <p>
                Your browser will ask you to create a <strong className="text-white/70">passkey</strong> &mdash;
                like a fingerprint, Face ID, or device passcode.
              </p>
              <p className="text-white/35">
                This binds your wallet to this device as a second layer of protection alongside your secret key.
              </p>
            </div>
            <button
              onClick={handleWorkingCancel}
              className="mt-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white/75"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Step: Mnemonic (after create, before backup) */}
        {step === 'mnemonic' && mnemonic && (
          <div className="space-y-4">
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
                Write these words down in order
              </div>
              <p style={{ color: 'rgba(255,184,0,0.6)', fontSize: 11, lineHeight: 1.5, paddingLeft: 22 }}>
                This is the ONLY way to recover your wallet if you lose your device and backup file.
                Write them on paper and store it safely. Never share them with anyone.
              </p>
            </div>

            {/* 3x4 grid of words */}
            <div className="grid grid-cols-3 gap-2">
              {mnemonic.split(' ').map((word, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-center"
                  style={{ userSelect: 'none' }}
                >
                  <span className="text-[10px] text-white/30 mr-1">{i + 1}.</span>
                  <span className="text-sm font-mono text-white/90">{word}</span>
                </div>
              ))}
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer group pt-1">
              <input
                type="checkbox"
                checked={mnemonicWritten}
                onChange={(e) => setMnemonicWritten(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black/40 accent-white"
              />
              <span className="text-xs text-white/60 group-hover:text-white/80 leading-relaxed">
                I have written down my seed phrase and stored it safely
              </span>
            </label>

            <button
              onClick={() => setStep('backup')}
              disabled={!mnemonicWritten}
              className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step: Backup (after mnemonic) */}
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
                  Secured with passkey + password encryption
                </span>
              </div>
              <p style={{ color: 'rgba(72,255,171,0.55)', fontSize: 11, lineHeight: 1.5, paddingLeft: 22 }}>
                {prfActive
                  ? 'Your key is encrypted with both your password and biometric data. Maximum security.'
                  : 'Your passkey authenticates you. Your password encrypts the key. Both are needed to access your wallet.'}
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

              <button
                onClick={copyBackup}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white/80"
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
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
              original password to decrypt it.
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
                Your password
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your original password"
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
        {/* Step: Restore from mnemonic */}
        {step === 'restore-mnemonic-input' && (
          <div className="space-y-4">
            <p className="text-sm text-white/80 leading-relaxed">
              Enter your 12-word seed phrase to restore your wallet.
              You&apos;ll choose a new password to protect it on this device.
            </p>

            <div>
              <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
                Seed Phrase (12 words)
              </label>
              <textarea
                value={restoreMnemonic}
                onChange={(e) => setRestoreMnemonic(e.target.value)}
                placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                rows={3}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none font-mono resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
                Choose a new password (6+ characters)
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter new password"
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
                  setRestoreMnemonic('');
                  setPin('');
                  setError(null);
                }}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Back
              </button>
              <button
                onClick={async () => {
                  setError(null);
                  const words = restoreMnemonic.trim();
                  if (!words || !validateMnemonic(words)) {
                    setError('Invalid seed phrase. Please check your 12 words.');
                    return;
                  }
                  if (pin.length < 6) {
                    setError('Password must be at least 6 characters.');
                    return;
                  }
                  setStep('working');
                  const controller = new AbortController();
                  abortRef.current = controller;
                  try {
                    const userId = crypto.randomUUID();
                    const result = await restoreFromMnemonic(words, userId, 'FOID Wallet', pin, controller.signal);
                    save(result.wallet);
                    const unlocked = await unlock(result.wallet, pin, controller.signal);
                    setAddress(unlocked.address);
                    setPrivateKey(unlocked.privateKey);
                    setOpen(false);
                    restoreRainbowKit();
                    resolveWalletRequest({
                      address: unlocked.address,
                      privateKey: unlocked.privateKey,
                    });
                  } catch (err) {
                    if (controller.signal.aborted) return;
                    const msg = err instanceof Error ? err.message : 'Restore failed';
                    setError(msg);
                    setStep('restore-mnemonic-input');
                  } finally {
                    if (abortRef.current === controller) abortRef.current = null;
                  }
                }}
                disabled={!restoreMnemonic.trim() || pin.length < 6}
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
