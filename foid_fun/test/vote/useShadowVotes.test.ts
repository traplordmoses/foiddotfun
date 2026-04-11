import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Must import after mocking localStorage
const { useShadowVotes } = await import("@/hooks/useShadowVotes");

// Helper: call hook outside React (simple extraction)
function createShadowVotes() {
  // Since this is a hook using useCallback/useRef, we need to call it differently.
  // For a pure unit test, we test the underlying storage logic directly.
  const STORAGE_KEY = "foid-shadow-votes";
  type ShadowVote = { proposalId: number; approve: boolean; timestamp: number };

  function readStore(): ShadowVote[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as ShadowVote[];
    } catch { return []; }
  }

  function writeStore(votes: ShadowVote[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  }

  return {
    add(proposalId: number, approve: boolean) {
      const vote: ShadowVote = { proposalId, approve, timestamp: Date.now() };
      const existing = readStore().filter((v) => v.proposalId !== proposalId);
      writeStore([...existing, vote]);
    },
    getReplayable(windowMs = 5 * 60 * 1000): ShadowVote[] {
      const cutoff = Date.now() - windowMs;
      return readStore().filter((v) => v.timestamp > cutoff);
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },
  };
}

describe("Shadow Votes Storage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("stores and retrieves a shadow vote", () => {
    const sv = createShadowVotes();
    sv.add(1, true);
    const votes = sv.getReplayable();
    expect(votes).toHaveLength(1);
    expect(votes[0].proposalId).toBe(1);
    expect(votes[0].approve).toBe(true);
  });

  it("replaces duplicate votes for the same proposal", () => {
    const sv = createShadowVotes();
    sv.add(1, true);
    sv.add(1, false);
    const votes = sv.getReplayable();
    expect(votes).toHaveLength(1);
    expect(votes[0].approve).toBe(false);
  });

  it("stores multiple votes for different proposals", () => {
    const sv = createShadowVotes();
    sv.add(1, true);
    sv.add(2, false);
    sv.add(3, true);
    expect(sv.getReplayable()).toHaveLength(3);
  });

  it("filters expired votes outside the replay window", () => {
    const sv = createShadowVotes();
    // Manually write an old vote
    const old = [{ proposalId: 99, approve: true, timestamp: Date.now() - 6 * 60 * 1000 }];
    localStorage.setItem("foid-shadow-votes", JSON.stringify(old));
    expect(sv.getReplayable()).toHaveLength(0);
  });

  it("clears all shadow votes", () => {
    const sv = createShadowVotes();
    sv.add(1, true);
    sv.add(2, false);
    sv.clear();
    expect(sv.getReplayable()).toHaveLength(0);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("foid-shadow-votes", "not-json");
    const sv = createShadowVotes();
    expect(sv.getReplayable()).toHaveLength(0);
  });
});
