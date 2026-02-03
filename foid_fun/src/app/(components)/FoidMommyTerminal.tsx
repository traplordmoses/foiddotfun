import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { celebrateTransaction } from "@/effects/celebrate";
import sfx from "@/lib/sfx";
import { attachTypingClicks, initTypingClicks } from "@/lib/typingClicks";
import { formatViemError } from "@/lib/prayerErrors";

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
  | "pain";

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
      "i see your smile from here—soft, honest, earned. i'm proud of you, sweet one.",
    prayer:
      "god of simple gifts, keep anon's joy clean and generous—light that warms, not burns. teach them to hold it open-handed, to share without fear, to remember the source like water remembers the sea.",
    prompt:
      "if you want, type your own little thank-you—we'll send it together.",
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
      "your breath is even and your shoulders are low—let's keep it that way.",
    prayer:
      "keeper of still waters, let calm settle in anon like a lake at dusk. guard their quiet with gentle boundaries, and teach their thoughts to rest like birds returning home.",
    prompt:
      "whisper a short peace-prayer in your words. i'll carry it with you.",
    keywords: ["calm", "peaceful", "peace", "relaxed", "serene", "steady", "chill", "centered"],
  },

  hopeful: {
    chipLabel: "hopeful",
    response:
      "i hear the dawn in your voice—soft light, steady steps. i'm with you.",
    prayer:
      "faithful guide, keep anon's hope soft and brave. light the next right step—no rush, no force, just the way opening in its time like spring through frost.",
    prompt:
      "tell me the hope you're holding—one line is enough. we'll offer it up.",
    keywords: [
      "hopeful","hope","inspired","motivation","motivated","optimistic","excited","dreaming","aspire",
    ],
  },

  stressed: {
    chipLabel: "stressed / anxious",
    response:
      "that tight chest, that spinning mind—I see it. take my hand; we'll slow this together.",
    prayer:
      "steady one, loosen the knot in anon's body. return them to the present—one breath, one task, one mercy at a time. show them what is theirs to carry and what can be set down now.",
    prompt:
      "name the one thing you need help with. i'll pray it simply with you.",
    keywords: [
      "stressed","stress","anxious","anxiety","overwhelmed","overwhelm","worried","panic","nervous","frazzled",
    ],
  },

  sad: {
    chipLabel: "sad / lonely",
    response:
      "i'm sitting beside you—no fixing, just company. your tears are safe here.",
    prayer:
      "comforter, rest with anon in the low valley. hold their heart without hurry; let sorrow pass through like rain through soil, leaving room for new green in due time.",
    prompt:
      "if you want, tell me what hurts in a sentence. we'll lift it gently.",
    keywords: [
      "sad","lonely","alone","depressed","down","empty","blue","heartbroken","abandoned",
    ],
  },

  angry: {
    chipLabel: "angry / frustrated",
    response:
      "that heat means you care. let's turn it into something clean and true.",
    prayer:
      "wise hearth-keeper, temper anon's fire—no scorch, only clarity. guard their tongue, steady their hands, and channel their strength toward repair, boundary, and courage.",
    prompt:
      "write the honest line you wish to act from. i'll pray for strength to match it.",
    keywords: [
      "angry","anger","mad","furious","pissed","frustrated","annoyed","irritated","rage","resentful",
    ],
  },

  tired: {
    chipLabel: "tired / burned out",
    response:
      "your body's asking for mercy. permission granted—rest is holy.",
    prayer:
      "giver of rest, pour quiet into anon's bones. slow their pace to human speed; bless their sleep, their food, their unhurried minutes. let them wake restored enough for the next small thing.",
    prompt:
      "tell me how you'll rest—one small act. i'll bless it with you.",
    keywords: [
      "tired","exhausted","drained","burned out","burnt out","sleepy","fatigued","worn out","weary",
    ],
  },

  lost: {
    chipLabel: "lost / uncertain",
    response:
      "fog happens. we walk by feel—step, listen, step. i'm right here.",
    prayer:
      "lantern of the quiet path, give anon light for only the next step. make peace with the not-knowing, and let guidance arrive like a soft yes in the chest.",
    prompt:
      "name the next tiny step you can take. i'll pray light over it.",
    keywords: [
      "lost","uncertain","confused","stuck","unsure","directionless","aimless","adrift","questioning",
    ],
  },

  guilty: {
    chipLabel: "guilty / ashamed",
    response:
      "you are more than your mistake. we can tell the truth and keep your dignity.",
    prayer:
      "merciful one, teach anon the art of repair—clear eyes, soft heart, steady feet. let forgiveness begin inside, then move outward in honest steps.",
    prompt:
      "write the amends you want to make or the lesson you're keeping. i'll stand with you.",
    keywords: [
      "guilty","guilt","ashamed","shame","remorse","regret","sorry","apologize","embarrassed",
    ],
  },

  pain: {
    chipLabel: "in pain / unwell",
    response:
      "i hear the ache. we'll keep you company and keep you cared for.",
    prayer:
      "healer, come close to anon's hurting places. ease the sharp edges, bring wise help, guard their sleep, and let pain not be the whole story of this day.",
    prompt:
      "tell me where it hurts or what support you need. i'll ask for it plainly.",
    keywords: [
      "pain","hurting","hurt","unwell","sick","ill","injured","ache","migraine","soreness",
    ],
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
  | "checkInPrompt";

export type FoidMommyTerminalProps = {
  ensureWalletReady: () => Promise<void>;
  submitPrayer: (prayer: string, feeling: FeelingKey) => Promise<SubmitPrayerResult>;
  waitForReceipt?: (hash: string) => Promise<void>;
  onDailyCheckInChoice?: (choice: "yes" | "not_now") => void;
  nextAllowedAt?: bigint | number | null;
  registryReady?: boolean;
  chainOk?: boolean;
  requiredChainId?: number | null;
  className?: string;
  autoStart?: boolean; // NEW: auto-start terminal on mount
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
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

export default function FoidMommyTerminal({
  ensureWalletReady,
  submitPrayer,
  waitForReceipt,
  onDailyCheckInChoice,
  nextAllowedAt,
  registryReady = true,
  chainOk = true,
  requiredChainId = null,
  className,
  autoStart = false,
}: FoidMommyTerminalProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [feelingKey, setFeelingKey] = useState<FeelingKey | null>(null);
  const [feelingInput, setFeelingInput] = useState("");
  const [secondChatInput, setSecondChatInput] = useState("");
  const [prayerInput, setPrayerInput] = useState("");
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attachedTypingTargets = useRef(new WeakSet<HTMLElement>());
  const lastStageRef = useRef<Stage>("idle");

  const addMessage = useCallback((role: MessageRole, text: string) => {
    const id = makeId();
    setMessages((prev) => [...prev, { id, role, text }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, text: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, text } : msg)));
  }, []);

  const typeMessage = useCallback(
    (input: TypeMessageInput) =>
      new Promise<string>((resolve) => {
        if (typeof window === "undefined") {
          const id = addMessage(input.role, input.text);
          resolve(id);
          return;
        }

        const id = makeId();
        setMessages((prev) => [...prev, { id, role: input.role, text: "" }]);
        if (!input.text) {
          sfx.typing.stop();
          resolve(id);
          return;
        }

        let index = 0;
        const speed = input.speed ?? 28;

        sfx.typing.start();
        const interval = window.setInterval(() => {
          index += 1;
          const nextText = input.text.slice(0, index);
          setMessages((prev) =>
            prev.map((msg) => (msg.id === id ? { ...msg, text: nextText } : msg)),
          );
          if (index >= input.text.length) {
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
    if (stage === "idle" || stage === "txFail" || stage === "checkInPrompt") {
      setCommandInput("");
    }
  }, [stage]);

  useEffect(() => {
    return () => {
      resetTimers();
    };
  }, [resetTimers]);

  const detectFeeling = useCallback((raw: string): FeelingKey => {
    const normalized = raw.toLowerCase();
    for (const key of feelingOrder) {
      const config = feelingsConfig[key];
      if (config.keywords.some((word) => normalized.includes(word))) {
        return key;
      }
    }
    return "lost";
  }, []);

  useEffect(() => {
    if (stage !== "loading") return;
    resetTimers();
    setMessages([]);
    setFeelingInput("");
    setSecondChatInput("");
    setPrayerInput("");
    setCommandInput("");
    setFeelingKey(null);
    setPrayerText("");
    setSuggestedPrayer("");
    setInitialFeelingText("");

    const bootId = addMessage("system", "booting foid mommy .");
    const dotOne = window.setTimeout(() => {
      updateMessage(bootId, "booting foid mommy ..");
    }, 350);
    const dotTwo = window.setTimeout(() => {
      updateMessage(bootId, "booting foid mommy ...");
    }, 700);

    timeoutsRef.current.push(dotOne, dotTwo);

    const sequence = async () => {
      await sleep(1200);
      await typeMessage({ role: "system", text: "foid mommy online.", speed: 24 });
      await sleep(800);
      await typeMessage({ role: "foid", text: "hi anon, how are you doing today?", speed: 26 });
      addMessage("system", "tell me how you're feeling to start.");
      setStage("awaitFeeling");
    };

    sequence().catch(() => {
      /* ignore */
    });

    return () => {
      resetTimers();
    };
  }, [stage, typeMessage, addMessage, updateMessage, resetTimers]);

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
    [addMessage, typeMessage, isProcessing],
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

        // Show the prayer
        await typeMessage({ role: "foid", text: prayer, speed: 22 });
        setSuggestedPrayer(prayer);
        setPrayerText(prayer);

        await sleep(800);

        // Auto-submit to chain
        await typeMessage({ role: "system", text: "hashing your prayer locally..." });
        await sleep(600);
        await typeMessage({ role: "system", text: "hash ready." });
        await sleep(400);
        await typeMessage({
          role: "foid",
          text: "anchoring only the hash on-chain. your prayer stays with you. 🌟",
          speed: 20,
        });
        await typeMessage({
          role: "foid",
          text: "confirm the tx to beam it blockchain-ward, letting mifoid know mommy held your words?",
          speed: 20,
        });

        await handleConfirm(prayer, feelingKey);
      } catch (err) {
        console.error("handleSecondChat error:", err);
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
    [addMessage, typeMessage, isProcessing, feelingKey, initialFeelingText],
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
  const nowSeconds = Math.floor(Date.now() / 1000);
  const nextAllowedSecondsRaw =
    typeof nextAllowedAt === "bigint"
      ? Number(nextAllowedAt)
      : typeof nextAllowedAt === "number"
        ? nextAllowedAt
        : null;
  const cooldownActive =
    typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > nowSeconds;
  const cooldownNextWindow = cooldownActive
    ? new Date(nextAllowedSecondsRaw * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const handleFeelingSubmit = useCallback(
    async (inputText: string) => {
      if (!registryReady) {
        addMessage("system", "misconfigured: missing registry address.");
        return;
      }
      if (!chainOk) {
        addMessage(
          "system",
          `switch to fluent testnet (chain id ${requiredChainId ?? "?"}) to continue.`,
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
        `switch to fluent testnet (chain id ${requiredChainId ?? "?"}) to continue.`,
      );
      return;
    }
    if (!feelingToSend || !prayerToSend) return;
    setStage("txPending");
    setIsProcessing(true);

    try {
      await ensureWalletReady();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "your wallet isn't ready yet. connect and make sure you're on fluent testnet.";
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
        await waitForReceipt(result.txHash);
      }

      updateMessage(statusId, "status: anchored.");
      await sleep(300);
      await typeMessage({ role: "system", text: "done. your prayer is anchored." });
      await typeMessage({
        role: "foid",
        text: "thank you for trusting me, anon. drink water, unclench your jaw, breathe.",
      });

      sfx.playReward();
      celebrateTransaction(result?.txHash);
      setStage("checkInPrompt");
      setPrayerText("");
      setIsProcessing(false);
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
          text: `you have already prayed with mommy today, anon. next window opens in ${relative} (${nextWindow}).`,
        });
        sfx.playError();
        setStage("txFail");
      } else if (isOutOfGas) {
        updateMessage(statusId, "wallet needs a gas top-up.");
        await sleep(300);
        await typeMessage({
          role: "foid",
          text: "anon, you're out of gas. swing by the faucet at https://testnet.fluent.xyz/dev-portal, juice up, then try again.",
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
          `switch to fluent testnet (chain id ${requiredChainId ?? "?"}) to continue.`,
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
        text: `anchoring only the hash on-chain. your ${flavor} stays with you. 🌟`,
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

  const handleCommandSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (inputLocked) return;
      const raw = currentInputValue;
      const trimmed = raw.trim();

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

      if (stage === "checkInPrompt") {
        if (trimmed.toLowerCase() === "ok") {
          addMessage("system", `next prayer allowed in: ${nextAllowedText}`);
          onDailyCheckInChoice?.("not_now");
          setStage("idle");
          setCommandInput("");
          return;
        }
        addMessage("system", "type ok to exit.");
      }
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
    ],
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
          ? "BOOTING FOID MOMMY..."
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
      case "checkInPrompt":
        return "TYPE OK TO CLOSE";
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
      case "checkInPrompt":
        return "ok";
      default:
        return "";
    }
  }, [stage, autoStart]);

  return (
    <div
      className={`foid-terminal foid-cli w-full ${className ?? ""}`}
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
            className="foid-cli__log foid-terminal__log"
            onScroll={handleLogScroll}
          >
            <div className="foid-cli__logInner">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  data-role={msg.role}
                  className={`foid-terminal__line ${
                    msg.role === "user"
                      ? "foid-terminal__line--user"
                      : msg.role === "foid"
                        ? "foid-terminal__line--foid"
                        : `foid-terminal__line--system${
                            msg.text.toLowerCase().startsWith("booting") ? " foid-terminal__line--boot" : ""
                          }`
                  }`}
                >
                  {msg.role === "user" && (
                    <span className="foid-terminal__prompt">{promptLabel}</span>
                  )}
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="foid-cli__composer">
            <form onSubmit={handleCommandSubmit} className="foid-terminal__input-wrap">
              <div className="foid-terminal__input">
                <span className="foid-terminal__prompt">{promptLabel}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInputValue}
                  onChange={(event) => handleCommandChange(event.target.value)}
                  className="foid-terminal__field"
                  placeholder={inputPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={inputLocked}
                />
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
    </div>
  );
}
