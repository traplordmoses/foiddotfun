import { useCallback } from "react";
import { useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

export function useSwitchWallet() {
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const switchWallet = useCallback(() => {
    disconnect();
    setTimeout(() => openConnectModal?.(), 100);
  }, [disconnect, openConnectModal]);

  return { disconnect, switchWallet };
}
