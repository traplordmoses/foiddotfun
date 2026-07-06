// src/apps/FilesApp.tsx
// FILES.EXE — the FOID OS file browser, extracted from the /files route so
// the same component renders in BOTH presentations (multi-window plan §4):
//   - the /files route page (thin wrapper: main + vista-window + titlebar)
//   - a desktop shell window (<OSWindow appId="files">) — the default
//     files surface on lg+ viewports since Stage C (routes hand off)
//
// Finder anatomy in aero material: a glass sidebar (Favorites drive the
// kind filter, Locations link out to the repo + foid.fun), a slim toolbar
// (back/forward history, icon/list view toggle, search), and a canvas with
// Mac selection behavior — click selects, double-click opens, arrow keys
// move, Enter/Space opens, Escape clears. All keyboard handling is
// element-scoped (the listbox), so two open windows never fight over keys.
//
// The archive is curator-only: everything rendered here comes from
// src/config/mediaLibrary.ts (founder's videos + MiFOID image artifacts).
// There is no upload path by design.
//
// Opening an item launches MEDIA_PLAYER.EXE — a slab-material overlay on
// the shared <Modal variant="slab"> primitive. The primitive portals to
// <body> (shell-scoped takeover), so it renders identically from the route
// and from a desktop window.
//
// files.css is imported HERE — the shared location both the route and the
// shell load (it used to live in files/layout.tsx, which the shell never
// mounts). Class prefixes are namespaced .files-*.
"use client";

import "@/app/files/files.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import { MEDIA_LIBRARY, type MediaItem } from "@/config/mediaLibrary";
import { ipfsToHttp } from "@/lib/ipfsUrl";

type MediaKind = MediaItem["kind"];
type KindFilter = "all" | MediaKind;
type ViewMode = "icons" | "list";

const GITHUB_URL = "https://github.com/traplordmoses/foiddotfun";

/** Sidebar Favorites — each drives the kind filter (Mac "Music" naming). */
const FAVORITES: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All Files" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Music" },
  { key: "image", label: "Images" },
];

const CRUMB_LABEL: Record<KindFilter, string> = {
  all: "All",
  video: "Videos",
  audio: "Music",
  image: "Images",
};

const KIND_LABEL: Record<MediaKind, string> = {
  video: "Video",
  audio: "Music",
  image: "Image",
};

/* ── Inline icon set ──────────────────────────────────────────────────────
   16-grid stroke glyphs, currentColor so rows/buttons tint them. Replaces
   the old emoji glyphs (DOS-vibes) with one drawn family. */

type IconProps = { size?: number; className?: string };

function iconAttrs({ size = 14, className }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

function IconStack(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M8 2.1 14 5.2 8 8.3 2 5.2z" />
      <path d="m2 8.2 6 3.1 6-3.1" />
      <path d="m2 11.1 6 3.1 6-3.1" />
    </svg>
  );
}
function IconVideo(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="2" />
      <path d="M6.7 5.9v4.2L10.3 8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconMusic(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M6.3 12.4V4l6-1.4v8.5" />
      <circle cx="4.4" cy="12.4" r="1.85" />
      <circle cx="10.4" cy="11.1" r="1.85" />
    </svg>
  );
}
function IconImage(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <circle cx="5.5" cy="6.3" r="1.1" />
      <path d="m2.6 11.6 3.6-3.4 2.6 2.4 2-1.8 2.6 2.5" />
    </svg>
  );
}
function IconBranch(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <circle cx="4.5" cy="3.9" r="1.6" />
      <circle cx="4.5" cy="12.1" r="1.6" />
      <circle cx="11.5" cy="6" r="1.6" />
      <path d="M4.5 5.5v5" />
      <path d="M11.5 7.6c0 2.3-3 2.6-5.2 3.2" />
    </svg>
  );
}
function IconGlobe(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M1.75 8h12.5" />
      <path d="M8 1.75c1.9 1.9 1.9 10.6 0 12.5" />
      <path d="M8 1.75c-1.9 1.9-1.9 10.6 0 12.5" />
    </svg>
  );
}
function IconExternal(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M6.5 3.5h-2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
      <path d="M9.5 2.5h4v4" />
      <path d="M13.2 2.8 7.6 8.4" />
    </svg>
  );
}
function IconChevronLeft(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M9.7 3.3 5.4 8l4.3 4.7" />
    </svg>
  );
}
function IconChevronRight(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M6.3 3.3 10.6 8l-4.3 4.7" />
    </svg>
  );
}
function IconGridView(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <rect x="2.25" y="2.25" width="4.75" height="4.75" rx="1" />
      <rect x="9" y="2.25" width="4.75" height="4.75" rx="1" />
      <rect x="2.25" y="9" width="4.75" height="4.75" rx="1" />
      <rect x="9" y="9" width="4.75" height="4.75" rx="1" />
    </svg>
  );
}
function IconListView(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M5.6 4.1h8" />
      <path d="M5.6 8h8" />
      <path d="M5.6 11.9h8" />
      <circle cx="2.9" cy="4.1" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.9" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.9" cy="11.9" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconSearch(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.4 10.4 3.3 3.3" />
    </svg>
  );
}

