import { NextResponse } from "next/server";
import { keccak256, stringToBytes } from "viem";
import { verifyAgentSignature } from "../_lib/auth";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";
import { getRelayerWalletClient, getAgentPublicClient, getRelayerAccount } from "../_lib/relayer";
import { PRAYER_REGISTRY_ABI } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEELING_MAP: Record<string, number> = {
  happy: 1, calm: 2, hopeful: 3, stressed: 4, sad: 5,
  angry: 6, tired: 7, lost: 8, guilty: 9, pain: 10,
};

function json(success: boolean, data?: unknown, error?: string, status = 200) {
  return NextResponse.json({ success, ...(data ? { data } : {}), ...(error ? { error } : {}) }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, feeling, message, signature, timestamp } = body;

    if (!wallet || !feeling || !signature || !timestamp) {
      return json(false, undefined, "Missing required fields: wallet, feeling, signature, timestamp", 400);
    }

    // Verify signature
    const auth = await verifyAgentSignature({
      wallet,
      signature,
      timestamp,
      action: "pray",
      payload: feeling,
    });
    if (!auth.ok) return json(false, undefined, auth.error, 401);

    // Rate limit
    const limit = checkRateLimit(auth.wallet, "pray");
    if (!limit.ok) return json(false, undefined, limit.error, 429);

    // Resolve feeling label
    const label = FEELING_MAP[feeling.toLowerCase()] ?? 1;

    // Call foid-mommy for prayer generation
    const feelingText = message || feeling;
    let prayerText: string;
    let foidMommyResponse: string;

    try {
      const OpenAI = (await import("openai")).default;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
      const client = new OpenAI({ apiKey });

      // Single-turn prayer generation for agents (skip the conversational back-and-forth)
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are Foid Mommy, crafting a personalized prayer.
Create a short, meaningful prayer that references their situation and offers hope.
Style: 2-3 sentences max (~60 words). Speak to "you" directly. Simple, honest, grounded.
Also provide a brief warm acknowledgment (1 sentence).

Return EXACTLY two lines:
RESPONSE: <warm 1-sentence acknowledgment>
PRAYER: <2-3 sentence prayer>`,
          },
          {
            role: "user",
            content: `Feeling: ${feeling}\nMessage: ${feelingText}\n\nGenerate response and prayer:`,
          },
        ],
        max_tokens: 150,
        temperature: 0.88,
      });

      const text = response.choices[0]?.message?.content ?? "";
      const responseMatch = text.match(/^RESPONSE:\s*(.+)/im);
      const prayerMatch = text.match(/^PRAYER:\s*([\s\S]+)/im);

      foidMommyResponse = responseMatch?.[1]?.trim() ?? "your prayer has been heard.";
      prayerText = prayerMatch?.[1]?.trim() ?? "may this moment bring you peace.";
    } catch (err) {
      console.warn("[api/agent/pray] OpenAI fallback:", err);
      foidMommyResponse = "your prayer has been heard.";
      prayerText = "may this moment bring you what you need.";
    }

    // Submit prayer on-chain via relayer
    const prayerHash = keccak256(stringToBytes(prayerText));
    const publicClient = getAgentPublicClient();
    const walletClient = getRelayerWalletClient();
    const account = getRelayerAccount();

    let txHash: string;
    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: CONTRACTS.PRAYER_REGISTRY as `0x${string}`,
        abi: PRAYER_REGISTRY_ABI,
        functionName: "submitPrayer",
        args: [prayerHash, BigInt(label), 1n],
      });

      txHash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      if (msg.includes("CooldownActive")) {
        return json(false, undefined, "Prayer cooldown active. Only 1 prayer per 24h per relayer.", 429);
      }
      console.error("[api/agent/pray] tx failed:", err);
      return json(false, undefined, `On-chain submission failed: ${msg.slice(0, 200)}`, 500);
    }

    recordAction(auth.wallet, "pray");

    return json(true, {
      wallet: auth.wallet,
      feeling,
      label,
      prayerText,
      foidMommyResponse,
      prayerHash,
      txHash,
    });
  } catch (err) {
    console.error("[api/agent/pray]", err);
    return json(false, undefined, "Internal error", 500);
  }
}
