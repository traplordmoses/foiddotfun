'use client';

import { useCallback, useState } from 'react';
import { load } from '@/lib/wallet/storage';

interface BackupStepProps {
  address: string | null;
  prfActive: boolean;
  onContinue: () => void;
}

export default function BackupStep({ address, prfActive, onContinue }: BackupStepProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

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
      // Clipboard API may not be available
    }
  }, []);

  return (
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
          <span className="font-medium">Secured with passkey + password encryption</span>
        </div>
        <p style={{ color: 'rgba(72,255,171,0.55)', fontSize: 11, lineHeight: 1.5, paddingLeft: 22 }}>
          {prfActive
            ? 'Your key is encrypted with both your password and biometric data. Maximum security.'
            : 'Your passkey authenticates you. Your password encrypts the key. Both are needed to access your wallet.'}
        </p>
      </div>

      {/* Address display */}
      <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
        <div className="text-[10px] text-white/40 tracking-widest uppercase mb-1">Address</div>
        <div className="font-mono text-xs text-white/90 break-all">{address}</div>
      </div>

      {/* Backup warning */}
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

      {/* Backup actions — no email option (security risk) */}
      <div className="space-y-2">
        <button
          onClick={downloadBackup}
          className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
        onClick={onContinue}
        className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90"
      >
        Continue
      </button>
    </div>
  );
}
