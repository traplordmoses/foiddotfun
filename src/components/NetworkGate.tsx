"use client";
import { useEffect } from "react";
import { useChainId, useSwitchChain } from "wagmi";

interface NetworkGateProps {
  chainId: number;
  children: React.ReactNode;
}

export function NetworkGate({ chainId, children }: NetworkGateProps) {
  const current = useChainId();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (current !== chainId && switchChain) {
      // Prompt a programmatic switch; RainbowKit will also prompt via Connect UI
      try {
        switchChain({ chainId });
      } catch {}
    }
  }, [current, chainId, switchChain]);

  if (current !== chainId) {
    return (
      <div className="p-4 text-center">
        <p className="mb-2">Please switch to Fluent Testnet (chain 20994).</p>
        <button
          className="rounded-xl px-4 py-2 bg-fuchsia-600/80 hover:bg-fuchsia-600"
          onClick={() => switchChain?.({ chainId })}
        >
          Switch network
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
