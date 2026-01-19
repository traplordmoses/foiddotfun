"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { musicPanelController } from "@/components/musicPanelController";

const MusicPanelLogic = dynamic(() => import("./MusicPanel"), { ssr: false });

const formatTrackTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

type CompactMusicPlayerProps = { mountLogic?: boolean };

export default function CompactMusicPlayer({ mountLogic = true }: CompactMusicPlayerProps) {
  const [state, setState] = useState(musicPanelController.getState());

  useEffect(() => {
    const unsubscribe = musicPanelController.subscribe(() =>
      setState(musicPanelController.getState()),
    );
    return unsubscribe;
  }, []);

  const {
    currentTrackName,
    isPlaying,
    progress,
    elapsed,
    duration,
    shuffle,
    repeat,
    volume,
  } = state;

  const progressPercent = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const volumeLabel = Math.round((volume ?? 0) * 100);

  const handleToggle = () => musicPanelController.toggle();
  const handleNext = () => musicPanelController.next();
  const handlePrev = () => musicPanelController.prev();
  const handleShuffle = () => musicPanelController.toggleShuffle();
  const handleRepeat = () => musicPanelController.toggleRepeat();
  const increaseVolume = () => musicPanelController.adjustVolume(0.08);
  const decreaseVolume = () => musicPanelController.adjustVolume(-0.08);

  return (
    <>
      {mountLogic && (
        <div className="ipod-music-panel-logic" aria-hidden="true">
          <MusicPanelLogic />
        </div>
      )}
      <div className="ipod-player">
        <div className="ipod-wheel">
          <button className="ipod-wheel__vol" type="button" onClick={increaseVolume} title="Volume up">
            +
          </button>
          <div className="ipod-wheel__ring">
            <button
              className="ipod-wheel__btn ipod-wheel__btn--prev"
              type="button"
              onClick={handlePrev}
              title="Previous"
            >
              ⏮
            </button>
            <button
              className="ipod-wheel__center"
              type="button"
              onClick={handleToggle}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              className="ipod-wheel__btn ipod-wheel__btn--next"
              type="button"
              onClick={handleNext}
              title="Next"
            >
              ⏭
            </button>
          </div>
          <button className="ipod-wheel__vol" type="button" onClick={decreaseVolume} title="Volume down">
            −
          </button>
        </div>
        <div className="ipod-display">
          <div className="ipod-display__content">
            <div className="ipod-display__track" title={currentTrackName}>
              {currentTrackName}
            </div>
            <div className="ipod-display__bar">
              <div className="ipod-display__fill" style={{ width: `${progressPercent * 100}%` }} />
              <div className="ipod-display__knob" style={{ left: `${progressPercent * 100}%` }} />
            </div>
            <div className="ipod-display__meta">
              <div className="ipod-display__meta-side">
                <button
                  className={`ipod-display__shuffle ${shuffle ? "ipod-display__shuffle--active" : ""}`}
                  onClick={handleShuffle}
                  type="button"
                  title="Shuffle"
                >
                  🔀
                </button>
              </div>
              <div className="ipod-display__meta-center">
                <span className="ipod-display__time">
                  {formatTrackTime(elapsed)} / {formatTrackTime(duration)}
                </span>
              </div>
              <div className="ipod-display__meta-side ipod-display__meta-side--right">
                <button
                  className={`ipod-display__repeat ${repeat ? "ipod-display__repeat--active" : ""}`}
                  onClick={handleRepeat}
                  type="button"
                  title="Repeat"
                >
                  🔁
                </button>
                <span className="ipod-display__volume" aria-label="Volume level">
                  {volumeLabel}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        :global(.ipod-player) {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 6px;
          width: 100%;
          border-radius: 26px;
          border: 1px solid rgba(255, 210, 235, 0.65);
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.9), transparent 55%),
            linear-gradient(
              145deg,
              rgba(255, 210, 225, 0.65) 0%,
              rgba(255, 150, 195, 0.55) 45%,
              rgba(200, 75, 140, 0.72) 100%
            );
          box-shadow:
            0 14px 28px rgba(0, 10, 30, 0.28),
            0 0 30px rgba(255, 150, 190, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.45),
            inset 0 -3px 8px rgba(0, 0, 0, 0.25);
        }

        :global(.ipod-wheel) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        :global(.ipod-wheel__vol) {
          width: 24px;
          height: 14px;
          font-size: 12px;
          color: rgba(18, 38, 62, 0.8);
          text-shadow: 0 0 6px rgba(38, 196, 255, 0.35);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s, transform 0.15s;
        }
        :global(.ipod-wheel__vol:hover) {
          color: rgba(18, 38, 62, 1);
          transform: translateY(-1px);
        }

        :global(.ipod-wheel__ring) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: linear-gradient(
            180deg,
            rgba(224, 242, 255, 0.95),
            rgba(192, 219, 255, 0.85),
            rgba(164, 199, 255, 0.8)
          );
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow:
            inset 0 3px 6px rgba(0, 0, 0, 0.15),
            0 2px 6px rgba(0, 0, 0, 0.15),
            0 0 12px rgba(165, 220, 255, 0.45);
        }

        :global(.ipod-wheel__btn) {
          position: absolute;
          width: 22px;
          height: 22px;
          font-size: 10px;
          color: rgba(20, 40, 60, 0.7);
          text-shadow: 0 0 6px rgba(31, 162, 255, 0.4);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s, transform 0.15s;
          top: 50%;
          transform: translateY(-50%);
        }
        :global(.ipod-wheel__btn:hover) {
          color: rgba(20, 40, 60, 1);
          transform: translateY(-50%) scale(1.05);
        }

        :global(.ipod-wheel__btn--prev) { left: -4px; }
        :global(.ipod-wheel__btn--next) { right: -4px; }

        :global(.ipod-wheel__center) {
          width: 24px;
          height: 24px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(220, 230, 255, 0.8));
          border-radius: 50%;
          border: none;
          font-size: 14px;
          color: rgba(12, 32, 54, 0.9);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
          transition: all 0.15s;
        }
        :global(.ipod-wheel__center:hover) { background: linear-gradient(180deg, #fff, rgba(220, 235, 255, 0.95)); }

        :global(.ipod-display) {
          flex: 1;
          padding: 6px 10px;
          background: linear-gradient(
            180deg,
            rgba(14, 26, 48, 0.95),
            rgba(8, 18, 34, 0.95)
          );
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow:
            inset 0 2px 8px rgba(255, 255, 255, 0.08),
            0 2px 12px rgba(0, 0, 0, 0.45);
          overflow: hidden;
        }

        :global(.ipod-display__content) {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        :global(.ipod-display__track) {
          width: 100%;
          font-size: 9px;
          font-weight: 700;
          color: rgba(190, 255, 235, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
          text-shadow: 0 0 10px rgba(140, 255, 220, 0.6);
        }

        :global(.ipod-display__bar) {
          position: relative;
          width: min(100%, 240px);
          height: 5px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.35);
        }

        :global(.ipod-display__fill) {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(116, 255, 238, 0.95),
            rgba(84, 219, 255, 0.9)
          );
          border-radius: 3px;
          box-shadow: 0 0 8px rgba(84, 219, 255, 0.6);
        }

        :global(.ipod-display__knob) {
          position: absolute;
          top: 50%;
          width: 12px;
          height: 12px;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(84, 219, 255, 0.8);
          border-radius: 50%;
          box-shadow:
            0 1px 4px rgba(0, 0, 0, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          transform: translate(-50%, -50%);
        }

        :global(.ipod-display__meta) {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        :global(.ipod-display__meta-side) {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: none;
        }

        :global(.ipod-display__meta-side--right) {
          justify-content: flex-end;
        }

        :global(.ipod-display__meta-center) {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        :global(.ipod-display__time) {
          font-family: var(--font-mono);
          font-size: 8px;
          color: rgba(200, 255, 245, 0.9);
          flex: 1;
          text-align: center;
          text-shadow: 0 0 6px rgba(32, 180, 200, 0.5);
        }

        :global(.ipod-display__volume) {
          font-size: 8px;
          font-family: var(--font-mono);
          color: rgba(200, 255, 245, 0.9);
          letter-spacing: 0.2em;
        }

        :global(.ipod-display__shuffle),
        :global(.ipod-display__repeat) {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          opacity: 0.55;
          transition: opacity 0.15s;
          padding: 2px;
        }
        :global(.ipod-display__shuffle:hover),
        :global(.ipod-display__repeat:hover) { opacity: 0.85; }
        :global(.ipod-display__shuffle--active),
        :global(.ipod-display__repeat--active) { opacity: 1; color: #1d1d1d; }
        :global(.ipod-wheel__vol:focus-visible),
        :global(.ipod-wheel__btn:focus-visible),
        :global(.ipod-wheel__center:focus-visible),
        :global(.ipod-display__shuffle:focus-visible),
        :global(.ipod-display__repeat:focus-visible) {
          outline: 2px solid var(--foid-accent);
          outline-offset: 3px;
          box-shadow: 0 0 12px var(--foid-glow);
        }

        :global(.ipod-music-panel-logic) {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}
