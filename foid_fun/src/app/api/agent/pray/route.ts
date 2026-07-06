import { NextResponse } from "next/server";
import { keccak256, stringToBytes } from "viem";
import { verifyAgentSignature } from "../_lib/auth";
import { checkRateLimit, recordAction } from "@/lib/rateLimit";
import { isGloballyRateLimited } from "../_lib/globalCap";
import { requireAgentSecret } from "../_lib/apiSecret";
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
  // Fail-closed relayer gate: bot-only via AGENT_API_SECRET (see apiSecret.ts).
  const gate = requireAgentSecret(req);
  if (gate) return gate;
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

    // Rate limit (per-wallet)
    const limit = checkRateLimit(auth.wallet, "pray");
    if (!limit.ok) return json(false, undefined, limit.error, 429);

    // Global drain backstop: wallets are free, so a Sybil swarm can pass the
    // per-wallet check. This coarse all-callers cap bounds OpenAI + gas spend.
    // FOUNDER FOLLOW-UP: replace with a real allowlist/quota (audit H1).
    if (isGloballyRateLimited("pray")) {
      return json(false, undefined, "Service busy. Please try again shortly.", 429);
    }

    // Resolve feeling label
    const label = FEELING_MAP[feeling.toLowerCase()] ?? 1;

    const publicClient = getAgentPublicClient();
    const walletClient = getRelayerWalletClient();
    const account = getRelayerAccount();

    // Cheap on-chain cooldown precheck BEFORE spending an OpenAI completion.
    // The registry cooldown is keyed on the relayer (all agents share one
    // relayer wallet), so if it's still cooling down every pray this window
    // will revert — no reason to pay for a prayer we can't submit. This turns
    // a spammer's "burn completions then get rejected" into a cheap read-only
    // rejection. Fail-open on read errors: the submit below still enforces it.
    try {
      const nextAllowedAt = (await publicClient.readContract({
        address: CONTRACTS.PRAYER_REGISTRY as `0x${string}`,
        abi: PRAYER_REGISTRY_ABI,
        functionName: "nextAllowedAt",
        args: [account.address],
      })) as bigint;
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      if (nextAllowedAt > nowSec) {
        return json(
          false,
          undefined,
          "Prayer cooldown active. Only 1 prayer per 24h per relayer.",
          429,
        );
      }
    } catch (err) {
      console.warn("[api/agent/pray] cooldown precheck read failed (continuing):", err);
    }

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

    // Submit prayer onchain via relayer (clients resolved above).
    const prayerHash = keccak256(stringToBytes(prayerText));

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
      return json(false, undefined, `Onchain submission failed: ${msg.slice(0, 200)}`, 500);
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
