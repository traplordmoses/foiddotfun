// src/apps/AboutApp.tsx
// ABOUT.EXE — the FOID OS about browser, extracted from the /about route so
// the same component renders in BOTH presentations (multi-window plan §4):
//   - the /about route page (thin wrapper: main + vista-window + titlebar)
//   - a desktop shell window (<OSWindow appId="about">) when the
//     NEXT_PUBLIC_FOID_DESKTOP flag is on
//
// Same Finder anatomy as FILES.EXE (files.css classes wholesale): glass
// sidebar (Favorites drive the category filter, Locations link to the repo
// + FILES.EXE), slim toolbar (back/forward history, icon/list view toggle,
// search across filename + title), and a canvas with Mac selection behavior
// — click selects, double-click opens, arrows move, Enter/Space opens,
// Escape clears. All keyboard handling is element-scoped (the listbox), so
// two open windows never fight over keys.
//
// Every section of the old about page lives as a .md/.txt document in
// src/content/aboutDocs.ts. Opening one launches TEXTEDIT.EXE — a slab
// <Modal> with a comfortable reading surface (MarkdownLite for .md, a
// monospace <pre> for .txt) plus prev/next arrows (← → keys too) so you can
// read the whole shelf without closing. The primitive portals to <body>
// (shell-scoped takeover), so it renders identically from the route and
// from a desktop window — always above every window frame.
//
// files.css + about.css are imported HERE — the shared location both the
// route and the shell load (they used to live in about/layout.tsx, which
// the shell never mounts). The Finder chrome classes are namespaced
// .files-*; about.css only adds the TEXTEDIT.EXE reader + doc glyphs.
"use client";

import "@/app/files/files.css";
import "@/app/about/about.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import MarkdownLite from "@/components/MarkdownLite";
import { ABOUT_DOCS, type AboutDoc, type AboutDocCategory, type AboutDocKind } from "@/content/aboutDocs";

type CategoryFilter = "all" | AboutDocCategory;
type ViewMode = "icons" | "list";

const GITHUB_URL = "https://github.com/traplordmoses/foiddotfun";

/** Sidebar Favorites — each drives the category filter. */
const FAVORITES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All Docs" },
  { key: "docs", label: "Docs" },
  { key: "onchain", label: "Onchain" },
  { key: "community", label: "Community" },
];

const CRUMB_LABEL: Record<CategoryFilter, string> = {
  all: "All",
  docs: "Docs",
  onchain: "Onchain",
  community: "Community",
};

const KIND_LABEL: Record<AboutDocKind, string> = {
  md: "Markdown",
  txt: "Plain Text",
};

const KIND_BADGE: Record<AboutDocKind, string> = {
  md: "MD",
  txt: "TXT",
};

