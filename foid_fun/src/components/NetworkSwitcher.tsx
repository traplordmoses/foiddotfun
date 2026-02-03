"use client";

import { useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { TARGET_CHAIN_ID } from "@/lib/chain";

export function NetworkSwitcher() {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    // Auto-switch to target chain when connected to wrong chain
    if (isConnected && chainId !== TARGET_CHAIN_ID && switchChain) {
      switchChain({ chainId: TARGET_CHAIN_ID });
    }
  }, [isConnected, chainId, switchChain]);

  return null;
}
