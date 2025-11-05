"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectBar() {
  return (
    <div className="mb-6 mt-2 grid grid-cols-12 gap-4">
      <div className="col-span-12 flex justify-center lg:col-start-10 lg:col-span-3 lg:justify-end">
        <ConnectButton chainStatus="name" showBalance={false} />
      </div>
    </div>
  );
}
