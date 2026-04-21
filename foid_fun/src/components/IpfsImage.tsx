// /src/components/IpfsImage.tsx
// Shared <img> wrapper for IPFS CIDs with:
//   - persistent gateway preference (localStorage via reorderGateways) so
//     returning visitors skip the discovery phase entirely
//   - one-shot parallel probe (probeGatewaysForCid) on first mount when no
//     preference exists — races every candidate gateway in parallel and
//     memoizes the winner, instead of waiting 6-18s for sequential fallbacks
//   - 3s per-image stall timeout as a mid-session safety net (gateway that
//     worked earlier suddenly becomes unreachable)
//   - failure/success memoization (circuit breaker) shared across the app
//
// Drop-in replacement for raw <img src={cidToHttpUrl(cid)} onError={tryNextGateway} />.
"use client";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { ipfsToHttp } from "@/lib/ipfsUrl";
import {
  reorderGateways,
  markGatewayFailure,
  markGatewaySuccess,
} from "@/lib/ipfsGatewayCache";
import { probeGatewaysForCid } from "@/lib/ipfsGatewayProbe";

type Props = {
  cid: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  // Note: inside transformed ancestors (e.g. the pan/zoom board-stage),
  // loading="lazy" via IntersectionObserver is unreliable in Chrome/Safari.
  // Default to "eager" — virtualization already caps the visible count.
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "sync" | "auto";
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onLoad?: () => void;
  onError?: () => void;
  stallTimeoutMs?: number;
};

function IpfsImageInner({
  cid,
  alt,
  className,
  style,
  draggable = false,
  loading = "eager",
  fetchPriority = "auto",
  decoding = "async",
  referrerPolicy = "no-referrer",
  onLoad,
  onError,
  stallTimeoutMs = 3000,
}: Props) {
  // `reorderGateways` reads the persisted preferred gateway from
  // localStorage and moves it to the front — a returning visitor hits their
  // fast gateway on the very first image.
  const [urls, setUrls] = useState<string[]>(() => reorderGateways(ipfsToHttp(cid)));
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // First visit (no cached preference): race every candidate gateway in
  // parallel via <Image> preload. When the probe resolves, rebuild the URL
  // list so the winner is first. The probe is a module-level singleton, so
  // only one network race runs regardless of how many IpfsImage mounts.
  useEffect(() => {
    let cancelled = false;
    probeGatewaysForCid(cid).then((winner) => {
      if (cancelled || !winner) return;
      const next = reorderGateways(ipfsToHttp(cid));
      // Reset to index 0 — the winner is now at the front.
      setUrls(next);
      setGatewayIdx(0);
    });
    return () => { cancelled = true; };
  }, [cid]);

  const src = urls[gatewayIdx] ?? "";

  const handleError = () => {
    setLoaded(false);
    const failed = urls[gatewayIdx];
    if (failed) markGatewayFailure(failed);
    const next = gatewayIdx + 1;
    if (next < urls.length) setGatewayIdx(next);
    onError?.();
  };

  const handleLoad = () => {
    setLoaded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const winner = urls[gatewayIdx];
    if (winner) markGatewaySuccess(winner);
    onLoad?.();
  };

  useEffect(() => {
    setLoaded(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!loaded) {
        const stalled = urls[gatewayIdx];
        if (stalled) markGatewayFailure(stalled);
        const next = gatewayIdx + 1;
        if (next < urls.length) setGatewayIdx(next);
      }
    }, stallTimeoutMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewayIdx, urls.length, stallTimeoutMs]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt ?? ""}
      className={className}
      style={style}
      draggable={draggable}
      loading={loading}
      // @ts-expect-error — fetchpriority is a standard HTML attribute,
      // but React's typings haven't caught up in all versions.
      fetchpriority={fetchPriority}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}

export const IpfsImage = memo(IpfsImageInner);
