"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useBalance } from "wagmi";
import { isAddress, parseEther, formatEther } from "viem";
import type { Address } from "viem";
import { getWalletClient, publicClient, fluentChain } from "@/lib/viem";
import { BLOCK_EXPLORER_URL } from "@/lib/contracts";
import { parseWeb3Error, isUserRejection } from "@/lib/errors";
import { useMobile } from "@/hooks/useMobile";

interface SendEthModalProps {
  address: string;
  onClose: () => void;
}

type TxState = "idle" | "confirming" | "sending" | "success" | "error";

export default function SendEthModal({ address, onClose }: SendEthModalProps) {
  const { isMobile } = useMobile();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const recipientInputRef = useRef<HTMLInputElement>(null);

  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: address as Address,
    query: { enabled: true },
  });

  const isValidRecipient = recipient.length > 0 && isAddress(recipient);
  const recipientTouched = recipient.length > 0;

  // Parse amount safely
  let parsedAmount: bigint | null = null;
  try {
    if (amount && Number(amount) > 0) {
      parsedAmount = parseEther(amount);
    }
  } catch {
    // invalid decimal input
  }

  const isBusy = txState === "confirming" || txState === "sending";

  // Focus recipient input on mount
  useEffect(() => {
    const timer = setTimeout(() => recipientInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isBusy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  // Debounced gas estimation
  useEffect(() => {
    if (!isValidRecipient || !parsedAmount || parsedAmount <= 0n) {
      setGasEstimate(null);
      setGasPrice(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const [gas, price] = await Promise.all([
          publicClient.estimateGas({
            account: address as `0x${string}`,
            to: recipient as `0x${string}`,
            value: parsedAmount!,
          }),
          publicClient.getGasPrice(),
        ]);
        if (!controller.signal.aborted) {
          setGasEstimate(gas);
          setGasPrice(price);
        }
      } catch {
        if (!controller.signal.aborted) {
          setGasEstimate(21000n); // fallback for simple transfer
          try {
            const price = await publicClient.getGasPrice();
            if (!controller.signal.aborted) setGasPrice(price);
          } catch {
            // ignore
          }
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, recipient, amount]);

  const handleMax = useCallback(async () => {
    if (!balanceData) return;
    try {
      const price = gasPrice ?? (await publicClient.getGasPrice());
      const gas = gasEstimate ?? 21000n;
      // 1.1x safety margin on gas cost
      const gasCost = (gas * price * 11n) / 10n;
      const maxValue = balanceData.value - gasCost;
      if (maxValue > 0n) {
        setAmount(formatEther(maxValue));
      } else {
        setAmount("0");
      }
    } catch {
      // If gas fetch fails, use conservative estimate
      const conservativeGasCost = 21000n * 50000000000n; // 21k gas * 50 gwei
      const maxValue = balanceData.value - conservativeGasCost;
      setAmount(maxValue > 0n ? formatEther(maxValue) : "0");
    }
  }, [balanceData, gasEstimate, gasPrice]);

  const handleSend = useCallback(async () => {
    if (!isValidRecipient || !parsedAmount || parsedAmount <= 0n) return;

    setError(null);
    setTxState("confirming");

    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.sendTransaction({
        account: (walletClient.account ?? address) as `0x${string}`,
        to: recipient as `0x${string}`,
        value: parsedAmount,
        chain: fluentChain,
      });

      setTxState("sending");
      setTxHash(hash);

      await publicClient.waitForTransactionReceipt({ hash });

      setTxState("success");
      refetchBalance();
    } catch (err) {
      if (isUserRejection(err)) {
        setTxState("idle");
        return;
      }
      const parsed = parseWeb3Error(err);
      setError(parsed.message);
      setTxState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipient, amount, refetchBalance]);

  const gasCostDisplay =
    gasEstimate && gasPrice
      ? formatEther(gasEstimate * gasPrice)
      : null;

  const canSend =
    isValidRecipient &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    !isBusy &&
    txState === "idle";

  // ── Render ──

  const modalWidth = isMobile ? "90vw" : 420;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(100,255,220,0.2)",
    background: "rgba(0,0,0,0.3)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 6,
    display: "block",
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(3,11,18,0.72)",
        backdropFilter: "blur(8px) saturate(120%)",
        WebkitBackdropFilter: "blur(8px) saturate(120%)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      {/* Outer glow border */}
      <div
        style={{
          width: modalWidth,
          maxWidth: "90vw",
          borderRadius: 22,
          padding: 2,
          background:
            "linear-gradient(135deg, rgba(100,255,220,0.5), rgba(80,220,180,0.25), rgba(100,255,220,0.5))",
          boxShadow:
            "0 0 40px rgba(80,220,180,0.2), 0 16px 48px rgba(0,0,0,0.4)",
        }}
      >
        {/* Inner glass panel */}
        <div
          style={{
            borderRadius: 20,
            padding: isMobile ? 18 : 24,
            background:
              "linear-gradient(180deg, rgba(40,80,90,0.95), rgba(20,45,55,0.98))",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(255,255,255,0.95)",
                letterSpacing: "0.05em",
              }}
            >
              Send ETH
            </h2>
            {!isBusy && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontSize: 20,
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>

          {/* Balance display */}
          {balanceData && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.2)",
                marginBottom: 16,
                fontSize: 12,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Balance</span>
              <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>
                {Number(balanceData.formatted).toFixed(6)} ETH
              </span>
            </div>
          )}

          {/* Idle / Form state */}
          {(txState === "idle" || txState === "error") && (
            <>
              {/* Recipient */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Recipient Address</label>
                <input
                  ref={recipientInputRef}
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  style={{
                    ...inputStyle,
                    fontFamily: "monospace",
                    fontSize: 13,
                    borderColor:
                      recipientTouched && !isValidRecipient
                        ? "rgba(255,100,100,0.5)"
                        : "rgba(100,255,220,0.2)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(100,255,220,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      recipientTouched && !isValidRecipient
                        ? "rgba(255,100,100,0.5)"
                        : "rgba(100,255,220,0.2)")
                  }
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                {recipientTouched && !isValidRecipient && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,100,100,0.8)",
                      marginTop: 4,
                      paddingLeft: 2,
                    }}
                  >
                    Enter a valid Ethereum address
                  </div>
                )}
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Amount (ETH)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow digits, one decimal, and empty string
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setAmount(val);
                      }
                    }}
                    style={{
                      ...inputStyle,
                      paddingRight: 60,
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(100,255,220,0.5)")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(100,255,220,0.2)")
                    }
                  />
                  <button
                    type="button"
                    onClick={handleMax}
                    disabled={!balanceData}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      padding: "4px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(100,255,220,0.3)",
                      background: "rgba(100,255,220,0.1)",
                      color: "rgba(100,255,220,0.9)",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(100,255,220,0.2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(100,255,220,0.1)")
                    }
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Gas estimate */}
              {gasCostDisplay && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: 16,
                    paddingLeft: 2,
                  }}
                >
                  Estimated gas: ~{Number(gasCostDisplay).toFixed(8)} ETH
                </div>
              )}

              {/* Error message */}
              {txState === "error" && error && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,100,100,0.3)",
                    background: "rgba(255,50,50,0.1)",
                    marginBottom: 14,
                    fontSize: 12,
                    color: "rgba(255,150,150,0.9)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: 14,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "0.05em",
                  cursor: canSend ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  background: canSend
                    ? "linear-gradient(135deg, rgba(80,220,180,0.8), rgba(60,200,160,0.9))"
                    : "rgba(80,220,180,0.15)",
                  color: canSend
                    ? "rgba(0,30,20,0.95)"
                    : "rgba(255,255,255,0.3)",
                  boxShadow: canSend
                    ? "0 4px 16px rgba(80,220,180,0.3)"
                    : "none",
                }}
              >
                {txState === "error" ? "Try Again" : "Send"}
              </button>
            </>
          )}

          {/* Confirming / Sending state */}
          {isBusy && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "30px 0",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid rgba(100,255,220,0.2)",
                  borderTop: "3px solid rgba(100,255,220,0.9)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.8)",
                  fontWeight: 600,
                }}
              >
                {txState === "confirming"
                  ? "Confirm in wallet..."
                  : "Sending transaction..."}
              </div>
              {txHash && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  Waiting for confirmation
                </div>
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Success state */}
          {txState === "success" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 0",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(80,220,180,0.15)",
                  border: "2px solid rgba(80,220,180,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  color: "rgba(80,220,180,0.95)",
                }}
              >
                &#10003;
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "rgba(80,220,180,0.95)",
                }}
              >
                Transaction Sent
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  textAlign: "center",
                }}
              >
                {amount} ETH sent to {recipient.slice(0, 6)}...{recipient.slice(-4)}
              </div>
              {txHash && (
                <a
                  href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    color: "rgba(100,255,220,0.9)",
                    textDecoration: "underline",
                    marginTop: 4,
                  }}
                >
                  View on Explorer &rarr;
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  marginTop: 8,
                  padding: "10px 32px",
                  borderRadius: 12,
                  border: "1px solid rgba(100,255,220,0.3)",
                  background: "rgba(100,255,220,0.1)",
                  color: "rgba(100,255,220,0.9)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(100,255,220,0.2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(100,255,220,0.1)")
                }
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
