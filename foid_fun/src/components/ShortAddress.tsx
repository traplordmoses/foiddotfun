"use client";
import React from "react";

export function ShortAddress({
  address,
  start = 6,
  end = 4,
  className = "",
}: {
  address?: string;
  start?: number;
  end?: number;
  className?: string;
}) {
  if (!address) return null;
  const a = address.toString();
  const short = a.length > start + end + 2
    ? `${a.slice(0, 2 + start)}…${a.slice(-end)}`
    : a;
  return (
    <span className={`font-mono ${className}`} title={a}>
      {short}
    </span>
  );
}
