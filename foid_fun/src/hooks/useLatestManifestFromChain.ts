import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";

import { LOREBOARD_MANIFEST_STORE_ADDRESS } from "@/config/contracts";
import { loreBoardManifestStoreAbi } from "@/abi/loreBoardManifestStore";
import type { BoardManifest } from "@/types/manifest";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import { debug } from "@/lib/debug";

type State = {
  manifest: BoardManifest | null;
  epoch: number | null;
  loading: boolean;
  error: Error | null;
};

export function useLatestManifestFromChain(): State {
  const publicClient = usePublicClient();
  const [state, setState] = useState<State>({
    manifest: null,
    epoch: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    const load = async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: null }));

        const manifestStore = LOREBOARD_MANIFEST_STORE_ADDRESS;
        if (!manifestStore) {
          throw new Error("NEXT_PUBLIC_LOREBOARD_MANIFEST_STORE_ADDRESS is missing");
        }

        const latest = await publicClient.readContract({
          address: manifestStore as Address,
          abi: loreBoardManifestStoreAbi,
          functionName: "latest",
        });
        const [epoch, , cid] = latest as readonly [bigint | number, `0x${string}`, string];

        const epochNum = Number(epoch);
        const normalizedCid = cid.replace(/^ipfs:\/\//, "");

        if (!normalizedCid || normalizedCid.length === 0 || epochNum === 0) {
          if (!cancelled) {
            setState({
              manifest: null,
              epoch: null,
              loading: false,
              error: null,
            });
          }
          return;
        }

        let manifest: BoardManifest | null = null;
        let lastError: Error | null = null;

        for (const url of ipfsToHttp(normalizedCid)) {
          try {
            const res = await fetch(url);
            if (!res.ok) {
              lastError = new Error(`failed to fetch manifest: ${res.status}`);
              continue;
            }
            const json = (await res.json()) as BoardManifest;
            manifest = {
              epoch: json?.epoch ?? epochNum,
              placements: Array.isArray(json?.placements) ? json.placements : [],
              width: json?.width,
              height: json?.height,
              cells: json?.cells,
              renderCid: json?.renderCid,
              finalizedAt: json?.finalizedAt,
            };
            break;
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (!manifest) {
          throw lastError ?? new Error("failed to fetch manifest from IPFS");
        }

        if (!cancelled) {
          setState({
            manifest,
            epoch: manifest.epoch ?? epochNum,
            loading: false,
            error: null,
          });
        }
      } catch (e: unknown) {
        debug.error("load latest manifest failed", e);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e : new Error(String(e)),
          }));
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  return state;
}
