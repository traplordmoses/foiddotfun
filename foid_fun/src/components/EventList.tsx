"use client";
import { useEffect, useState } from "react";
import type { Abi, Address } from "viem";
import { formatUnits, zeroAddress } from "viem"; // 👈 added (values only)
import { usePublicClient } from "wagmi";
import {
  BLOCK_EXPLORER_URL,
  BridgeRouter,
  WrappedFoid,
} from "@/lib/contracts";

type EventEntry = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
};

const TOKEN_EVENT_NAMES = [
  "Transfer",
  "RoleGranted",
  "RoleRevoked",
  "Paused",
  "Unpaused",
] as const;
const BRIDGE_EVENT_NAMES = ["Minted", "RedeemRequested"] as const;

const TOKEN_EVENT_SET = new Set<string>(TOKEN_EVENT_NAMES);
const BRIDGE_EVENT_SET = new Set<string>(BRIDGE_EVENT_NAMES);

// --- UI helpers (presentation only) ---
const DECIMALS = 18; // wFOID decimals
const short = (a?: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");
const isZero = (a?: string) => (a ?? "").toLowerCase() === zeroAddress.toLowerCase();
const addrLink = (a?: string) =>
  a ? `${BLOCK_EXPLORER_URL}/address/${a}` : undefined;

export function EventList() {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<EventEntry[] | null>(null);

  useEffect(() => {
    (async () => {
      if (!publicClient) return;

      try {
        const latest = await publicClient.getBlockNumber();
        const windowSize = 3000n;
        const fromBlock = latest > windowSize ? latest - windowSize : 0n;

        const [tokenLogs, bridgeLogs] = await Promise.all([
          publicClient
            .getContractEvents({
              address: WrappedFoid.address as Address,
              abi: WrappedFoid.abi as Abi,
              fromBlock,
              toBlock: latest,
            })
            .then((logs) =>
              logs.filter((log) => TOKEN_EVENT_SET.has(log.eventName ?? "")),
            ),
          publicClient
            .getContractEvents({
              address: BridgeRouter.address as Address,
              abi: BridgeRouter.abi as Abi,
              fromBlock,
              toBlock: latest,
            })
            .then((logs) =>
              logs.filter((log) => BRIDGE_EVENT_SET.has(log.eventName ?? "")),
            ),
        ]);

        const decoded: EventEntry[] = [...tokenLogs, ...bridgeLogs]
          .map((log) => {
            const blockNumber = log.blockNumber ?? 0n;
            const logIndex = log.logIndex ?? 0;
            return {
              id: `${blockNumber}-${logIndex}`,
              name: log.eventName,
              args: { ...(log.args as Record<string, unknown> ?? {}) },
              blockNumber,
              logIndex,
            };
          })
          .sort((a, b) => {
            if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
            return b.blockNumber > a.blockNumber ? 1 : -1;
          });

        setEvents(decoded);
      } catch {
        setEvents([]);
      }
    })();
  }, [publicClient]);

  if (!events) return <div className="card p-4">Loading events…</div>;
  if (events.length === 0) return <div className="card p-4">No recent events found.</div>;

  // --- turn each decoded event into a friendly line (UI only) ---
  const renderLine = (e: EventEntry) => {
    const n = String(e.name ?? "");

    // TOKEN: Transfer -> infer Mint/Burn/Transfer
    if (n === "Transfer") {
      const from = (e.args.from as string) || zeroAddress;
      const to = (e.args.to as string) || zeroAddress;
      const value = (e.args.value as bigint) ?? 0n;
      const amt = `${formatUnits(value, DECIMALS)} wFOID`;

      let label = "Transfer";
      let content: React.ReactNode = (
        <>
          <a
            href={addrLink(from)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted"
          >
            {short(from)}
          </a>{" "}
          →{" "}
          <a
            href={addrLink(to)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted"
          >
            {short(to)}
          </a>{" "}
          · {amt}
        </>
      );

      if (isZero(from)) {
        label = "Mint";
        content = (
          <>
            to{" "}
            <a
              href={addrLink(to)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {short(to)}
            </a>{" "}
            · {amt}
          </>
        );
      } else if (isZero(to)) {
        label = "Burn";
        content = (
          <>
            from{" "}
            <a
              href={addrLink(from)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {short(from)}
            </a>{" "}
            · {amt}
          </>
        );
      }

      return (
        <div key={e.id} className="flex items-start justify-between gap-3 text-sm">
          <div>
            <span className="font-mono text-fluent-pink">{label}</span>
            <span className="ml-2 text-neutral-300">{content}</span>
            <div className="text-neutral-500 text-xs">
              blk{" "}
              <a
                href={`${BLOCK_EXPLORER_URL}/block/${e.blockNumber.toString()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted"
              >
                {e.blockNumber.toString()}
              </a>{" "}
              · idx {e.logIndex}
            </div>
          </div>
        </div>
      );
    }

    if (n === "RoleGranted" || n === "RoleRevoked") {
      const role = (e.args.role as string) || "0x";
      const account = (e.args.account as string) || zeroAddress;
      return (
        <div key={e.id} className="text-sm">
          <span className="font-mono text-fluent-pink">{n}</span>
          <span className="ml-2 text-neutral-300">
            {short(role, 6)} ·{" "}
            <a
              href={addrLink(account)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {short(account)}
            </a>
          </span>
          <div className="text-neutral-500 text-xs">
            blk{" "}
            <a
              href={`${BLOCK_EXPLORER_URL}/block/${e.blockNumber.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {e.blockNumber.toString()}
            </a>{" "}
            · idx {e.logIndex}
          </div>
        </div>
      );
    }

    if (n === "Paused" || n === "Unpaused") {
      const account = (e.args.account as string) || zeroAddress;
      return (
        <div key={e.id} className="text-sm">
          <span className="font-mono text-fluent-pink">{n}</span>
          <span className="ml-2 text-neutral-300">
            by{" "}
            <a
              href={addrLink(account)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {short(account)}
            </a>
          </span>
          <div className="text-neutral-500 text-xs">
            blk{" "}
            <a
              href={`${BLOCK_EXPLORER_URL}/block/${e.blockNumber.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {e.blockNumber.toString()}
            </a>{" "}
            · idx {e.logIndex}
          </div>
        </div>
      );
    }

    // BRIDGE
    if (n === "Minted") {
      const to = (e.args.to as string) || zeroAddress;
      const amount = (e.args.amount as bigint) ?? 0n;
      return (
        <div key={e.id} className="text-sm">
          <span className="font-mono text-fluent-pink">Bridge Minted</span>
          <span className="ml-2 text-neutral-300">
            to{" "}
            <a
              href={addrLink(to)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {short(to)}
            </a>{" "}
            · {formatUnits(amount, DECIMALS)} wFOID
          </span>
          <div className="text-neutral-500 text-xs">
            blk{" "}
            <a
              href={`${BLOCK_EXPLORER_URL}/block/${e.blockNumber.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {e.blockNumber.toString()}
            </a>{" "}
            · idx {e.logIndex}
          </div>
        </div>
      );
    }

    if (n === "RedeemRequested") {
      const from = (e.args.from as string) || zeroAddress;
      const amount = (e.args.amount as bigint) ?? 0n;
      return (
        <div key={e.id} className="text-sm">
          <span className="font-mono text-fluent-pink">Burn for Redeem</span>
          <span className="ml-2 text-neutral-300">
            by{" "}
            <a
              href={addrLink(from)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {short(from)}
            </a>{" "}
            · {formatUnits(amount, DECIMALS)} wFOID
          </span>
          <div className="text-neutral-500 text-xs">
            blk{" "}
            <a
              href={`${BLOCK_EXPLORER_URL}/block/${e.blockNumber.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {e.blockNumber.toString()}
            </a>{" "}
            · idx {e.logIndex}
          </div>
        </div>
      );
    }

    // Fallback (rare/unknown)
    return (
      <div key={e.id} className="text-sm">
        <span className="font-mono text-fluent-pink">{n || "Event"}</span>{" "}
        <span className="text-neutral-400">{JSON.stringify(e.args)}</span>
        <div className="text-neutral-500 text-xs">
          blk{" "}
          <a
            href={`${BLOCK_EXPLORER_URL}/block/${e.blockNumber.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted"
          >
            {e.blockNumber.toString()}
          </a>{" "}
          · idx {e.logIndex}
        </div>
      </div>
    );
  };

  return <div className="card p-4 space-y-3">{events.map(renderLine)}</div>;
}
