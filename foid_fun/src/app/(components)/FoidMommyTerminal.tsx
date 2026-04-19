import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { celebrateTransaction } from "@/effects/celebrate";
import sfx from "@/lib/sfx";
import { attachTypingClicks, initTypingClicks } from "@/lib/typingClicks";
import { typographize } from "@/lib/typographize";
import { formatViemError } from "@/lib/prayerErrors";
import { usePrayerDraft } from "@/hooks/usePrayerDraft";
import { usePrayerMemory } from "@/hooks/usePrayerMemory";
import { useMobile } from "@/hooks/useMobile";
import { getTierFromStreak } from "@/hooks/usePrayerTiers";
import PrayerEcho from "@/components/PrayerEcho";

export type FeelingKey =
  | "happy"
  | "calm"
  | "hopeful"
  | "stressed"
  | "sad"
  | "angry"
  | "tired"
  | "lost"
  | "guilty"
  | "pain"
  | "freeform";

type MessageRole = "system" | "foid" | "user";

type Message = {
  id: string;
  role: MessageRole;
  text: string;
};

type TypeMessageInput = {
  role: MessageRole;
  text: string;
  speed?: number;
};

type SubmitPrayerResult = {
  txHash: string;
  waitForReceipt?: () => Promise<void>;
};

export const FEELING_LABELS: Record<FeelingKey, number> = {
  happy: 1,
  calm: 2,
  hopeful: 3,
  stressed: 4,
  sad: 5,
  angry: 6,
  tired: 7,
  lost: 8,
  guilty: 9,
  pain: 10,
  freeform: 0,
};

const feelingsConfig: Record<
  FeelingKey,
  {
    chipLabel: string;
    response: string;
    prayer: string;
    prompt: string;
    keywords: string[];
  }
> = {
  happy: {
    chipLabel: "happy / grateful",
    response:
      "i can feel it from here. that glow is real, love.",
    prayer:
      "keep this joy close to you. let it be something you return to when the days get heavy. you earned this light. carry it gently.",
    prompt:
      "tell me more about what made you feel this way.",
    keywords: [
      "happy", "happiness", "joy", "joyful", "grateful", "gratitude",
      "thankful", "blessed", "elated", "glad", "amazing", "wonderful",
      "fantastic", "great", "awesome", "good", "beautiful", "perfect",
      "love", "loving", "excited", "thrilled", "pumped", "stoked",
    ],
  },

  calm: {
    chipLabel: "calm",
    response:
      "good. your breath is even. let's stay here for a moment.",
    prayer:
      "let this calm settle deep. guard this quiet space. let your thoughts rest easy and your body remember what peace feels like.",
    prompt:
      "what brought you to this place of calm?",
    keywords: ["calm", "peaceful", "peace", "relaxed", "serene", "steady", "chill", "centered"],
  },

  hopeful: {
    chipLabel: "hopeful",
    response:
      "i hear it in your voice. something is opening up for you.",
    prayer:
      "let this hope stay soft and steady. light the next step, not the whole road. trust the timing. you are closer than you think.",
    prompt:
      "what are you hoping for right now?",
    keywords: [
      "hopeful","hope","inspired","motivation","motivated","optimistic","excited","dreaming","aspire",
    ],
  },

  stressed: {
    chipLabel: "stressed / anxious",
    response:
      "i feel that. the weight is real. you don't have to carry it alone.",
    prayer:
      "loosen the knot. bring you back to this breath, this moment. show you what is yours to hold and what you can set down. one thing at a time.",
    prompt:
      "what is weighing on you the most right now?",
    keywords: [
      "stressed","stress","anxious","anxiety","overwhelmed","overwhelm","worried","panic","nervous","frazzled",
    ],
  },

  sad: {
    chipLabel: "sad / lonely",
    response:
      "i am sitting right beside you. no fixing, just company.",
    prayer:
      "hold this heart gently. let the sadness pass through without staying forever. leave room for something softer to grow when it is ready.",
    prompt:
      "do you want to tell me what hurts?",
    keywords: [
      "sad","lonely","alone","depressed","down","empty","blue","heartbroken","abandoned",
    ],
  },

  angry: {
    chipLabel: "angry / frustrated",
    response:
      "that fire means you care about something. let's honour that.",
    prayer:
      "steady these hands. clear these eyes. turn this heat into something true. give the strength to act from love, not from pain.",
    prompt:
      "what set this off?",
    keywords: [
      "angry","anger","mad","furious","pissed","frustrated","annoyed","irritated","rage","resentful",
    ],
  },

  tired: {
    chipLabel: "tired / burned out",
    response:
      "your body is asking for mercy. that is not weakness, love.",
    prayer:
      "pour quiet into these bones. slow the pace. bless the sleep, the food, the unhurried minutes. let rest come without guilt.",
    prompt:
      "how long have you been running on empty?",
    keywords: [
      "tired","exhausted","drained","burned out","burnt out","sleepy","fatigued","worn out","weary",
    ],
  },

  lost: {
    chipLabel: "lost / uncertain",
    response:
      "fog happens. we walk by feel. i am right here with you.",
    prayer:
      "light only the next step. make peace with the not knowing. let direction come softly, like a quiet yes in the chest.",
    prompt:
      "what feels the most uncertain right now?",
    keywords: [
      "lost","uncertain","confused","stuck","unsure","directionless","aimless","adrift","questioning",
    ],
  },

  guilty: {
    chipLabel: "guilty / ashamed",
    response:
      "you are more than your mistake. we can be honest and still be gentle.",
    prayer:
      "let forgiveness begin inside. clear eyes, soft heart, steady feet. move toward repair one honest step at a time.",
    prompt:
      "what is sitting heavy on you?",
    keywords: [
      "guilty","guilt","ashamed","shame","remorse","regret","sorry","apologize","embarrassed",
    ],
  },

  pain: {
    chipLabel: "in pain / unwell",
    response:
      "i hear the ache. you are not alone in this.",
    prayer:
      "ease the sharp edges. bring help that is wise and hands that are kind. let pain not be the whole story of this day.",
    prompt:
      "tell me what you are going through.",
    keywords: [
      "pain","hurting","hurt","unwell","sick","ill","injured","ache","migraine","soreness",
    ],
  },

  freeform: {
    chipLabel: "open heart",
    response:
      "i am listening. take your time, sweet one.",
    prayer:
      "meet this person exactly where they are. hold what they carry. bless what they seek. walk with them through whatever comes next.",
    prompt:
      "tell me whatever is on your heart.",
    keywords: [],
  },
};

