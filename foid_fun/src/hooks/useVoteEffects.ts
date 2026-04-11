"use client";

import { useCallback, useReducer } from "react";
import type { SwipeDirection } from "@/types/vote";
import {
  playSwipeYes,
  playSwipeNo,
  playSkipWhoosh,
  playCardEnter,
} from "@/lib/sfx";

type VoteEffectsState = {
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

type VoteEffectsAction =
  | { type: "SWIPE"; direction: "left" | "right" | "up" }
  | { type: "SHAKE_END" }
  | { type: "RESET_FIRST_CARD" };

const initialState: VoteEffectsState = {
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

function reducer(state: VoteEffectsState, action: VoteEffectsAction): VoteEffectsState {
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

export type VoteEffects = {
  particle: { direction: SwipeDirection; trigger: number };
  glow: { direction: SwipeDirection; trigger: number };
  result: { direction: SwipeDirection; trigger: number };
  streakTrigger: number;
  cardKey: number;
  shaking: boolean;
  isFirstCard: boolean;
  sessionVoteCount: number;
  fireSwipe: (dir: "left" | "right" | "up") => void;
};

export function useVoteEffects(): VoteEffects {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fireSwipe = useCallback((dir: "left" | "right" | "up") => {
    if (dir === "right") playSwipeYes();
    else if (dir === "left") playSwipeNo();
    else playSkipWhoosh();

    dispatch({ type: "SWIPE", direction: dir });
    setTimeout(() => dispatch({ type: "SHAKE_END" }), 150);
    setTimeout(() => playCardEnter(), 350);
  }, []);

  return {
    particle: { direction: state.particleDir, trigger: state.particleTrigger },
    glow: { direction: state.glowDir, trigger: state.glowTrigger },
    result: { direction: state.resultDir, trigger: state.resultTrigger },
    streakTrigger: state.streakTrigger,
    cardKey: state.cardKey,
    shaking: state.shaking,
    isFirstCard: state.isFirstCard,
    sessionVoteCount: state.sessionVoteCount,
    fireSwipe,
  };
}
