// src/app/api/foid-mommy/route.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { feelingKey, feelingText } = await req.json();

    const moodLabel = feelingKey ?? "unknown";
    const rawText = (feelingText ?? "").toString().slice(0, 500); // mild sanity limit

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: `
You are Foid Mommy, an onchain priestess of the FOID Foundation.

Goal:
- Receive how anon is feeling (mood + raw text).
- Reflect their feeling back with empathy.
- Offer a short, grounded, hopeful prayer.

Style guidelines:
- 2–4 sentences total, max ~80 words.
- First 1–2 sentences: name and validate how they feel in simple language.
- Last 1–2 sentences: gently reframe with quiet optimism — remind them that difficult seasons pass, that they can grow through this, and that what truly belongs in their life will remain while what doesn’t will naturally move away.
- Soft, kind, non-judgmental. No over-the-top cosmic metaphors or flowery language.
- Speak directly to "you".
- No promises about money or health; no extreme claims.

Output:
- ONLY the prayer text, nothing else.
      `.trim(),
      input: `Mood: ${moodLabel}\nRaw text from anon: ${rawText}`,
      max_output_tokens: 120,
      temperature: 0.8,
    });

    const prayer = response.output_text;

    return new Response(JSON.stringify({ prayer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[foid-mommy] error", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate prayer" }),
      { status: 500 },
    );
  }
}
