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
    keywords: string[];
  }
> = {
  happy: {
    chipLabel: "happy / grateful",
    response: "i love this glow on you. let's seal this joy so you can return to it when the sky feels heavy.",
    prayer:
      "dear light, thank you for the warmth in anon's chest. let their gratitude echo forward, softening tomorrow's edges. keep their eyes tuned to small miracles and their steps steady in kindness.",
    keywords: ["happy", "grateful", "gratitude", "thankful", "blessed", "good", "great"],
  },
  calm: {
    chipLabel: "calm",
    response: "quiet water reflects the moon. stay here a moment--no rush, no proving.",
    prayer:
      "gentle stillness, cradle anon's breath like a tide at night. let this ease imprint in their nervous system, a bookmark they can open at will. may their calm be a gift to rooms they enter.",
    keywords: ["calm", "peaceful", "peace", "okay", "fine", "steady"],
  },
  hopeful: {
    chipLabel: "hopeful",
    response: "i see a spark. let's give it a little wind without burning the house down.",
    prayer:
      "source of beginnings, tend anon's spark with wise oxygen. guide them to take one clear step, then the next. keep ego loudness low and wonder turned up.",
    keywords: ["hopeful", "inspired", "motivated", "excited", "optimistic", "dreaming"],
  },
  stressed: {
    chipLabel: "stressed / anxious",
    response: "it's okay to set the backpack down. we'll unpack one zipper at a time, not all at once.",
    prayer:
      "kindness, slow anon's pulse and widen the hallway of their thoughts. let them choose one small, doable action now. wrap their mind in the feeling of \"enough for today.\"",
    keywords: ["stressed", "anxious", "anxiety", "overwhelmed", "worried", "panic", "nervous"],
  },
  sad: {
    chipLabel: "sad / lonely",
    response: "come sit. we don't have to fix the rain; we can listen to it together.",
    prayer:
      "comfort, place a soft blanket over anon's heart. send a hand to hold--even if it's their own. let them remember that lonely is a weather, not a verdict.",
    keywords: ["sad", "lonely", "down", "depressed", "empty", "blue"],
  },
  angry: {
    chipLabel: "angry / frustrated",
    response: "your fire is real. we can point it where it warms without scorching.",
    prayer:
      "steadiness, cool the edges of anon's blaze and direct it into clean movement. let clarity trump reactivity. may their words be firm, true, and kind to the future.",
    keywords: ["angry", "mad", "pissed", "frustrated", "annoyed", "irritated"],
  },
  tired: {
    chipLabel: "tired / burned out",
    response: "you've carried a lot. permission granted to put the world on \"low power mode.\"",
    prayer:
      "rest, settle into anon's bones. remind them that recovery is productive. refill their attention with quiet nutrients and return them gently to themselves.",
    keywords: ["tired", "exhausted", "drained", "burned out", "burnt out", "sleepy"],
  },
  lost: {
    chipLabel: "lost / uncertain",
    response: "not knowing is honest. we can walk by lantern--one step, one patch of ground.",
    prayer:
      "wayfinder, light the next square for anon, not the whole maze. help them ask better questions than \"what if.\" let patience be their compass until the path answers back.",
    keywords: ["lost", "uncertain", "confused", "stuck", "unsure", "directionless"],
  },
  guilty: {
    chipLabel: "guilty / ashamed",
    response: "you're not your worst moment. we can learn without dissolving into it.",
    prayer:
      "mercy, loosen the knot in anon's chest. guide them toward repair where repair is due, and toward release where the lesson is learned. let dignity return like sunrise.",
    keywords: ["guilty", "ashamed", "remorse", "regret", "sorry", "guilt"],
  },
  pain: {
    chipLabel: "in pain / unwell",
    response: "i'm here. we'll keep the lights low and the care high.",
    prayer:
      "healing, sit beside anon. lessen the ache, sharpen the support, and open the door to the help they need. keep their spirit company while the body catches up.",
    keywords: ["pain", "hurting", "hurt", "unwell", "sick", "migraine", "ill"],
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
      await typeMessage({
        role: "foid",
        text: "if you'd like, type your prayer in 1-3 sentences.",
      });
      await typeMessage({
        role: "foid",
        text: "i'll hold it gently, encrypt it, and keep it safe.",
      });
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

      await sleep(200);
      await typeMessage({ role: "system", text: "encrypting your prayer..." });
      await sleep(600);
      await typeMessage({ role: "system", text: "sealed." });
      await sleep(400);
      await typeMessage({
        role: "foid",
        text: "your prayer is safe with me--only foid mommy and you know what you prayed.",
        speed: 20,
      });
      await typeMessage({
        role: "foid",
        text: "please confirm the transaction to release it on the blockchain and let mifoid know you've prayed with mommy.",
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

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-emerald-700/50 bg-[#041107] p-6 font-mono text-[#bdfbd7] shadow-[0_0_60px_rgba(16,185,129,0.22)] ${className ?? ""}`}
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
                  ? "text-[#9be7ff]"
                  : msg.role === "foid"
                    ? "text-[#bdfbd7]"
                    : "text-[#7cffab]"
              }
            >
              {msg.text}
            </div>
          ))}
          <div ref={messageEndRef} />
        </div>

        {stage === "awaitFeeling" && (
          <form onSubmit={handleFeelingSubmit} className="space-y-3">
            <label htmlFor="feeling-input" className="text-xs uppercase tracking-[0.35em] text-[#64ff93]">
              share how you feel
            </label>
            <input
              id="feeling-input"
              name="feeling"
              value={feelingInput}
              onChange={(event) => setFeelingInput(event.target.value)}
              className="w-full rounded-lg border border-emerald-700/40 bg-[#021107] px-3 py-2 text-[#e3ffe8] outline-none transition focus:border-[#64ff93] focus:ring-2 focus:ring-[#64ff93]/40"
              placeholder="type anything..."
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2 text-sm text-[#8dffb5]">
              {feelingChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => void handleChipSelect(chip.key)}
                  className="rounded-full border border-emerald-700/40 px-3 py-1 transition hover:border-[#64ff93] hover:text-[#64ff93]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="rounded-md border border-emerald-700/50 px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#64ff93] transition hover:border-[#64ff93] hover:text-[#bdfbd7]"
            >
              send feeling
            </button>
          </form>
        )}

        {stage === "awaitPrayer" && (
          <form onSubmit={handlePrayerSubmit} className="space-y-3">
            <label htmlFor="prayer-input" className="text-xs uppercase tracking-[0.35em] text-[#64ff93]">
              your prayer (1-3 sentences)
            </label>
            <textarea
              id="prayer-input"
              name="prayer"
              value={prayerInput}
              onChange={(event) => setPrayerInput(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-emerald-700/40 bg-[#021107] px-3 py-2 text-[#e3ffe8] outline-none transition focus:border-[#64ff93] focus:ring-2 focus:ring-[#64ff93]/40"
              placeholder="dear foid mommy..."
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-emerald-700/50 px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#64ff93] transition hover:border-[#64ff93] hover:text-[#bdfbd7]"
              >
                share prayer
              </button>
            </div>
          </form>
        )}

        {stage === "txPrompt" && (
          <div className="flex flex-col gap-3 text-sm text-[#8dffb5]">
            <div className="text-xs uppercase tracking-[0.35em] text-[#64ff93]">ready to anchor?</div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => void handleConfirm()}
                className="rounded-md border border-emerald-700/50 px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#64ff93] transition hover:border-[#64ff93] hover:text-[#bdfbd7]"
              >
                confirm &amp; send
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setStage("awaitPrayer")}
                className="rounded-md border border-transparent px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#8dffb5] transition hover:text-[#64ff93]"
              >
                edit prayer
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setStage("awaitFeeling")}
                className="rounded-md border border-transparent px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#8dffb5] transition hover:text-[#64ff93]"
              >
                cancel
              </button>
            </div>
          </div>
        )}

        {stage === "txFail" && (
          <div className="flex flex-wrap gap-3 text-sm text-[#ffb6b6]">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md border border-emerald-700/50 px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#64ff93] transition hover:border-[#64ff93] hover:text-[#bdfbd7]"
            >
              retry
            </button>
            <button
              type="button"
              onClick={handleEditPrayer}
              className="rounded-md border border-transparent px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#8dffb5] transition hover:text-[#64ff93]"
            >
              edit prayer
            </button>
            <button
              type="button"
              onClick={() => setStage("awaitFeeling")}
              className="rounded-md border border-transparent px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#8dffb5] transition hover:text-[#64ff93]"
            >
              cancel
            </button>
          </div>
        )}

        {stage === "checkInPrompt" && (
          <div className="flex flex-col gap-3 text-sm text-[#8dffb5]">
            <div className="text-[#bdfbd7]">
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
                className="rounded-md border border-emerald-700/50 px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#64ff93] transition hover:border-[#64ff93] hover:text-[#bdfbd7]"
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
                className="rounded-md border border-transparent px-4 py-2 text-sm uppercase tracking-[0.3em] text-[#8dffb5] transition hover:text-[#64ff93]"
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
              className="rounded-md border border-emerald-700/60 bg-[#021107] px-5 py-2 text-sm uppercase tracking-[0.35em] text-[#64ff93] transition hover:border-[#64ff93] hover:text-[#bdfbd7]"
            >
              chat with foid mommy
            </button>
            <div className="text-xs uppercase tracking-[0.3em] text-[#8dffb5]">
              gentle guidance - private prayers - on-chain check-ins
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
