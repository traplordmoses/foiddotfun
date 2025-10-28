"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

// --- Fluent Testnet chain (typed against viem's Chain) ---
const rpcUrl =
  (process.env.NEXT_PUBLIC_RPC as string | undefined) ??
  (process.env.NEXT_PUBLIC_RPC_URL as string | undefined) ??
  "https://rpc.testnet.fluent.xyz";
const explorerUrl =
  (process.env.NEXT_PUBLIC_BLOCK_EXPLORER as string | undefined) ??
  "https://testnet.fluentscan.xyz";
const fluentTestnet = {
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Fluentscan", url: explorerUrl },
  },
} as const satisfies import("viem").Chain;

// --- wagmi config: only injected connector (MetaMask/Brave/etc.) ---
const config = createConfig({
  chains: [fluentTestnet],
  connectors: [injected()],
  transports: {
    [fluentTestnet.id]: http(rpcUrl),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#0f0f13",
                color: "#f8f8ff",
                border: "1px solid rgba(255,255,255,0.08)",
              },
              success: { iconTheme: { primary: "#8b5cf6", secondary: "#0f0f13" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "#0f0f13" } },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
