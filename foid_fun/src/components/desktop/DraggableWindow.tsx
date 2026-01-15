"use client";

import { useCallback, useRef, useState, type ReactNode, type MouseEvent, type CSSProperties } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import useAeroSounds from "../useAeroSounds";

export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DraggableWindowProps {
  id: string;
  title: string;
  icon?: string;
  children: ReactNode;
  position: WindowPosition;
  zIndex: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;
  onFocus: (id: string) => void;
  onPositionChange: (id: string, position: WindowPosition) => void;
  onClose?: (id: string) => void;
  className?: string;
  bodyClassName?: string;
}

export default function DraggableWindow({
  id,
  title,
  icon,
  children,
  position,
  zIndex,
  minWidth = 200,
  minHeight = 150,
  maxWidth,
  maxHeight,
  resizable = true,
  onFocus,
  onPositionChange,
  onClose,
  className = "",
  bodyClassName = "",
}: DraggableWindowProps) {
  const rndRef = useRef<Rnd>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isPressed, setIsPressed] = useState(false);
  const { playHover, playClick, playWindowFocus, playWhoosh } = useAeroSounds();

  const handleDragStop: RndDragCallback = useCallback(
    (_e, data) => {
      onPositionChange(id, {
        ...position,
        x: data.x,
        y: data.y,
      });
    },
    [id, position, onPositionChange]
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_e, _direction, ref, _delta, pos) => {
      onPositionChange(id, {
        x: pos.x,
        y: pos.y,
        width: parseInt(ref.style.width, 10),
        height: parseInt(ref.style.height, 10),
      });
      playWhoosh();
    },
    [id, onPositionChange, playWhoosh]
  );

  const handleMouseDown = useCallback(() => {
    onFocus(id);
    playWindowFocus();
    setIsPressed(true);
  }, [id, onFocus, playWindowFocus]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleClose = useCallback(() => {
    playClick();
    onClose?.(id);
  }, [id, onClose, playClick]);

  const handleWindowMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  const handleWindowEnter = useCallback(() => {
    setIsHovered(true);
    playHover();
  }, [playHover]);

  const handleWindowLeave = useCallback(() => {
    setIsHovered(false);
    setMousePos({ x: 0.5, y: 0.5 });
  }, []);

  const handleControlHover = useCallback(() => {
    playHover();
  }, [playHover]);

  const handleControlClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      playClick();
    },
    [playClick]
  );

  return (
    <Rnd
      ref={rndRef}
      position={{ x: position.x, y: position.y }}
      size={{ width: position.width, height: position.height }}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      dragHandleClassName="window-drag-handle"
      enableResizing={
        resizable
          ? {
              top: true,
              right: true,
              bottom: true,
              left: true,
              topRight: true,
              bottomRight: true,
              bottomLeft: true,
              topLeft: true,
            }
          : false
      }
      bounds="parent"
      style={{ zIndex }}
      className={`desktop-window ${className}`}
    >
      <div
        ref={windowRef}
        className={`vista-window vista-window--enhanced h-full flex flex-col ${
          isHovered ? "is-hovered" : ""
        } ${isPressed ? "is-pressed" : ""}`}
        onMouseMove={handleWindowMouseMove}
        onMouseEnter={handleWindowEnter}
        onMouseLeave={handleWindowLeave}
        style={
          {
            "--mouse-x": mousePos.x,
            "--mouse-y": mousePos.y,
          } as CSSProperties
        }
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-[1] transition-opacity duration-300"
          style={{
            background: `radial-gradient(
              600px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%,
              rgba(150, 220, 255, 0.12) 0%,
              rgba(100, 180, 255, 0.06) 25%,
              transparent 50%
            )`,
            opacity: isHovered ? 1 : 0,
          }}
        />

        <div className="vista-window__titlebar vista-window__titlebar--enhanced window-drag-handle cursor-grab active:cursor-grabbing">
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-200"
            style={{
              background: `radial-gradient(
                ellipse 80% 120% at ${mousePos.x * 100}% 80%,
                rgba(255, 255, 255, 0.15) 0%,
                transparent 50%
              )`,
              opacity: isHovered ? 1 : 0,
            }}
          />

          <div className="vista-window__controls" aria-hidden="true">
            <button
              type="button"
              className="vista-window__control vista-window__control--close vista-window__control--enhanced"
              onClick={handleClose}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={handleControlHover}
            />
            <span
              className="vista-window__control vista-window__control--minimize vista-window__control--enhanced"
              onMouseEnter={handleControlHover}
              onClick={handleControlClick}
            />
            <span
              className="vista-window__control vista-window__control--restore vista-window__control--enhanced"
              onMouseEnter={handleControlHover}
              onClick={handleControlClick}
            />
          </div>
          <span className="vista-window__title relative z-[1]">
            {icon && <span aria-hidden="true">{icon}</span>} {title}
          </span>
        </div>

        <div
          className={`vista-window__body vista-window__body--enhanced flex-1 overflow-auto relative ${bodyClassName}`}
        >
          <div
            className="pointer-events-none absolute inset-0 z-[0]"
            style={{
              background: `
                radial-gradient(
                  ellipse 100% 80% at ${30 + mousePos.x * 40}% ${20 + mousePos.y * 30}%,
                  rgba(150, 210, 255, 0.08) 0%,
                  transparent 50%
                ),
                linear-gradient(
                  180deg,
                  rgba(100, 180, 255, 0.05) 0%,
                  transparent 30%
                )
              `,
            }}
          />

          <div className="relative z-[1]">{children}</div>
        </div>
      </div>
    </Rnd>
  );
}
