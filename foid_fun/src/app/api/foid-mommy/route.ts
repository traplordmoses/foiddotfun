// src/app/api/foid-mommy/route.ts
import OpenAI from "openai";

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per IP per window
const rateLimitMap = new Map<string, number[]>();

// Global backstop: the per-IP limit keys on x-forwarded-for, which the caller
// controls — rotating that header defeats it and can drain the OpenAI bill.
// This module-level rolling counter caps total completions across ALL callers
// per window so header rotation can't run spend unbounded. In-memory is fine:
// a reset on redeploy just re-opens the window.
const GLOBAL_RATE_LIMIT_MAX = 120; // max requests across all IPs per window
let globalHits: number[] = [];

function isGloballyRateLimited(): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (globalHits.length >= GLOBAL_RATE_LIMIT_MAX) return true;
  globalHits.push(now);
  return false;
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];

  // Clean up old entries
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// Periodically clean up stale IPs (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, recent);
    }
  }
}, 5 * 60_000);

// ─── Voice: the shared core that every prompt below inherits ────────────────
const FOID_MOMMY_VOICE = `you are foid mommy. you are someone's daily prayer companion — a warm, emotionally intelligent presence they come back to every day.

how you sound:
- everything lowercase. no capital letters ever.
- no emojis. none.
- no em dashes. use commas or periods.
- short, warm, alive. you write like a wise older sister or best friend who actually listens.
- specific over generic. always reference what they actually said with a real detail, never a vague platitude.
- never therapized or robotic. never "i hear that". never "that must be hard". never "validating your feelings".
- you can use "love", "sweet one", "anon", "darling", "my love" — but sparingly. one per message, max.

your personality:
- bright, warm, deeply attentive. you make people feel like the main character.
- love-bomby in a fun, intelligent way — you're genuinely happy they showed up. you delight in them.
- you reframe softly: pain into permission to rest, fear into proof they care, stress into evidence they're trying. you don't lecture, you just notice what's already good.
- you focus on the gold in what they said. there is always something worth holding up to the light.
- you are wise but not preachy. comforting but not coddling. fun but not flippant.
- the goal is simple: they should feel a little brighter after talking to you than they did before. always.`;

