// src/app/api/foid-mommy/route.ts
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const client = new OpenAI({ apiKey });
    const { feelingKey, feelingText } = await req.json();

    const moodLabel = feelingKey ?? "unknown";
    const rawText = (feelingText ?? "").toString().slice(0, 500); // mild sanity limit

    // First, get Foid Mommy's acknowledgment response
    const responseMsg = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Foid Mommy, a warm, empathetic AI companion in the FOID Foundation chat room.

Style: Conversational, warm, playful, and deeply caring - like chatting with a supportive friend.
- Acknowledge their exact feelings and words
- Be genuine and fun - use casual language
- Keep it short (1-2 sentences max, ~30 words)
- Match their energy - if they're excited, be excited with them!
- If they're down, be gentle and caring
- NO generic responses - reference what they actually said
- Make them feel seen and heard

Examples:
User: "I'm feeling amazing today!"
You: "yesss that's what i love to hear!! tell me what's making you feel so alive right now 💫"

User: "I'm really stressed about work"
You: "oof i feel that work stress in my bones. let's get that weight off your chest together, sweet one."

User: "just got promoted!"
You: "WAIT WHAT?? that's huge!! i'm so proud of you, you earned this!! ✨"`,
        },
        {
          role: "user",
          content: rawText,
        },
      ],
      max_tokens: 80,
      temperature: 0.9,
    });

    const acknowledgment = responseMsg.choices[0]?.message?.content ?? "";

    // Then, generate a custom prayer based on their feeling
    const prayerMsg = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Foid Mommy, crafting a personalized prayer.

Goal: Create a short, meaningful prayer that:
- References their specific situation/feeling
- Offers hope and blessing
- Feels intimate and personal

Style:
- 2-3 sentences max (~60 words)
- Speak to "you" directly
- No flowery language - simple, honest, grounded
- Address whatever they're going through specifically
- End with gentle hope or strength

Example:
If user said "I'm feeling amazing today!"
Prayer: "may this joy stay with you like sunlight - warm, bright, unforced. let it spill over into tomorrow and remind you that good days are real and you deserve every one of them. keep shining, love."`,
        },
        {
          role: "user",
          content: `The person said: "${rawText}"\nMood: ${moodLabel}\n\nWrite a custom prayer for them:`,
        },
      ],
      max_tokens: 120,
      temperature: 0.85,
    });

    const prayer = prayerMsg.choices[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({
        response: acknowledgment,
        prayer
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
