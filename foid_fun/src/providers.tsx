// src/providers.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { ReactNode } from "react";
import { WagmiProvider, http, fallback, createConfig } from "wagmi";
import {
  RainbowKitProvider,
  darkTheme,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  walletConnectWallet,
  metaMaskWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { TARGET_CHAIN, TARGET_CHAIN_ID } from "@/lib/chain";
import { FALLBACK_RPC_URL } from "@/config/canonical";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { foidEmbeddedWallet } from "@/lib/connectors/embeddedRainbowKit";
import { AnalyticsBoot } from "@/components/AnalyticsBoot";

const PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "83f1c6e8db75c230db6e2e4b6b8b5c59";

const connectors = connectorsForWallets(
  [
    {
      groupName: "FOID",
      wallets: [foidEmbeddedWallet],
    },
    {
      groupName: "External",
      wallets: [injectedWallet, metaMaskWallet, walletConnectWallet],
    },
  ],
  {
    projectId: PROJECT_ID,
    appName: "FOID.FUN",
  },
);

export const config = createConfig({
  connectors,
  chains: [TARGET_CHAIN],
  transports: {
    [TARGET_CHAIN_ID]: fallback([
      http(TARGET_CHAIN.rpcUrls.default.http[0], { retryCount: 3, retryDelay: 500 }),
      http(FALLBACK_RPC_URL, { retryCount: 2, retryDelay: 1000 }),
    ]),
  },
  ssr: false,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      gcTime: 5 * 60_000,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme()}
          modalSize="compact"
          initialChain={TARGET_CHAIN}
          showRecentTransactions={true}
        >
          <NetworkSwitcher />
          <AnalyticsBoot />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "rgba(28,32,48,0.82)",
                color: "#f8f8ff",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 14px 38px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
                borderRadius: "14px",
                padding: "10px 12px",
                minWidth: "220px",
              },
              success: { iconTheme: { primary: "#8b5cf6", secondary: "#0f0f13" } },
              error: process.env.NODE_ENV !== "production"
                ? {
                    iconTheme: { primary: "#f97373", secondary: "#0f0f13" },
                    style: {
                      background: "rgba(255, 79, 110, 0.16)",
                      color: "#ffeef0",
                      border: "1px solid rgba(255, 129, 150, 0.42)",
                      boxShadow:
                        "0 16px 42px rgba(255,79,110,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
                    },
                  }
                : { duration: 1, style: { display: "none" } },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
