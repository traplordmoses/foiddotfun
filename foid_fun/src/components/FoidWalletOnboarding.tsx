'use client';

import { useEffect, useState, useCallback } from 'react';
import { resolveWalletCreation } from '@/lib/connectors/onboardingBridge';
import { createEmbeddedWallet, exportPrivateKey } from '@/lib/embeddedWallet';

type Step = 'explain' | 'creating' | 'backup';

export default function FoidWalletOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('explain');
  const [address, setAddress] = useState<string | null>(null);
  const [passkeyProtected, setPasskeyProtected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for the bridge event
  useEffect(() => {
    const handler = () => {
      setStep('explain');
      setAddress(null);
      setPasskeyProtected(false);
      setError(null);
      setCopied(false);
      setOpen(true);

      // Close the RainbowKit connect modal so it doesn't block our onboarding modal.
      // RainbowKit renders an overlay with [data-rk] [role="dialog"]; click its
      // backdrop or the close button to dismiss it.
      requestAnimationFrame(() => {
        const rkOverlay = document.querySelector<HTMLElement>('[data-rk] [aria-label="Close"]');
        if (rkOverlay) {
          rkOverlay.click();
          return;
        }
        // Fallback: find the RainbowKit backdrop and click it to dismiss
        const backdrop = document.querySelector<HTMLElement>('[data-rk] [role="dialog"]');
        const parent = backdrop?.parentElement;
        if (parent && parent !== document.body) {
          // Click outside the dialog to trigger RainbowKit's own dismiss
          parent.click();
        }
      });
    };
    window.addEventListener('foid-wallet:request-create', handler);
    return () => window.removeEventListener('foid-wallet:request-create', handler);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveWalletCreation(null);
  }, []);

  const handleCreate = useCallback(async () => {
    setStep('creating');
    setError(null);
    try {
      const result = await createEmbeddedWallet();
      setAddress(result.address);
      setPasskeyProtected(result.passkeyProtected);
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet creation failed');
      setStep('explain');
    }
  }, []);

  const handleExportKey = useCallback(async () => {
    try {
      const key = await exportPrivateKey();
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export key');
    }
  }, []);

  const handleContinue = useCallback(() => {
    setOpen(false);
    if (address) {
      resolveWalletCreation({ address });
    } else {
      resolveWalletCreation(null);
    }
  }, [address]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 100000 }}
    >
      <div
        className="relative w-[90vw] max-w-md rounded-2xl border border-white/15 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,.5)]"
        style={{ background: 'rgba(20,20,30,0.92)' }}
      >
        {/* Header */}
        <div className="mb-4 text-center">
          <div className="text-lg font-bold tracking-wide">FOID WALLET</div>
          <div className="mt-1 text-xs text-white/50 tracking-widest uppercase">
            {step === 'explain' && 'Setup'}
            {step === 'creating' && 'Creating...'}
            {step === 'backup' && 'Backup'}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Step: Explain */}
        {step === 'explain' && (
          <div className="space-y-4">
            <p className="text-sm text-white/80 leading-relaxed">
              FOID Wallet creates a secure wallet protected by your device&apos;s
              biometrics (Face ID, fingerprint, or PIN). No browser extension needed.
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              Your private key is encrypted and stored locally on this device.
              You&apos;ll have a chance to back it up after creation.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
              >
                Create Wallet
              </button>
            </div>
          </div>
        )}

        {/* Step: Creating */}
        {step === 'creating' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-sm text-white/70">
              Creating your wallet...
            </p>
            <p className="text-xs text-white/40">
              You may see a biometric prompt if your device supports passkey encryption.
            </p>
          </div>
        )}

        {/* Step: Backup */}
        {step === 'backup' && (
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              Your wallet has been created. Save your address and back up your
              private key somewhere safe.
            </p>

            {/* Passkey protection status */}
            <div
              className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{
                background: passkeyProtected ? 'rgba(72,255,171,0.08)' : 'rgba(255,184,0,0.08)',
                border: `1px solid ${passkeyProtected ? 'rgba(72,255,171,0.25)' : 'rgba(255,184,0,0.25)'}`,
                color: passkeyProtected ? 'rgba(72,255,171,0.9)' : 'rgba(255,184,0,0.9)',
              }}
            >
              <span style={{ fontSize: 14 }}>{passkeyProtected ? '\u2713' : '\u26A0'}</span>
              <span>
                {passkeyProtected
                  ? 'Passkey-protected — your key is encrypted with biometrics'
                  : 'No passkey protection — your browser does not support passkey encryption (WebAuthn PRF). Back up your private key!'}
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

            {/* Export key button */}
            <button
              onClick={handleExportKey}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              {copied ? 'Copied to clipboard!' : 'Export Private Key'}
            </button>

            <p className="text-[11px] text-white/40 leading-relaxed">
              Your private key will be copied to your clipboard. Store it in a
              password manager or write it down. Anyone with this key can access
              your funds.
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
