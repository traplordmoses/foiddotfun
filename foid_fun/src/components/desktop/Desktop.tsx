"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import DraggableWindow from "./DraggableWindow";
import RitualWindowContent from "./RitualWindowContent";
import LoreboardWindowContent from "./LoreboardWindowContent";
import { useDesktopState, type WindowId } from "@/hooks/useDesktopState";
import type { WindowPosition } from "./DraggableWindow";

const MusicPanel = dynamic(() => import("@/components/MusicPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-xs text-white/70">
      <span>Loading MUSIC.EXE...</span>
    </div>
  ),
});

export default function Desktop() {
  const {
    windows,
    mounted,
    focusWindow,
    updatePosition,
    closeWindow,
    openWindow,
    resetLayout,
  } = useDesktopState();

  const handleFocus = useCallback(
    (id: string) => focusWindow(id as WindowId),
    [focusWindow]
  );

  const handlePositionChange = useCallback(
    (id: string, position: WindowPosition) =>
      updatePosition(id as WindowId, position),
    [updatePosition]
  );

  const handleClose = useCallback(
    (id: string) => closeWindow(id as WindowId),
    [closeWindow]
  );

  // Don't render until mounted (to avoid hydration mismatch with localStorage)
  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="text-white/50 font-terminal text-sm animate-pulse">
          Booting FOID_OS...
        </div>
      </div>
    );
  }

  const closedWindows = Object.entries(windows).filter(
    ([, state]) => !state.visible
  );

  return (
    <div className="desktop-environment h-screen w-screen overflow-hidden relative">
      {/* Top Menu Bar */}
      <header className="desktop-menubar fixed top-0 left-0 right-0 h-10 z-[9999] flex items-center justify-between px-4 bg-foid-midnight/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-4">
          <span className="font-primary text-sm font-bold uppercase tracking-[0.2em] text-white/90">
            FOID Foundation
          </span>
          {/* Closed windows can be reopened */}
          {closedWindows.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-white/40">Windows:</span>
              {closedWindows.map(([id]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openWindow(id as WindowId)}
                  className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                >
                  {id.replace("_", " ")}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={resetLayout}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Reset Layout
          </button>
          <ConnectButton
            chainStatus="icon"
            accountStatus="avatar"
            showBalance={false}
          />
        </div>
      </header>

      {/* Desktop Area */}
      <div className="desktop-area absolute inset-0 pt-10" id="desktop-bounds">
        {/* FOID Mommy Image Window */}
        {windows.foid_mommy.visible && (
          <DraggableWindow
            id="foid_mommy"
            title="FOID_MOMMY.JPG"
            icon="📸"
            position={windows.foid_mommy.position}
            zIndex={windows.foid_mommy.zIndex}
            onFocus={handleFocus}
            onPositionChange={handlePositionChange}
            onClose={handleClose}
            minWidth={200}
            minHeight={200}
            bodyClassName="p-0 overflow-hidden"
          >
            <Image
              src="/foidmommy.jpg"
              alt="Crayon sketch of Foid with cherries and neon eyes on a diner table."
              width={1280}
              height={960}
              className="w-full h-full object-contain"
              priority
            />
          </DraggableWindow>
        )}

        {/* Music Window */}
        {windows.music.visible && (
          <DraggableWindow
            id="music"
            title="MUSIC.EXE"
            icon="🎵"
            position={windows.music.position}
            zIndex={windows.music.zIndex}
            onFocus={handleFocus}
            onPositionChange={handlePositionChange}
            onClose={handleClose}
            minWidth={280}
            minHeight={180}
            bodyClassName="p-0 overflow-hidden"
          >
            <MusicPanel />
          </DraggableWindow>
        )}

        {/* Ritual Window */}
        {windows.ritual.visible && (
          <DraggableWindow
            id="ritual"
            title="FOID_RITUAL.EXE"
            icon="🙏"
            position={windows.ritual.position}
            zIndex={windows.ritual.zIndex}
            onFocus={handleFocus}
            onPositionChange={handlePositionChange}
            onClose={handleClose}
            minWidth={280}
            minHeight={240}
            resizable={true}
          >
            <RitualWindowContent />
          </DraggableWindow>
        )}

        {/* Loreboard Window */}
        {windows.loreboard.visible && (
          <DraggableWindow
            id="loreboard"
            title="LOREBOARD.APP"
            icon="🎨"
            position={windows.loreboard.position}
            zIndex={windows.loreboard.zIndex}
            onFocus={handleFocus}
            onPositionChange={handlePositionChange}
            onClose={handleClose}
            minWidth={280}
            minHeight={240}
            resizable={true}
          >
            <LoreboardWindowContent />
          </DraggableWindow>
        )}
      </div>

      {/* Bottom Taskbar (optional - shows open windows) */}
      <footer className="desktop-taskbar fixed bottom-0 left-0 right-0 h-12 z-[9999] flex items-center justify-center gap-2 px-4 bg-foid-midnight/80 backdrop-blur-md border-t border-white/10">
        {Object.entries(windows)
          .filter(([, state]) => state.visible)
          .sort(([, a], [, b]) => a.zIndex - b.zIndex)
          .map(([id, state]) => (
            <button
              key={id}
              type="button"
              onClick={() => focusWindow(id as WindowId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                state.zIndex === Math.max(...Object.values(windows).filter(w => w.visible).map(w => w.zIndex))
                  ? "bg-foid-aqua/20 text-foid-aqua border border-foid-aqua/40"
                  : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
              }`}
            >
              {id === "foid_mommy" && "📸 "}
              {id === "music" && "🎵 "}
              {id === "ritual" && "🙏 "}
              {id === "loreboard" && "🎨 "}
              {id.replace("_", " ").toUpperCase()}
            </button>
          ))}
      </footer>
    </div>
  );
}
