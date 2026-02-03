'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && (
        <div className="mb-4 text-6xl opacity-50">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-white/90 mb-2">
        {title}
      </h3>

      <p className="text-sm text-white/60 max-w-md mb-6">
        {description}
      </p>

      {action && (
        <Link
          href={action.href}
          className="px-6 py-3 bg-gradient-to-br from-purple-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-200 active:scale-95"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
