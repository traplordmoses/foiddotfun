'use client';

import { useEffect, useState, useCallback } from 'react';
import { resolveWalletRequest } from '@/lib/connectors/onboardingBridge';
import {
  create,
  unlock,
  load,
  save,
  importWallet,
} from '@/lib/wallet';
import { MIN_PIN_LENGTH } from '@/lib/wallet/constants';
import ExplainStep from './ExplainStep';
import PinStep from './PinStep';
import WorkingStep from './WorkingStep';
import BackupStep from './BackupStep';
import RestoreStep from './RestoreStep';

type Mode = 'create' | 'unlock' | 'restore';
type Step = 'explain' | 'pin' | 'working' | 'backup' | 'restore-input';

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState<Step>('explain');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [prfActive, setPrfActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function resetState() {
    setPin('');
    setPinConfirm('');
    setAddress(null);
    setPrivateKey(null);
    setPrfActive(false);
    setError(null);
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

  const handlePinSubmit = useCallback(async () => {
    setError(null);

    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} characters.`);
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

  const handleRestore = useCallback(async (restoreJson: string) => {
    setError(null);
    if (!restoreJson.trim()) {
      setError('Please paste or upload your backup data.');
      return;
    }
    if (pin.length < MIN_PIN_LENGTH) {
      setError('Enter your PIN to decrypt the wallet.');
      return;
    }
    try {
      const wallet = importWallet(restoreJson.trim());
      const unlocked = await unlock(wallet, pin);
      save(wallet);
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
  }, [pin]);

  const handleContinue = useCallback(() => {
    setOpen(false);
    restoreRainbowKit();
    if (address && privateKey) {
      resolveWalletRequest({ address, privateKey });
    } else {
      resolveWalletRequest(null);
    }
  }, [address, privateKey]);

  if (!open) return null;

  const stepTitle: Record<Step, string> = {
    explain: 'Setup',
    pin: mode === 'create' ? 'Choose a PIN' : mode === 'unlock' ? 'Enter PIN' : 'Restore',
    working: mode === 'create' ? 'Creating...' : 'Unlocking...',
    backup: 'Save Your Backup',
    'restore-input': 'Restore Wallet',
  };

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
      >
        {/* Header */}
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-wide">FOID WALLET</div>
          <div className="mt-1 text-xs text-white/50 tracking-widest uppercase">
            {stepTitle[step]}
          </div>
        </div>

        {/* Error banner (for non-step-specific errors) */}
        {error && step !== 'pin' && step !== 'restore-input' && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            {error}
          </div>
        )}

        {step === 'explain' && (
          <ExplainStep
            onContinue={() => setStep('pin')}
            onRestore={() => { setMode('restore'); setStep('restore-input'); }}
            onCancel={handleCancel}
          />
        )}

        {step === 'pin' && (mode === 'create' || mode === 'unlock') && (
          <PinStep
            mode={mode}
            pin={pin}
            pinConfirm={pinConfirm}
            onPinChange={setPin}
            onPinConfirmChange={setPinConfirm}
            onSubmit={handlePinSubmit}
            onCancel={handleCancel}
            error={error}
          />
        )}

        {step === 'working' && (
          <WorkingStep mode={mode === 'restore' ? 'unlock' : mode} />
        )}

        {step === 'backup' && (
          <BackupStep
            address={address}
            prfActive={prfActive}
            onContinue={handleContinue}
          />
        )}

        {step === 'restore-input' && (
          <RestoreStep
            pin={pin}
            onPinChange={setPin}
            onRestore={handleRestore}
            onBack={() => { setMode('create'); setStep('explain'); setPin(''); setError(null); }}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
