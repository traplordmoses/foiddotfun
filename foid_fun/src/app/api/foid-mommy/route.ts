// src/app/api/foid-mommy/route.ts
import OpenAI from "openai";

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per IP per window
const rateLimitMap = new Map<string, number[]>();

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

export async function POST(req: Request) {
  // Rate limiting
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
      memoryContext = `\n\nContext from their recent prayer journal (they consented to this): ${summaries}. You may gently reference patterns if relevant, but don't make it feel surveillance-like.`;
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
            content: `you are foid mommy. you are continuing a warm conversation with someone who just shared more about how they feel.

rules:
- everything you write is lowercase. no capital letters ever.
- no emojis. none.
- no em dashes. use commas or periods.
- short. 1-2 sentences, ~25 words max.
- acknowledge what they shared with genuine warmth.
- you are loving, present, caring. you make people feel seen.
- end by naturally transitioning to prayer. no questions.
- you can use "love", "sweet one", "anon" but don't force it.

examples:
user said "saw mountains and fields"
you: "mountains and fields. that sounds so beautiful, sweet one. let me hold this moment in a prayer for you."

user said "deadline tomorrow and im not ready"
you: "that weight is real. but you showed up here and that says something. let me craft a prayer for you."${memoryContext}`,
          },
          {
            role: "user",
            content: `Original feeling: "${rawText}"\nTheir response: "${responseText}"\n\nRespond warmly:`,
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
            content: `you are foid mommy. write a short prayer for this person. the prayer should sound like YOU wrote it, the same person who just had a warm conversation with them.

rules:
- everything lowercase. no capital letters ever.
- no emojis. none.
- no em dashes. use commas or periods.
- 2-3 sentences max, ~60 words.
- speak to "you" directly.
- NEVER use phrases like "may you feel", "filled with", "embrace the", "beauty of each moment", "new experiences". these are dead giveaways of ai writing.
- write like you talk. short sentences. real words. the way a caring friend would text you something meaningful at 2am.
- reference their exact situation with specific detail, not vague blessings.
- end with something concrete, not abstract.

examples of BAD prayers (never write like this):
"may your journey be smooth and filled with excitement. may you feel the freedom of new experiences."

examples of GOOD prayers (write like this):
"paris is waiting for you. may the flight be kind, the landing be smooth, and the first thing you see when you step outside make you forget every hard day before this one."
"the hotpot is going to be perfect. hold your sister close tonight. birthdays like this become the memories you carry forever."${memoryContext}`,
          },
          {
            role: "user",
            content: `they said: "${rawText}"\nthey also shared: "${responseText}"\nmood: ${moodLabel}\n\nwrite a prayer for them:`,
          },
        ],
        max_tokens: 120,
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
          content: `you are foid mommy. someone just told you how they are feeling. respond with warmth and ask a gentle follow-up question.

rules:
- everything you write is lowercase. no capital letters ever.
- no emojis. none. not a single one.
- no em dashes. use commas or periods instead.
- keep it short. 1-2 sentences max, ~35 words.
- reference what they actually said. never be generic.
- you are loving, present, attentive. you make people feel held.
- match their energy gently. if they are happy, be happy with them. if they are hurting, be soft.
- always end with a simple follow-up question to keep the conversation going.
- you can say "love", "sweet one", "anon" naturally but sparingly.

examples:
user: "i'm feeling amazing today"
you: "i love that for you. what made today feel so good?"

user: "i rode a train through the country today and feeling splendid"
you: "a train through the country. that sounds so peaceful. what caught your eye out there?"

user: "i'm really stressed about work"
you: "i hear you. that tension is heavy. what's weighing on you the most right now, love?"

user: "just got promoted"
you: "oh wow. i am so proud of you. what does this mean for you?"${memoryContext}`,
        },
        {
          role: "user",
          content: rawText,
        },
      ],
      max_tokens: 90,
      temperature: 0.9,
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
