"use client";
import { useAccount, useContractRead } from "wagmi";
import { formatUnits } from "viem";
import { WrappedFoid } from "@/lib/contracts";
import { NetworkGate } from "@/components/NetworkGate";
import { StatCard } from "@/components/StatCard";
import { RoleBadge } from "@/components/RoleBadge";
import { EventList } from "@/components/EventList";
import ParallaxTilt from "@/components/ParallaxTilt";

export default function DashboardPage() {
  const { address } = useAccount();

  const { data: totalSupply } = useContractRead({
    ...WrappedFoid,
    functionName: "totalSupply",
    query: { refetchInterval: 4000 },
  });
  const { data: decimals } = useContractRead({ ...WrappedFoid, functionName: "decimals" });
  const { data: paused } = useContractRead({
    ...WrappedFoid,
    functionName: "paused",
    query: { refetchInterval: 4000 },
  });
  const { data: balance } = useContractRead({
    ...WrappedFoid,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 4000 },
  });
  const { data: minterRole } = useContractRead({ ...WrappedFoid, functionName: "MINTER_ROLE" });
  const { data: pauserRole } = useContractRead({ ...WrappedFoid, functionName: "PAUSER_ROLE" });
  const { data: hasMinter } = useContractRead({
    ...WrappedFoid,
    functionName: "hasRole",
    args: minterRole && address ? [minterRole, address] : undefined,
    query: { enabled: Boolean(minterRole && address), refetchInterval: 4000 },
  });
  const { data: hasPauser } = useContractRead({
    ...WrappedFoid,
    functionName: "hasRole",
    args: pauserRole && address ? [pauserRole, address] : undefined,
    query: { enabled: Boolean(pauserRole && address), refetchInterval: 4000 },
  });

  const decimalsNum =
    typeof decimals === "number" ? decimals : Number((decimals as any)?.toString() ?? 18);
  const balanceFormatted =
    balance !== undefined ? formatUnits(balance as bigint, decimalsNum) : "0";
  const totalSupplyFormatted =
    totalSupply !== undefined ? formatUnits(totalSupply as bigint, decimalsNum) : "0";

  // force a strict boolean to avoid undefined flicker
  const pausedBool = paused === true;

  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "0", 10);

  return (
    <main className="space-y-6">
      <NetworkGate chainId={chainId}>
        <div className="p-4">
          <ParallaxTilt className="rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="My Balance" value={`${balanceFormatted} wFOID`} />
              <StatCard label="Total Supply" value={`${totalSupplyFormatted} wFOID`} />
              <StatCard label="Status" value={pausedBool ? "Paused" : "Active"} />
            </div>
          </ParallaxTilt>
        </div>

        <div className="p-4 flex flex-col space-y-2">
          <h2 className="font-mono uppercase text-fluent-pink text-sm">Roles</h2>
          <div className="flex flex-wrap gap-2">
            <RoleBadge role="MINTER" hasRole={Boolean(hasMinter)} />
            <RoleBadge role="PAUSER" hasRole={Boolean(hasPauser)} />
          </div>
        </div>

        <div className="p-4">
          <EventList />
        </div>
      </NetworkGate>
    </main>
  );
}
