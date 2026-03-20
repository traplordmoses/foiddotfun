"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

type PairingState = {
  handle: string | null;
  loading: boolean;
  error: string | null;
};

export function useXPairing() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [state, setState] = useState<PairingState>({
    handle: null,
    loading: false,
    error: null,
  });

  // Fetch current pairing on mount / address change
  useEffect(() => {
    if (!address) {
      setState({ handle: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pair-x?wallet=${address}`);
        const data = await res.json();
        if (!cancelled) {
          setState({
            handle: data.paired ? data.handle : null,
            loading: false,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [address]);

  const pair = useCallback(async (handle: string) => {
    if (!address) throw new Error("Wallet not connected");

    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle) throw new Error("Handle required");

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const timestamp = Date.now();
      const message = `I am @${cleanHandle} on X. Linking to FOID Foundation. Timestamp: ${timestamp}`;

      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/pair-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, handle: cleanHandle, signature, timestamp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pairing failed");

      setState({ handle: data.handle, loading: false, error: null });
      return data.handle as string;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Pairing failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, [address, signMessageAsync]);

  const unpair = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const timestamp = Date.now();
      const message = `Unpair X account from FOID. Timestamp: ${timestamp}`;

      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/pair-x", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, signature, timestamp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unpair failed");

      setState({ handle: null, loading: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unpair failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, [address, signMessageAsync]);

  return {
    handle: state.handle,
    isPaired: !!state.handle,
    loading: state.loading,
    error: state.error,
    pair,
    unpair,
    isConnected,
  };
}
