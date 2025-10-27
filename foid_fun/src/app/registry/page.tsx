"use client";
import { useState } from "react";
import { useAccount, useContractRead } from "wagmi";
import { AttestorRegistry } from "@/lib/contracts";
import { NetworkGate } from "@/components/NetworkGate";
import { TxButton } from "@/components/TxButton";
import { StatCard } from "@/components/StatCard";

// local helper so we don't add new files
function ShortAddr({ address }: { address?: string }) {
  if (!address) return null;
  const a = String(address);
  const short = a.length > 14 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a;
  return (
    <span className="font-mono block truncate" title={a}>
      {short}
    </span>
  );
}

export default function RegistryPage() {
  const { address } = useAccount();
  const { data: owner } = useContractRead({ ...AttestorRegistry, functionName: "owner" });

  const isOwner =
    typeof owner === "string" &&
    typeof address === "string" &&
    owner.toLowerCase() === address.toLowerCase();

  const [attestorToCheck, setAttestorToCheck] = useState("");
  const [addAttestorAddr, setAddAttestorAddr] = useState("");
  const [removeAttestorAddr, setRemoveAttestorAddr] = useState("");

  const { data: attestorStatus } = useContractRead({
    ...AttestorRegistry,
    functionName: "isAttestor",
    args: attestorToCheck ? [attestorToCheck] : undefined,
    query: { enabled: Boolean(attestorToCheck), refetchInterval: 4000 },
  });

  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "0", 10);

  return (
    <main className="space-y-6">
      <NetworkGate chainId={chainId}>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Registry Owner" value={<ShortAddr address={owner as string} />} />
          {address && <StatCard label="You are owner" value={isOwner ? "Yes" : "No"} />}
        </div>

        <div className="p-4 space-y-8">
          <section className="card space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Check Attestor</h2>
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Address to check"
              value={attestorToCheck}
              onChange={(e) => setAttestorToCheck(e.target.value)}
            />
            {attestorToCheck && (
              <div className="text-sm text-neutral-400">
                Is attestor: {attestorStatus ? "Yes" : "No"}
              </div>
            )}
          </section>

          {isOwner && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Add Attestor</h2>
              <input
                className="w-full p-2 rounded-lg bg-neutral-800"
                placeholder="Attestor address"
                value={addAttestorAddr}
                onChange={(e) => setAddAttestorAddr(e.target.value)}
              />
              <TxButton
                contract={AttestorRegistry}
                functionName="addAttestor"
                args={[addAttestorAddr]}
                enabled={!!addAttestorAddr}
                onSuccess={() => setAddAttestorAddr("")}
              >
                Add Attestor
              </TxButton>
            </section>
          )}

          {isOwner && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Remove Attestor</h2>
              <input
                className="w-full p-2 rounded-lg bg-neutral-800"
                placeholder="Attestor address"
                value={removeAttestorAddr}
                onChange={(e) => setRemoveAttestorAddr(e.target.value)}
              />
              <TxButton
                contract={AttestorRegistry}
                functionName="removeAttestor"
                args={[removeAttestorAddr]}
                enabled={!!removeAttestorAddr}
                onSuccess={() => setRemoveAttestorAddr("")}
              >
                Remove Attestor
              </TxButton>
            </section>
          )}
        </div>
      </NetworkGate>
    </main>
  );
}
