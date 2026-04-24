"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getWalletClient } from "@/lib/viem";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { LOREBOARD_ABI } from "@/lib/contracts/abis/loreboard";
import { convertToJpeg } from "@/lib/imageConvert";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import toast from "react-hot-toast";

type SubmitStatus = "idle" | "converting" | "uploading" | "confirming" | "done";

export default function SwipeSubmitPage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const processFile = useCallback(async (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }
    // Convert to JPEG if not already PNG/JPEG
    let processed = f;
    if (f.type !== "image/jpeg" && f.type !== "image/png") {
      try {
        processed = await convertToJpeg(f);
      } catch {
        toast.error("Could not process image");
        return;
      }
    }
    setFile(processed);
    setPreview(URL.createObjectURL(processed));
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

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
        account: walletClient.account ?? address,
        address: contractAddress,
        abi: LOREBOARD_ABI,
        functionName: "propose",
        args: [cid, 0, 0, 64, 64],
        value: BigInt(CONTRACTS.SWIPE_SUBMISSION_FEE ?? "0"),
      });

      setTxHash(hash);
      setStatus("done");
      toast.success("Meme proposed!");
      setTimeout(() => router.push("/swipe"), 1500);
    } catch (err) {
      setStatus("idle");
      toast.error(err instanceof Error ? err.message : "Submission failed");
    }
  }, [file, isConnected, address, router]);

  return (
    <main className="relative bg-foid-bg text-white/90 min-h-screen overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="relative z-10 flex items-start justify-center min-h-screen px-3 py-4 pb-24">
        <div className="w-full max-w-lg">
          <section className="vista-window w-full flex flex-col">
            <AppTitlebar
              title="SUBMIT_MEME.EXE"
              connected={isConnected}
              address={address}
              onDisconnect={() => disconnect()}
              onSwitchWallet={switchWallet}
            />
            <div className="vista-window__body">
              <div className="p-3 md:p-5">
                <Link
                  href="/swipe"
                  className="mb-4 inline-flex items-center text-xs text-neutral-400 transition hover:text-purple-400"
                >
                  &larr; Back to Vote
                </Link>

                <h1 className="mb-1 text-base font-bold text-white">Submit a Meme</h1>
                <p className="mb-4 text-xs text-white/50">
                  Propose a meme for the community to vote on. What passes gets canonized forever.
                </p>

                {/* Upload area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`mb-4 flex min-h-[200px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition ${
                    preview
                      ? "border-purple-500/40 bg-purple-500/5"
                      : "border-white/10 bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/5"
                  }`}
                  onClick={() => document.getElementById("meme-file-input")?.click()}
                >
                  <input
                    id="meme-file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {preview ? (
                    <img src={preview} alt="Preview" className="max-h-[280px] rounded-lg object-contain" loading="lazy" />
                  ) : (
                    <div className="text-center px-4">
                      <div className="mb-2 text-3xl text-white/20">&#x1F4F7;</div>
                      <p className="text-sm text-white/40">Tap to upload or drop an image</p>
                      <p className="mt-1 text-[10px] text-white/20">Any image format &mdash; auto-converted to JPEG</p>
                    </div>
                  )}
                </div>

                {/* Cost + how it works — compact */}
                <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 flex items-start gap-2.5">
                  <span className="text-amber-400 text-sm leading-none mt-0.5">&#x26A0;</span>
                  <div>
                    <p className="text-xs font-medium text-amber-300">Costs 0.001 ETH</p>
                    <p className="mt-0.5 text-[10px] text-white/35">
                      Submission fee to prevent spam. With FOID Wallet, signs automatically.
                    </p>
                  </div>
                </div>

                <div className="mb-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-[10px] text-white/35">
                  <span className="text-white/50 font-medium">How it works:</span>{" "}
                  Upload &rarr; pay 0.001 ETH &rarr; community swipes YES/NO &rarr; approved memes get placed on the Loreboard
                </div>

                {/* Submit button */}
                {status === "done" ? (
                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-center">
                    <p className="text-sm font-medium text-purple-300">Meme proposed!</p>
                    {txHash && (
                      <a
                        href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-purple-400 hover:underline"
                      >
                        View transaction &rarr;
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!file || !isConnected || status !== "idle"}
                    className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {status === "converting"
                      ? "Converting image..."
                      : status === "uploading"
                        ? "Uploading to IPFS..."
                        : status === "confirming"
                          ? "Confirm in wallet..."
                          : !isConnected
                            ? "Connect wallet first"
                            : !file
                              ? "Select an image"
                              : "Propose Meme (0.001 ETH)"}
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
