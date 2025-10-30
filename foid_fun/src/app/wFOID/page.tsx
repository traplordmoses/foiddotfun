"use client";
import { useState } from "react";
import { useAccount, useContractRead } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { AttestorRegistry, WrappedFoid } from "@/lib/contracts";
import { NetworkGate } from "@/components/NetworkGate";
import { StatCard } from "@/components/StatCard";
import { AmountInput } from "@/components/AmountInput";
import { TxButton } from "@/components/TxButton";
import { RoleBadge } from "@/components/RoleBadge";

const ShortAddr = ({ address }: { address?: string }) => {
  if (!address) return null;
  const value = String(address);
  return (
    <span className="block truncate font-mono text-sm" title={value}>
      {value.length > 14 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value}
    </span>
  );
};

export default function TokenPage() {
  const { address } = useAccount();

  const { data: name } = useContractRead({ ...WrappedFoid, functionName: "name" });
  const { data: symbol } = useContractRead({ ...WrappedFoid, functionName: "symbol" });
  const { data: decimals } = useContractRead({ ...WrappedFoid, functionName: "decimals" });
  const { data: totalSupply } = useContractRead({
    ...WrappedFoid,
    functionName: "totalSupply",
    query: { refetchInterval: 4000 },
  });

  const decimalsNum =
    typeof decimals === "number" ? decimals : Number((decimals as any)?.toString() ?? 18);
  const totalSupplyFormatted =
    totalSupply !== undefined ? formatUnits(totalSupply as bigint, decimalsNum) : "0";

  // Roles
  const { data: minterRole } = useContractRead({ ...WrappedFoid, functionName: "MINTER_ROLE" });
  const { data: pauserRole } = useContractRead({ ...WrappedFoid, functionName: "PAUSER_ROLE" });

  const { data: hasMinter } = useContractRead({
    ...WrappedFoid,
    functionName: "hasRole",
    args: minterRole && address ? [minterRole, address] : undefined,
    query: {
      enabled: Boolean(minterRole && address),
      refetchInterval: 4000,
    },
  });

  const { data: hasPauser } = useContractRead({
    ...WrappedFoid,
    functionName: "hasRole",
    args: pauserRole && address ? [pauserRole, address] : undefined,
    query: {
      enabled: Boolean(pauserRole && address),
      refetchInterval: 4000,
    },
  });

  const { data: paused } = useContractRead({
    ...WrappedFoid,
    functionName: "paused",
    query: { refetchInterval: 4000 },
  });

  // form state
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [approveSpender, setApproveSpender] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [burnFrom, setBurnFrom] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [attestorToCheck, setAttestorToCheck] = useState("");
  const [addAttestorAddr, setAddAttestorAddr] = useState("");
  const [removeAttestorAddr, setRemoveAttestorAddr] = useState("");

  // allowance (read-only)
  const { data: allowanceData } = useContractRead({
    ...WrappedFoid,
    functionName: "allowance",
    args: address && approveSpender ? [address, approveSpender] : undefined,
    query: {
      enabled: Boolean(address && approveSpender),
      refetchInterval: 4000,
    },
  });
  const allowanceFormatted =
    allowanceData !== undefined ? formatUnits(allowanceData as bigint, decimalsNum) : "0";

  const hasMinterRole = hasMinter === true;
  const hasPauserRole = hasPauser === true;
  const isPaused = paused === true;

  const { data: registryOwner } = useContractRead({ ...AttestorRegistry, functionName: "owner" });
  const isRegistryOwner =
    typeof registryOwner === "string" &&
    typeof address === "string" &&
    registryOwner.toLowerCase() === address.toLowerCase();

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
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
          <StatCard label="Token" value={`${name ?? ""} (${symbol ?? ""})`} />
          <StatCard label="Decimals" value={decimalsNum} />
          <StatCard label="Total Supply" value={`${totalSupplyFormatted} ${symbol ?? ""}`} />
          <StatCard
            label="Registry Owner"
            value={
              <ShortAddr
                address={typeof registryOwner === "string" ? registryOwner : undefined}
              />
            }
          />
          {address && (
            <StatCard label="You are registry owner" value={isRegistryOwner ? "Yes" : "No"} />
          )}
        </div>

        <div className="p-4 space-y-8">
          {/* Transfer */}
          <section className="card space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Transfer</h2>
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Recipient address"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
            />
            <AmountInput value={transferAmount} onChange={setTransferAmount} placeholder="Amount" />
            <TxButton
              contract={WrappedFoid}
              functionName="transfer"
              args={[transferTo, transferAmount ? parseUnits(transferAmount, decimalsNum) : 0n]}
              enabled={!!transferTo && !!transferAmount}
              onSuccess={() => {
                setTransferTo("");
                setTransferAmount("");
              }}
            >
              Transfer
            </TxButton>
          </section>

          {/* Approve */}
          <section className="card space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Approve</h2>
            <input
              className="w-full p-2 rounded-lg bg-neutral-800"
              placeholder="Spender address"
              value={approveSpender}
              onChange={(e) => setApproveSpender(e.target.value)}
            />
            <AmountInput value={approveAmount} onChange={setApproveAmount} placeholder="Amount" />
            <div className="text-xs text-neutral-400">Current allowance: {allowanceFormatted}</div>
            <TxButton
              contract={WrappedFoid}
              functionName="approve"
              args={[
                approveSpender,
                approveAmount ? parseUnits(approveAmount, decimalsNum) : 0n,
              ]}
              enabled={!!approveSpender && !!approveAmount}
              onSuccess={() => setApproveAmount("")}
            >
              Approve
            </TxButton>
          </section>

          {/* Mint (gated) */}
          {hasMinterRole && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Mint</h2>
              <input
                className="w-full p-2 rounded-lg bg-neutral-800"
                placeholder="Recipient address"
                value={mintTo}
                onChange={(e) => setMintTo(e.target.value)}
              />
              <AmountInput value={mintAmount} onChange={setMintAmount} placeholder="Amount" />
              <TxButton
                contract={WrappedFoid}
                functionName="mint"
                args={[mintTo, mintAmount ? parseUnits(mintAmount, decimalsNum) : 0n]}
                enabled={!!mintTo && !!mintAmount}
                onSuccess={() => {
                  setMintTo("");
                  setMintAmount("");
                }}
              >
                Mint
              </TxButton>
            </section>
          )}

          {/* Burn (gated) */}
          {hasMinterRole && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Burn</h2>
              <input
                className="w-full p-2 rounded-lg bg-neutral-800"
                placeholder="Address to burn from"
                value={burnFrom}
                onChange={(e) => setBurnFrom(e.target.value)}
              />
              <AmountInput value={burnAmount} onChange={setBurnAmount} placeholder="Amount" />
              <TxButton
                contract={WrappedFoid}
                functionName="burn"
                args={[burnFrom, burnAmount ? parseUnits(burnAmount, decimalsNum) : 0n]}
                enabled={!!burnFrom && !!burnAmount}
                onSuccess={() => {
                  setBurnFrom("");
                  setBurnAmount("");
                }}
              >
                Burn
              </TxButton>
            </section>
          )}

          {/* Pause / Unpause (gated) */}
          {hasPauserRole && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Pause / Unpause</h2>
              <TxButton
                contract={WrappedFoid}
                functionName={isPaused ? "unpause" : "pause"}
                args={[]}
                enabled={true}
              >
                {isPaused ? "Unpause" : "Pause"}
              </TxButton>
            </section>
          )}

          {/* Roles (badges) */}
          <section className="p-1">
            <div className="flex flex-wrap gap-2">
              <RoleBadge role="MINTER" hasRole={hasMinterRole} />
              <RoleBadge role="PAUSER" hasRole={hasPauserRole} />
            </div>
          </section>

          {/* Attestor registry tools */}
          <section className="card space-y-4">
            <h2 className="font-mono uppercase text-fluent-pink text-sm">Check Attestor</h2>
            <input
              className="w-full rounded-lg bg-neutral-800 p-2"
              placeholder="Address to check"
              value={attestorToCheck}
              onChange={(event) => setAttestorToCheck(event.target.value)}
            />
            {attestorToCheck && (
              <div className="text-sm text-neutral-400">
                Is attestor: {attestorStatus ? "Yes" : "No"}
              </div>
            )}
          </section>

          {isRegistryOwner && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Add Attestor</h2>
              <input
                className="w-full rounded-lg bg-neutral-800 p-2"
                placeholder="Attestor address"
                value={addAttestorAddr}
                onChange={(event) => setAddAttestorAddr(event.target.value)}
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

          {isRegistryOwner && (
            <section className="card space-y-4">
              <h2 className="font-mono uppercase text-fluent-pink text-sm">Remove Attestor</h2>
              <input
                className="w-full rounded-lg bg-neutral-800 p-2"
                placeholder="Attestor address"
                value={removeAttestorAddr}
                onChange={(event) => setRemoveAttestorAddr(event.target.value)}
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
