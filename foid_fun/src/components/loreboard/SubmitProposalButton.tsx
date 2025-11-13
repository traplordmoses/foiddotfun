"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { writeContract } from "@wagmi/core";
import { config } from "@/providers";
import ABI from "@/abi/LoreBoardTreasury.json" assert { type: "json" };
import { encodePacked, keccak256, toHex } from "viem";
import type { Rect } from "@/lib/contracts/loreboard";

const FLUENT_CHAIN_ID = 20994;

type Props = {
  treasury: `0x${string}`;
  epoch: number;
  rect: Rect;
  cells: number;
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
  epoch,
  rect,
  cells,
  cidV1,
  bidPerCellWei,
  bidder,
  prepareCid,
  onSubmitted,
}: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [cid, setCid] = useState(cidV1 ?? "");

  const safeCells = Math.max(0, Math.trunc(cells));

  useEffect(() => {
    setCid(cidV1 ?? "");
  }, [cidV1]);

  const cidBytes = useMemo(() => {
    if (!cid) return "";
    const trimmed = cid.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        const parts = url.pathname.replace(/^\/+/, "").split("/");
        return parts.slice(parts[0] === "ipfs" ? 1 : 0).join("/");
      } catch {
        return trimmed;
      }
    }
    if (trimmed.startsWith("ipfs://")) return trimmed.slice("ipfs://".length);
    return trimmed;
  }, [cid]);

  const cidHash = useMemo(() => {
    if (!cidBytes) return null;
    return keccak256(toHex(new TextEncoder().encode(cidBytes)));
  }, [cidBytes]);

  const value = useMemo(
    () => bidPerCellWei * BigInt(safeCells),
    [bidPerCellWei, safeCells]
  );

  const mustSwitchChain = Boolean(chainId && chainId !== FLUENT_CHAIN_ID);
  const disabled =
    pending ||
    !isConnected ||
    !bidder ||
    (!cid && !prepareCid) ||
    (cid && !cidHash) ||
    bidPerCellWei <= 0n ||
    safeCells <= 0 ||
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
      } catch (e: any) {
        setError(e?.message ?? "Failed to prepare CID");
        return;
      }
    }

    const normalizedCid = (() => {
      const trimmed = ensuredCid?.trim() ?? "";
      if (!trimmed) return "";
      if (trimmed.startsWith("ipfs://")) return trimmed.slice("ipfs://".length);
      if (/^https?:\/\//i.test(trimmed)) {
        try {
          const url = new URL(trimmed);
          const parts = url.pathname.replace(/^\/+/, "").split("/");
          return parts.slice(parts[0] === "ipfs" ? 1 : 0).join("/");
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    })();

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

    const encodedEpoch = Number(BigInt.asUintN(32, BigInt(epoch)));

    const proposalId = keccak256(
      encodePacked(
        ["address", "uint32", "bytes32", "int32", "int32", "int32", "int32"],
        [
          bidder,
          encodedEpoch,
          ensuredCidHash,
          normalizedRect.x,
          normalizedRect.y,
          normalizedRect.w,
          normalizedRect.h,
        ]
      )
    );

    setPending(true);
    setError(null);
    setTxHash(null);

    try {
      const hash = await writeContract(
        config,
        {
          account: bidder,
          address: treasury,
          abi: ABI as any,
          functionName: "proposePlacement",
          args: [
            {
              id: proposalId,
              bidder,
              rect: normalizedRect,
              cells: safeCells,
              bidPerCellWei,
              cidHash: ensuredCidHash,
              epoch: encodedEpoch,
            },
          ],
          value,
          chainId: FLUENT_CHAIN_ID,
        } as any
      );
      setTxHash(hash);
      onSubmitted?.({ txHash: hash, proposalId, cid: ensuredCid });
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "tx failed");
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
