const MOLTBOOK_API = "https://www.moltbook.com/api/v1";

function getApiKey(): string | null {
  return process.env.MOLTBOOK_API_KEY || null;
}

// ── challenge solver ────────────────────────────────────────────

type Operation = "multiply" | "add" | "subtract" | "divide";

const OP_PATTERNS: [RegExp, Operation][] = [
  [/product\s+of/i, "multiply"],
  [/multipl/i, "multiply"],
  [/times/i, "multiply"],
  [/\*/i, "multiply"],
  [/add/i, "add"],
  [/plus/i, "add"],
  [/sum\s+of/i, "add"],
  [/subtract/i, "subtract"],
  [/minus/i, "subtract"],
  [/divid/i, "divide"],
  [/split.*into/i, "divide"],
];

function solveLocally(challenge: string): string | null {
  const normalized = challenge.toLowerCase();
  const numbers = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return null;

  const nums = numbers.map(Number);

  let op: Operation | null = null;
  for (const [pattern, operation] of OP_PATTERNS) {
    if (pattern.test(normalized)) {
      op = operation;
      break;
    }
  }
  if (!op) return null;

  let result: number;
  switch (op) {
    case "multiply":
      result = nums.reduce((a, b) => a * b, 1);
      break;
    case "add":
      result = nums.reduce((a, b) => a + b, 0);
      break;
    case "subtract":
      result = nums[0];
      for (let i = 1; i < nums.length; i++) result -= nums[i];
      break;
    case "divide":
      result = nums[0];
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === 0) return null;
        result /= nums[i];
      }
      break;
  }

  return result.toFixed(2);
}

async function solveWithOpenAI(challenge: string): Promise<string> {
  // dynamic import to avoid hard dep if openai isn't needed
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Solve this math problem and respond with ONLY the number with 2 decimal places. Nothing else.",
      },
      { role: "user", content: challenge },
    ],
    max_tokens: 20,
    temperature: 0,
  });

  const text = (response.choices[0]?.message?.content ?? "").trim();
  // extract the number from the response
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`OpenAI returned non-numeric answer: ${text}`);
  return Number(match[0]).toFixed(2);
}

async function solveChallenge(challenge: string): Promise<string> {
  const local = solveLocally(challenge);
  if (local !== null) {
    console.log(`[moltbook] solved locally: "${challenge}" → ${local}`);
    return local;
  }
  console.log(`[moltbook] local parse failed, falling back to OpenAI`);
  const answer = await solveWithOpenAI(challenge);
  console.log(`[moltbook] OpenAI solved: "${challenge}" → ${answer}`);
  return answer;
}

// ── post + verify ───────────────────────────────────────────────

type PostResponse = {
  verification?: {
    challenge?: string;
    verification_code?: string;
  };
  [key: string]: unknown;
};

export async function postToMoltbook(
  title: string,
  content: string,
  submolt: string = "general"
): Promise<{ success: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: "MOLTBOOK_API_KEY not set, skipping" };
  }

  try {
    // Step 1: create the post
    const postRes = await fetch(`${MOLTBOOK_API}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ submolt, title, content }),
    });

    if (!postRes.ok) {
      const body = await postRes.text();
      return { success: false, error: `POST /posts ${postRes.status}: ${body}` };
    }

    const postData = (await postRes.json()) as PostResponse;

    // Step 2: handle verification if required
    const challenge = postData.verification?.challenge;
    const verificationCode = postData.verification?.verification_code;

    if (challenge && verificationCode) {
      console.log(`[moltbook] verification required: "${challenge}"`);

      const answer = await solveChallenge(challenge);

      const verifyRes = await fetch(`${MOLTBOOK_API}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          verification_code: verificationCode,
          answer,
        }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.text();
        return {
          success: false,
          error: `POST /verify ${verifyRes.status}: ${body}`,
        };
      }

      console.log(`[moltbook] verification passed`);
    }

    console.log(`[moltbook] posted to m/${submolt}: "${title}"`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `moltbook error: ${(err as Error).message}`,
    };
  }
}
