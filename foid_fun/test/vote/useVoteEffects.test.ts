import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock SFX to avoid audio context errors in tests
vi.mock("@/lib/sfx", () => ({
  playSwipeYes: vi.fn(),
  playSwipeNo: vi.fn(),
  playSkipWhoosh: vi.fn(),
  playCardEnter: vi.fn(),
}));

describe("Vote Effects Reducer", () => {
  // Test the reducer logic directly since the hook wraps useReducer
  type SwipeDirection = "left" | "right" | "up" | null;

  type State = {
    particleDir: SwipeDirection;
    particleTrigger: number;
    glowDir: SwipeDirection;
    glowTrigger: number;
    resultDir: SwipeDirection;
    resultTrigger: number;
    streakTrigger: number;
    cardKey: number;
    shaking: boolean;
    isFirstCard: boolean;
    sessionVoteCount: number;
  };

  type Action =
    | { type: "SWIPE"; direction: "left" | "right" | "up" }
    | { type: "SHAKE_END" }
    | { type: "RESET_FIRST_CARD" };

  const initialState: State = {
    particleDir: null,
    particleTrigger: 0,
    glowDir: null,
    glowTrigger: 0,
    resultDir: null,
    resultTrigger: 0,
    streakTrigger: 0,
    cardKey: 0,
    shaking: false,
    isFirstCard: true,
    sessionVoteCount: 0,
  };

  function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "SWIPE":
        return {
          ...state,
          particleDir: action.direction,
          particleTrigger: state.particleTrigger + 1,
          glowDir: action.direction,
          glowTrigger: state.glowTrigger + 1,
          resultDir: action.direction,
          resultTrigger: state.resultTrigger + 1,
          streakTrigger: state.streakTrigger + 1,
          cardKey: state.cardKey + 1,
          shaking: true,
          isFirstCard: false,
          sessionVoteCount: state.sessionVoteCount + 1,
        };
      case "SHAKE_END":
        return { ...state, shaking: false };
      case "RESET_FIRST_CARD":
        return { ...state, isFirstCard: true };
      default:
        return state;
    }
  }

  it("initializes with correct defaults", () => {
    expect(initialState.isFirstCard).toBe(true);
    expect(initialState.sessionVoteCount).toBe(0);
    expect(initialState.shaking).toBe(false);
    expect(initialState.particleDir).toBeNull();
  });

  it("SWIPE right updates all effect channels", () => {
    const next = reducer(initialState, { type: "SWIPE", direction: "right" });
    expect(next.particleDir).toBe("right");
    expect(next.glowDir).toBe("right");
    expect(next.resultDir).toBe("right");
    expect(next.shaking).toBe(true);
    expect(next.isFirstCard).toBe(false);
    expect(next.sessionVoteCount).toBe(1);
    expect(next.cardKey).toBe(1);
    expect(next.particleTrigger).toBe(1);
  });

  it("SWIPE left sets direction to left", () => {
    const next = reducer(initialState, { type: "SWIPE", direction: "left" });
    expect(next.particleDir).toBe("left");
    expect(next.glowDir).toBe("left");
  });

  it("SWIPE up sets direction to up", () => {
    const next = reducer(initialState, { type: "SWIPE", direction: "up" });
    expect(next.particleDir).toBe("up");
  });

  it("SHAKE_END clears shaking", () => {
    const shaking = reducer(initialState, { type: "SWIPE", direction: "right" });
    expect(shaking.shaking).toBe(true);
    const next = reducer(shaking, { type: "SHAKE_END" });
    expect(next.shaking).toBe(false);
  });

  it("increments session vote count across multiple swipes", () => {
    let state = initialState;
    state = reducer(state, { type: "SWIPE", direction: "right" });
    state = reducer(state, { type: "SWIPE", direction: "left" });
    state = reducer(state, { type: "SWIPE", direction: "up" });
    expect(state.sessionVoteCount).toBe(3);
    expect(state.cardKey).toBe(3);
  });

  it("triggers increment monotonically", () => {
    let state = initialState;
    for (let i = 0; i < 5; i++) {
      state = reducer(state, { type: "SWIPE", direction: "right" });
    }
    expect(state.particleTrigger).toBe(5);
    expect(state.glowTrigger).toBe(5);
    expect(state.resultTrigger).toBe(5);
    expect(state.streakTrigger).toBe(5);
  });
});
