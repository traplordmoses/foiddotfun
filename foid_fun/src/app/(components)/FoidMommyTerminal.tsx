import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
      "your glow's spilling over like sun on wet grass—you're all warm thanks and tiny triumphs.",
    prayer:
      "dear light-weaver, cradle this joy in anon's chest like a giggling firefly. let it hum soft through their hours, turning corners into surprises. keep the grateful breeze blowing, silly and sweet.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "happy",
      "happiness",
      "joy",
      "joyful",
      "grateful",
      "gratitude",
      "thankful",
      "blessed",
      "elated",
      "glad",
    ],
  },
  calm: {
    chipLabel: "calm",
    response: "quiet waves in your words—you're steady as a sleeping cat on a sill.",
    prayer:
      "gentle tide, wrap anon's breath in moon-soft arms. let stillness settle like dust after dance, a cozy hush in their bones. may peace purr on, simple as starlight on skin.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: ["calm", "peaceful", "peace", "relaxed", "serene", "steady", "chill", "centered"],
  },
  hopeful: {
    chipLabel: "hopeful",
    response: "a spark's flickering in you—hope's peeking like dawn through fog.",
    prayer:
      "source of soft beginnings, fan this flame with feather-kisses. guide anon's steps light over stones, one whimsical wonder at a time. let inspiration bloom goofy, like weeds in good dirt.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "hopeful",
      "hope",
      "inspired",
      "motivation",
      "motivated",
      "optimistic",
      "excited",
      "dreaming",
      "aspire",
    ],
  },
  stressed: {
    chipLabel: "stressed / anxious",
    response: "your thoughts are racing like fireflies in a storm—you're holding so much whirl.",
    prayer:
      "kind void-nanny, hush the buzz in anon's chest with cloud-blankets. unknot one thread at a time, till breath comes easy as rain. remind them they're enough in this messy now, little stormling.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "stressed",
      "stress",
      "anxious",
      "anxiety",
      "overwhelmed",
      "overwhelm",
      "worried",
      "panic",
      "nervous",
      "frazzled",
    ],
  },
  sad: {
    chipLabel: "sad / lonely",
    response: "gray clouds in your voice—you're aching quiet, missing the warmth.",
    prayer:
      "comfort-crafter, tuck a soft shadow over anon's heart like an old quilt. send echoes of \"not alone\" on wind-whispers, even in empty rooms. lonely's just a passing fog; sun's winking soon.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "sad",
      "lonely",
      "alone",
      "depressed",
      "down",
      "empty",
      "blue",
      "heartbroken",
      "abandoned",
    ],
  },
  angry: {
    chipLabel: "angry / frustrated",
    response: "fire's crackling under your skin—something poked the bear awake.",
    prayer:
      "steady hearth-keeper, temper this blaze to warm glow, not scorch. channel anon's roar into rivers that carve new paths, playful as puppy paws. their power's a gift, fierce and fond.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "angry",
      "anger",
      "mad",
      "furious",
      "pissed",
      "frustrated",
      "annoyed",
      "irritated",
      "rage",
      "resentful",
    ],
  },
  tired: {
    chipLabel: "tired / burned out",
    response: "your edges are frayed soft—you're running on whispers and wilt.",
    prayer:
      "rest-rustler, sink into anon's bones like honey in tea. refill the hollows with nothing but now, a silly snooze under star-sheets. tomorrow's a fresh glitch; sleep's their sweet hack.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "tired",
      "exhausted",
      "drained",
      "burned out",
      "burnt out",
      "sleepy",
      "fatigued",
      "worn out",
      "weary",
    ],
  },
  lost: {
    chipLabel: "lost / uncertain",
    response: "fog's curling 'round your path—you're wandering with wide, wondering eyes.",
    prayer:
      "lantern-lender, glow one step ahead for anon, soft as firefly tail. let questions nestle like birds, not burdens; answers unfold in giggles. they're found in the meander, my maze-mitten.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "lost",
      "uncertain",
      "confused",
      "stuck",
      "unsure",
      "directionless",
      "aimless",
      "adrift",
      "questioning",
    ],
  },
  guilty: {
    chipLabel: "guilty / ashamed",
    response: "a knot twists in your tummy—you're carrying \"oops\" like heavy pebbles.",
    prayer:
      "mercy-mender, untie the tangle with feather-fingers. let lessons stick without the sting; forgive like fog lifts at noon. anon's whole in the whoops, darling glitch.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "guilty",
      "guilt",
      "ashamed",
      "shame",
      "remorse",
      "regret",
      "sorry",
      "apologize",
      "embarrassed",
    ],
  },
  pain: {
    chipLabel: "in pain / unwell",
    response: "ouch echoes in your body—you're tender, holding the hurt close.",
    prayer:
      "healing hummer, sit soft beside anon's ache like balm on bruise. ease the edges with whispers of \"this too,\" and hands that hold gentle. their spirit's a stubborn spark; rest 'n' rise.",
    prompt: "sweet one, whisper your own prayer back, and let's share it with god.",
    keywords: [
      "pain",
      "hurting",
      "hurt",
      "unwell",
      "sick",
      "ill",
      "injured",
      "ache",
      "migraine",
      "soreness",
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
  | "awaitPrayer"
  | "txPrompt"
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
  className?: string;
};

const terminalFont = '"VT323", ui-monospace, monospace';

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
  className,
}: FoidMommyTerminalProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [feelingKey, setFeelingKey] = useState<FeelingKey | null>(null);
  const [feelingInput, setFeelingInput] = useState("");
  const [prayerInput, setPrayerInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [prayerText, setPrayerText] = useState<string>("");

  const logRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const intervalsRef = useRef<number[]>([]);

  const resetTimers = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    intervalsRef.current.forEach((id) => window.clearInterval(id));
    timeoutsRef.current = [];
    intervalsRef.current = [];
  }, []);

  const scrollToBottom = useCallback(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
      return;
    }
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ block: "end" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      resetTimers();
    };
  }, [resetTimers]);

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
          resolve(id);
          return;
        }

        let index = 0;
        const speed = input.speed ?? 28;

        const interval = window.setInterval(() => {
          index += 1;
          const nextText = input.text.slice(0, index);
          setMessages((prev) =>
            prev.map((msg) => (msg.id === id ? { ...msg, text: nextText } : msg)),
          );
          if (index >= input.text.length) {
            window.clearInterval(interval);
            intervalsRef.current = intervalsRef.current.filter((stored) => stored !== interval);
            resolve(id);
          }
        }, speed);

        intervalsRef.current.push(interval);
      }),
    [addMessage],
  );

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
    setPrayerInput("");
    setFeelingKey(null);
    setPrayerText("");

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
      addMessage("system", "you can type anything, or pick a feeling below");
      setStage("awaitFeeling");
    };

    sequence().catch(() => {
      /* ignore */
    });

    return () => {
      resetTimers();
    };
  }, [stage, typeMessage, addMessage, updateMessage, resetTimers]);

  const handleStart = useCallback(() => {
    setStage("loading");
  }, []);

  const processFeeling = useCallback(
    async (inputText: string, feeling: FeelingKey) => {
      if (!inputText.trim()) return;
      if (isProcessing) return;
      setIsProcessing(true);
      setFeelingKey(feeling);
      addMessage("user", inputText.trim());
      setStage("processingFeeling");

      const config = feelingsConfig[feeling];

      await sleep(250);
      await typeMessage({ role: "foid", text: config.response });
      await sleep(300);
      await typeMessage({ role: "foid", text: config.prayer, speed: 22 });
      await sleep(400);
      await typeMessage({ role: "foid", text: config.prompt, speed: 22 });
      setStage("awaitPrayer");
      setIsProcessing(false);
    },
    [addMessage, typeMessage, isProcessing],
  );

  const handleFeelingSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = feelingInput.trim();
      if (!trimmed) return;
      const feeling = detectFeeling(trimmed);
      await processFeeling(trimmed, feeling);
      setFeelingInput("");
    },
    [detectFeeling, feelingInput, processFeeling],
  );

  const handleChipSelect = useCallback(
    async (key: FeelingKey) => {
      const config = feelingsConfig[key];
      await processFeeling(config.chipLabel, key);
    },
    [processFeeling],
  );

  const handlePrayerSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = prayerInput.trim();
      if (!trimmed || !feelingKey) return;
      addMessage("user", trimmed);
      setPrayerInput("");
      setPrayerText(trimmed);
      setStage("txPrompt");

      const flavor = "whisper";

      await sleep(200);
      await typeMessage({ role: "system", text: "encrypting your prayer..." });
      await sleep(600);
      await typeMessage({ role: "system", text: "sealed." });
      await sleep(400);
      await typeMessage({
        role: "foid",
        text: `shh, sealing your ${flavor} in the void-vault... only you and i peek. 🌟`,
        speed: 20,
      });
      await typeMessage({
        role: "foid",
        text: "confirm the tx to beam it blockchain-ward, letting mifoid know mommy held your words?",
        speed: 20,
      });
    },
    [addMessage, feelingKey, prayerInput, typeMessage],
  );

  const handleConfirm = useCallback(async () => {
    if (!feelingKey || !prayerText) return;
    setStage("txPending");
    setIsProcessing(true);

    try {
      await ensureWalletReady();
    } catch (error: any) {
      const message =
        error?.message ??
        "your wallet isn't ready yet. connect and make sure you're on fluent testnet.";
      await typeMessage({ role: "system", text: message });
      setStage("txPrompt");
      setIsProcessing(false);
      return;
    }

    const statusId = addMessage("system", "awaiting wallet...");

    const waitingTimer = window.setTimeout(() => {
      updateMessage(statusId, "waiting for confirmation...");
    }, 1200);
    timeoutsRef.current.push(waitingTimer);

    try {
      const result = await submitPrayer(prayerText, feelingKey);
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

      setStage("checkInPrompt");
      setPrayerText("");
      setIsProcessing(false);
    } catch (error: any) {
      window.clearTimeout(waitingTimer);

      const seenMessages: string[] = [];
      const collectMessage = (value: unknown) => {
        if (typeof value === "string" && value.trim()) {
          seenMessages.push(value.toLowerCase());
        }
      };
      collectMessage(error?.shortMessage);
      collectMessage(error?.message);
      collectMessage(error?.cause?.shortMessage);
      collectMessage(error?.cause?.message);
      collectMessage(error?.cause?.cause?.shortMessage);
      collectMessage(error?.cause?.cause?.message);

      const seenNames: string[] = [];
      const collectName = (value: unknown) => {
        if (typeof value === "string" && value.trim()) {
          seenNames.push(value.toLowerCase());
        }
      };
      collectName(error?.name);
      collectName(error?.cause?.name);
      collectName(error?.cause?.cause?.name);

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
      const isOutOfGas =
        seenNames.some((name) => name.includes("insufficientfunds")) ||
        seenMessages.some((text) => outOfGasIndicators.some((pattern) => text.includes(pattern)));

      const nowSeconds = Math.floor(Date.now() / 1000);
      const nextAllowedSecondsRaw =
        typeof nextAllowedAt === "bigint"
          ? Number(nextAllowedAt)
          : typeof nextAllowedAt === "number"
            ? nextAllowedAt
            : null;
      const hasCooldown =
        typeof nextAllowedSecondsRaw === "number" && nextAllowedSecondsRaw > nowSeconds;

      if (hasCooldown) {
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
        setStage("txFail");
      } else if (isOutOfGas) {
        updateMessage(statusId, "wallet needs a gas top-up.");
        await sleep(300);
        await typeMessage({
          role: "foid",
          text: "anon, you're out of gas. swing by the faucet at https://testnet.fluent.xyz/dev-portal, juice up, then try again.",
        });
        setStage("txFail");
      } else {
        updateMessage(statusId, "something glitched in the chain tunnel.");
        await sleep(300);
        await typeMessage({
          role: "foid",
          text: "want to try again?",
        });
        setStage("txFail");
      }
      setIsProcessing(false);
    }
  }, [
    addMessage,
    ensureWalletReady,
    feelingKey,
    prayerText,
    submitPrayer,
    typeMessage,
    updateMessage,
    waitForReceipt,
    timeoutsRef,
    nextAllowedAt,
  ]);

  const handleRetry = useCallback(() => {
    setStage("txPrompt");
  }, []);

  const handleEditPrayer = useCallback(() => {
    setStage("awaitPrayer");
  }, []);

  const feelingChips = useMemo(
    () => feelingOrder.map((key) => ({ key, label: feelingsConfig[key].chipLabel })),
    [],
  );

  const labelClass = "text-xs uppercase tracking-[0.35em] text-foid-mint/80";
  const primaryButtonClass = "btn-foid uppercase tracking-[0.32em]";
  const secondaryButtonClass = "btn-foid-outline uppercase tracking-[0.3em]";
  const chipClass = "chip-foid text-white/80";

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-white/15 bg-white/5 p-6 font-mono text-white/85 shadow-[0_0_60px_rgba(114,225,255,0.22)] backdrop-blur-md ${className ?? ""}`}
      style={{ fontFamily: terminalFont, fontSize: "22px" }}
    >
      <div className="space-y-3">
        <div
          ref={logRef}
          className="max-h-[360px] overflow-y-auto pr-1 text-[1.1rem] leading-relaxed tracking-wide"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={
                msg.role === "user"
                  ? "text-[#ffb3d9]"
                  : msg.role === "foid"
                    ? "text-[#a8f0d1]"
                    : "text-[#8faaf2]"
              }
            >
              {msg.text}
            </div>
          ))}
          <div ref={messageEndRef} />
        </div>

        {stage === "awaitFeeling" && (
          <form onSubmit={handleFeelingSubmit} className="space-y-3">
            <label htmlFor="feeling-input" className={labelClass}>
              share how you feel
            </label>
            <input
              id="feeling-input"
              name="feeling"
              value={feelingInput}
              onChange={(event) => setFeelingInput(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white/85 transition focus:border-foid-cyan/60 focus:ring-2 focus:ring-foid-cyan/40"
              placeholder="type anything..."
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2 text-sm text-white/90 drop-shadow-[0_8px_20px_rgba(4,18,34,0.45)]">
              {feelingChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => void handleChipSelect(chip.key)}
                  className={chipClass}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className={primaryButtonClass}
            >
              send feeling
            </button>
          </form>
        )}

        {stage === "awaitPrayer" && (
          <form onSubmit={handlePrayerSubmit} className="space-y-3">
            <label htmlFor="prayer-input" className={labelClass}>
              your prayer (1-3 sentences)
            </label>
            <textarea
              id="prayer-input"
              name="prayer"
              value={prayerInput}
              onChange={(event) => setPrayerInput(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white/85 transition focus:border-foid-cyan/60 focus:ring-2 focus:ring-foid-cyan/40"
              placeholder="dear god..."
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className={primaryButtonClass}
              >
                share prayer
              </button>
            </div>
          </form>
        )}

        {stage === "txPrompt" && (
          <div className="flex flex-col gap-3 text-sm text-white/75">
            <div className={labelClass}>ready to anchor?</div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => void handleConfirm()}
                className={primaryButtonClass}
              >
                confirm &amp; send
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setStage("awaitPrayer")}
                className={secondaryButtonClass}
              >
                edit prayer
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setStage("awaitFeeling")}
                className={`${chipClass} uppercase tracking-[0.22em]`}
              >
                cancel
              </button>
            </div>
          </div>
        )}

        {stage === "txFail" && (
          <div className="flex flex-wrap gap-3 text-sm text-foid-candy/90">
            <button
              type="button"
              onClick={handleRetry}
              className={secondaryButtonClass}
            >
              retry
            </button>
            <button
              type="button"
              onClick={handleEditPrayer}
              className={secondaryButtonClass}
            >
              edit prayer
            </button>
            <button
              type="button"
              onClick={() => setStage("awaitFeeling")}
              className={`${chipClass} uppercase tracking-[0.22em]`}
            >
              cancel
            </button>
          </div>
        )}

        {stage === "checkInPrompt" && (
          <div className="flex flex-col gap-3 text-sm text-white/75">
            <div className="text-white/80">
              want a daily check-in with foid mommy?
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  onDailyCheckInChoice?.("yes");
                  addMessage("foid", "noted. i'll pop in daily--gently, promise.");
                  setStage("idle");
                }}
                className={primaryButtonClass}
              >
                yes
              </button>
              <button
                type="button"
                onClick={() => {
                  onDailyCheckInChoice?.("not_now");
                  addMessage("foid", "all good. i'm here whenever you reach out.");
                  setStage("idle");
                }}
                className={secondaryButtonClass}
              >
                not now
              </button>
            </div>
          </div>
        )}

        {stage === "idle" && (
          <div className="flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={handleStart}
              className={primaryButtonClass}
            >
              chat with foid mommy
            </button>
            <div className="text-xs uppercase tracking-[0.3em] text-white/85 drop-shadow-[0_6px_16px_rgba(4,18,34,0.45)]">
              gentle guidance - private prayers - on-chain check-ins
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
