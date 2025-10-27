"use client";
import React from "react";

export function StatCard({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="card">
      <div className="text-xs font-mono uppercase text-fluent-pink mb-1">{label}</div>
      <div className="text-xl leading-tight max-w-full overflow-hidden">
        <span className={`block truncate ${valueClassName}`}>{value}</span>
      </div>
    </div>
  );
}
