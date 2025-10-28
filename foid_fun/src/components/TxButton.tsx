"use client";
import { useEffect, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Abi } from "viem";
import toast from "react-hot-toast";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";

interface TxButtonProps {
  contract: {
    address: `0x${string}`;
    abi: readonly unknown[];
  };
  functionName: string;
  args?: readonly unknown[];
  enabled?: boolean;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function TxButton({
  contract,
  functionName,
  args = [],
  enabled = true,
  children,
  onSuccess,
}: TxButtonProps) {
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: Boolean(hash),
      refetchInterval: hash ? 1500 : false,
    },
  });

  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
      setHash(undefined);
    }
  }, [hash, isSuccess, onSuccess]);

  const handleClick = async () => {
    if (!enabled || isMining) {
      toast.error("Action currently disabled");
      return;
    }

    console.debug("TxButton click", { functionName, args });

    try {
      const loadingId = toast.loading("Submitting transaction…");
      const normalizedArgs = (Array.isArray(args)
        ? args.map((arg) => {
            if (typeof arg === "bigint" && arg < 0n) {
              // normalize negative sentinel values into uint256 space
              return (arg + (1n << 256n)) as unknown;
            }
            return arg;
          })
        : args) as typeof args;

      const txHash = await writeContractAsync({
        address: contract.address,
        abi: contract.abi as Abi,
        functionName,
        args: normalizedArgs,
      });
      setHash(txHash);
      toast.dismiss(loadingId);
      toast.success(
        () => (
          <span>
            Tx submitted:{" "}
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-fluent-blue"
            >
              {txHash.slice(0, 10)}…
            </a>
          </span>
        ),
        { duration: 6000 },
      );
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error(err?.shortMessage || err?.message || "Transaction failed");
    }
  };

  return (
    <button
      type="button"
      disabled={!enabled || isMining}
      onClick={handleClick}
      className="px-4 py-2 rounded-full bg-fluent-purple hover:bg-fluent-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isMining ? "Processing…" : children}
    </button>
  );
}
