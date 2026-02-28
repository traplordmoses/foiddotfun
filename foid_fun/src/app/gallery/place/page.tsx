"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { getWalletClient } from "@/lib/viem";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { FOID_TREST_DIRECT_ABI } from "@/lib/contracts/abis/foidTrestDirect";
import toast from "react-hot-toast";

type PlaceStatus = "idle" | "uploading" | "confirming" | "done";

export default function DirectPlacePage() {
  const { address, isConnected } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PlaceStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) {
        toast.error("File must be under 5MB");
        return;
      }
      setFile(f);
      setPreview(URL.createObjectURL(f));
    },
    []
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file || !isConnected || !address) return;

    try {
      setStatus("uploading");

      // Upload to IPFS
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      const uploadRes = await fetch("/api/ipfs-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          base64,
          mime: file.type,
        }),
      });

      if (!uploadRes.ok) {
        throw new Error("IPFS upload failed");
      }

      const { cid } = await uploadRes.json();
      if (!cid) throw new Error("No CID returned");

      setStatus("confirming");

      // Send transaction
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not connected");

      const contractAddress = CONTRACTS.FOID_TREST_DIRECT as `0x${string}`;
      if (!contractAddress) throw new Error("FOIDRESTDirect not configured");

      const hash = await walletClient.writeContract({
        account: address,
        address: contractAddress,
        abi: FOID_TREST_DIRECT_ABI,
        functionName: "placeDirect",
        args: [cid, title, description],
        value: BigInt(CONTRACTS.PLACEMENT_FEE_WEI ?? "1000000000000000"),
      });

      setTxHash(hash);
      setStatus("done");
      toast.success("Placed on the FOIDREST!");
    } catch (err) {
      setStatus("idle");
      const message =
        err instanceof Error ? err.message : "Placement failed";
      toast.error(message);
    }
  }, [file, isConnected, address, title, description]);

  return (
    <div className="min-h-screen bg-neutral-950 px-4 pb-24 pt-8 md:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/gallery"
          className="mb-6 inline-flex items-center text-sm text-neutral-400 transition hover:text-purple-400"
        >
          &larr; Back to FOIDREST
        </Link>

        <h1 className="mb-2 font-display text-2xl font-bold text-neutral-50">
          Place on FOIDREST
        </h1>
        <p className="mb-8 text-sm text-neutral-400">
          Pay a flat fee to permanently place your content on the gallery. No
          voting required.
        </p>

        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`mb-6 flex min-h-[240px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed transition ${
            preview
              ? "border-purple-500/40 bg-neutral-900/40"
              : "border-neutral-700 bg-neutral-900/20 hover:border-purple-500/30"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="max-h-[400px] rounded-lg object-contain"
            />
          ) : (
            <div className="text-center">
              <div className="mb-2 text-3xl text-neutral-600">+</div>
              <p className="text-sm text-neutral-500">
                Drop an image or click to upload
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                PNG, JPEG, GIF, WebP — max 5MB
              </p>
            </div>
          )}
        </div>

        {/* Metadata fields */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give it a name"
              maxLength={100}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900/60 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the story?"
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900/60 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
        </div>

        {/* Fee display */}
        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Placement fee</span>
            <span className="font-mono text-neutral-200">~0.001 ETH</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            This is a permanent placement. Your content will live on the
            FOIDREST forever.
          </p>
        </div>

        {/* Submit button */}
        {status === "done" ? (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
            <p className="text-sm font-medium text-purple-300">
              Placed on the FOIDREST!
            </p>
            {txHash && (
              <a
                href={`https://testnet.fluentscan.xyz/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-purple-400 hover:underline"
              >
                View transaction &rarr;
              </a>
            )}
            <div className="mt-4">
              <Link
                href="/gallery"
                className="text-sm text-purple-400 hover:underline"
              >
                View Gallery
              </Link>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={
              !file || !isConnected || status !== "idle"
            }
            className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "uploading"
              ? "Uploading to IPFS..."
              : status === "confirming"
                ? "Confirm in wallet..."
                : !isConnected
                  ? "Connect wallet first"
                  : !file
                    ? "Select an image"
                    : "Place on FOIDREST"}
          </button>
        )}
      </div>
    </div>
  );
}
