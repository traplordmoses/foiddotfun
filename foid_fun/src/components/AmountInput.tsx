"use client";
import { ChangeEvent } from 'react';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  max?: string;
}

export function AmountInput({ value, onChange, placeholder = '0.0', max }: AmountInputProps) {
  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      onChange(val);
    }
  };
  return (
    <div className="flex items-center space-x-2">
      <input
        type="text"
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        className="flex-1 bg-neutral-800 p-2 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-fluent-pink"
      />
      {max && (
        <button
          type="button"
          className="text-xs text-fluent-blue hover:underline"
          onClick={() => onChange(max)}
        >
          Max
        </button>
      )}
    </div>
  );
}