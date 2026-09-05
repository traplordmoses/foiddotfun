'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { buildIndex, queryIndex } from '@/hooks/board/useVisiblePlacements';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { useMobile } from '@/hooks/useMobile';
import { motion } from 'framer-motion';
import { IpfsImage } from '@/components/IpfsImage';

interface BoardNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type: 'text' | 'image' | 'meme';
  status?: 'voting' | 'canonized';
  forCount?: number;
  againstCount?: number;
}

interface MobileBoardProps {
  nodes: BoardNode[];
  onNodeClick?: (node: BoardNode) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onAddNode?: (x: number, y: number) => void;
}

export function MobileBoard({
  nodes,
  onNodeClick,
}: MobileBoardProps) {
  const { screenWidth, screenHeight } = useMobile();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas state. The view fits itself to the content bounds the first time
  // nodes arrive (below); until then it sits at 30% over world origin.
  const [scale, setScale] = useState(0.3);
  const [position, setPosition] = useState(() => ({
    x: (typeof window !== 'undefined' ? window.innerWidth : 375) / 2,
    y: (typeof window !== 'undefined' ? window.innerHeight : 667) / 2,
  }));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Content bounds in world units. Pan limits and the initial fit derive
  // from these, so the board can never be panned into empty space and never
  // opens on empty space either (placements sit thousands of units from the
  // origin, so the old origin-centred start showed nothing on first paint).
  const bounds = useMemo(() => {
    if (nodes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    return { minX, minY, maxX, maxY };
  }, [nodes]);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const clampPosition = useCallback((x: number, y: number) => {
    const b = boundsRef.current;
    if (!b) return { x, y };
    const s = scaleRef.current;
    const sw = typeof window !== 'undefined' ? window.innerWidth : screenWidth;
    const sh = typeof window !== 'undefined' ? window.innerHeight : screenHeight;
    // Keep at least half a screen of content reachable in every direction.
    const padX = sw * 0.5;
    const padY = sh * 0.5;
    const minPosX = sw - b.maxX * s - padX;
    const maxPosX = padX - b.minX * s;
    const minPosY = sh - b.maxY * s - padY;
    const maxPosY = padY - b.minY * s;
    const lowX = Math.min(minPosX, maxPosX);
    const highX = Math.max(minPosX, maxPosX);
    const lowY = Math.min(minPosY, maxPosY);
    const highY = Math.max(minPosY, maxPosY);
    return {
      x: Math.max(lowX, Math.min(highX, x)),
      y: Math.max(lowY, Math.min(highY, y)),
    };
  }, [screenWidth, screenHeight]);

  // Handle pan with bounds checking
  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setPosition((prev) => clampPosition(prev.x + delta.x, prev.y + delta.y));
  }, [clampPosition]);

  // First fit: once placements arrive, zoom out to show the board and centre
  // it. Runs once; gestures own the view after that. The scale floor keeps
  // tiles legible on a big board (0.12 = a 600-unit placement at ~72 px);
  // the viewport then covers a slice of the board and virtualization does
  // the rest. Nodes are not rendered until the fit has run, so no image is
  // requested at the pre-fit scale.
  const fittedRef = useRef(false);
  const [fitted, setFitted] = useState(false);
  useEffect(() => {
    if (fittedRef.current || !bounds) return;
    fittedRef.current = true;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const bw = Math.max(1, bounds.maxX - bounds.minX);
    const bh = Math.max(1, bounds.maxY - bounds.minY);
    const fit = Math.min(1, Math.max(0.12, Math.min(sw / bw, sh / bh) * 0.9));
    setScale(fit);
    setPosition({
      x: sw / 2 - (bounds.minX + bw / 2) * fit,
      y: sh / 2 - (bounds.minY + bh / 2) * fit,
    });
    setFitted(true);
  }, [bounds]);

  // Viewport virtualization: only nodes intersecting the screen (plus half a
  // screen of margin) render. The desktop board already does this; the
  // mobile tree used to mount every placement at once (99 images, 6 MB).
  const nodeRect = useCallback((n: BoardNode) => ({ x: n.x, y: n.y, w: n.width, h: n.height }), []);
  const index = useMemo(() => buildIndex(nodes, nodeRect), [nodes, nodeRect]);
  const visibleNodes = useMemo(() => {
    if (!fitted) return [] as BoardNode[];
    const vw = screenWidth / scale;
    const vh = screenHeight / scale;
    return queryIndex(
      index,
      { x: -position.x / scale, y: -position.y / scale, w: vw, h: vh },
      Math.max(vw, vh) * 0.5,
    );
  }, [fitted, index, position.x, position.y, scale, screenWidth, screenHeight]);

  // Image request widths come from the ON-SCREEN size (the proxy adds DPR 2
  // itself), bucketed to 64 px so the edge cache stays hot, and never shrink
  // for a node during a session: zooming out must not re-download smaller.
  // The old code asked for the world width (a 608-unit placement shown at
  // 180 px fetched a 1216 px image).
  const requestedWidthRef = useRef<Map<string, number>>(new Map());
  const requestWidthFor = (node: BoardNode) => {
    const cssWidth = node.width * scale;
    const bucket = Math.min(640, Math.max(64, Math.ceil(cssWidth / 64) * 64));
    const prev = requestedWidthRef.current.get(node.id) ?? 0;
    const next = Math.max(prev, bucket);
    requestedWidthRef.current.set(node.id, next);
    return next;
  };

  // Handle zoom — focal-point preserving: the world point under `center`
  // stays under `center` after the scale change. Works for both pinch
  // (center = midpoint of two fingers) and Ctrl+wheel (center = cursor).
  const handleZoom = useCallback(
    (newScale: number, center: { x: number; y: number }) => {
      const worldX = (center.x - position.x) / scale;
      const worldY = (center.y - position.y) / scale;
      setScale(newScale);
      setPosition({
        x: center.x - worldX * newScale,
        y: center.y - worldY * newScale,
      });
    },
    [scale, position]
  );

  // Handle long press - open node preview
  const handleLongPress = useCallback(
    (point: { x: number; y: number }) => {
      // Check if long pressed on a node
      const tappedNode = nodes.find((node) => {
        const nodeX = node.x * scale + position.x;
        const nodeY = node.y * scale + position.y;
        const nodeWidth = node.width * scale;
        const nodeHeight = node.height * scale;

        return (
          point.x >= nodeX &&
          point.x <= nodeX + nodeWidth &&
          point.y >= nodeY &&
          point.y <= nodeY + nodeHeight
        );
      });

      if (tappedNode) {
        // Long press opens the preview
        onNodeClick?.(tappedNode);
      }
    },
    [nodes, scale, position, onNodeClick]
  );

  // Setup pointer + wheel gestures (imperative binding on canvasRef)
  useTouchGestures(canvasRef, {
    minZoom: 0.1,
    maxZoom: 10,
    onPan: handlePan,
    onZoom: handleZoom,
    onLongPress: handleLongPress,
    longPressDuration: 500,
    onTap: (point) => {
      // Single tap just selects/highlights
      const tappedNode = nodes.find((node) => {
        const nodeX = node.x * scale + position.x;
        const nodeY = node.y * scale + position.y;
        const nodeWidth = node.width * scale;
        const nodeHeight = node.height * scale;

        return (
          point.x >= nodeX &&
          point.x <= nodeX + nodeWidth &&
          point.y >= nodeY &&
          point.y <= nodeY + nodeHeight
        );
      });

      if (tappedNode) {
        setSelectedNode(tappedNode.id);
      } else {
        setSelectedNode(null);
      }
    },
  });

  return (
    <div className="relative w-full h-full overflow-hidden bg-transparent">
      <style>{`
        @keyframes mobile-neon-glow {
          0%, 100% {
            border-color: rgba(168,85,247,0.5);
            box-shadow: 0 0 10px rgba(168,85,247,0.3), 0 0 24px rgba(168,85,247,0.1), inset 0 0 6px rgba(168,85,247,0.08);
          }
          50% {
            border-color: rgba(168,85,247,0.9);
            box-shadow: 0 0 18px rgba(168,85,247,0.55), 0 0 40px rgba(168,85,247,0.25), inset 0 0 12px rgba(168,85,247,0.15);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mobile-board-voting {
            animation: none !important;
          }
        }
      `}</style>
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0"
        style={{ touchAction: 'none' }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {/* Grid background - very subtle */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: `${50 * scale}px ${50 * scale}px`,
              backgroundPosition: `${position.x}px ${position.y}px`,
            }}
          />

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const isVoting = node.status === 'voting' || node.id.startsWith('proposal-') || node.id.startsWith('pending-');
            return (
              <motion.div
                key={node.id}
                className={`
                  absolute
                  ${isVoting ? 'mobile-board-voting' : ''}
                  ${selectedNode === node.id ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}
                `}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  ...(isVoting ? {
                    borderRadius: 6,
                    border: '1.5px solid rgba(168,85,247,0.6)',
                    boxShadow: '0 0 12px rgba(168,85,247,0.4), 0 0 28px rgba(168,85,247,0.15), inset 0 0 8px rgba(168,85,247,0.1)',
                    animation: 'mobile-neon-glow 2.5s ease-in-out infinite',
                    overflow: 'hidden',
                  } : {}),
                }}
                whileTap={{ scale: 0.98 }}
              >
                {node.type === 'image' || node.type === 'meme' ? (
                  // Shared IpfsImage: same-origin proxy at [0], public
                  // gateway fallbacks at [1..] with a per-image stall timer.
                  // Previous raw <img> had no onError handler — if the
                  // proxy returned a 5xx or stalled, mobile showed a
                  // broken image with no retry path. Using the shared
                  // component makes mobile robust against single-gateway
                  // flakiness the same way desktop already is.
                  <IpfsImage
                    cid={node.content}
                    alt="Board item"
                    className="w-full h-full object-cover pointer-events-none"
                    style={isVoting ? { opacity: 0.6 } : undefined}
                    draggable={false}
                    displayWidth={requestWidthFor(node)}
                  />
                ) : (
                  <div className="text-white text-sm break-words bg-black/40 backdrop-blur-sm p-3 rounded-lg">
                    {node.content}
                  </div>
                )}
                {isVoting && (
                  <div style={{
                    position: 'absolute', top: 3, left: 3,
                    background: 'rgba(168,85,247,0.85)', color: '#fff',
                    fontSize: 7, fontWeight: 800, letterSpacing: '0.1em',
                    padding: '1px 4px', borderRadius: 3, lineHeight: '12px',
                    textTransform: 'uppercase',
                  }}>
                    VOTING {(node.forCount ?? 0) + (node.againstCount ?? 0) > 0
                      ? `${node.forCount ?? 0}Y / ${node.againstCount ?? 0}N`
                      : ''}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Instructions overlay removed — GestureHint in board/page.tsx handles first-load tutorial */}
    </div>
  );
}
