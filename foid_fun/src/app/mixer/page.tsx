"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider, parseEther, isAddress } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast from "react-hot-toast";

// API base URL - change this to match your Express server port
const MIXER_API_URL = process.env.NEXT_PUBLIC_MIXER_API_URL || "http://localhost:3001";

interface Deposit {
  id: number;
  amount: number;
  recipient_address: string;
  claimed: boolean;
  claim_tx_hash?: string;
  created_at: string;
  claimed_at?: string;
}

export default function MixerPage() {
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
      const serverAddrResponse = await fetch(`${MIXER_API_URL}/api/server-address`);
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

      if (receipt.status === 1) {
        // Transaction successful - save to DB with plaintext recipient address
        const depositResponse = await fetch(`${MIXER_API_URL}/api/deposit`, {
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
      const response = await fetch(`${MIXER_API_URL}/api/claim`, {
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
        toast.info("No claims available");
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
      const response = await fetch(`${MIXER_API_URL}/api/deposits`);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-10 max-w-2xl w-full shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 m-0">💰 Fluent Mixer</h1>
            <p className="text-sm text-gray-700 mt-1">Deposit ETH with recipient addresses</p>
          </div>
          <ConnectButton chainStatus="name" showBalance={false} />
        </div>

        {isConnected && connectedAddress && (
          <div className="mb-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-800">
            <strong>Connected:</strong> <span className="font-mono">{connectedAddress}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendETH();
          }}
        >
          <div className="mb-5">
            <label className="block mb-2 text-gray-900 font-medium text-sm">Amount (ETH):</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.001"
              min="0.001"
              placeholder="0.1"
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-gray-900 font-medium text-sm">Recipient Address (EOA):</label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              pattern="^0x[a-fA-F0-9]{40}$"
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="mb-5 bg-gray-100 p-3 rounded-lg">
            <label className="block mb-2 font-semibold text-gray-900">Send ETH to Server:</label>
            <button
              type="submit"
              disabled={isLoading || !isConnected}
              className="w-full py-2.5 px-5 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg font-semibold transition-transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : "Send ETH"}
            </button>
            {showTxHash && (
              <div className="mt-2.5 text-xs text-gray-700">
                <strong>Transaction Hash:</strong> <span className="font-mono">{txHash}</span>
              </div>
            )}
          </div>
        </form>

        {result.show && (
          <div
            className={`mt-5 p-4 rounded-lg text-sm ${
              result.type === "success"
                ? "bg-green-100 text-green-900 border border-green-300"
                : "bg-red-100 text-red-900 border border-red-300"
            }`}
            dangerouslySetInnerHTML={{ __html: result.message }}
          />
        )}

        {status.message && (
          <div
            className={`mt-2.5 p-2.5 rounded-lg text-xs ${
              status.type === "success"
                ? "bg-green-100 text-green-900"
                : status.type === "error"
                ? "bg-red-100 text-red-900"
                : "bg-gray-100 text-gray-900"
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="mt-8 pt-8 border-t-2 border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl text-gray-900">🎁 Claim Deposits</h2>
          </div>
          <form onSubmit={handleClaim}>
            <div className="mb-4">
              <label className="block mb-2 text-gray-900 font-medium text-sm">Your Address:</label>
              <input
                type="text"
                value={claimAddress}
                onChange={(e) => setClaimAddress(e.target.value)}
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                required
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:outline-none focus:border-purple-600"
              />
            </div>
            <button
              type="submit"
              disabled={isClaiming}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg font-semibold transition-transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ width: "auto" }}
            >
              {isClaiming ? "Checking..." : "Check & Claim"}
            </button>
          </form>
          {claimResult.show && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                claimResult.type === "success"
                  ? "bg-green-100 text-green-900 border border-green-300"
                  : "bg-red-100 text-red-900 border border-red-300"
              }`}
              dangerouslySetInnerHTML={{ __html: claimResult.message }}
            />
          )}
        </div>

        <div className="mt-8 pt-8 border-t-2 border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl text-gray-900">📋 All Deposits</h2>
            <button
              onClick={fetchDeposits}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg text-sm font-semibold transition-transform hover:scale-105"
            >
              Refresh
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {deposits.length === 0 ? (
              <div className="text-center text-gray-700 py-5">No deposits yet</div>
            ) : (
              deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2.5"
                  style={{
                    borderLeft: `4px solid ${deposit.claimed ? "#28a745" : "#ffc107"}`,
                  }}
                >
                  <div className="flex justify-between mb-2.5 text-xs text-gray-700">
                    <span>
                      <strong>ID:</strong> {deposit.id}
                    </span>
                    <span>
                      <strong>Status:</strong>{" "}
                      {deposit.claimed ? (
                        <span style={{ color: "#28a745" }}>✓ Claimed</span>
                      ) : (
                        <span style={{ color: "#ffc107" }}>⏳ Pending</span>
                      )}
                    </span>
                    <span>{new Date(deposit.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-gray-900">
                    <strong>Amount:</strong> {deposit.amount} ETH
                    <br />
                    <strong>Recipient:</strong> <span className="font-mono">{deposit.recipient_address}</span>
                    <br />
                    {deposit.claimed && (
                      <>
                        <strong>Claimed At:</strong> {new Date(deposit.claimed_at!).toLocaleString()}
                        <br />
                        <strong>TX Hash:</strong>{" "}
                        <code className="text-xs font-mono">{deposit.claim_tx_hash}</code>
                      </>
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
