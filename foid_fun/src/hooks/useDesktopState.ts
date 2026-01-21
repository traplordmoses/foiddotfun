import { useState, useCallback, useEffect } from "react";
import type { WindowPosition } from "@/components/desktop/DraggableWindow";

const STORAGE_KEY = "foid_desktop_state_v1";

export interface WindowState {
  position: WindowPosition;
  visible: boolean;
  zIndex: number;
}

export type WindowId = "foid_mommy" | "music" | "ritual" | "loreboard";

type DesktopState = Record<WindowId, WindowState>;

// Default positions for each window (centered layout)
const DEFAULT_STATE: DesktopState = {
  foid_mommy: {
    position: { x: 40, y: 60, width: 360, height: 380 },
    visible: true,
    zIndex: 1,
  },
  music: {
    position: { x: 40, y: 460, width: 360, height: 200 },
    visible: true,
    zIndex: 2,
  },
  ritual: {
    position: { x: 440, y: 60, width: 340, height: 280 },
    visible: true,
    zIndex: 3,
  },
  loreboard: {
    position: { x: 440, y: 360, width: 340, height: 280 },
    visible: true,
    zIndex: 4,
  },
};

function loadFromStorage(): DesktopState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new windows
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToStorage(state: DesktopState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function useDesktopState() {
  const [state, setState] = useState<DesktopState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setState(stored);
    }
    setMounted(true);
  }, []);

  // Save to storage on state change (after initial mount)
  useEffect(() => {
    if (mounted) {
      saveToStorage(state);
    }
  }, [state, mounted]);

  const focusWindow = useCallback((id: WindowId) => {
    setState((prev) => {
      const newZ = Math.max(...Object.values(prev).map((w) => w.zIndex)) + 1;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          zIndex: newZ,
        },
      };
    });
  }, []);

  const updatePosition = useCallback((id: WindowId, position: WindowPosition) => {
    setState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        position,
      },
    }));
  }, []);

  const toggleWindow = useCallback((id: WindowId) => {
    setState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        visible: !prev[id].visible,
      },
    }));
  }, []);

  const closeWindow = useCallback((id: WindowId) => {
    setState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        visible: false,
      },
    }));
  }, []);

  const openWindow = useCallback((id: WindowId) => {
    setState((prev) => {
      const newZ = Math.max(...Object.values(prev).map((w) => w.zIndex)) + 1;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          visible: true,
          zIndex: newZ,
        },
      };
    });
  }, []);

  const resetLayout = useCallback(() => {
    setState(DEFAULT_STATE);
    setHighestZ(10);
  }, []);

  return {
    windows: state,
    mounted,
    focusWindow,
    updatePosition,
    toggleWindow,
    closeWindow,
    openWindow,
    resetLayout,
  };
}
