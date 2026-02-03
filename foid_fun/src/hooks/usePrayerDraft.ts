'use client';

import { useEffect, useState } from 'react';

const DRAFT_KEY = 'foid-prayer-draft';
const DRAFT_TIMESTAMP_KEY = 'foid-prayer-draft-timestamp';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PrayerDraft {
  text: string;
  timestamp: number;
}

export function usePrayerDraft() {
  const [draft, setDraft] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  // Initialize on client
  useEffect(() => {
    setIsClient(true);

    // Load draft from localStorage
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      const savedTimestamp = localStorage.getItem(DRAFT_TIMESTAMP_KEY);

      if (savedDraft && savedTimestamp) {
        const timestamp = parseInt(savedTimestamp, 10);
        const age = Date.now() - timestamp;

        // Only restore if less than 24 hours old
        if (age < DRAFT_EXPIRY_MS) {
          setDraft(savedDraft);
        } else {
          // Clear expired draft
          localStorage.removeItem(DRAFT_KEY);
          localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading prayer draft:', error);
    }
  }, []);

  // Save draft to localStorage (debounced via effect)
  const saveDraft = (text: string) => {
    setDraft(text);

    if (!isClient) return;

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
  };

  // Clear draft (call after successful submission)
  const clearDraft = () => {
    setDraft('');

    if (!isClient) return;

    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error clearing prayer draft:', error);
    }
  };

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: Boolean(draft.trim()),
  };
}
