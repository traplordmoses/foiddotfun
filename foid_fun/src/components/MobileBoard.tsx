'use client';

import { useRef, useState, useCallback } from 'react';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { useMobile } from '@/hooks/useMobile';
import { motion, AnimatePresence } from 'framer-motion';
import { cidToHttpUrl } from '@/lib/ipfsUrl';

interface BoardNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type: 'text' | 'image' | 'meme';
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
  onNodeMove,
  onAddNode,
}: MobileBoardProps) {
  const { isMobile, screenWidth, screenHeight } = useMobile();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas state - start at 30% zoom for better overview
  const [scale, setScale] = useState(0.3);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Pan bounds - allow panning up to 2x screen dimensions from center
  const MAX_PAN_X = screenWidth * 2;
  const MAX_PAN_Y = screenHeight * 2;
  const MIN_PAN_X = -MAX_PAN_X;
  const MIN_PAN_Y = -MAX_PAN_Y;

  // Handle pan with bounds checking
  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setPosition((prev) => {
      const newX = prev.x + delta.x;
      const newY = prev.y + delta.y;

      return {
        x: Math.max(MIN_PAN_X, Math.min(MAX_PAN_X, newX)),
        y: Math.max(MIN_PAN_Y, Math.min(MAX_PAN_Y, newY)),
      };
    });
  }, [MAX_PAN_X, MAX_PAN_Y, MIN_PAN_X, MIN_PAN_Y]);

  // Handle zoom
  const handleZoom = useCallback(
    (newScale: number, center: { x: number; y: number }) => {
      // Adjust position to zoom towards center
      const scaleDiff = newScale - scale;
      const newX = position.x - (center.x - screenWidth / 2) * scaleDiff;
      const newY = position.y - (center.y - screenHeight / 2) * scaleDiff;

      setScale(newScale);
      setPosition({ x: newX, y: newY });
    },
    [scale, position, screenWidth, screenHeight]
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

  // Setup touch gestures
  const { touchHandlers } = useTouchGestures({
    minZoom: 0.1,
    maxZoom: 10,
    zoomSpeed: 0.005,
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
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0"
        {...touchHandlers}
        style={{ touchAction: 'none' }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: 'transform 0.1s ease-out',
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

          {/* Nodes - NO BLACK BOXES! */}
          {nodes.map((node) => (
            <motion.div
              key={node.id}
              className={`
                absolute
                ${selectedNode === node.id ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}
              `}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
              }}
              whileTap={{ scale: 0.98 }}
            >
              {node.type === 'image' || node.type === 'meme' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cidToHttpUrl(node.content)}
                  alt="Board item"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div className="text-white text-sm break-words bg-black/40 backdrop-blur-sm p-3 rounded-lg">
                  {node.content}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Instructions overlay - shows briefly on first interaction */}
      <AnimatePresence>
        {isMobile && scale === 0.3 && position.x === 0 && position.y === 0 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            <div className="text-center px-8 text-white">
              <div className="text-2xl mb-4">🤲</div>
              <p className="text-lg font-medium mb-2">Touch to interact</p>
              <p className="text-sm text-white/60">
                Pinch to zoom • Drag to pan • Hold to open
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
