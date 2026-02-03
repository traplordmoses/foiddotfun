'use client';

import { ButtonHTMLAttributes, ReactNode, useState } from 'react';
import { useHaptic, type HapticPattern } from '@/hooks/useHaptic';

interface HapticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  hapticPattern?: HapticPattern;
  onAsyncClick?: () => Promise<void>;
  loadingText?: string;
}

export function HapticButton({
  children,
  hapticPattern = 'light',
  onClick,
  onAsyncClick,
  loadingText,
  disabled,
  className = '',
  ...props
}: HapticButtonProps) {
  const { trigger } = useHaptic();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    trigger(hapticPattern);

    if (onAsyncClick) {
      setIsLoading(true);
      try {
        await onAsyncClick();
      } finally {
        setIsLoading(false);
      }
    }

    onClick?.(e);
  };

  return (
    <button
      {...props}
      className={className}
      onClick={handleClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingText || 'Loading...'}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
