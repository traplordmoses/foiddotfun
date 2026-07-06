"use client";

// FILES.EXE — the FOID OS file explorer (/files).
//
// Renders whatever src/config/mediaLibrary.ts registers: MiFOID music
// videos, audio transmissions, image artifacts. Clicking a tile opens
// MEDIA_PLAYER.EXE — a slab-material overlay window built on the shared
// <Modal variant="slab"> primitive (backdrop, Escape, focus trap and
// focus-restore come from the primitive; the player only adds its own
// titlebar + stage).
//
// Titlebar wiring mirrors /vote (useAccount + useSwitchWallet) with the
// /mifoid mounted-guard so the server-rendered "disconnected" frame never
// mismatches a connected client.

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useSwitchWallet } from "@/hooks/useSwitchWallet";
import AppTitlebar from "@/app/(components)/AppTitlebar";
import { Modal } from "@/components/ui";
import { MEDIA_LIBRARY, type MediaItem } from "@/config/mediaLibrary";
import { ipfsToHttp } from "@/lib/ipfsUrl";

type MediaKind = MediaItem["kind"];
type KindFilter = "all" | MediaKind;

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "image", label: "Images" },
];

const KIND_GLYPH: Record<MediaKind, string> = {
  video: "\u{1F3AC}", // 🎬
  audio: "\u{1F3B5}", // 🎵
  image: "\u{1F5BC}\u{FE0F}", // 🖼️
};

/** Resolve a manifest src to something the browser can load:
 *  - "/media/foo.mp4"  → served verbatim from public/
 *  - "ipfs://<cid>" / bare CID → first ipfsToHttp candidate (the /api/ipfs
 *    proxy when configured, public gateway otherwise)
 *  - full http(s) URL → passed through */
function resolveMediaSrc(src: string): string {
  if (src.startsWith("/")) return src;
  return ipfsToHttp(src)[0] ?? src;
}

/* ── MEDIA_PLAYER.EXE ─────────────────────────────────────────────────── */

function MediaPlayer({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const src = resolveMediaSrc(item.src);
  const poster = item.poster ? resolveMediaSrc(item.poster) : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      label={`MEDIA_PLAYER.EXE — ${item.title}`}
      variant="slab"
      className="files-player"
      initialFocusRef={closeRef}
      maxWidth={item.kind === "audio" ? 560 : 940}
    >
      {/* Mini titlebar: live close orb (window-control material) + label */}
      <div className="files-player__bar">
        <button
          ref={closeRef}
          type="button"
          className="vista-window__control vista-window__control--close"
          aria-label="Close media player"
          onClick={onClose}
        />
        <span className="files-player__label">MEDIA_PLAYER.EXE — {item.title}</span>
      </div>

      <div className={`files-player__stage${item.kind === "audio" ? " files-player__stage--audio" : ""}`}>
        {item.kind === "video" && (
          <video controls autoPlay playsInline src={src} poster={poster} style={{ maxHeight: "70vh" }} />
        )}
        {item.kind === "audio" && <audio controls src={src} />}
        {item.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary local/IPFS sources, same as gallery/PlacementCard
          <img src={src} alt={item.title} style={{ maxHeight: "70vh" }} />
        )}
      </div>

      {item.description ? <p className="files-player__desc">{item.description}</p> : null}
    </Modal>
  );
}

/* ── Empty archive invitation ─────────────────────────────────────────── */

function EmptyArchive() {
  return (
    <div className="files-empty">
      <div className="files-empty__inner">
        <div className="files-empty__glyphs" aria-hidden="true">
          <span>{KIND_GLYPH.video}</span>
          <span>{KIND_GLYPH.audio}</span>
          <span>{KIND_GLYPH.image}</span>
        </div>
        <span className="foid-label">MEDIA ARCHIVE — 0 ITEMS</span>
        <h1 className="files-empty__title">the archive is empty</h1>
        <p className="files-empty__body">
          MiFOID music videos, audio transmissions and image artifacts will live here.
          Feeding the archive takes two moves:
        </p>
        <div className="files-empty__steps">
          <div className="files-empty__step">
            <span className="files-empty__step-num">01</span>
            <span className="files-empty__step-text">drop an mp4 into</span>
            <code className="files-empty__path">/public/media</code>
          </div>
          <div className="files-empty__step">
            <span className="files-empty__step-num">02</span>
            <span className="files-empty__step-text">register it in</span>
            <code className="files-empty__path">src/config/mediaLibrary.ts</code>
          </div>
        </div>
        <p className="files-empty__sub">
          or pin to Pinata and set src to ipfs://&lt;cid&gt; — the /api/ipfs proxy serves it
        </p>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function FilesPage() {
  const { address, isConnected } = useAccount();
  const { disconnect, switchWallet } = useSwitchWallet();

  /* Hydration fix — server renders disconnected, client may differ */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [filter, setFilter] = useState<KindFilter>("all");
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);

  const items = useMemo(
    () => (filter === "all" ? MEDIA_LIBRARY : MEDIA_LIBRARY.filter((item) => item.kind === filter)),
    [filter],
  );

  return (
    <main
      className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100vh" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />

      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <AppTitlebar
              title="FILES.EXE"
              connected={mounted && isConnected}
              address={mounted ? address : undefined}
              onDisconnect={() => disconnect()}
              onSwitchWallet={switchWallet}
            />

            <div
              className="vista-window__body"
              style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
            >
              {/* Explorer toolbar: path + count on the left, kind filters right */}
              <div className="files-toolbar">
                <span className="foid-label">C:\FOID\MEDIA</span>
                <span className="foid-label" aria-live="polite">
                  {items.length} ITEM{items.length === 1 ? "" : "S"}
                </span>
                <div className="files-toolbar__filters" role="group" aria-label="Filter by kind">
                  {FILTERS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`files-filter${filter === key ? " files-filter--active" : ""}`}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {MEDIA_LIBRARY.length === 0 ? (
                <EmptyArchive />
              ) : (
                <div className="files-body">
                  {items.length === 0 ? (
                    <p className="foid-label" style={{ padding: "24px 8px", textAlign: "center" }}>
                      NO {filter.toUpperCase()} FILES IN THE ARCHIVE YET
                    </p>
                  ) : (
                    <div className="files-grid">
                      {items.map((item) => {
                        const poster = item.poster ? resolveMediaSrc(item.poster) : undefined;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="files-tile"
                            onClick={() => setActiveItem(item)}
                            aria-label={`Open ${item.title} in media player`}
                          >
                            <span className="files-tile__thumb">
                              {poster ? (
                                // eslint-disable-next-line @next/next/no-img-element -- arbitrary local/IPFS sources, same as gallery/PlacementCard
                                <img src={poster} alt="" loading="lazy" />
                              ) : (
                                <span className="files-tile__glyph" aria-hidden="true">
                                  {KIND_GLYPH[item.kind]}
                                </span>
                              )}
                              <span className="files-tile__kind">{item.kind}</span>
                            </span>
                            <span className="files-tile__meta">
                              <span className="files-tile__name foid-data" title={item.title}>
                                {item.title}
                              </span>
                              <span className="files-tile__date">{item.addedAt}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {activeItem ? <MediaPlayer item={activeItem} onClose={() => setActiveItem(null)} /> : null}
    </main>
  );
}
