'use client';

import { useCallback, useRef, useState } from 'react';
import { MIN_PIN_LENGTH } from '@/lib/wallet/constants';

interface RestoreStepProps {
  pin: string;
  onPinChange: (pin: string) => void;
  onRestore: (json: string) => void;
  onBack: () => void;
  error: string | null;
}

export default function RestoreStep({ pin, onPinChange, onRestore, onBack, error }: RestoreStepProps) {
  const [restoreJson, setRestoreJson] = useState('');
  const [showPin, setShowPin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setRestoreJson(reader.result as string);
      reader.readAsText(file);
    },
    [],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/80 leading-relaxed">
        Paste your backup data or upload your backup file. You&apos;ll need your
        original password to decrypt it.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </div>
      )}

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

      {/* Paste backup */}
      <div>
        <div className="text-[10px] text-white/40 tracking-widest uppercase mb-1.5">
          Or paste backup data
        </div>
        <textarea
          value={restoreJson}
          onChange={(e) => setRestoreJson(e.target.value)}
          placeholder='{"version":2,"vault":{...}}'
          rows={3}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none font-mono resize-none"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
          Your password
        </label>
        <div className="relative">
          <input
            type={showPin ? 'text' : 'password'}
            value={pin}
            onChange={(e) => onPinChange(e.target.value)}
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
          onClick={onBack}
          className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
        >
          Back
        </button>
        <button
          onClick={() => onRestore(restoreJson)}
          disabled={!restoreJson.trim() || pin.length < MIN_PIN_LENGTH}
          className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Restore Wallet
        </button>
      </div>
    </div>
  );
}
