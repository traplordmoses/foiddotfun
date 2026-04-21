"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { FLUENT_CHAIN_ID, FLUENT_CHAIN_NAME, BLOCK_EXPLORER_URL } from "@/lib/contracts";
import { PUBLIC_RPC_URL } from "@/config/canonical";

// Always advertise the public Fluent RPC to MetaMask. The dedicated /
// private RPC is proxied server-side via /api/rpc and is never exposed
// to the injected wallet (the URL passed here is shown to users and
// stored in their wallet config).
const rpcUrl = PUBLIC_RPC_URL;

interface NetworkGateProps {
  chainId: number;
  children: React.ReactNode;
}

type EthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

export function NetworkGate({ chainId, children }: NetworkGateProps) {
  const { chain, isConnected } = useAccount();
  const hookChainId = useChainId();
  const { switchChain, switchChainAsync } = useSwitchChain();
  const [attemptedAdd, setAttemptedAdd] = useState(false);

  const currentChainId = useMemo(() => {
    const fromAccount =
      typeof chain?.id === "number" && chain.id > 0 ? chain.id : undefined;
    const fromHook =
      typeof hookChainId === "number" && hookChainId > 0 ? hookChainId : undefined;
    return fromAccount ?? fromHook;
  }, [chain?.id, hookChainId]);

  useEffect(() => {
    if (!isConnected || currentChainId === undefined || currentChainId === chainId) {
      return;
    }

    const trySwitch = async () => {
      try {
        await switchChainAsync?.({ chainId });
      } catch {
        if (typeof window === "undefined") return;
        const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
        if (!ethereum || attemptedAdd) return;

        const addChainParams = {
          chainId: `0x${chainId.toString(16)}`,
          chainName: FLUENT_CHAIN_NAME,
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [BLOCK_EXPLORER_URL],
          nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
        };

        try {
          setAttemptedAdd(true);
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [addChainParams],
          });
        } catch {
          // ignore add-chain failure so user fallback UI can render
        }
      }
    };

    void trySwitch();
  }, [attemptedAdd, chainId, currentChainId, isConnected, switchChainAsync]);

  if (isConnected && currentChainId !== undefined && currentChainId !== chainId) {
    return (
      <div className="p-4 text-center">
        <p className="mb-2">
          Please switch to {FLUENT_CHAIN_NAME} (chain {FLUENT_CHAIN_ID}).
        </p>
        <p className="mb-4 text-xs text-neutral-400">Detected chain: {currentChainId}</p>
        <div className="flex flex-col gap-2 items-center">
          <button
            className="rounded-xl px-4 py-2 bg-fuchsia-600/80 hover:bg-fuchsia-600"
            onClick={() => switchChain?.({ chainId })}
          >
            Switch network
          </button>
          <button
            className="rounded-xl px-4 py-2 border border-fuchsia-500/60 text-fuchsia-300 hover:border-fuchsia-500 hover:text-fuchsia-100"
            onClick={() => {
              if (typeof window === "undefined") return;
              const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
              if (!ethereum) return;
              ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: `0x${chainId.toString(16)}`,
                    chainName: FLUENT_CHAIN_NAME,
                    rpcUrls: [rpcUrl],
                    blockExplorerUrls: [BLOCK_EXPLORER_URL],
                    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
                  },
                ],
              }).catch(() => {
                // ignore manual add failure
              });
            }}
          >
            Add {FLUENT_CHAIN_NAME}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
