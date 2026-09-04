"use client";

// MIFOID.EXE reservation strip (audit U6). The page advertised tiered mint
// prices for a contract that is not deployed, with no way to act. This
// captures intent: one signature reserves a spot; the count is social proof.
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { reserveMessage } from "@/lib/mifoidReserve";

type Status = "idle" | "signing" | "saved" | "error" | "closed";

export default function MifoidReserve() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signMessageAsync } = useSignMessage();
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mifoid/reserve")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { open?: boolean; count?: number } | null) => {
        if (cancelled || !d) return;
        setOpen(Boolean(d.open));
        setCount(typeof d.count === "number" ? d.count : 0);
      })
      .catch(() => {
        if (!cancelled) setOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!address) return;
    try {
      if (localStorage.getItem(`foid_mifoid_reserved_${address.toLowerCase()}`) === "1") setStatus("saved");
    } catch {
      /* ignore */
    }
  }, [address]);

  const reserve = useCallback(async () => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    setStatus("signing");
    try {
      const timestamp = Date.now();
      const signature = await signMessageAsync({ message: reserveMessage(address, timestamp) });
      const res = await fetch("/api/mifoid/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, signature, timestamp }),
      });
      if (!res.ok) {
        setStatus(res.status === 503 ? "closed" : "error");
        return;
      }
      setStatus("saved");
      setCount((c) => (c ?? 0) + 1);
      try {
        localStorage.setItem(`foid_mifoid_reserved_${address.toLowerCase()}`, "1");
      } catch {
        /* ignore */
      }
    } catch {
      setStatus("error");
    }
  }, [address, isConnected, openConnectModal, signMessageAsync]);

  if (open === false) {
    return (
      <div className="mifoid-reserve">
        <span className="mifoid-reserve__label">mint status</span>
        <span className="mifoid-reserve__copy">not live yet. the contract ships after the streak contract upgrade; follow @foidfun for the date.</span>
      </div>
    );
  }

  return (
    <div className="mifoid-reserve" aria-live="polite">
      <span className="mifoid-reserve__label">mint status</span>
      <span className="mifoid-reserve__copy">
        {status === "saved"
          ? "spot reserved. your streak tier at mint time sets your bonus."
          : "not live yet. reserve a spot with one signature, no payment."}
      </span>
      <div className="mifoid-reserve__row">
        <button
          type="button"
          className="foid-cta-btn min-h-11 px-5"
          onClick={reserve}
          disabled={status === "signing" || status === "saved"}
        >
          {status === "signing"
            ? "check your wallet"
            : status === "saved"
              ? "reserved"
              : isConnected
                ? "reserve my spot"
                : "connect to reserve"}
        </button>
        {count !== null ? (
          <span className="mifoid-reserve__count">{count.toLocaleString()} reserved</span>
        ) : null}
        {status === "error" ? <span className="mifoid-reserve__err">could not save, try again</span> : null}
        {status === "closed" ? <span className="mifoid-reserve__err">reservations open soon</span> : null}
      </div>
    </div>
  );
}