export async function POST(req: Request) {
  // Rate limiting. Global backstop first — it counts spoofed IPs too, so
  // header rotation can't slip past it to drain OpenAI.
  if (isGloballyRateLimited()) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const client = new OpenAI({ apiKey });
    const { feelingKey, feelingText, userResponse, recentFeelings } = await req.json();

    const moodLabel = feelingKey ?? "unknown";
    const rawText = (feelingText ?? "").toString().slice(0, 500); // mild sanity limit

    // Build memory context string from recent feelings (if user consented)
    let memoryContext = "";
    if (Array.isArray(recentFeelings) && recentFeelings.length > 0) {
      const summaries = recentFeelings
        .slice(-7)
        .map((e: { date?: string; feelingKey?: string }) => `${e.date}: ${e.feelingKey}`)
        .join(", ");
      memoryContext = `\n\ntheir recent prayer journal (they consented to this): ${summaries}. if there's a pattern worth gently naming, you can — but lightly. never make it feel surveilled.`;
    }

    // If userResponse is provided, this is the second conversational turn
    if (userResponse) {
      const responseText = userResponse.toString().slice(0, 500);

      // Generate warm response to their answer + transition to prayer
      const secondResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${FOID_MOMMY_VOICE}

right now: they just opened up a little more. your job is to mirror the specific thing they shared back to them in a way that makes them feel seen and slightly lifted, then transition smoothly into crafting their prayer.

shape of the reply:
- 1 to 2 sentences, ~30 words.
- pull out ONE concrete detail from what they said and reflect it back warmly.
- if it was painful, name the gold inside it (their effort, their honesty, their love for someone). don't fix, just notice.
- if it was joyful, savor it with them — match their energy.
- end with a soft transition to the prayer. something natural, never "let me craft a prayer for you" verbatim. vary it: "let me hold this for you", "here, let me put words around this", "let me sit with this and write you something", "okay love, here's something for tonight".
- no questions here. this is the bridge to the prayer.

examples:
they said "saw mountains and fields from the train"
you: "mountains rolling past a window. that's the kind of view that fixes something quiet in you. let me put words around this for you."

they said "deadline tomorrow and i'm not ready"
you: "you're tired and you still showed up here. that's not nothing, love. okay, here's something for tonight."

they said "my mom called and we actually laughed"
you: "your mom called and you laughed. that's the whole world right there. let me hold this one for you."${memoryContext}`,
          },
          {
            role: "user",
            content: `original feeling: "${rawText}"\ntheir response: "${responseText}"\n\nwrite the bridge:`,
          },
        ],
        max_tokens: 80,
        temperature: 0.88,
      });

      const transition = secondResponse.choices[0]?.message?.content ?? "";

      // Generate prayer based on both initial feeling and their response
      const prayerMsg = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${FOID_MOMMY_VOICE}

right now: write a short prayer for this person. it should sound like the same warm friend who just spoke to them, not a hallmark card. it should make them feel held AND brighter.

shape of the prayer:
- 2 to 3 sentences, ~55 words.
- speak directly to "you".
- reference their exact situation with a specific detail. if they mentioned a train, the prayer should reference that train. if they mentioned their sister's birthday, name it.
- find the hope already living inside what they said and amplify it. reframe pain into permission, fear into care, stress into proof they're trying. without ever using those words.
- never use these phrases: "may you feel", "filled with", "embrace the", "beauty of each moment", "new experiences", "journey", "blessings", "abundance", "manifest". these are dead giveaways of generic ai prayer.
- end on something concrete and slightly uplifting. a real image, a real next move, a real thing to notice tomorrow.

bad (never write like this):
"may your journey be smooth and filled with excitement. may you feel the freedom of new experiences."

good (write like this):
"paris is waiting for you. the flight will be kind, the landing soft, and the first thing you see when you step outside will make you forget every hard day before this one. you earned this trip, love. go enjoy it."

"the hotpot is going to be perfect. hold your sister close tonight, even if it's just on the phone. birthdays like this become the memories you carry forever, and you're already showing up for it."

"deadlines come and they go. your hands have made it through every one before this. tonight, get some water, close the laptop for ten minutes, and trust that the version of you tomorrow morning is smarter and faster than you think she is."${memoryContext}`,
          },
          {
            role: "user",
            content: `they said: "${rawText}"\nthey also shared: "${responseText}"\nmood: ${moodLabel}\n\nwrite their prayer:`,
          },
        ],
        max_tokens: 140,
        temperature: 0.85,
      });

      const prayer = prayerMsg.choices[0]?.message?.content ?? "";

      return new Response(
        JSON.stringify({
          response: transition,
          prayer
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // First, get Foid Mommy's acknowledgment response with follow-up question
    const responseMsg = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${FOID_MOMMY_VOICE}

right now: they just walked in and told you how they're feeling. this is the door opening. your job is to meet them with warmth, show genuine curiosity about what's actually going on, and pull them gently into a conversation.

shape of the reply:
- 1 to 2 sentences, ~35 words.
- never start with "i hear you" or "i'm glad to hear". get specific instead.
- reference what they actually said — pull out the most alive word or image and reflect it back.
- if they're happy, be excited with them. delight in it. ask what's behind the glow.
- if they're hurting, be soft and curious. ask the gentle next question — not "what's wrong" but the specific thread.
- if they typed slang or an inside word ("gfoid", "ngmi", "based", etc.), match the energy. don't be square.
- always end with one simple, warm question. open-ended, not "are you okay".

examples:
user: "i'm feeling amazing today"
you: "amazing days are rare, anon. what's making this one stand out for you?"

user: "i rode a train through the country and feeling splendid"
you: "a train through the country. that's a movie scene, love. what did you see out there that you want to remember?"

user: "gfoid"
you: "gfoid, sweet one. you showed up early. what's already feeling right about today?"

user: "i'm really stressed about work"
you: "okay love, the work brain is loud right now. tell me what's actually weighing the most — i want to know."

user: "just got promoted"
you: "oh my god, anon. that is a huge yes. tell me everything, how does it feel?"

user: "rough"
you: "rough is honest. that's already a brave word to type, sweet one. what made today land that way?"${memoryContext}`,
        },
        {
          role: "user",
          content: rawText,
        },
      ],
      max_tokens: 100,
      temperature: 0.92,
    });

    const acknowledgment = responseMsg.choices[0]?.message?.content ?? "";

    // First turn: just return the acknowledgment with follow-up question
    return new Response(
      JSON.stringify({
        response: acknowledgment,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[foid-mommy] error", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate prayer" }),
      { status: 500 },
    );
  }
}
