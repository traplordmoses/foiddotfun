"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider, parseEther, isAddress } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast from "react-hot-toast";

// API base URL - change this to match your Express server port
const ANONYMIZER_API_URL = process.env.NEXT_PUBLIC_ANONYMIZER_API_URL || "http://localhost:3001";

interface Deposit {
  id: number;
  amount: number;
  recipient_address: string;
  claimed: boolean;
  claim_tx_hash?: string;
  created_at: string;
  claimed_at?: string;
}

export default function AnonymizerPage() {
  const { address: connectedAddress, isConnected } = useAccount();
  const [serverAddress, setServerAddress] = useState<string | null>(null);
  
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [claimAddress, setClaimAddress] = useState("");
  
  const [status, setStatus] = useState<{ message: string; type: "" | "success" | "error" }>({ message: "", type: "" });
  const [result, setResult] = useState<{ message: string; type: "" | "success" | "error"; show: boolean }>({ message: "", type: "", show: false });
  const [claimResult, setClaimResult] = useState<{ message: string; type: "" | "success" | "error"; show: boolean }>({ message: "", type: "", show: false });
  const [txHash, setTxHash] = useState<string>("");
  const [showTxHash, setShowTxHash] = useState(false);
  
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Fetch server address
  const fetchServerAddress = async () => {
    try {
      const serverAddrResponse = await fetch(`${ANONYMIZER_API_URL}/api/server-address`);
      const serverAddrData = await serverAddrResponse.json();
      setServerAddress(serverAddrData.serverAddress);
      setStatus({ message: "✓ Server address loaded", type: "success" });
    } catch (error: any) {
      setStatus({ message: "✗ Failed to load server address: " + error.message, type: "error" });
    }
  };

  // Set claim address when wallet connects
  useEffect(() => {
    if (connectedAddress) {
      setClaimAddress(connectedAddress);
      setRecipientAddress((prev) => prev || connectedAddress);
    }
  }, [connectedAddress]);

  // Send ETH via wallet
  const sendETH = async () => {
    if (!isConnected || !connectedAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!isAddress(recipientAddress)) {
      toast.error("Please enter a valid recipient address");
      return;
    }

    if (!serverAddress) {
      toast.error("Server address not loaded");
      return;
    }

    if (typeof window === "undefined") return;
    const ethereum = (window as typeof window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      toast.error("No injected wallet detected.");
      return;
    }

    setIsLoading(true);
    setResult({ message: "", type: "", show: false });
    setShowTxHash(false);

    try {
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      
      // Send ETH transaction
      const tx = await signer.sendTransaction({
        to: serverAddress,
        value: parseEther(amount),
      });

      setTxHash(tx.hash);
      setShowTxHash(true);
      setStatus({ message: "✓ Transaction sent. Waiting for confirmation...", type: "success" });
      toast.success("Transaction submitted");

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction pending - receipt unavailable");
      }

      if (receipt.status === 1) {
        // Transaction successful - save to DB with plaintext recipient address
        const depositResponse = await fetch(`${ANONYMIZER_API_URL}/api/deposit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txHash: tx.hash,
            recipientAddress: recipientAddress.toLowerCase(), // Plaintext, no encryption
          }),
        });

        const depositData = await depositResponse.json();

        if (!depositResponse.ok) {
          throw new Error(depositData.error || "Failed to save deposit");
        }

        setResult({
          message: `✓ Deposit Complete!<br><strong>Amount:</strong> ${depositData.amount} ETH<br><strong>Recipient:</strong> ${depositData.recipientAddress}<br><strong>Transaction Hash:</strong> <a href="https://fluentscan.xyz/tx/${tx.hash}" target="_blank" style="color: #667eea;">${tx.hash.substring(0, 10)}...</a>`,
          type: "success",
          show: true,
        });
        setStatus({ message: "✓ Deposit saved successfully!", type: "success" });
        toast.success("Deposit saved successfully!");

        // Clear form and refresh
        setTimeout(() => {
          setAmount("");
          setShowTxHash(false);
          fetchDeposits();
        }, 2000);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error("Send ETH error:", error);
      setResult({
        message: `<strong>✗ Error:</strong> ${escapeHtml(error.message || "Transaction failed")}`,
        type: "error",
        show: true,
      });

      if (error.code === 4001) {
        setStatus({ message: "✗ Transaction rejected by user", type: "error" });
        toast.error("Transaction rejected");
      } else {
        setStatus({ message: "✗ Failed: " + error.message, type: "error" });
        toast.error(error.message || "Transaction failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle claim form submission
  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();

    let address = claimAddress.trim();

    if (!isAddress(address)) {
      setClaimResult({
        message: "<strong>✗ Error:</strong> Invalid address format",
        type: "error",
        show: true,
      });
      toast.error("Invalid address format");
      return;
    }

    // Normalize address to lowercase
    address = address.toLowerCase();

    setIsClaiming(true);
    setClaimResult({ message: "", type: "", show: false });

    try {
      const response = await fetch(`${ANONYMIZER_API_URL}/api/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipientAddress: address }),
      });

      const data = await response.json();

      if (data.success) {
        setClaimResult({
          message: `<strong>✓ Claim Successful!</strong><br><strong>Total Amount:</strong> ${data.totalAmount} ETH<br><strong>Deposits Claimed:</strong> ${data.depositCount}<br><strong>Transaction Hash:</strong> <a href="https://fluentscan.xyz/tx/${escapeHtml(data.txHash)}" target="_blank" style="color: #667eea;">${escapeHtml(data.txHash)}</a>`,
          type: "success",
          show: true,
        });
        toast.success("Claim successful!");
        fetchDeposits();
      } else {
        setClaimResult({
          message: `<strong>ℹ️ No Claims Available</strong><br>${escapeHtml(data.message)}`,
          type: "error",
          show: true,
        });
        toast("No claims available");
      }
    } catch (error: any) {
      setClaimResult({
        message: `<strong>✗ Error:</strong> ${escapeHtml(error.message || "Failed to claim")}`,
        type: "error",
        show: true,
      });
      toast.error(error.message || "Failed to claim");
    } finally {
      setIsClaiming(false);
    }
  };

  // Fetch deposits
  const fetchDeposits = async () => {
    try {
      const response = await fetch(`${ANONYMIZER_API_URL}/api/deposits`);
      const data = await response.json();

      if (data.success) {
        setDeposits(data.deposits);
      }
    } catch (error) {
      console.error("Failed to fetch deposits:", error);
    }
  };

  // Escape HTML
  const escapeHtml = (text: string) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  // Initialize on mount
  useEffect(() => {
    fetchServerAddress();
    fetchDeposits();
  }, []);

  return (
    <div className="relative z-10 flex min-h-screen items-start justify-center px-4 py-16">
      <div className="w-full max-w-3xl rounded-3xl border border-white/20 foid-glass p-8 text-white/90 shadow-[0_24px_80px_rgba(11,46,78,0.45)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-white/55">Foid Toolsuite</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">🛡️ Foid Anonymizer</h1>
            <p className="mt-1 text-sm text-white/70">Disguise ETH flows by routing deposits through the Foid relay.</p>
          </div>
          <div className="self-start">
            <ConnectButton chainStatus="name" showBalance={false} />
          </div>
        </div>

        {isConnected && connectedAddress && (
          <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/75 shadow-[0_0_30px_rgba(114,225,255,0.18)]">
            <span className="font-semibold text-white/65">Connected:</span>{" "}
            <span className="font-mono text-white/90">{connectedAddress}</span>
          </div>
        )}

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            sendETH();
          }}
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Amount (ETH)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.001"
              min="0.001"
              placeholder="0.10"
              required
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-mono text-white/90 placeholder-white/40 transition focus:border-foid-cyan/70 focus:outline-none focus:ring-2 focus:ring-foid-cyan/40"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Recipient Address (EOA)</label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              pattern="^0x[a-fA-F0-9]{40}$"
              required
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-mono text-white/90 placeholder-white/40 transition focus:border-foid-cyan/70 focus:outline-none focus:ring-2 focus:ring-foid-cyan/40"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-white/20 bg-white/[0.08] p-4">
            <label className="text-sm font-semibold text-white/80">Send ETH through the anonymizer relay</label>
            <button
              type="submit"
              disabled={isLoading || !isConnected}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-foid-aqua via-foid-periw to-foid-candy px-5 py-3 text-base font-semibold text-foid-midnight shadow-[0_18px_45px_rgba(114,225,255,0.24)] transition hover:scale-[1.01] hover:shadow-[0_22px_55px_rgba(114,225,255,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Processing..." : "Send ETH"}
            </button>
            {showTxHash && (
              <div className="text-xs text-white/70">
                <strong className="font-semibold text-white/80">Transaction Hash:</strong>{" "}
                <span className="font-mono">{txHash}</span>
              </div>
            )}
          </div>
        </form>

        {result.show && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              result.type === "success"
                ? "border-emerald-400/45 bg-emerald-400/15 text-emerald-100"
                : "border-rose-400/45 bg-rose-400/15 text-rose-100"
            }`}
            dangerouslySetInnerHTML={{ __html: result.message }}
          />
        )}

        {status.message && (
          <div
            className={`mt-3 rounded-full border px-4 py-2 text-xs tracking-wide ${
              status.type === "success"
                ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-100"
                : status.type === "error"
                ? "border-rose-400/45 bg-rose-400/10 text-rose-100"
                : "border-white/20 bg-white/10 text-white/70"
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="mt-10 border-t border-white/20 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">🎁 Claim Deposits</h2>
          </div>
          <form onSubmit={handleClaim} className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Your address</label>
              <input
                type="text"
                value={claimAddress}
                onChange={(e) => setClaimAddress(e.target.value)}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                required
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-mono text-white/90 placeholder-white/40 transition focus:border-foid-cyan/70 focus:outline-none focus:ring-2 focus:ring-foid-cyan/40"
              />
            </div>
            <button
              type="submit"
              disabled={isClaiming}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-foid-aqua via-foid-periw to-foid-candy px-5 py-2.5 text-sm font-semibold text-foid-midnight shadow-[0_15px_35px_rgba(114,225,255,0.22)] transition hover:scale-[1.01] hover:shadow-[0_18px_45px_rgba(114,225,255,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClaiming ? "Checking..." : "Check & Claim"}
            </button>
          </form>
          {claimResult.show && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                claimResult.type === "success"
                  ? "border-emerald-400/45 bg-emerald-400/15 text-emerald-100"
                  : "border-rose-400/45 bg-rose-400/15 text-rose-100"
              }`}
              dangerouslySetInnerHTML={{ __html: claimResult.message }}
            />
          )}
        </div>

        <div className="mt-10 border-t border-white/20 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">📋 All Deposits</h2>
            <button
              onClick={fetchDeposits}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-foid-cyan/60 hover:bg-foid-cyan/10 hover:text-white"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
            {deposits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center text-white/60">
                No deposits yet
              </div>
            ) : (
              deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] p-4 shadow-[0_0_25px_rgba(114,225,255,0.15)] transition hover:border-white/25"
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${deposit.claimed ? "bg-emerald-300/80" : "bg-amber-300/80"}`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
                    <span>
                      <strong className="text-white/80">ID:</strong> {deposit.id}
                    </span>
                    <span>
                      <strong className="text-white/80">Status:</strong>{" "}
                      {deposit.claimed ? (
                        <span className="text-emerald-200">✓ Claimed</span>
                      ) : (
                        <span className="text-amber-200">⏳ Pending</span>
                      )}
                    </span>
                    <span>{new Date(deposit.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-white/85">
                    <div>
                      <strong className="text-white/80">Amount:</strong> {deposit.amount} ETH
                    </div>
                    <div>
                      <strong className="text-white/80">Recipient:</strong>{" "}
                      <span className="font-mono text-white/90">{deposit.recipient_address}</span>
                    </div>
                    {deposit.claimed && (
                      <div className="space-y-1 text-xs text-white/70">
                        <div>
                          <strong className="text-white/80">Claimed At:</strong>{" "}
                          {new Date(deposit.claimed_at!).toLocaleString()}
                        </div>
                        <div>
                          <strong className="text-white/80">TX Hash:</strong>{" "}
                          <code className="font-mono text-emerald-200/90">{deposit.claim_tx_hash}</code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
