// src/providers.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "@wagmi/connectors"; // ✅ use the separate package
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { TARGET_CHAIN, TARGET_CHAIN_ID } from "@/lib/chain";

export const config = createConfig({
  chains: [TARGET_CHAIN],
  connectors: [injected({ shimDisconnect: true })], // ✅ no MetaMask SDK
  transports: {
    [TARGET_CHAIN_ID]: http(
      process.env.NEXT_PUBLIC_RPC ??
        process.env.NEXT_PUBLIC_RPC_URL ??
        (TARGET_CHAIN.rpcUrls.default.http[0] ?? "https://rpc.testnet.fluent.xyz"),
    ),
  },
  ssr: true,
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
        <RainbowKitProvider theme={darkTheme()} modalSize="compact">
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
              error: {
                iconTheme: { primary: "#f97373", secondary: "#0f0f13" },
                style: {
                  background: "rgba(255, 79, 110, 0.16)",
                  color: "#ffeef0",
                  border: "1px solid rgba(255, 129, 150, 0.42)",
                  boxShadow:
                    "0 16px 42px rgba(255,79,110,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
                },
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
