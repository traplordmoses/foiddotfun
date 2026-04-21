// /src/components/IpfsImage.tsx
// Shared <img> wrapper for IPFS CIDs with:
//   - session-cached gateway preference (reorderGateways) so we try the
//     last-known-good gateway first instead of always starting at ipfs.io
//   - 6s stall timeout: if a gateway hasn't responded we advance to the
//     next one rather than waiting for the browser's ~30s default
//   - failure/success memoization (circuit breaker) shared across the session
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
  const urls = useMemo(() => reorderGateways(ipfsToHttp(cid)), [cid]);
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
