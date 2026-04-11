'use client';

import { useState } from 'react';

interface ExportKeyDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Two-step private key export dialog with safety warnings.
 * Step 1: Warning + confirmation.
 * Step 2: Re-authenticate via wallet unlock, copy key, auto-clear clipboard.
 */
export default function ExportKeyDialog({ open, onClose }: ExportKeyDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  if (!open) return null;

  const handleExport = async () => {
    try {
      // Always require fresh unlock for export (don't use cached session)
      const { requestWalletUnlock } = await import('@/lib/connectors/onboardingBridge');
      const result = await requestWalletUnlock();
      if (!result) {
        setStatus('error');
        return;
      }

      // Update session with fresh credentials
      const { setSession } = await import('@/lib/wallet/session');
      setSession(result.privateKey, result.address);

      await navigator.clipboard.writeText(result.privateKey);
      setStatus('copied');

      // Auto-clear clipboard after 30 seconds
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === result.privateKey) {
            await navigator.clipboard.writeText('');
          }
        } catch {
          // Clipboard API may fail if tab lost focus
        }
      }, 30_000);

      setTimeout(() => {
        setStatus('idle');
        setConfirmed(false);
        onClose();
      }, 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100001 }}
      onClick={onClose}
    >
      <div
        className="w-[90vw] max-w-sm rounded-2xl border border-white/15 p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,.5)]"
        style={{ background: 'rgba(20,20,30,0.95)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!confirmed ? (
          <>
            <div className="text-sm font-bold text-red-400 mb-3">Export Private Key</div>
            <div
              className="rounded-lg px-3 py-2.5 text-xs mb-4"
              style={{
                background: 'rgba(255,80,80,0.08)',
                border: '1px solid rgba(255,80,80,0.25)',
                color: 'rgba(255,120,120,0.9)',
              }}
            >
              <p className="font-medium mb-1">This is dangerous.</p>
              <p style={{ color: 'rgba(255,120,120,0.65)', lineHeight: 1.5 }}>
                Anyone with your private key has full control of your wallet.
                Never share it. Never paste it into a website. Never send it to anyone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmed(true)}
                className="flex-1 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/30"
              >
                I understand
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-bold text-white/90 mb-3">
              {status === 'copied' ? 'Copied!' : 'Authenticate to export'}
            </div>
            {status === 'copied' ? (
              <p className="text-xs text-white/50 mb-4">
                Private key copied. Clipboard will auto-clear in 30 seconds.
              </p>
            ) : (
              <p className="text-xs text-white/50 mb-4">
                You will be prompted for your PIN and passkey to export.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmed(false); onClose(); }}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              {status !== 'copied' && (
                <button
                  onClick={handleExport}
                  className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
                >
                  {status === 'error' ? 'Try again' : 'Export Key'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
