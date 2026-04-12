'use client';

import { useEffect, useRef, useState } from 'react';
import { MIN_PIN_LENGTH } from '@/lib/wallet/constants';
import { checkThrottle, getThrottleMessage } from '@/lib/wallet/throttle';

interface PinStepProps {
  mode: 'create' | 'unlock';
  pin: string;
  pinConfirm: string;
  onPinChange: (pin: string) => void;
  onPinConfirmChange: (pinConfirm: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  error: string | null;
}

export default function PinStep({
  mode,
  pin,
  pinConfirm,
  onPinChange,
  onPinConfirmChange,
  onSubmit,
  onCancel,
  error,
}: PinStepProps) {
  const [showPin, setShowPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const throttleMsg = getThrottleMessage();

  useEffect(() => {
    setTimeout(() => pinRef.current?.focus(), 100);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (pin.length >= MIN_PIN_LENGTH && (mode !== 'create' || pinConfirm)) {
        onSubmit();
      }
    }
  };

  const isDisabled = !checkThrottle().allowed || pin.length < MIN_PIN_LENGTH || (mode === 'create' && !pinConfirm);

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {throttleMsg && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          {throttleMsg}
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs text-white/50 tracking-widest uppercase mb-2">
          {mode === 'create' ? `Choose a password (${MIN_PIN_LENGTH}+ characters)` : 'Enter your password'}
        </label>
        <div className="relative">
          <input
            ref={pinRef}
            type={showPin ? 'text' : 'password'}
            value={pin}
            onChange={(e) => onPinChange(e.target.value)}
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
            onChange={(e) => onPinConfirmChange(e.target.value)}
            placeholder="Confirm password"
            autoComplete="off"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono tracking-wider"
          />
        </div>
      )}

      <p className="text-[11px] text-white/40 leading-relaxed">
        {mode === 'create'
          ? 'Your password encrypts your private key. It is never stored. If you forget it, you will need your backup to recover.'
          : 'You will also be prompted for passkey authentication.'}
      </p>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isDisabled}
          className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {mode === 'create' ? 'Create Wallet' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
