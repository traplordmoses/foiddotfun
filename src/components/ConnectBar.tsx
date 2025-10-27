"use client";
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function ConnectBar() {
  return (
    <div className="flex justify-end p-4">
      <ConnectButton chainStatus="name" showBalance={false} />
    </div>
  );
}