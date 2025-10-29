"use client";

import { useAccount, useContractRead } from "wagmi";
import { formatUnits, erc20Abi as viemErc20Abi } from "viem"; // use viem's ERC-20 ABI
import { WrappedFoid } from "@/lib/contracts";
import { NetworkGate } from "@/components/NetworkGate";
import { StatCard } from "@/components/StatCard";
import ParallaxTilt from "@/components/ParallaxTilt";

const ERC20_ABI = viemErc20Abi;

export default function FoidSwapPage() {
  const { address } = useAccount();

  const { data: decimals } = useContractRead({
    address: WrappedFoid.address,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  const { data: balance } = useContractRead({
    address: WrappedFoid.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 4000 },
  });

  const decimalsNum =
    typeof decimals === "number" ? decimals : Number((decimals as any)?.toString() ?? 18);
  const balanceFormatted =
    balance !== undefined ? formatUnits(balance as bigint, decimalsNum) : "0";

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "0");

  return (
    <main className="space-y-6">
      <NetworkGate chainId={chainId}>
        <div className="p-4">
          <ParallaxTilt className="rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="My Balance" value={`${balanceFormatted} wFOID`} />
              <StatCard label="Token Decimals" value={`${decimalsNum}`} />
              {/* TODO: add approve/swap/liquidity UI wired to your router */}
            </div>
          </ParallaxTilt>
        </div>
      </NetworkGate>
    </main>
  );
}
