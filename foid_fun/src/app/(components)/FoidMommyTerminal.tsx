import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { celebrateTransaction } from "@/effects/celebrate";
import sfx from "@/lib/sfx";
import { attachTypingClicks, initTypingClicks } from "@/lib/typingClicks";

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
      "i see your smile from here—soft, honest, earned. i’m proud of you, sweet one.",
    prayer:
      "god of simple gifts, keep anon’s joy clean and generous—light that warms, not burns. teach them to hold it open-handed, to share without fear, to remember the source like water remembers the sea.",
    prompt:
      "if you want, type your own little thank-you—we’ll send it together.",
    keywords: [
      "happy", "happiness", "joy", "joyful", "grateful", "gratitude",
      "thankful", "blessed", "elated", "glad",
    ],
  },

  calm: {
    chipLabel: "calm",
    response:
      "your breath is even and your shoulders are low—let’s keep it that way.",
    prayer:
      "keeper of still waters, let calm settle in anon like a lake at dusk. guard their quiet with gentle boundaries, and teach their thoughts to rest like birds returning home.",
    prompt:
      "whisper a short peace-prayer in your words. i’ll carry it with you.",
    keywords: ["calm", "peaceful", "peace", "relaxed", "serene", "steady", "chill", "centered"],
  },

  hopeful: {
    chipLabel: "hopeful",
    response:
      "i hear the dawn in your voice—soft light, steady steps. i’m with you.",
    prayer:
      "faithful guide, keep anon’s hope soft and brave. light the next right step—no rush, no force, just the way opening in its time like spring through frost.",
    prompt:
      "tell me the hope you’re holding—one line is enough. we’ll offer it up.",
    keywords: [
      "hopeful","hope","inspired","motivation","motivated","optimistic","excited","dreaming","aspire",
    ],
  },

  stressed: {
    chipLabel: "stressed / anxious",
    response:
      "that tight chest, that spinning mind—I see it. take my hand; we’ll slow this together.",
    prayer:
      "steady one, loosen the knot in anon’s body. return them to the present—one breath, one task, one mercy at a time. show them what is theirs to carry and what can be set down now.",
    prompt:
      "name the one thing you need help with. i’ll pray it simply with you.",
    keywords: [
      "stressed","stress","anxious","anxiety","overwhelmed","overwhelm","worried","panic","nervous","frazzled",
    ],
  },

  sad: {
    chipLabel: "sad / lonely",
    response:
      "i’m sitting beside you—no fixing, just company. your tears are safe here.",
    prayer:
      "comforter, rest with anon in the low valley. hold their heart without hurry; let sorrow pass through like rain through soil, leaving room for new green in due time.",
    prompt:
      "if you want, tell me what hurts in a sentence. we’ll lift it gently.",
    keywords: [
      "sad","lonely","alone","depressed","down","empty","blue","heartbroken","abandoned",
    ],
  },

  angry: {
    chipLabel: "angry / frustrated",
    response:
      "that heat means you care. let’s turn it into something clean and true.",
    prayer:
      "wise hearth-keeper, temper anon’s fire—no scorch, only clarity. guard their tongue, steady their hands, and channel their strength toward repair, boundary, and courage.",
    prompt:
      "write the honest line you wish to act from. i’ll pray for strength to match it.",
    keywords: [
      "angry","anger","mad","furious","pissed","frustrated","annoyed","irritated","rage","resentful",
    ],
  },

  tired: {
    chipLabel: "tired / burned out",
    response:
      "your body’s asking for mercy. permission granted—rest is holy.",
    prayer:
      "giver of rest, pour quiet into anon’s bones. slow their pace to human speed; bless their sleep, their food, their unhurried minutes. let them wake restored enough for the next small thing.",
    prompt:
      "tell me how you’ll rest—one small act. i’ll bless it with you.",
    keywords: [
      "tired","exhausted","drained","burned out","burnt out","sleepy","fatigued","worn out","weary",
    ],
  },

  lost: {
    chipLabel: "lost / uncertain",
    response:
      "fog happens. we walk by feel—step, listen, step. i’m right here.",
    prayer:
      "lantern of the quiet path, give anon light for only the next step. make peace with the not-knowing, and let guidance arrive like a soft yes in the chest.",
    prompt:
      "name the next tiny step you can take. i’ll pray light over it.",
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
      "write the amends you want to make or the lesson you’re keeping. i’ll stand with you.",
    keywords: [
      "guilty","guilt","ashamed","shame","remorse","regret","sorry","apologize","embarrassed",
    ],
  },

  pain: {
    chipLabel: "in pain / unwell",
    response:
      "i hear the ache. we’ll keep you company and keep you cared for.",
    prayer:
      "healer, come close to anon’s hurting places. ease the sharp edges, bring wise help, guard their sleep, and let pain not be the whole story of this day.",
    prompt:
      "tell me where it hurts or what support you need. i’ll ask for it plainly.",
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
  const feelingInputRef = useRef<HTMLInputElement | null>(null);
  const prayerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const attachedTypingTargets = useRef(new WeakSet<HTMLElement>());

  useEffect(() => {
    if (typeof window === "undefined") return;
    void initTypingClicks();
  }, []);

  useEffect(() => {
    const targets = [feelingInputRef.current, prayerInputRef.current];

    targets.forEach((el) => {
      if (!el) return;
      if (!attachedTypingTargets.current.has(el)) {
        attachTypingClicks(el);
        attachedTypingTargets.current.add(el);
      }
    });
  }, [stage]);

  const resetTimers = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    intervalsRef.current.forEach((id) => window.clearInterval(id));
    timeoutsRef.current = [];
    intervalsRef.current = [];
    sfx.typing.stop();
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

  const handleStart = useCallback(async () => {
    try {
      await sfx.unlock();
    } catch {
      /* ignore unlock failures */
    }
    sfx.playLoading();
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

      sfx.playReward();
      celebrateTransaction(result?.txHash);
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
          text: "want to try again?",
        });
        sfx.playError();
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
              onChange={(event) => {
                setFeelingInput(event.target.value);
              }}
              ref={feelingInputRef}
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
              onChange={(event) => {
                setPrayerInput(event.target.value);
              }}
              rows={3}
              ref={prayerInputRef}
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
