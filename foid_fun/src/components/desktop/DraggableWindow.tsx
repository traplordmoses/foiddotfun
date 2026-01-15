"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";

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
    },
    [id, onPositionChange]
  );

  const handleMouseDown = useCallback(() => {
    onFocus(id);
  }, [id, onFocus]);

  const handleClose = useCallback(() => {
    onClose?.(id);
  }, [id, onClose]);

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
      dragHandleClassName="window-drag-handle"
      enableResizing={resizable ? {
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true,
      } : false}
      bounds="parent"
      style={{ zIndex }}
      className={`desktop-window ${className}`}
    >
      <div className="vista-window h-full flex flex-col">
        {/* Title Bar - Drag Handle */}
        <div className="vista-window__titlebar window-drag-handle cursor-grab active:cursor-grabbing">
          <div className="vista-window__controls" aria-hidden="true">
            <button
              type="button"
              className="vista-window__control vista-window__control--close"
              onClick={handleClose}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <span className="vista-window__control vista-window__control--minimize" />
            <span className="vista-window__control vista-window__control--restore" />
          </div>
          <span className="vista-window__title">
            {icon && <span aria-hidden="true">{icon}</span>} {title}
          </span>
        </div>

        {/* Window Body */}
        <div className={`vista-window__body flex-1 overflow-auto ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </Rnd>
  );
}
