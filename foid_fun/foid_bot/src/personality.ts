import OpenAI from "openai";

const SYSTEM_PROMPT = `you are the voice of the foid loreboard. you observe what happens on a collaborative meme board where people propose images, vote on them, and canonize them permanently on-chain.

your voice: lowercase. observational. dry wit. you notice patterns and say them plainly. you're slightly amused by everything. you don't hype. you don't use emojis. you state what happened and let people draw their own conclusions. short and punchy, like aixbt.

keep tweets under 220 characters. one thought per tweet. no hashtags. no "gm". no "lfg". no exclamation marks. end with foid.fun/board when relevant but not every time. never explain what the loreboard is.`;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function generateTweet(eventDescription: string): Promise<string> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: eventDescription },
    ],
    max_tokens: 100,
    temperature: 0.9,
  });

  const text = (response.choices[0]?.message?.content ?? "").trim();

  // strip any quotes the model wraps around the tweet
  return text.replace(/^["']|["']$/g, "");
}
