'use client';

import { useCallback, useEffect, useState } from 'react';

const DRAFT_KEY = 'foid-prayer-draft';
const DRAFT_TIMESTAMP_KEY = 'foid-prayer-draft-timestamp';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function usePrayerDraft() {
  const [draft, setDraft] = useState<string>('');

  // Initialize on client
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      const savedTimestamp = localStorage.getItem(DRAFT_TIMESTAMP_KEY);

      if (savedDraft && savedTimestamp) {
        const timestamp = parseInt(savedTimestamp, 10);
        const age = Date.now() - timestamp;

        if (age < DRAFT_EXPIRY_MS) {
          setDraft(savedDraft);
        } else {
          localStorage.removeItem(DRAFT_KEY);
          localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading prayer draft:', error);
    }
  }, []);

  const saveDraft = useCallback((text: string) => {
    setDraft(text);
    if (typeof window === 'undefined') return;
    try {
      if (text.trim()) {
        localStorage.setItem(DRAFT_KEY, text);
        localStorage.setItem(DRAFT_TIMESTAMP_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
      }
    } catch (error) {
      console.error('Error saving prayer draft:', error);
    }
  }, []);

  const clearDraft = useCallback(() => {
    setDraft('');
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error clearing prayer draft:', error);
    }
  }, []);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: Boolean(draft.trim()),
  };
}
