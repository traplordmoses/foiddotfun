// /src/components/IpfsImage.tsx
// Shared <img> wrapper for IPFS CIDs with:
//   - persistent gateway preference (localStorage via reorderGateways) so
//     returning visitors skip the discovery phase entirely
//   - sequential per-image fallback with a 6s stall timeout (gateway that
//     worked earlier suddenly becomes unreachable → advance to next)
//   - failure/success memoization (circuit breaker) shared across the app
//
// Earlier revision had an in-component parallel gateway probe via new
// Image() preloads — that regressed mobile: preloading the full placement
// image across 5 gateways saturates the connection (~1.5MB wasted for a
// 300KB image on a cold session). Reverted. A future probe implementation
// should use Range: bytes=0-0 HEAD/GET to race gateways without downloading
// the full payload.
//
// Drop-in replacement for raw <img src={cidToHttpUrl(cid)} onError={tryNextGateway} />.
"use client";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { ipfsImageUrls } from "@/lib/ipfsUrl";
import {
  reorderGateways,
  markGatewayFailure,
  markGatewaySuccess,
} from "@/lib/ipfsGatewayCache";

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
  stallTimeoutMs = 6000,
}: Props) {
  // Candidate URL list:
  //   [0] same-origin /api/ipfs/<cid> proxy (authenticated Pinata upstream,
  //       edge-cached, HTTP/2-multiplexed with the page) — the fast path.
  //   [1..] public-gateway fallbacks, reordered by the session circuit
  //       breaker so a known-good gateway is tried before known-bad ones.
  // Only the gateway portion is reordered; the proxy always stays at [0]
  // because its latency characteristics are independent of the public
  // gateway pool (it's our own server).
  const urls = useMemo(() => {
    const all = ipfsImageUrls(cid);
    if (all.length <= 1) return all;
    const [proxy, ...rest] = all;
    return [proxy, ...reorderGateways(rest)];
  }, [cid]);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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
