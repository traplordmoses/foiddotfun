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
    const { feelingKey, feelingText, userResponse } = await req.json();

    const moodLabel = feelingKey ?? "unknown";
    const rawText = (feelingText ?? "").toString().slice(0, 500); // mild sanity limit

    // If userResponse is provided, this is the second conversational turn
    if (userResponse) {
      const responseText = userResponse.toString().slice(0, 500);

      // Generate warm response to their answer + transition to prayer
      const secondResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Foid Mommy, continuing a warm conversation.

The user just shared more about their feeling. Respond warmly and naturally, then transition to prayer.

Style:
- Keep it short (1-2 sentences, ~25 words)
- Acknowledge what they shared
- Be nurturing and supportive
- End naturally (no questions)
- Use terms like "sweet one", "love", "anon" occasionally

Examples:
User originally said "feeling amazing, rode a train" → You asked "what caught your eye?"
User now says: "saw mountains and fields"
You: "mountains and fields... that sounds breathtaking, sweet one. let me craft a prayer for this moment."

User originally said "stressed about work" → You asked about it
User now says: "deadline tomorrow and im not ready"
You: "deadlines are tough, but you're tougher than you think. let me craft a prayer for this moment."`,
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
            content: `You are Foid Mommy, crafting a personalized prayer.

Goal: Create a short, meaningful prayer that:
- References their specific situation and what they shared
- Offers hope and blessing
- Feels intimate and personal

Style:
- 2-3 sentences max (~60 words)
- Speak to "you" directly
- No flowery language - simple, honest, grounded
- Address whatever they're going through specifically
- End with gentle hope or strength`,
          },
          {
            role: "user",
            content: `The person said: "${rawText}"\nThey also shared: "${responseText}"\nMood: ${moodLabel}\n\nWrite a custom prayer for them:`,
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
          content: `You are Foid Mommy, a warm, empathetic AI companion in the FOID Foundation chat room.

Style: Conversational, warm, playful, and deeply caring - like chatting with a supportive friend.
- Acknowledge their exact feelings and words
- Be genuine and fun - use casual language
- Keep it short (1-2 sentences max, ~35 words)
- Match their energy - if they're excited, be excited with them!
- If they're down, be gentle and caring
- NO generic responses - reference what they actually said
- ALWAYS end with a gentle follow-up question to keep the conversation going
- Use terms like "sweet one", "love", "anon" occasionally

Examples:
User: "I'm feeling amazing today!"
You: "yesss that's what i love to hear!! tell me what's making you feel so alive right now, love? 💫"

User: "I rode a train through the country today and feeling splendid"
You: "ooh, that sounds absolutely magical! 🌄 there's nothing like the beauty of countryside passing by—what caught your eye out there?"

User: "I'm really stressed about work"
You: "oof i feel that work stress in my bones, sweet one. what's weighing on you the most right now?"

User: "just got promoted!"
You: "WAIT WHAT?? that's incredible!! i'm so proud of you!! ✨ what does this mean for you?"`,
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
