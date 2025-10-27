"use client";

interface RoleBadgeProps {
  role: string;
  hasRole: boolean;
}

export function RoleBadge({ role, hasRole }: RoleBadgeProps) {
  const classes = hasRole
    ? 'bg-green-700 text-green-100'
    : 'bg-neutral-700 text-neutral-400';
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-mono uppercase tracking-wide ${classes}`}
    >
      {role}
    </span>
  );
}