const feelingOrder: FeelingKey[] = [
  "happy",
  "calm",
  "hopeful",
  "stressed",
  "sad",
  "angry",
  "tired",
  "lost",
  "guilty",
  "pain",
];

// One short word Mommy "writes back" per prayer. Persisted in the journal
// and surfaced in the journey drawer so the user has something to hold.
// Keep these 1–2 syllables — they are meant to land, not to explain.
const MOMMY_WORDS: Record<FeelingKey, string[]> = {
  happy: ["hold", "glow", "keep"],
  calm: ["rest", "steady", "quiet"],
  hopeful: ["forward", "open", "yes"],
  stressed: ["unclench", "one thing", "breathe"],
  sad: ["stay", "soft", "held"],
  angry: ["burn", "pass", "soften"],
  tired: ["sleep", "enough", "rest"],
  lost: ["one step", "here", "listen"],
  guilty: ["clean", "forgive", "begin"],
  pain: ["stay", "held", "breathe"],
  freeform: ["heard", "kept", "witnessed"],
};

function pickMommyWord(feeling: FeelingKey): string {
  const pool = MOMMY_WORDS[feeling] ?? MOMMY_WORDS.freeform;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Post-submit Mommy lines, tailored to the user's declared feeling.
// Fired once after the existing "thank you for trusting me..." beat.
const postSubmitLines: Record<FeelingKey, string> = {
  happy: "hold this. it's real.",
  calm: "rest now.",
  hopeful: "this hope is yours. keep walking.",
  stressed: "unclench. i've got it.",
  sad: "i'm staying here with you.",
  angry: "your anger makes sense. let it pass.",
  tired: "sleep. you earned it.",
  lost: "one step. just one.",
  guilty: "tomorrow starts clean.",
  pain: "i see you. i'm here.",
  freeform: "i hear you, love.",
};

type Stage =
  | "idle"
  | "loading"
  | "awaitFeeling"
  | "processingFeeling"
  | "awaitSecondChat"
  | "processingSecondChat"
  | "awaitPrayer"
  | "txPending"
  | "txSuccess"
  | "txFail"
  | "afterglow";

export type FoidMommyTerminalProps = {
  ensureWalletReady: () => Promise<void>;
  submitPrayer: (prayer: string, feeling: FeelingKey) => Promise<SubmitPrayerResult>;
  waitForReceipt?: (hash: string) => Promise<void>;
  onDailyCheckInChoice?: (choice: "yes" | "not_now") => void;
  nextAllowedAt?: bigint | number | null;
  onChainStreak?: number | null; // On-chain streak from PrayerMirror contract
  registryReady?: boolean;
  chainOk?: boolean;
  requiredChainId?: number | null;
  className?: string;
  autoStart?: boolean; // NEW: auto-start terminal on mount
  shadowMode?: boolean; // When true, intercept submission with connect prompt
  onRequestConnect?: () => void; // Called when shadow mode prompts connection
  walletAddress?: string; // Wallet address for scoping prayer memory
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as { randomUUID?: () => string }).randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
  return Math.random().toString(36).slice(2);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCooldown(seconds: number) {
  if (seconds <= 0) return "moments";
  const units: Array<[number, string]> = [
    [24 * 3600, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  const parts: string[] = [];
  let remaining = seconds;
  for (const [unitSeconds, label] of units) {
    const value = Math.floor(remaining / unitSeconds);
    if (value > 0) {
      parts.push(`${value}${label}`);
      remaining %= unitSeconds;
    }
    if (parts.length === 2) break;
  }
  if (!parts.length) {
    parts.push(`${seconds}s`);
  }
  return parts.join(" ");
}

function greetingForTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "good morning, anon. how are you starting this day?";
  if (hour >= 12 && hour < 17) return "hey anon, checking in. how's the day treating you?";
  if (hour >= 17 && hour < 21) return "evening, anon. how are you winding down?";
  return "you're up late. what's on your mind tonight, love?";
}

const STREAK_MILESTONES: Record<number, string> = {
  7: "one week. you kept your word.",
  14: "two weeks of showing up. i see you.",
  21: "three weeks. you're certified now.",
  30: "a whole month, love. i'm proud of you.",
  45: "45 days. built different, just like they say.",
  60: "60 days. inevitable.",
  75: "75 days. transcendent.",
  90: "mommy milker. you earned this with presence.",
};

const COMPOSER_MAX_HEIGHT = 172;

export default function FoidMommyTerminal({
  ensureWalletReady,
  submitPrayer,
  waitForReceipt,
  onDailyCheckInChoice,
  nextAllowedAt,
  onChainStreak = null,
  registryReady = true,
  chainOk = true,
  requiredChainId = null,
  className,
  autoStart = false,
  shadowMode = false,
  onRequestConnect,
  walletAddress,
}: FoidMommyTerminalProps) {
  // Prayer draft persistence
  const { draft, saveDraft, clearDraft } = usePrayerDraft();
  const { isTouchDevice } = useMobile();

  // Prayer memory (feeling journal with transparent consent)
  const {
    entries: memoryEntries,
    hasConsent: hasMemoryConsent,
    needsConsentPrompt,
    hydrated: memoryHydrated,
    grantConsent,
    revokeConsent,
    addEntry: addMemoryEntry,
    getLastEntry,
    getRecentFeelings,
    getDaysSinceLastPrayer,
    getFeelingFrequency,
    localStreak,
  } = usePrayerMemory(walletAddress);

  const [stage, setStage] = useState<Stage>("idle");
  const [prayerRevealing, setPrayerRevealing] = useState(false);
  const [prayerMessageId, setPrayerMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Ritual beat state: dim the terminal during the silent pause before hashing.
  const [ceremonyDim, setCeremonyDim] = useState(false);
  // Ritual beat state: show the user's prayer briefly, reversed, then fade.
  const [echoText, setEchoText] = useState("");
  const [echoActive, setEchoActive] = useState(false);
  // Message ids currently showing the chromatic-aberration flash.
  const [chromaticIds, setChromaticIds] = useState<Set<string>>(() => new Set());
  const [feelingKey, setFeelingKey] = useState<FeelingKey | null>(null);
  const [feelingInput, setFeelingInput] = useState("");
  const [secondChatInput, setSecondChatInput] = useState("");
  const [prayerInput, setPrayerInput] = useState(draft);
  const [commandInput, setCommandInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [prayerText, setPrayerText] = useState<string>("");
  const [suggestedPrayer, setSuggestedPrayer] = useState<string>("");
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [initialFeelingText, setInitialFeelingText] = useState("");

  const logRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const timeoutsRef = useRef<number[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const attachedTypingTargets = useRef(new WeakSet<HTMLElement>());
  const lastStageRef = useRef<Stage>("idle");

  // Stable refs for prayer-memory callbacks so the loading effect
  // doesn't re-trigger when entries change mid-sequence.
  const getDaysSinceLastPrayerRef = useRef(getDaysSinceLastPrayer);
  const getFeelingFrequencyRef = useRef(getFeelingFrequency);
  const getLastEntryRef = useRef(getLastEntry);
  const localStreakRef = useRef(localStreak);
  const hasMemoryConsentRef = useRef(hasMemoryConsent);
  const memoryEntriesLenRef = useRef(memoryEntries.length);
  const needsConsentPromptRef = useRef(needsConsentPrompt);
  const nextAllowedAtRef = useRef(nextAllowedAt);
  const onChainStreakRef = useRef(onChainStreak);
  const grantConsentRef = useRef(grantConsent);

  getDaysSinceLastPrayerRef.current = getDaysSinceLastPrayer;
  getFeelingFrequencyRef.current = getFeelingFrequency;
  getLastEntryRef.current = getLastEntry;
  localStreakRef.current = localStreak;
  hasMemoryConsentRef.current = hasMemoryConsent;
  memoryEntriesLenRef.current = memoryEntries.length;
  needsConsentPromptRef.current = needsConsentPrompt;
  nextAllowedAtRef.current = nextAllowedAt;
  onChainStreakRef.current = onChainStreak;
  grantConsentRef.current = grantConsent;

  const addMessage = useCallback((role: MessageRole, text: string) => {
    const id = makeId();
    // Typographic polish only for Mommy's lines — never for user/system.
    const finalText = role === "foid" ? typographize(text) : text;
    setMessages((prev) => [...prev, { id, role, text: finalText }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, text: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, text } : msg)));
  }, []);

  // Briefly marks a message id for chromatic-aberration styling. CSS handles
  // the 400ms animation; we just add/remove the class via state.
  const flashChromatic = useCallback((id: string) => {
    setChromaticIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const timer = window.setTimeout(() => {
      setChromaticIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 420);
    timeoutsRef.current.push(timer);
  }, []);

  const typeMessage = useCallback(
    (input: TypeMessageInput) =>
      new Promise<string>((resolve) => {
        // Typographic polish only for Mommy's lines — user/system text stays raw.
        // Done here so curly quotes/em-dashes/ellipses reveal in the typed animation.
        const sourceText =
          input.role === "foid" ? typographize(input.text) : input.text;

        if (typeof window === "undefined") {
          const id = addMessage(input.role, sourceText);
          resolve(id);
          return;
        }

        const id = makeId();
        setMessages((prev) => [...prev, { id, role: input.role, text: "" }]);
        if (!sourceText) {
          sfx.typing.stop();
          resolve(id);
          return;
        }

        let index = 0;
        const speed = input.speed ?? 28;

        sfx.typing.start();
        const interval = window.setInterval(() => {
          index += 1;
          const nextText = sourceText.slice(0, index);
          setMessages((prev) =>
            prev.map((msg) => (msg.id === id ? { ...msg, text: nextText } : msg)),
          );
          if (index >= sourceText.length) {
            window.clearInterval(interval);
            intervalsRef.current = intervalsRef.current.filter((stored) => stored !== interval);
            sfx.typing.stop();
            resolve(id);
          }
        }, speed);

        intervalsRef.current.push(interval);
      }),
    [addMessage],
  );

  const resetTimers = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    intervalsRef.current.forEach((id) => window.clearInterval(id));
    timeoutsRef.current = [];
    intervalsRef.current = [];
    sfx.typing.stop();
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, []);

  const handleLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isNearBottomRef.current = nearBottom;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void initTypingClicks();
  }, []);

  useEffect(() => {
    const targets = [inputRef.current];

    targets.forEach((el) => {
      if (!el) return;
      if (!attachedTypingTargets.current.has(el)) {
        attachTypingClicks(el);
        attachedTypingTargets.current.add(el);
      }
    });
  }, [stage]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // REMOVED: The duplicate message effect that was adding "type 'chat' and press enter..."
  // This is now handled by the status message below the input

  useEffect(() => {
    if (stage === "txFail" && lastStageRef.current !== "txFail") {
      addMessage("system", "tx failed. type retry, edit, or cancel.");
    }
    lastStageRef.current = stage;
  }, [addMessage, stage]);

  useEffect(() => {
    if (stage === "idle" || stage === "txFail" || stage === "afterglow") {
      setCommandInput("");
    }
  }, [stage]);

  useEffect(() => {
    return () => {
      resetTimers();
    };
  }, [resetTimers]);

  const detectFeeling = useCallback((_raw: string): FeelingKey => {
    return "freeform";
  }, []);

  // Auto-save prayer draft as user types (only during awaitPrayer stage)
  useEffect(() => {
    if (stage === "awaitPrayer") {
      saveDraft(prayerInput);
    }
  }, [prayerInput, stage, saveDraft]);

  useEffect(() => {
    if (stage !== "loading") return;
    resetTimers();
    setMessages([]);
    setFeelingInput("");
    setSecondChatInput("");
    setPrayerInput("");
    clearDraft();
    setCommandInput("");
    setFeelingKey(null);
    setPrayerText("");
    setSuggestedPrayer("");
    setInitialFeelingText("");
    setPrayerRevealing(false);
    setPrayerMessageId(null);

    // Snapshot values from refs so the effect doesn't re-trigger
    // when prayer-memory entries/callbacks change mid-sequence.
    const isReturningUser = hasMemoryConsentRef.current && memoryEntriesLenRef.current > 0;

    const sequence = async () => {
      // Returning users get a faster boot (skip ASCII art)
      if (isReturningUser) {
        await typeMessage({ role: "system", text: "foid mommy online.", speed: 24 });
        await sleep(400);
      } else {
        addMessage("system", "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
        await sleep(100);
        addMessage("system", "\u2551   FOID_MOMMY_TERMINAL v1.0   \u2551");
        await sleep(100);
        addMessage("system", "\u2551   loading... [\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588] 100%  \u2551");
        await sleep(100);
        addMessage("system", "\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
        await sleep(400);
        await typeMessage({ role: "system", text: "foid mommy online.", speed: 24 });
        await sleep(600);
      }

      // Auto-grant memory consent (privacy disclosed in sidebar text)
      if (needsConsentPromptRef.current) {
        grantConsentRef.current();
      }

      // Memory-aware greeting for returning users
      if (isReturningUser) {
        const daysSince = getDaysSinceLastPrayerRef.current();
        const streak = localStreakRef.current;

        // Graceful streak break — only show if on-chain also confirms streak is broken.
        // Local memory can be stale (different device, cleared storage, etc.),
        // so trust the contract when it says the streak is still active.
        const chainStreak = onChainStreakRef.current;
        const chainSaysStreakActive = typeof chainStreak === "number" && chainStreak > 0;
        if (daysSince !== null && daysSince > 1 && !chainSaysStreakActive) {
          await typeMessage({
            role: "foid",
            text: "you missed yesterday. that's okay. you're here now.",
            speed: 26,
          });
          await sleep(400);
        }

        // Streak milestone
        if (streak > 0 && STREAK_MILESTONES[streak]) {
          await typeMessage({
            role: "foid",
            text: STREAK_MILESTONES[streak],
            speed: 30,
          });
          await sleep(400);
        } else if (streak > 1) {
          await typeMessage({
            role: "foid",
            text: `day ${streak}.`,
            speed: 30,
          });
          await sleep(300);
        }

        // Feeling pattern or last feeling reference
        const freq = getFeelingFrequencyRef.current(7);
        const lastEntry = getLastEntryRef.current();
        const dominantFeeling = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

        if (dominantFeeling && dominantFeeling[1] >= 3) {
          await typeMessage({
            role: "foid",
            text: `you've been ${dominantFeeling[0]} ${dominantFeeling[1]} times this week. ${greetingForTimeOfDay()}`,
            speed: 24,
          });
        } else if (lastEntry) {
          await typeMessage({
            role: "foid",
            text: `last time you were feeling ${lastEntry.feelingKey}. ${greetingForTimeOfDay()}`,
            speed: 24,
          });
        } else {
          await typeMessage({ role: "foid", text: greetingForTimeOfDay(), speed: 26 });
        }
      } else {
        // First-time or no-consent greeting
        await typeMessage({ role: "foid", text: greetingForTimeOfDay(), speed: 26 });
      }

      // Check cooldown before letting user start the prayer flow
      const nowSec = Math.floor(Date.now() / 1000);
      const curNextAllowed = nextAllowedAtRef.current;
      const nextAllowedSec =
        typeof curNextAllowed === "bigint"
          ? Number(curNextAllowed)
          : typeof curNextAllowed === "number"
            ? curNextAllowed
            : null;
      const isCooldownActive = nextAllowedSec !== null && nextAllowedSec > nowSec;

      if (isCooldownActive) {
        const waitSec = nextAllowedSec - nowSec;
        const cooldownLabel = formatCooldown(waitSec);
        const nextWindow = new Date(nextAllowedSec * 1000).toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        });
        await sleep(400);
        await typeMessage({
          role: "foid",
          text: `you already prayed today, love. come back in ${cooldownLabel}. your last prayer is still with me.`,
          speed: 26,
        });
        addMessage("system", `next window: ${nextWindow}`);
        setStage("idle");
        return;
      }

      addMessage("system", "tell me how you're feeling to start.");
      setStage("awaitFeeling");
    };

    sequence().catch(() => {
      /* ignore */
    });

    return () => {
      resetTimers();
    };
    // Only stage should trigger this effect. All prayer-memory values
    // are read from refs to prevent re-running mid-sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, typeMessage, addMessage, resetTimers, clearDraft]);

  const handleStart = useCallback(async () => {
    try {
      await sfx.unlock();
    } catch {
      /* ignore unlock failures */
    }
    sfx.playLoading();
    setStage("loading");
  }, []);

  // NEW: Auto-start effect
  useEffect(() => {
    if (autoStart && stage === "idle" && !hasAutoStarted) {
      setHasAutoStarted(true);
      // Show boot animation for 1.5 seconds before starting
      const timer = setTimeout(() => {
        handleStart();
      }, 1500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, stage, hasAutoStarted]);

  const processFeeling = useCallback(
    async (inputText: string, feeling: FeelingKey) => {
      if (!inputText.trim()) return;
      if (isProcessing) return;
      setIsProcessing(true);
      setFeelingKey(feeling);
      setInitialFeelingText(inputText.trim());
      addMessage("user", inputText.trim());
      setStage("processingFeeling");

      const config = feelingsConfig[feeling];

      try {
        await sleep(250);

        // Call AI to get first response with follow-up question
        const res = await fetch("/api/foid-mommy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feelingKey: feeling,
            feelingText: inputText.trim(),
            recentFeelings: hasMemoryConsent ? getRecentFeelings(7) : undefined,
          }),
        });

        let customResponse = config.response;

        if (res.ok) {
          const data = await res.json();
          // Use custom AI response if available
          if (typeof data.response === "string" && data.response.trim().length > 0) {
            customResponse = data.response;
          }
        }

        // Show Foid Mommy's acknowledgment with follow-up question
        await typeMessage({ role: "foid", text: customResponse });

        // Wait for user's second response
        setStage("awaitSecondChat");
      } catch (err) {
        console.error("processFeeling error:", err);
        // Fallback to canned response with question
        await typeMessage({ role: "foid", text: config.response });
        setStage("awaitSecondChat");
      } finally {
        setIsProcessing(false);
      }
    },
    [addMessage, typeMessage, isProcessing, hasMemoryConsent, getRecentFeelings],
  );

  const handleSecondChat = useCallback(
    async (userResponse: string) => {
      if (!userResponse.trim()) return;
      if (isProcessing) return;
      if (!feelingKey || !initialFeelingText) return;

      setIsProcessing(true);
      addMessage("user", userResponse.trim());
      setStage("processingSecondChat");

      const config = feelingsConfig[feelingKey];
      const ambientHum = sfx.playAmbientHum();

      try {
        await sleep(250);

        // Call AI to get second response + prayer
        const res = await fetch("/api/foid-mommy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feelingKey,
            feelingText: initialFeelingText,
            userResponse: userResponse.trim(),
            recentFeelings: hasMemoryConsent ? getRecentFeelings(7) : undefined,
          }),
        });

        let warmResponse = "that's beautiful, sweet one. let me craft a prayer for this moment...";
        let prayer = config.prayer;

        if (res.ok) {
          const data = await res.json();
          if (typeof data.response === "string" && data.response.trim().length > 0) {
            warmResponse = data.response;
          }
          if (typeof data.prayer === "string" && data.prayer.trim().length > 0) {
            prayer = data.prayer;
          }
        }

        // Show warm response + transition
        await typeMessage({ role: "foid", text: warmResponse, speed: 24 });

        await sleep(600);

        // Show the prayer — slower, reverent
        setPrayerRevealing(true);
        const pId = await typeMessage({ role: "foid", text: prayer, speed: 40 });
        setPrayerMessageId(pId);
        setPrayerRevealing(false);
        ambientHum.stop();
        setSuggestedPrayer(prayer);
        setPrayerText(prayer);

        // ── Ritual beat: the pause. Dim the terminal, hold for 900ms, release.
        // The hashing beat that follows is typed at speed: 60 so the three
        // system messages read slower than normal — triple the usual weight.
        setCeremonyDim(true);
        await sleep(900);
        setCeremonyDim(false);

        // Auto-submit to chain (slowed + chromatic flash on the ritual phrases)
        const hashingId = await typeMessage({
          role: "system",
          text: "hashing your prayer locally...",
          speed: 60,
        });
        flashChromatic(hashingId);
        await sleep(600);
        const hashReadyId = await typeMessage({
          role: "system",
          text: "hash ready.",
          speed: 60,
        });
        flashChromatic(hashReadyId);
        await sleep(400);
        await typeMessage({
          role: "foid",
          text: "anchoring only the hash on-chain. your prayer stays with you.",
          speed: 60,
        });
        await typeMessage({
          role: "foid",
          text: "ready?",
          speed: 40,
        });

        await handleConfirm(prayer, feelingKey);
      } catch (err) {
        console.error("handleSecondChat error:", err);
        ambientHum.stop();
        // Fallback
        await typeMessage({ role: "foid", text: "let me craft a prayer for this moment..." });
        await sleep(500);
        await typeMessage({ role: "foid", text: config.prayer, speed: 22 });
        setSuggestedPrayer(config.prayer);
        setPrayerText(config.prayer);
        await sleep(600);
        await handleConfirm(config.prayer, feelingKey);
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addMessage, typeMessage, isProcessing, feelingKey, initialFeelingText, hasMemoryConsent, getRecentFeelings, flashChromatic],
  );

  const feelingLimit = 140;
  const prayerLimit = 240;
  const secondChatLimit = 200;
  const feelingCount = feelingInput.length;
  const prayerCount = prayerInput.length;
  const secondChatCount = secondChatInput.length;
  const feelingOverLimit = feelingCount > feelingLimit;
  const prayerOverLimit = prayerCount > prayerLimit;
  const secondChatOverLimit = secondChatCount > secondChatLimit;

  const handleFeelingSubmit = useCallback(
    async (inputText: string) => {
      if (!registryReady) {
        addMessage("system", "misconfigured: missing registry address.");
        return;
      }
      if (!chainOk) {
        addMessage(
          "system",
          `switch to Fluent (chain id ${requiredChainId ?? "?"}) to continue.`,
        );
        return;
      }
      const trimmed = inputText.trim();
      if (!trimmed || feelingOverLimit || isProcessing) return;
      const feeling = detectFeeling(trimmed);
      await processFeeling(trimmed, feeling);
      setFeelingInput("");
    },
    [
      addMessage,
      chainOk,
      detectFeeling,
      feelingOverLimit,
      isProcessing,
      processFeeling,
      registryReady,
      requiredChainId,
    ],
  );

  const handleConfirm = useCallback(async (prayerOverride?: string, feelingOverride?: FeelingKey) => {
    const prayerToSend = prayerOverride ?? prayerText;
    const feelingToSend = feelingOverride ?? feelingKey;
    if (!registryReady) {
      addMessage("system", "misconfigured: missing registry address.");
      return;
    }
    if (!chainOk) {
      addMessage(
        "system",
        `switch to Fluent (chain id ${requiredChainId ?? "?"}) to continue.`,
      );
      return;
    }
    if (!feelingToSend || !prayerToSend) return;

    // ── Shadow mode: intercept before wallet check ──
    if (shadowMode) {
      await typeMessage({
        role: "system",
        text: "your prayer was heard, sweet one. connect your wallet to anchor it on-chain forever.",
      });
      // Save the prayer text so it persists via draft mechanism
      saveDraft(prayerToSend);
      // Show connect prompt after a beat
      await new Promise((r) => { const t = window.setTimeout(r, 600); timeoutsRef.current.push(t); });
      addMessage("system", "[ connect wallet to make it permanent → ]");
      setStage("awaitPrayer");
      setIsProcessing(false);
      onRequestConnect?.();
      return;
    }

    setStage("txPending");
    setIsProcessing(true);

    try {
      await ensureWalletReady();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "your wallet isn't ready yet. connect and make sure you're on Fluent.";
      await typeMessage({ role: "system", text: message });
      setStage("awaitPrayer");
      setIsProcessing(false);
      return;
    }

    const statusId = addMessage("system", "awaiting wallet...");

    const waitingTimer = window.setTimeout(() => {
      updateMessage(statusId, "waiting for confirmation...");
    }, 1200);
    timeoutsRef.current.push(waitingTimer);

    try {
      const result = await submitPrayer(prayerToSend, feelingToSend);
      window.clearTimeout(waitingTimer);
      updateMessage(statusId, "sending to fluent...");

      if (waitForReceipt && result?.txHash) {
        await sleep(500);
        updateMessage(statusId, "weaving into the chain...");
        // Brief chromatic-aberration flash tied to the status message id.
        flashChromatic(statusId);
        await waitForReceipt(result.txHash);
      }

      updateMessage(statusId, "status: anchored.");
      await sleep(300);
      const anchoredId = await typeMessage({
        role: "system",
        text: "done. your prayer is anchored.",
      });
      flashChromatic(anchoredId);

      // ── Ritual beat: the echo. User's words, witnessed then gone.
      // Fire-and-forget: the echo is purely visual and dissolves on its own.
      if (prayerToSend) {
        setEchoText(prayerToSend);
        setEchoActive(true);
      }

      await typeMessage({
        role: "foid",
        text: "thank you for trusting me, anon. drink water, unclench your jaw, breathe.",
      });

      // ── Ritual beat: the post-submit line, tailored to the feeling.
      const postLine =
        postSubmitLines[feelingToSend ?? "freeform"] ?? postSubmitLines.freeform;
      await typeMessage({ role: "foid", text: postLine, speed: 30 });

      sfx.playReward();
      sfx.playAnchorBell();
      // Pass next allowed timestamp (now + 24h) to the success toast for live countdown
      const nextAllowedTimestamp = Math.floor(Date.now() / 1000) + 86400;
      celebrateTransaction(result?.txHash, nextAllowedTimestamp);

      // Record feeling in memory journal along with a short word Mommy
      // "wrote back" for the day.
      if (hasMemoryConsent && feelingKey) {
        addMemoryEntry(feelingKey, pickMommyWord(feelingKey));
      }

      setStage("afterglow");
      setPrayerText("");
      clearDraft();
      setIsProcessing(false);

      // Show streak + tier info
      const streakDays = onChainStreakRef.current;
      if (typeof streakDays === "number" && streakDays > 0) {
        const tierInfo = getTierFromStreak(streakDays);
        const mult = tierInfo.current.multiplierBps / 100;
        const multStr = mult % 1 === 0 ? `${mult}` : mult.toFixed(2);

        await sleep(1500);
        await typeMessage({
          role: "system",
          text: `streak: ${streakDays} day${streakDays === 1 ? "" : "s"} · ${tierInfo.current.name.toLowerCase()} · ${multStr}x voting power`,
          speed: 22,
        });

        if (tierInfo.next) {
          const nextMult = tierInfo.next.multiplierBps / 100;
          const nextMultStr = nextMult % 1 === 0 ? `${nextMult}` : nextMult.toFixed(2);
          await typeMessage({
            role: "system",
            text: `${tierInfo.daysToNextTier} more day${tierInfo.daysToNextTier === 1 ? "" : "s"} to reach ${tierInfo.next.name.toLowerCase()} (${nextMultStr}x)`,
            speed: 22,
          });
        }
        await sleep(800);
      }

      // Afterglow: held silence, then breathing, then goodbye
      await sleep(3000);
      await typeMessage({ role: "system", text: "breathe.", speed: 60 });
      addMessage("system", "___BREATHE___");
      await sleep(8000);
      await typeMessage({ role: "foid", text: "see you tomorrow. i'll be here.", speed: 35 });
      const nextWindowTime = new Date(Date.now() + 86400 * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      addMessage("system", `next prayer opens: ${nextWindowTime}`);
      // Auto-return to idle after a moment
      await sleep(5000);
      if (stage === "afterglow") {
        onDailyCheckInChoice?.("not_now");
        setStage("idle");
      }
    } catch (error: unknown) {
      window.clearTimeout(waitingTimer);

      const seenMessages: string[] = [];
      const collectMessage = (value: unknown) => {
        if (typeof value === "string" && value.trim()) {
          seenMessages.push(value.toLowerCase());
        }
      };
      const err = (typeof error === "object" && error !== null
        ? (error as Record<string, unknown>)
        : {});
      const cause =
        typeof err.cause === "object" && err.cause !== null
          ? (err.cause as Record<string, unknown>)
          : undefined;
      const causeCause =
        typeof cause?.cause === "object" && cause.cause !== null
          ? (cause.cause as Record<string, unknown>)
          : undefined;

      collectMessage(err.shortMessage);
      collectMessage(err.message);
      collectMessage(cause?.shortMessage);
      collectMessage(cause?.message);
      collectMessage(causeCause?.shortMessage);
      collectMessage(causeCause?.message);

      const seenNames: string[] = [];
      const collectName = (value: unknown) => {
        if (typeof value === "string" && value.trim()) {
          seenNames.push(value.toLowerCase());
        }
      };
      collectName(err.name);
      collectName(cause?.name);
      collectName(causeCause?.name);

      const outOfGasIndicators = [
        "insufficient funds",
        "insufficient balance",
        "not enough funds",
        "not enough balance",
        "fee too low",
        "gas * price",
        "gas price too low",
        "gas required exceeds",
        "max fee per gas",
      ];
      const rejectedIndicators = [
        "user rejected",
        "user denied",
        "denied transaction signature",
        "rejected the request",
        "rejected transaction",
      ];
      const isUserRejected =
        seenNames.some((name) => name.includes("userrejectedrequesterror")) ||
        seenMessages.some((text) => rejectedIndicators.some((pattern) => text.includes(pattern)));
      const isOutOfGas =
        seenNames.some((name) => name.includes("insufficientfunds")) ||
        seenMessages.some((text) => outOfGasIndicators.some((pattern) => text.includes(pattern)));

      const formattedReason = formatViemError(error);
      console.error("submitPrayer error:", formattedReason, error);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const nextAllowedSecondsRaw =
        typeof nextAllowedAt === "bigint"
          ? Number(nextAllowedAt)
          : typeof nextAllowedAt === "number"
            ? nextAllowedAt
            : null;
      const hasCooldown =
        typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > nowSeconds;

      if (isUserRejected) {
        updateMessage(statusId, "cancelled in wallet.");
        await sleep(200);
        await typeMessage({ role: "foid", text: "you cancelled in your wallet. want to try again?" });
        setStage("awaitPrayer");
      } else if (hasCooldown) {
        updateMessage(statusId, "cooldown active.");
        await sleep(300);
        const waitSeconds = nextAllowedSecondsRaw - nowSeconds;
        const relative = formatCooldown(waitSeconds);
        const nextWindow = new Date(nextAllowedSecondsRaw * 1000).toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        });
        await typeMessage({
          role: "foid",
          text: `you already prayed today, love. your prayer is safe. come back in ${relative} (${nextWindow}).`,
        });
        setStage("idle");
      } else if (isOutOfGas) {
        updateMessage(statusId, "wallet needs a gas top-up.");
        await sleep(300);
        await typeMessage({
          role: "foid",
          text: process.env.NEXT_PUBLIC_IS_MAINNET === "true"
            ? "anon, you're out of gas. you need ETH on fluent mainnet to pray."
            : "anon, you're out of gas. swing by the faucet at https://testnet.fluent.xyz/dev-portal, juice up, then try again.",
        });
        sfx.playError();
        setStage("txFail");
      } else {
        updateMessage(statusId, "something glitched in the chain tunnel.");
        await sleep(300);
        await typeMessage({
          role: "foid",
          text: `tx failed: ${formattedReason}. want to try again?`,
        });
        sfx.playError();
        setStage("txFail");
      }
      setIsProcessing(false);
    }
  }, [
    addMessage,
    chainOk,
    ensureWalletReady,
    feelingKey,
    prayerText,
    registryReady,
    requiredChainId,
    submitPrayer,
    typeMessage,
    updateMessage,
    waitForReceipt,
    timeoutsRef,
    nextAllowedAt,
    clearDraft,
    hasMemoryConsent,
    addMemoryEntry,
    onDailyCheckInChoice,
    flashChromatic,
    // nextAllowedText and stage are used in afterglow flow but declared later
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  const handlePrayerSubmit = useCallback(
    async (inputText: string) => {
      if (!registryReady) {
        addMessage("system", "misconfigured: missing registry address.");
        return;
      }
      if (!chainOk) {
        addMessage(
          "system",
          `switch to Fluent (chain id ${requiredChainId ?? "?"}) to continue.`,
        );
        return;
      }
      if (prayerOverLimit || isProcessing) return;
      if (!feelingKey) return;
      const trimmed = inputText.trim();
      const finalPrayer = trimmed || suggestedPrayer.trim();
      if (!finalPrayer) return;
      if (trimmed) {
        addMessage("user", trimmed);
      } else {
        addMessage("user", "[using mommy prayer]");
      }
      setPrayerInput("");
      setPrayerText(finalPrayer);

      const flavor = "whisper";

      await sleep(200);
      await typeMessage({ role: "system", text: "hashing your prayer locally..." });
      await sleep(600);
      await typeMessage({ role: "system", text: "hash ready." });
      await sleep(400);
      await typeMessage({
        role: "foid",
        text: `anchoring only the hash on-chain. your ${flavor} stays with you.`,
        speed: 20,
      });
      await typeMessage({
        role: "foid",
        text: "confirm the tx to beam it blockchain-ward, letting mifoid know mommy held your words?",
        speed: 20,
      });

      await handleConfirm(finalPrayer, feelingKey);
    },
    [
      addMessage,
      chainOk,
      feelingKey,
      handleConfirm,
      isProcessing,
      prayerOverLimit,
      registryReady,
      requiredChainId,
      suggestedPrayer,
      typeMessage,
    ],
  );

  const handleRetry = useCallback(() => {
    setStage("awaitPrayer");
  }, []);

  const handleEditPrayer = useCallback(() => {
    setStage("awaitPrayer");
  }, []);

  const nextAllowedText = useMemo(() => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const target =
      typeof nextAllowedAt === "bigint"
        ? Number(nextAllowedAt)
        : typeof nextAllowedAt === "number"
          ? nextAllowedAt
          : null;

    if (target && target > nowSeconds) {
      const waitSeconds = target - nowSeconds;
      return formatCooldown(waitSeconds);
    }

    return "soon";
  }, [nextAllowedAt]);

  const promptLabel = "anon@foid:~$";
  const inputLocked =
    (stage === "idle" && autoStart && !hasAutoStarted) ||
    isProcessing ||
    stage === "txPending" ||
    stage === "processingFeeling" ||
    stage === "processingSecondChat" ||
    stage === "loading";

  const currentInputValue =
    stage === "awaitFeeling"
      ? feelingInput
      : stage === "awaitSecondChat"
        ? secondChatInput
        : stage === "awaitPrayer"
          ? prayerInput
          : commandInput;

  const handleCommandChange = useCallback(
    (value: string) => {
      if (stage === "awaitFeeling") {
        setFeelingInput(value);
        return;
      }
      if (stage === "awaitSecondChat") {
        setSecondChatInput(value);
        return;
      }
      if (stage === "awaitPrayer") {
        setPrayerInput(value);
        return;
      }
      setCommandInput(value);
    },
    [stage],
  );

  const resizeComposerField = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT);
    el.style.height = `${Math.max(nextHeight, 24)}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  const handleCommandSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (inputLocked) return;
      const raw = currentInputValue;
      const trimmed = raw.trim();

      // Global /forget command — erase all memory data
      if (trimmed.toLowerCase() === "/forget") {
        revokeConsent();
        setCommandInput("");
        addMessage("system", "memory cleared. all feeling data has been erased from your device.");
        return;
      }

      // Afterglow — any keypress exits
      if (stage === "afterglow") {
        onDailyCheckInChoice?.("not_now");
        setStage("idle");
        setCommandInput("");
        return;
      }

      if (stage === "idle") {
        if (!trimmed || trimmed.toLowerCase() === "chat") {
          setCommandInput("");
          await handleStart();
          return;
        }
        addMessage("system", "unknown command. try 'chat'.");
        return;
      }

      if (stage === "awaitFeeling") {
        await handleFeelingSubmit(raw);
        return;
      }

      if (stage === "awaitSecondChat") {
        if (!trimmed || secondChatOverLimit) return;
        await handleSecondChat(trimmed);
        setSecondChatInput("");
        return;
      }

      if (stage === "awaitPrayer") {
        if (trimmed === "/mommy") {
          if (!suggestedPrayer) {
            addMessage("system", "mommy prayer not ready yet.");
            return;
          }
          setPrayerInput(suggestedPrayer);
          inputRef.current?.focus();
          return;
        }
        await handlePrayerSubmit(raw);
        return;
      }

      if (stage === "txFail") {
        const lowered = trimmed.toLowerCase();
        if (lowered === "retry") {
          handleRetry();
          setCommandInput("");
          return;
        }
        if (lowered === "edit") {
          handleEditPrayer();
          setCommandInput("");
          return;
        }
        if (lowered === "cancel") {
          setStage("awaitFeeling");
          setCommandInput("");
          return;
        }
        addMessage("system", "type retry, edit, or cancel.");
        return;
      }

      // afterglow is handled above (any keypress exits)
    },
    [
      addMessage,
      currentInputValue,
      handleEditPrayer,
      handleFeelingSubmit,
      handlePrayerSubmit,
      handleRetry,
      handleSecondChat,
      handleStart,
      inputLocked,
      nextAllowedText,
      onDailyCheckInChoice,
      secondChatOverLimit,
      stage,
      suggestedPrayer,
      revokeConsent,
      grantConsent,
      typeMessage,
    ],
  );

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey) return;
      if ((event.nativeEvent as { isComposing?: boolean }).isComposing) return;
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    },
    [],
  );

  // UPDATED: Status tone for different states
  const statusTone =
    stage === "awaitFeeling" && feelingOverLimit
      ? "foid-terminal__status foid-terminal__status--error"
      : stage === "awaitSecondChat" && secondChatOverLimit
        ? "foid-terminal__status foid-terminal__status--error"
        : stage === "awaitPrayer" && prayerOverLimit
          ? "foid-terminal__status foid-terminal__status--error"
          : stage === "loading"
            ? "foid-terminal__status foid-terminal__status--loading"
            : stage === "idle" && autoStart
              ? "foid-terminal__status foid-terminal__status--loading"
              : "foid-terminal__status";

  const statusMessage = useMemo(() => {
    switch (stage) {
      case "idle":
        return autoStart
          ? "Press enter/return to start"
          : "CLICK HERE OR PRESS ENTER TO START";
      case "loading":
        return "BOOTING FOID MOMMY...";
      case "awaitFeeling":
        return feelingOverLimit
          ? `${feelingCount}/${feelingLimit} — KEEP IT UNDER 140 CHARS`
          : `TELL MOMMY HOW YOU FEEL • ${feelingCount}/${feelingLimit}`;
      case "processingFeeling":
        return "FOID MOMMY IS THINKING...";
      case "awaitSecondChat":
        return secondChatOverLimit
          ? `${secondChatCount}/${secondChatLimit} — KEEP IT UNDER 200 CHARS`
          : `SHARE WITH MOMMY • ${secondChatCount}/${secondChatLimit}`;
      case "processingSecondChat":
        return "CRAFTING YOUR PRAYER...";
      case "awaitPrayer":
        return prayerOverLimit
          ? `${prayerCount}/${prayerLimit} — KEEP IT UNDER 240 CHARS`
          : `TYPE YOUR PRAYER OR PRESS ENTER FOR MOMMY'S • ${prayerCount}/${prayerLimit}`;
      case "txPending":
        return "SENDING TO CHAIN...";
      case "txFail":
        return "RETRY / EDIT / CANCEL";
      case "afterglow":
        return isTouchDevice ? "TAP TO CLOSE" : "PRESS ANY KEY TO CLOSE";
      default:
        return "";
    }
  }, [
    stage,
    autoStart,
    feelingOverLimit,
    feelingCount,
    feelingLimit,
    secondChatOverLimit,
    secondChatCount,
    secondChatLimit,
    prayerOverLimit,
    prayerCount,
    prayerLimit,
    isTouchDevice,
  ]);

  // Get placeholder based on stage
  const inputPlaceholder = useMemo(() => {
    switch (stage) {
      case "idle":
        return autoStart ? "" : "press enter to start";
      case "awaitFeeling":
        return "how are you feeling?";
      case "awaitSecondChat":
        return "tell mommy more...";
      case "awaitPrayer":
        return "type your prayer or press enter";
      case "txFail":
        return "retry / edit / cancel";
      case "afterglow":
        return isTouchDevice ? "tap to close..." : "press any key...";
      default:
        return "";
    }
  }, [stage, autoStart, isTouchDevice]);

  useEffect(() => {
    resizeComposerField();
  }, [currentInputValue, stage, resizeComposerField]);

  return (
    <div
      className={`foid-terminal foid-cli w-full${ceremonyDim ? " foid-terminal--ceremony-dim" : ""} ${className ?? ""}`}
    >
      {/* IDLE STATE: Show only centered START button */}
      {stage === "idle" && !autoStart ? (
        <div className="flex items-center justify-center h-full w-full">
          <button
            onClick={handleStart}
            className="min-h-[56px] px-12 py-4 bg-gradient-to-br from-green-400 to-green-600 text-black font-bold text-lg rounded-xl shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 touch-manipulation"
          >
            START PRAYING
          </button>
        </div>
      ) : (
        /* ACTIVE STATE: Show full terminal interface */
        <>
          <div
            ref={logRef}
            className={`foid-cli__log foid-terminal__log${prayerRevealing ? " foid-terminal__log--prayer-focus" : ""}`}
            onScroll={handleLogScroll}
          >
            <div className="foid-cli__logInner">
              {messages.map((msg) => {
                // Breathing circle sentinel
                if (msg.text === "___BREATHE___") {
                  return (
                    <div key={msg.id} className="foid-terminal__breathe">
                      <div className="foid-terminal__breathe-circle" />
                    </div>
                  );
                }

                const isPrayerLine = msg.id === prayerMessageId;
                const isChromatic = chromaticIds.has(msg.id);

                return (
                  <div
                    key={msg.id}
                    data-role={msg.role}
                    className={`foid-terminal__line ${
                      msg.role === "user"
                        ? "foid-terminal__line--user"
                        : msg.role === "foid"
                          ? `foid-terminal__line--foid${isPrayerLine ? " foid-terminal__line--prayer" : ""}`
                          : `foid-terminal__line--system${
                              msg.text.toLowerCase().startsWith("booting") ? " foid-terminal__line--boot" : ""
                            }`
                    }${isChromatic ? " foid-terminal__line--chromatic" : ""}`}
                  >
                    {msg.role === "user" && (
                      <span className="foid-terminal__prompt">{promptLabel}</span>
                    )}
                    <span>{msg.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="foid-cli__composer">
            <form onSubmit={handleCommandSubmit} className="foid-terminal__input-wrap">
              <div className="foid-terminal__input">
                <span className="foid-terminal__prompt">{promptLabel}</span>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={currentInputValue}
                  onChange={(event) => handleCommandChange(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  className="foid-terminal__field foid-terminal__field--multiline w-full resize-none overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                  placeholder={inputPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={inputLocked}
                />
                {currentInputValue.trim().length > 0 && !inputLocked && (
                  <button
                    type="submit"
                    aria-label="Send"
                    className="foid-terminal__send-btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                )}
              </div>
              {statusMessage && (
                <div className={statusTone}>
                  {statusMessage}
                </div>
              )}
            </form>
          </div>
        </>
      )}

      {/* ── Full-screen prayer focal overlay ── */}
      <PrayerFocalOverlay
        active={prayerRevealing}
        messages={messages}
      />

      {/* ── Ritual beat: prayer echo (reversed, low opacity, dissolves) ── */}
      <PrayerEcho
        text={echoText}
        active={echoActive}
        onDone={() => {
          setEchoActive(false);
          setEchoText("");
        }}
      />
    </div>
  );
}

/**
 * Full-viewport overlay that makes the prayer the focal point of the entire screen
 * while Foid Mommy is typing it out. Fades in over a dark backdrop, shows the prayer
 * text being typed live (large, centered, glowing), then dissolves when done.
 */
function PrayerFocalOverlay({
  active,
  messages,
}: {
  active: boolean;
  messages: Message[];
}) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [frozenText, setFrozenText] = useState("");

  useEffect(() => {
    if (active) {
      setFading(false);
      setFrozenText("");
      setVisible(true);
    } else if (visible) {
      // Freeze the final prayer text before fading
      const lastFoid = [...messages].reverse().find((m) => m.role === "foid");
      if (lastFoid) setFrozenText(lastFoid.text);
      setFading(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setFading(false);
        setFrozenText("");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [active, visible, messages]);

  if (!visible) return null;

  // During active typing, grab the latest foid message (being typed char by char)
  const liveText = fading
    ? frozenText
    : ([...messages].reverse().find((m) => m.role === "foid")?.text ?? "");

  return (
    <div className={`prayer-focal ${fading ? "prayer-focal--fading" : "prayer-focal--active"}`}>
      <div className="prayer-focal__backdrop" />
      <div className="prayer-focal__content">
        <div className="prayer-focal__label">foid mommy is crafting your prayer</div>
        <div className="prayer-focal__text">
          {liveText}
          {!fading && <span className="prayer-focal__cursor" />}
        </div>
        <div className="prayer-focal__glow" />
      </div>
    </div>
  );
}
