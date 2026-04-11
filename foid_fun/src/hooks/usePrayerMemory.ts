'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeelingKey } from '@/app/(components)/FoidMommyTerminal';

// ── Types ────────────────────────────────────────────────────────────────────

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export type JournalEntry = {
  date: string;        // YYYY-MM-DD
  feelingKey: FeelingKey;
  timeOfDay: TimeOfDay;
};

export type ConsentState = 'granted' | 'denied' | null;

// ── Constants ────────────────────────────────────────────────────────────────

const JOURNAL_KEY_PREFIX = 'foid-prayer-journal';
const CONSENT_KEY_PREFIX = 'foid-prayer-memory-consent';
const MAX_ENTRIES = 365;

// Wallet-scoped storage keys — each wallet gets its own journey
function journalKey(address: string | undefined): string {
  return address ? `${JOURNAL_KEY_PREFIX}:${address.toLowerCase()}` : JOURNAL_KEY_PREFIX;
}
function consentKey(address: string | undefined): string {
  return address ? `${CONSENT_KEY_PREFIX}:${address.toLowerCase()}` : CONSENT_KEY_PREFIX;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Count consecutive days ending at today (or yesterday if no entry today). */
function computeLocalStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;

  // Deduplicate by date, get sorted unique dates descending
  const uniqueDates = [...new Set(entries.map((e) => e.date))].sort().reverse();

  const today = todayString();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Start counting from today or yesterday
  let startIdx = uniqueDates.indexOf(today);
  if (startIdx === -1) startIdx = uniqueDates.indexOf(yesterday);
  if (startIdx === -1) return 0;

  let streak = 1;
  let prevDate = new Date(uniqueDates[startIdx] + 'T00:00:00');

  for (let i = startIdx + 1; i < uniqueDates.length; i++) {
    const curr = new Date(uniqueDates[i] + 'T00:00:00');
    const diffMs = prevDate.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      streak++;
      prevDate = curr;
    } else {
      break;
    }
  }

  return streak;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePrayerMemory(walletAddress?: string) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [consentState, setConsentState] = useState<ConsentState>(null);
  const [hydrated, setHydrated] = useState(false);

  // Re-hydrate whenever wallet address changes — each wallet has its own journey
  useEffect(() => {
    setHydrated(false);
    setEntries([]);
    setConsentState(null);

    try {
      const cKey = consentKey(walletAddress);
      const raw = localStorage.getItem(cKey);
      if (raw === 'granted') setConsentState('granted');
      else if (raw === 'denied') setConsentState('denied');
      else setConsentState(null);

      if (raw === 'granted') {
        const jKey = journalKey(walletAddress);
        const journalRaw = localStorage.getItem(jKey);
        if (journalRaw) {
          const parsed = JSON.parse(journalRaw);
          if (Array.isArray(parsed)) {
            setEntries(parsed.slice(-MAX_ENTRIES));
          }
        }
      }
    } catch (error) {
      console.error('[prayer-memory] hydration error:', error);
    }
    setHydrated(true);
  }, [walletAddress]);

  const hasConsent = consentState === 'granted';
  const needsConsentPrompt = hydrated && consentState === null;

  const grantConsent = useCallback(() => {
    setConsentState('granted');
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(consentKey(walletAddress), 'granted');
    } catch (error) {
      console.error('[prayer-memory] consent save error:', error);
    }
  }, [walletAddress]);

  const revokeConsent = useCallback(() => {
    setConsentState('denied');
    setEntries([]);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(consentKey(walletAddress), 'denied');
      localStorage.removeItem(journalKey(walletAddress));
    } catch (error) {
      console.error('[prayer-memory] revoke error:', error);
    }
  }, [walletAddress]);

  const addEntry = useCallback(
    (feelingKey: FeelingKey) => {
      if (consentState !== 'granted') return;
      const entry: JournalEntry = {
        date: todayString(),
        feelingKey,
        timeOfDay: getTimeOfDay(),
      };
      setEntries((prev) => {
        // Don't duplicate for the same day
        const withoutToday = prev.filter((e) => e.date !== entry.date);
        const next = [...withoutToday, entry].slice(-MAX_ENTRIES);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(journalKey(walletAddress), JSON.stringify(next));
          } catch (error) {
            console.error('[prayer-memory] save error:', error);
          }
        }
        return next;
      });
    },
    [consentState, walletAddress],
  );

  const getLastEntry = useCallback((): JournalEntry | null => {
    if (entries.length === 0) return null;
    return entries[entries.length - 1];
  }, [entries]);

  const getRecentFeelings = useCallback(
    (count = 7): JournalEntry[] => {
      return entries.slice(-count);
    },
    [entries],
  );

  const getDaysSinceLastPrayer = useCallback((): number | null => {
    if (entries.length === 0) return null;
    const last = entries[entries.length - 1];
    const lastDate = new Date(last.date + 'T00:00:00');
    const today = new Date(todayString() + 'T00:00:00');
    return Math.round((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
  }, [entries]);

  const getFeelingFrequency = useCallback(
    (days = 7): Record<string, number> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

      const freq: Record<string, number> = {};
      for (const entry of entries) {
        if (entry.date >= cutoffStr) {
          freq[entry.feelingKey] = (freq[entry.feelingKey] ?? 0) + 1;
        }
      }
      return freq;
    },
    [entries],
  );

  const localStreak = useMemo(() => computeLocalStreak(entries), [entries]);

  return {
    entries,
    consentState,
    hasConsent,
    needsConsentPrompt,
    hydrated,
    grantConsent,
    revokeConsent,
    addEntry,
    getLastEntry,
    getRecentFeelings,
    getDaysSinceLastPrayer,
    getFeelingFrequency,
    localStreak,
  };
}
