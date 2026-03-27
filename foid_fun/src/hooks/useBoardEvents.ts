'use client';

import { useEffect, useRef, useCallback } from 'react';
import { subscribeToBoardEvents, type BoardEvent } from '@/lib/supabase';

/**
 * Subscribes to real-time board events (proposal created, vote cast, finalized).
 * Calls `onEvent` with a debounce to batch rapid events.
 *
 * Usage:
 *   useBoardEvents(() => { refetchProposals(); });
 */
export function useBoardEvents(onEvent: (event: BoardEvent) => void, debounceMs = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestEventRef = useRef<BoardEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const debouncedCallback = useCallback((event: BoardEvent) => {
    latestEventRef.current = event;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (latestEventRef.current) {
        onEventRef.current(latestEventRef.current);
      }
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    const unsubscribe = subscribeToBoardEvents(debouncedCallback);
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debouncedCallback]);
}
