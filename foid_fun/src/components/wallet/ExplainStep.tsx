'use client';

interface ExplainStepProps {
  onContinue: () => void;
  onRestore: () => void;
  onCancel: () => void;
}

export default function ExplainStep({ onContinue, onRestore, onCancel }: ExplainStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/80 leading-relaxed">
        FOID Wallet creates a secure wallet on your device. Your private
        key is encrypted with a password you choose, plus passkey
        authentication.
      </p>
      <p className="text-xs text-white/50 leading-relaxed">
        No browser extension needed. No seed phrase. Just a password and
        your passkey. Your password is never stored anywhere.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={onContinue}
          className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
        >
          Create New
        </button>
      </div>
      <button
        onClick={onRestore}
        className="w-full text-center text-[11px] text-white/35 hover:text-white/60 transition-colors pt-1"
      >
        Have a backup? Restore existing wallet
      </button>
    </div>
  );
}
