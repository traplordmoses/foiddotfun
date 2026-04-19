import { useCallback } from 'react';

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error' | 'heartbeat';

const hapticPatterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  selection: [5, 10],
  success: [10, 50, 10],
  error: [20, 100, 20, 100],
  // heartbeat: heavy thud, short silence, light follow-up — anchors a sacred beat
  heartbeat: [40, 80, 120],
};

export function useHaptic() {
  const trigger = useCallback((pattern: HapticPattern = 'light') => {
    if (typeof window === 'undefined') return;
    if (!('vibrate' in navigator)) return;

    try {
      const vibration = hapticPatterns[pattern];
      navigator.vibrate(vibration);
    } catch (error) {
      // Silently fail if vibration not supported
      console.debug('Haptic feedback not supported:', error);
    }
  }, []);

  return { trigger };
}
