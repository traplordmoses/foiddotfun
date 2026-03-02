"use client";

import { useCallback, useState } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import Link from "next/link";
import { getWalletClient } from "@/lib/viem";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { SWIPE_ABI } from "@/lib/contracts/abis/swipe";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import toast from "react-hot-toast";

type SubmitStatus = "idle" | "uploading" | "confirming" | "done";

export default function SwipeSubmitPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors } = useConnect();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmitStatus>("idle");
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
        body: JSON.stringify({ name: file.name, base64, mime: file.type }),
      });

      if (!uploadRes.ok) throw new Error("IPFS upload failed");
      const { cid } = await uploadRes.json();
      if (!cid) throw new Error("No CID returned");

      setStatus("confirming");

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not connected");

      const contractAddress = CONTRACTS.SWIPE as `0x${string}`;
      if (!contractAddress) throw new Error("Swipe contract not configured");

      const hash = await walletClient.writeContract({
        account: address,
        address: contractAddress,
        abi: SWIPE_ABI,
        functionName: "propose",
        args: [cid],
        value: BigInt(CONTRACTS.SWIPE_SUBMISSION_FEE ?? "0"),
      });

      setTxHash(hash);
      setStatus("done");
      toast.success("Meme proposed!");
    } catch (err) {
      setStatus("idle");
      toast.error(err instanceof Error ? err.message : "Submission failed");
    }
  }, [file, isConnected, address]);

  const handleSwitchWallet = useCallback(() => {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injected) injected.connect?.();
  }, [connectors]);

  return (
    <main className="relative bg-foid-bg text-white/90 min-h-screen overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="relative z-10 flex items-start justify-center min-h-screen px-4 py-6 pb-28">
        <div className="w-full max-w-2xl">
          <section className="vista-window w-full flex flex-col">
            <AppTitlebar
              title="SUBMIT_MEME.EXE"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={handleSwitchWallet}
            />
            <div className="vista-window__body">
              <div className="p-4 md:p-6">
                <Link
                  href="/swipe"
                  className="mb-6 inline-flex items-center text-sm text-neutral-400 transition hover:text-purple-400"
                >
                  &larr; Back to Swipe
                </Link>

                <h1 className="mb-2 text-xl font-bold text-white">Submit a Meme</h1>
                <p className="mb-6 text-sm text-white/50">
                  Propose a meme for the community to vote on. If it passes, it gets canonized in the Gallery forever.
                </p>

                {/* Upload area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`mb-6 flex min-h-[280px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed transition ${
                    preview
                      ? "border-purple-500/40 bg-purple-500/5"
                      : "border-white/10 bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/5"
                  }`}
                  onClick={() => document.getElementById("duel-file-input")?.click()}
                >
                  <input
                    id="duel-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {preview ? (
                    <img src={preview} alt="Preview" className="max-h-[360px] rounded-lg object-contain" />
                  ) : (
                    <div className="text-center">
                      <div className="mb-2 text-4xl text-white/20">&#x2694;</div>
                      <p className="text-sm text-white/40">Drop your meme or click to upload</p>
                      <p className="mt-1 text-xs text-white/20">PNG, JPEG, GIF, WebP &mdash; max 5MB</p>
                    </div>
                  )}
                </div>

                {/* How duels work */}
                <div className="mb-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-white/50">
                  <h3 className="mb-2 font-medium text-white/70">How it works</h3>
                  <ul className="space-y-1 text-xs text-white/40">
                    <li>1. Upload and propose your meme (small fee)</li>
                    <li>2. Community swipes to approve or reject (weighted by prayer streak)</li>
                    <li>3. Approved memes get canonized in the Gallery</li>
                  </ul>
                </div>

                {/* Submit button */}
                {status === "done" ? (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
                    <p className="text-sm font-medium text-purple-300">Meme proposed!</p>
                    <p className="mt-1 text-xs text-white/40">The community will now vote on your meme.</p>
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
                      <Link href="/swipe" className="text-sm text-purple-400 hover:underline">View Swipe</Link>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!file || !isConnected || status !== "idle"}
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
                            : "Propose Meme"}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
