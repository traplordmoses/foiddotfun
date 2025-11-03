"use client";
import { useMemo, useState } from "react";
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
    <span className="block truncate font-mono text-sm text-neutral-200" title={value}>
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
  const inputClass =
    "w-full rounded-lg border border-neutral-700/80 bg-neutral-950/70 px-3 py-2 text-white outline-none transition focus:border-fluent-purple";

  const stats = useMemo(() => {
    const items = [
      <StatCard key="token" label="Token" value={`${name ?? ""} (${symbol ?? ""})`} />,
      <StatCard key="decimals" label="Decimals" value={decimalsNum} />,
      <StatCard
        key="supply"
        label="Total Supply"
        value={`${totalSupplyFormatted} ${symbol ?? ""}`}
      />,
      <StatCard
        key="owner"
        label="Registry Owner"
        value={<ShortAddr address={typeof registryOwner === "string" ? registryOwner : undefined} />}
      />,
    ];
    if (address) {
      items.push(
        <StatCard
          key="isOwner"
          label="You are registry owner"
          value={isRegistryOwner ? "Yes" : "No"}
        />,
      );
    }
    return items;
  }, [address, decimalsNum, isRegistryOwner, name, registryOwner, symbol, totalSupplyFormatted]);

  return (
    <main className="py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <NetworkGate chainId={chainId}>
          <section className="space-y-8">
            <header className="space-y-3 text-white">
              <h1 className="text-3xl font-semibold">wFOID Control Panel</h1>
              <p className="max-w-2xl text-sm text-white/90 drop-shadow-[0_8px_20px_rgba(4,18,34,0.45)]">
                Manage the wrapped FOID token, review registry ownership, and administer attestor access.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card space-y-4">
                <h2 className="font-mono uppercase text-fluent-pink text-sm">Transfer</h2>
                <input
                  className={inputClass}
                  placeholder="Recipient address"
                  value={transferTo}
                  onChange={(event) => setTransferTo(event.target.value)}
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

              <section className="card space-y-4">
                <h2 className="font-mono uppercase text-fluent-pink text-sm">Approve</h2>
                <input
                  className={inputClass}
                  placeholder="Spender address"
                  value={approveSpender}
                  onChange={(event) => setApproveSpender(event.target.value)}
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

              {hasMinterRole && (
                <section className="card space-y-4">
                  <h2 className="font-mono uppercase text-fluent-pink text-sm">Mint</h2>
                  <input
                    className={inputClass}
                    placeholder="Recipient address"
                    value={mintTo}
                    onChange={(event) => setMintTo(event.target.value)}
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

              {hasMinterRole && (
                <section className="card space-y-4">
                  <h2 className="font-mono uppercase text-fluent-pink text-sm">Burn</h2>
                  <input
                    className={inputClass}
                    placeholder="Address to burn from"
                    value={burnFrom}
                    onChange={(event) => setBurnFrom(event.target.value)}
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

              {hasPauserRole && (
                <section className="card space-y-4">
                  <h2 className="font-mono uppercase text-fluent-pink text-sm">Pause / Unpause</h2>
                  <TxButton
                    contract={WrappedFoid}
                    functionName={isPaused ? "unpause" : "pause"}
                    args={[]}
                    enabled
                  >
                    {isPaused ? "Unpause" : "Pause"}
                  </TxButton>
                </section>
              )}

              <section className="card">
                <h2 className="font-mono uppercase text-fluent-pink text-sm">Roles</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RoleBadge role="MINTER" hasRole={hasMinterRole} />
                  <RoleBadge role="PAUSER" hasRole={hasPauserRole} />
                </div>
              </section>
            </div>

            <section className="card space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-mono uppercase text-fluent-pink text-sm">Attestor Registry</h2>
                  <p className="text-xs text-neutral-400">
                    Inspect and manage whitelisted attestors for FOID provenance proofs.
                  </p>
                </div>
                {isRegistryOwner && (
                  <span className="rounded-full border border-fluent-purple/40 bg-fluent-purple/10 px-3 py-1 text-xs font-semibold text-fluent-purple/80">
                    Registry owner
                  </span>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white">Check attestor status</h3>
                  <input
                    className={inputClass}
                    placeholder="Address to check"
                    value={attestorToCheck}
                    onChange={(event) => setAttestorToCheck(event.target.value)}
                  />
                  {attestorToCheck && (
                    <div className="rounded-lg bg-neutral-900/70 px-3 py-2 text-sm text-neutral-300">
                      Is attestor: {attestorStatus ? "Yes" : "No"}
                    </div>
                  )}
                </div>

                {isRegistryOwner && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">Add attestor</h3>
                      <input
                        className={inputClass}
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
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white">Remove attestor</h3>
                      <input
                        className={inputClass}
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
                    </div>
                  </div>
                )}
              </div>
            </section>
          </section>
        </NetworkGate>
      </div>
    </main>
  );
}
