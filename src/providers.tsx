"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Fluent Testnet chain (typed against viem's Chain) ---
const fluentTestnet = {
  id: 20994,
  name: "Fluent Testnet",
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
  },
} as const satisfies import("viem").Chain;

// --- wagmi config: only injected connector (MetaMask/Brave/etc.) ---
const config = createConfig({
  chains: [fluentTestnet],
  connectors: [injected()],
  transports: {
    [fluentTestnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL as string),
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
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