/* ── Inline icon set ──────────────────────────────────────────────────────
   16-grid stroke glyphs, currentColor, same family as FILES.EXE. */

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
/** Page with a folded corner — the document glyph (rows + sidebar). */
function IconDoc(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M4 1.75h5.2l3 3V13a1.25 1.25 0 0 1-1.25 1.25h-6.7A1.25 1.25 0 0 1 3 13V2.75a1 1 0 0 1 1-1z" />
      <path d="M9.2 1.75v3h3" />
      <path d="M5.6 8h4.8" />
      <path d="M5.6 10.6h4.8" />
    </svg>
  );
}
/** Onchain — a block. */
function IconCube(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M8 1.9 14 5.1v5.8L8 14.1 2 10.9V5.1z" />
      <path d="M2 5.1 8 8.3l6-3.2" />
      <path d="M8 8.3v5.8" />
    </svg>
  );
}
/** Community — two heads. */
function IconPeople(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <circle cx="5.7" cy="5.4" r="2.3" />
      <path d="M1.9 13.4c.4-2.6 1.9-4 3.8-4s3.4 1.4 3.8 4" />
      <circle cx="11.3" cy="6" r="1.85" />
      <path d="M10.8 9.6c1.8.2 3 1.5 3.4 3.3" />
    </svg>
  );
}
function IconFolder(p: IconProps) {
  return (
    <svg {...iconAttrs(p)}>
      <path d="M1.75 4.4a1.6 1.6 0 0 1 1.6-1.6h2.9l1.6 1.8h4.8a1.6 1.6 0 0 1 1.6 1.6v5.9a1.6 1.6 0 0 1-1.6 1.6H3.35a1.6 1.6 0 0 1-1.6-1.6z" />
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

const FAVORITE_ICON: Record<CategoryFilter, (p: IconProps) => JSX.Element> = {
  all: IconStack,
  docs: IconDoc,
  onchain: IconCube,
  community: IconPeople,
};

/** Icon-view tile glyph: page with folded corner + MD/TXT badge (drawn, no
 *  emoji). currentColor throughout so .about-doc-glyph tints it cyan. */
function DocTileIcon({ kind, size = 48 }: { kind: AboutDocKind; size?: number }) {
  const badge = KIND_BADGE[kind];
  const badgeWidth = kind === "md" ? 17 : 22;
  return (
    <svg
      width={(size * 40) / 50}
      height={size}
      viewBox="0 0 40 50"
      fill="none"
      className="about-doc-glyph"
      aria-hidden
    >
      <path
        d="M8 1.5h17.5L35 11v33a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5.5a4 4 0 0 1 4-4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M25.5 1.5V11H35" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10.5 19h19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <path d="M10.5 24.5h19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <path d="M10.5 30h12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <rect
        x="7"
        y="35"
        width={badgeWidth}
        height="10.5"
        rx="2.5"
        fill="currentColor"
        opacity="0.16"
      />
      <rect
        x="7"
        y="35"
        width={badgeWidth}
        height="10.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <text
        x={7 + badgeWidth / 2}
        y="43"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontFamily="var(--font-terminal, monospace)"
        fontSize="6.5"
        fontWeight="700"
        letterSpacing="0.5"
      >
        {badge}
      </text>
    </svg>
  );
}

/* ── TEXTEDIT.EXE — the reader ────────────────────────────────────────── */

function DocReader({
  docs,
  index,
  onClose,
  onNavigate,
}: {
  docs: AboutDoc[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const doc = docs[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const prev = index > 0 ? docs[index - 1] : null;
  const next = index < docs.length - 1 ? docs[index + 1] : null;

  /* New doc → back to the top of the page surface. */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [doc.id]);

  /* ← → walk the shelf while the reader is open (Escape closes via Modal).
     The reader is a modal takeover — it owns the keyboard while open, so
     no shell-focus gating is needed here. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && index < docs.length - 1) onNavigate(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, docs.length, onNavigate]);

  return (
    <Modal
      open
      onClose={onClose}
      label={`TEXTEDIT.EXE — ${doc.name}`}
      variant="slab"
      className="about-reader"
      initialFocusRef={closeRef}
      maxWidth={880}
    >
      {/* Slim titlebar: live close orb · filename · kind badge */}
      <div className="about-reader__bar">
        <button
          ref={closeRef}
          type="button"
          className="vista-window__control vista-window__control--close about-reader__close"
          aria-label="Close reader"
          onClick={onClose}
        />
        <span className="about-reader__name">TEXTEDIT.EXE — {doc.name}</span>
        <span className="about-reader__badge">{KIND_BADGE[doc.kind]}</span>
      </div>

      <div ref={scrollRef} className="about-reader__scroll" tabIndex={0}>
        {doc.kind === "md" ? (
          <div className="about-reader__doc">
            <MarkdownLite body={doc.body} />
          </div>
        ) : (
          <pre className="about-reader__pre">{doc.body}</pre>
        )}
      </div>

      {/* Footer: read through the shelf without closing */}
      <div className="about-reader__footer">
        <button
          type="button"
          className="about-reader__nav"
          disabled={!prev}
          aria-label={prev ? `Previous document: ${prev.name}` : "No previous document"}
          onClick={() => prev && onNavigate(index - 1)}
        >
          <IconChevronLeft size={12} />
          <span>{prev ? prev.name : "start"}</span>
        </button>
        <span className="foid-label about-reader__pos">
          {index + 1} / {docs.length}
        </span>
        <button
          type="button"
          className="about-reader__nav"
          disabled={!next}
          aria-label={next ? `Next document: ${next.name}` : "No next document"}
          onClick={() => next && onNavigate(index + 1)}
        >
          <span>{next ? next.name : "end"}</span>
          <IconChevronRight size={12} />
        </button>
      </div>
    </Modal>
  );
}

/* ── The app (window body) ────────────────────────────────────────────── */

export default function AboutApp() {
  /* Location history — sidebar clicks push, chevrons walk the stack. */
  const [hist, setHist] = useState<{ stack: CategoryFilter[]; index: number }>({
    stack: ["all"],
    index: 0,
  });
  const filter = hist.stack[hist.index];
  const canBack = hist.index > 0;
  const canForward = hist.index < hist.stack.length - 1;

  const navigateTo = (nextFilter: CategoryFilter) =>
    setHist((h) => {
      if (h.stack[h.index] === nextFilter) return h;
      const stack = [...h.stack.slice(0, h.index + 1), nextFilter];
      return { stack, index: stack.length - 1 };
    });
  const goBack = () => setHist((h) => (h.index > 0 ? { ...h, index: h.index - 1 } : h));
  const goForward = () =>
    setHist((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1 } : h));

  const [view, setView] = useState<ViewMode>("icons");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Index into `filtered` of the doc open in TEXTEDIT.EXE (null = closed). */
  const [readerIndex, setReaderIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const byCategory =
      filter === "all" ? ABOUT_DOCS : ABOUT_DOCS.filter((doc) => doc.category === filter);
    const q = query.trim().toLowerCase();
    return q
      ? byCategory.filter(
          (doc) => doc.name.toLowerCase().includes(q) || doc.title.toLowerCase().includes(q),
        )
      : byCategory;
  }, [filter, query]);

  /* Selection can dangle when the location/search changes under it. */
  useEffect(() => {
    if (selectedId && !filtered.some((doc) => doc.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  const selectDoc = (id: string) => {
    setSelectedId(id);
    canvasRef.current?.focus({ preventScroll: true });
  };

  const openDoc = (id: string) => {
    const index = filtered.findIndex((doc) => doc.id === id);
    if (index < 0) return;
    setSelectedId(id);
    setReaderIndex(index);
  };

  /* Reader prev/next keeps canvas selection in sync so closing lands where
     you left off reading. */
  const readerNavigate = (nextIndex: number) => {
    const doc = filtered[nextIndex];
    if (!doc) return;
    setReaderIndex(nextIndex);
    setSelectedId(doc.id);
  };

  /* Icon view is a real CSS grid — read the rendered column count so
     ArrowUp/ArrowDown move by visual rows, like Finder. */
  const gridColumnCount = () => {
    const el = gridRef.current;
    if (!el) return 1;
    return Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  };

  const moveSelection = (nextIndex: number) => {
    const doc = filtered[nextIndex];
    if (!doc) return;
    setSelectedId(doc.id);
    document.getElementById(`about-opt-${doc.id}`)?.scrollIntoView({ block: "nearest" });
  };

  const onCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return;
    const idx = selectedId ? filtered.findIndex((doc) => doc.id === selectedId) : -1;

    if (e.key === "Enter" || e.key === " ") {
      if (idx >= 0) {
        e.preventDefault();
        setReaderIndex(idx);
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
  const activeDoc = readerIndex !== null ? filtered[readerIndex] : null;

  const renderOption = (doc: AboutDoc) => {
    const selected = doc.id === selectedId;

    if (view === "icons") {
      return (
        <div
          key={doc.id}
          id={`about-opt-${doc.id}`}
          role="option"
          aria-selected={selected}
          className={`files-item${selected ? " files-item--selected" : ""}`}
          onClick={() => selectDoc(doc.id)}
          onDoubleClick={() => openDoc(doc.id)}
        >
          <span className="files-item__thumb">
            <DocTileIcon kind={doc.kind} />
          </span>
          <span className="files-item__name">{doc.name}</span>
        </div>
      );
    }

    return (
      <div
        key={doc.id}
        id={`about-opt-${doc.id}`}
        role="option"
        aria-selected={selected}
        className={`files-row${selected ? " files-row--selected" : ""}`}
        onClick={() => selectDoc(doc.id)}
        onDoubleClick={() => openDoc(doc.id)}
      >
        <span className="files-row__name">
          <IconDoc size={14} className="files-row__kindicon" />
          <span className="files-row__title foid-data">{doc.name}</span>
        </span>
        <span className="files-row__cell foid-data">{KIND_LABEL[doc.kind]}</span>
        <span className="files-row__cell foid-data">{doc.updatedAt}</span>
      </div>
    );
  };

  return (
    <>
      <div className="vista-window__body vista-window__body--flush files-shell">
        {/* ── Sidebar ── */}
        <aside className="files-sidebar">
          <div className="files-sidebar__section" role="group" aria-labelledby="about-fav-heading">
            <span id="about-fav-heading" className="foid-label files-sidebar__heading">
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

          <div className="files-sidebar__section" role="group" aria-labelledby="about-loc-heading">
            <span id="about-loc-heading" className="foid-label files-sidebar__heading">
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
            <Link className="files-side-row" href="/files">
              <IconFolder className="files-side-row__icon" />
              <span className="files-side-row__label">FILES.EXE</span>
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
                aria-label="Search documents by name or title"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) setQuery("");
                }}
              />
            </div>
          </div>

          {view === "list" && filtered.length > 0 && (
            <div className="files-listhead" aria-hidden="true">
              <span className="foid-label">Name</span>
              <span className="foid-label">Kind</span>
              <span className="foid-label">Updated</span>
            </div>
          )}
          <div
            ref={canvasRef}
            role="listbox"
            aria-label="Documents"
            tabIndex={0}
            aria-activedescendant={selectedId ? `about-opt-${selectedId}` : undefined}
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

          <div className="files-status">
            <span className="foid-label files-status__count" aria-live="polite">
              {selectedId
                ? `1 of ${filtered.length} selected`
                : `${filtered.length} document${filtered.length === 1 ? "" : "s"}`}
            </span>
            <span className="foid-label files-status__path">
              FOID OS <span className="files-status__sep" aria-hidden="true">&#9656;</span> About{" "}
              <span className="files-status__sep" aria-hidden="true">&#9656;</span>{" "}
              <span className="files-status__here">{crumb}</span>
            </span>
          </div>
        </div>
      </div>

      {/* TEXTEDIT.EXE — portals to <body> via the Modal primitive, so its
          placement here (inside the window subtree) is DOM-neutral and it
          always opens above every window frame. */}
      {activeDoc && readerIndex !== null ? (
        <DocReader
          docs={filtered}
          index={readerIndex}
          onClose={() => setReaderIndex(null)}
          onNavigate={readerNavigate}
        />
      ) : null}
    </>
  );
}
