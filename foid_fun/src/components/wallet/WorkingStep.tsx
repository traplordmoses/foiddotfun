'use client';

interface WorkingStepProps {
  mode: 'create' | 'unlock';
}

export default function WorkingStep({ mode }: WorkingStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      <p className="text-sm text-white/70">
        {mode === 'create' ? 'Creating your wallet...' : 'Unlocking...'}
      </p>
      <p className="text-xs text-white/40">
        You may see a passkey prompt from your device or password manager.
      </p>
    </div>
  );
}