const KIND_ICON: Record<MediaKind, (p: IconProps) => JSX.Element> = {
  video: IconVideo,
  audio: IconMusic,
  image: IconImage,
};

const FAVORITE_ICON: Record<KindFilter, (p: IconProps) => JSX.Element> = {
  all: IconStack,
  video: IconVideo,
  audio: IconMusic,
  image: IconImage,
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

/** Thumbnail source: explicit poster wins; images preview themselves. */
function thumbSrc(item: MediaItem): string | undefined {
  if (item.poster) return resolveMediaSrc(item.poster);
  if (item.kind === "image") return resolveMediaSrc(item.src);
  return undefined;
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

/* ── Empty archive (curator-only — visitors browse, the foundation adds) ── */

function EmptyArchive() {
  return (
    <div className="files-empty">
      <div className="files-empty__inner">
        <div className="files-empty__glyphs" aria-hidden="true">
          <IconVideo size={26} />
          <IconMusic size={26} />
          <IconImage size={26} />
        </div>
        <span className="foid-label">MIFOID MEDIA ARCHIVE — 0 ITEMS</span>
        <h1 className="files-empty__title">the archive is empty</h1>
        <p className="files-empty__body">
          This is the official MiFOID media archive — music videos, transmissions and
          image artifacts curated by the foundation. New drops land here as they are
          released.
        </p>
      </div>
    </div>
  );
}

/* ── The app (window body) ────────────────────────────────────────────── */

export default function FilesApp() {
  /* Location history — sidebar clicks push, chevrons walk the stack. */
  const [hist, setHist] = useState<{ stack: KindFilter[]; index: number }>({
    stack: ["all"],
    index: 0,
  });
  const filter = hist.stack[hist.index];
  const canBack = hist.index > 0;
  const canForward = hist.index < hist.stack.length - 1;

  const navigateTo = (next: KindFilter) =>
    setHist((h) => {
      if (h.stack[h.index] === next) return h;
      const stack = [...h.stack.slice(0, h.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
  const goBack = () => setHist((h) => (h.index > 0 ? { ...h, index: h.index - 1 } : h));
  const goForward = () =>
    setHist((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1 } : h));

  const [view, setView] = useState<ViewMode>("icons");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const byKind =
      filter === "all" ? MEDIA_LIBRARY : MEDIA_LIBRARY.filter((item) => item.kind === filter);
    const q = query.trim().toLowerCase();
    return q ? byKind.filter((item) => item.title.toLowerCase().includes(q)) : byKind;
  }, [filter, query]);

  /* Selection can dangle when the location/search changes under it. */
  useEffect(() => {
    if (selectedId && !filtered.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  const selectItem = (id: string) => {
    setSelectedId(id);
    canvasRef.current?.focus({ preventScroll: true });
  };

  /* Icon view is a real CSS grid — read the rendered column count so
     ArrowUp/ArrowDown move by visual rows, like Finder. */
  const gridColumnCount = () => {
    const el = gridRef.current;
    if (!el) return 1;
    return Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  };

  const moveSelection = (nextIndex: number) => {
    const item = filtered[nextIndex];
    if (!item) return;
    setSelectedId(item.id);
    document.getElementById(`files-opt-${item.id}`)?.scrollIntoView({ block: "nearest" });
  };

  const onCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return;
    const idx = selectedId ? filtered.findIndex((item) => item.id === selectedId) : -1;

    if (e.key === "Enter" || e.key === " ") {
      if (idx >= 0) {
        e.preventDefault();
        setActiveItem(filtered[idx]);
      }
      return;
    }
    if (e.key === "Escape") {
      setSelectedId(null);
      return;
    }

    const cols = view === "icons" ? gridColumnCount() : 1;
    let next: number;
    switch (e.key) {
      case "ArrowRight": next = idx < 0 ? 0 : Math.min(filtered.length - 1, idx + 1); break;
      case "ArrowLeft":  next = idx < 0 ? 0 : Math.max(0, idx - 1); break;
      case "ArrowDown":  next = idx < 0 ? 0 : Math.min(filtered.length - 1, idx + cols); break;
      case "ArrowUp":    next = idx < 0 ? 0 : Math.max(0, idx - cols); break;
      case "Home":       next = 0; break;
      case "End":        next = filtered.length - 1; break;
      default: return;
    }
    e.preventDefault();
    moveSelection(next);
  };

  /* Finder: clicking bare canvas (grid gaps included) drops the selection. */
  const onCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[role="option"]')) setSelectedId(null);
  };

  const crumb = CRUMB_LABEL[filter];
  const hasLibrary = MEDIA_LIBRARY.length > 0;

  const renderOption = (item: MediaItem) => {
    const selected = item.id === selectedId;
    const thumb = thumbSrc(item);
    const Glyph = KIND_ICON[item.kind];

    if (view === "icons") {
      return (
        <div
          key={item.id}
          id={`files-opt-${item.id}`}
          role="option"
          aria-selected={selected}
          className={`files-item${selected ? " files-item--selected" : ""}`}
          onClick={() => selectItem(item.id)}
          onDoubleClick={() => setActiveItem(item)}
        >
          <span className="files-item__thumb">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary local/IPFS sources, same as gallery/PlacementCard
              <img src={thumb} alt="" loading="lazy" draggable={false} />
            ) : (
              <Glyph size={30} className="files-item__glyph" />
            )}
          </span>
          <span className="files-item__name">{item.title}</span>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        id={`files-opt-${item.id}`}
        role="option"
        aria-selected={selected}
        className={`files-row${selected ? " files-row--selected" : ""}`}
        onClick={() => selectItem(item.id)}
        onDoubleClick={() => setActiveItem(item)}
      >
        <span className="files-row__name">
          <Glyph size={14} className="files-row__kindicon" />
          <span className="files-row__title foid-data">{item.title}</span>
        </span>
        <span className="files-row__cell foid-data">{KIND_LABEL[item.kind]}</span>
        <span className="files-row__cell foid-data">{item.addedAt}</span>
      </div>
    );
  };

  return (
    <>
      <div className="vista-window__body vista-window__body--flush files-shell">
        {/* ── Sidebar ── */}
        <aside className="files-sidebar">
          <div className="files-sidebar__section" role="group" aria-labelledby="files-fav-heading">
            <span id="files-fav-heading" className="foid-label files-sidebar__heading">
              Favorites
            </span>
            {FAVORITES.map(({ key, label }) => {
              const RowIcon = FAVORITE_ICON[key];
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`files-side-row${active ? " files-side-row--active" : ""}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => navigateTo(key)}
                >
                  <RowIcon className="files-side-row__icon" />
                  <span className="files-side-row__label">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="files-sidebar__section" role="group" aria-labelledby="files-loc-heading">
            <span id="files-loc-heading" className="foid-label files-sidebar__heading">
              Locations
            </span>
            <a
              className="files-side-row"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBranch className="files-side-row__icon" />
              <span className="files-side-row__label">GitHub</span>
              <IconExternal size={11} className="files-side-row__external" />
            </a>
            <Link className="files-side-row" href="/">
              <IconGlobe className="files-side-row__icon" />
              <span className="files-side-row__label">foid.fun</span>
            </Link>
          </div>
        </aside>

        {/* ── Main pane ── */}
        <div className="files-main">
          <div className="files-toolbar">
            <div className="files-nav" role="group" aria-label="History">
              <button
                type="button"
                className="files-navbtn"
                aria-label="Back"
                title="Back"
                disabled={!canBack}
                onClick={goBack}
              >
                <IconChevronLeft />
              </button>
              <button
                type="button"
                className="files-navbtn"
                aria-label="Forward"
                title="Forward"
                disabled={!canForward}
                onClick={goForward}
              >
                <IconChevronRight />
              </button>
            </div>

            <div className="files-viewseg" role="group" aria-label="View">
              <button
                type="button"
                className={`files-viewseg__btn${view === "icons" ? " files-viewseg__btn--active" : ""}`}
                aria-label="Icon view"
                title="Icon view"
                aria-pressed={view === "icons"}
                onClick={() => setView("icons")}
              >
                <IconGridView />
              </button>
              <button
                type="button"
                className={`files-viewseg__btn${view === "list" ? " files-viewseg__btn--active" : ""}`}
                aria-label="List view"
                title="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <IconListView />
              </button>
            </div>

            <div className="files-search">
              <IconSearch size={12} className="files-search__icon" />
              <input
                type="search"
                value={query}
                placeholder="Search"
                aria-label="Search files by title"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) setQuery("");
                }}
              />
            </div>
          </div>

          {!hasLibrary ? (
            <EmptyArchive />
          ) : (
            <>
              {view === "list" && filtered.length > 0 && (
                <div className="files-listhead" aria-hidden="true">
                  <span className="foid-label">Name</span>
                  <span className="foid-label">Kind</span>
                  <span className="foid-label">Date Added</span>
                </div>
              )}
              <div
                ref={canvasRef}
                role="listbox"
                aria-label="Files"
                tabIndex={0}
                aria-activedescendant={selectedId ? `files-opt-${selectedId}` : undefined}
                className={`files-canvas files-canvas--${view}`}
                onKeyDown={onCanvasKeyDown}
                onMouseDown={onCanvasMouseDown}
              >
                {filtered.length === 0 ? (
                  <p className="foid-label files-noresults">
                    {query.trim()
                      ? `No results for “${query.trim()}”`
                      : `Nothing in ${crumb} yet`}
                  </p>
                ) : view === "icons" ? (
                  <div ref={gridRef} className="files-grid" role="presentation">
                    {filtered.map(renderOption)}
                  </div>
                ) : (
                  filtered.map(renderOption)
                )}
              </div>
            </>
          )}

          <div className="files-status">
            <span className="foid-label files-status__count" aria-live="polite">
              {selectedId
                ? `1 of ${filtered.length} selected`
                : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
            </span>
            <span className="foid-label files-status__path">
              FOID OS <span className="files-status__sep" aria-hidden="true">&#9656;</span> Media{" "}
              <span className="files-status__sep" aria-hidden="true">&#9656;</span>{" "}
              <span className="files-status__here">{crumb}</span>
            </span>
          </div>
        </div>
      </div>

      {/* MEDIA_PLAYER.EXE — portals to <body> via the Modal primitive, so
          its placement here (inside the window subtree) is DOM-neutral. */}
      {activeItem ? <MediaPlayer item={activeItem} onClose={() => setActiveItem(null)} /> : null}
    </>
  );
}
