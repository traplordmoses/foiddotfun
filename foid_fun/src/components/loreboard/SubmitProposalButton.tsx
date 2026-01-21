"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import ABI from "@/abi/LoreboardBoardV2.json" assert { type: "json" };
import { decodeEventLog, keccak256, toHex, type Abi } from "viem";
import type { Rect } from "@/lib/contracts/loreboard";
import { publicClient } from "@/lib/viem";

const FLUENT_CHAIN_ID = 20994;
const LoreboardAbi = ABI as Abi;

const normalizeCidString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      const bare = parts.slice(parts[0] === "ipfs" ? 1 : 0).join("/");
      return bare ? `ipfs://${bare}` : "";
    } catch {
      return trimmed;
    }
  }
  if (trimmed.startsWith("ipfs://")) return trimmed;
  return `ipfs://${trimmed}`;
};

type Props = {
  treasury: `0x${string}`;
  rect: Rect;
  cidV1?: string;
  bidPerCellWei: bigint;
  bidder?: `0x${string}`;
  prepareCid?: () => Promise<string>;
  onSubmitted?: (payload: {
    txHash: string;
    proposalId: `0x${string}`;
    cid: string;
  }) => void;
};

export default function SubmitProposalButton({
  treasury,
  rect,
  cidV1,
  bidPerCellWei,
  bidder,
  prepareCid,
  onSubmitted,
}: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [cid, setCid] = useState(cidV1 ?? "");

  const estimatedCells = Math.max(
    1,
    Math.ceil(rect.w / 32) * Math.ceil(rect.h / 32)
  );

  useEffect(() => {
    setCid(cidV1 ?? "");
  }, [cidV1]);

  const cidBytes = useMemo(() => normalizeCidString(cid), [cid]);

  const cidHash = useMemo(() => {
    if (!cidBytes) return null;
    return keccak256(toHex(new TextEncoder().encode(cidBytes)));
  }, [cidBytes]);

  const value = useMemo(
    () => bidPerCellWei * BigInt(estimatedCells),
    [bidPerCellWei, estimatedCells]
  );

  const mustSwitchChain = Boolean(chainId && chainId !== FLUENT_CHAIN_ID);
  const disabled =
    pending ||
    !isConnected ||
    !bidder ||
    (!cid && !prepareCid) ||
    (cid && !cidHash) ||
    bidPerCellWei <= 0n ||
    estimatedCells <= 0 ||
    mustSwitchChain;

  async function onClick() {
    if (!isConnected) {
      alert("Connect wallet first");
      return;
    }
    if (!bidder) {
      alert("Wallet address unavailable");
      return;
    }
    let ensuredCid = cid;
    if (!ensuredCid) {
      if (!prepareCid) {
        alert("Missing CID");
        return;
      }
      try {
        ensuredCid = await prepareCid();
        setCid(ensuredCid);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to prepare CID";
        setError(message);
        return;
      }
    }

    const normalizedCid = normalizeCidString(ensuredCid ?? "");

    const ensuredCidHash = keccak256(
      toHex(new TextEncoder().encode(normalizedCid))
    );

    if (!ensuredCidHash) {
      alert("Missing CID hash");
      return;
    }
    if (mustSwitchChain) {
      alert("Switch to Fluent Testnet (chain 20994)");
      return;
    }

    const toI32 = (value: number) => Number(BigInt.asIntN(32, BigInt(value)));
    const toU32 = (value: number) => Number(BigInt.asUintN(32, BigInt(value)));

    const normalizedRect = {
      x: toI32(rect.x),
      y: toI32(rect.y),
      w: toU32(rect.w),
      h: toU32(rect.h),
    };

    const cidBytes = new TextEncoder().encode(normalizedCid);

    setPending(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await writeContractAsync({
        account: bidder,
        address: treasury,
        abi: LoreboardAbi,
        functionName: "proposePlacement",
        args: [
          normalizedRect.x,
          normalizedRect.y,
          normalizedRect.w,
          normalizedRect.h,
          bidPerCellWei,
          cidBytes,
        ],
        value,
        chainId: FLUENT_CHAIN_ID,
      });
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      const log = receipt.logs.find(
        (entry) => entry.address.toLowerCase() === treasury.toLowerCase()
      );
      if (!log) throw new Error("PlacementProposed event not found");
      const decoded = decodeEventLog({
        abi: LoreboardAbi,
        data: log.data,
        topics: log.topics,
        eventName: "PlacementProposed",
      });
      const args = decoded.args as Record<string, unknown>;
      if (typeof args.id !== "string") {
        throw new Error("Placement event missing id");
      }
      const id = args.id as `0x${string}`;
      onSubmitted?.({ txHash: hash, proposalId: id, cid: ensuredCid });
    } catch (e: unknown) {
      console.error(e);
      const message =
        typeof e === "object" && e !== null
          ? (("shortMessage" in e && typeof (e as { shortMessage?: string }).shortMessage === "string"
              ? (e as { shortMessage?: string }).shortMessage
              : undefined) ??
              ("message" in e && typeof (e as { message?: string }).message === "string"
                ? (e as { message?: string }).message
                : undefined) ??
              "tx failed")
          : "tx failed";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onClick}
        disabled={disabled}
        className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Submitting..." : "Submit proposal"}
      </button>
      {txHash && (
        <a
          className="text-sm underline"
          href={`https://testnet.fluentscan.xyz/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          view tx
        </a>
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
      {!cid && !prepareCid && (
        <p className="text-xs text-yellow-400">
          Provide a CID or configure the IPFS upload step to enable on-chain submission.
        </p>
      )}
    </div>
  );
}
