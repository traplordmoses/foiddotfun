/**
 * /api/chat/send — signature auth, sanitization, and rate limiting.
 *
 * Drives the actual POST handler with REAL EIP-191 signatures (viem
 * privateKeyToAccount), mocking only the Supabase REST fetch. Env vars are
 * read at module scope in the route, so the handler is imported dynamically
 * after they're stubbed.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildChatSignMessage } from "@/lib/chatAuth";

const SUPABASE_URL = "https://unit-test.supabase.co";
const ANON_KEY = "anon-key-for-tests";
const SERVICE_KEY = "service-key-for-tests";

const alice = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000001"
);
const mallory = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000002"
);

type PostHandler = (req: Request) => Promise<Response>;
let POST: PostHandler;

const fetchMock = vi.fn();

/** One canned Supabase: HEAD returns a window count, POST returns the row. */
function mockSupabase({ count = 0 }: { count?: number } = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `*/${count}` },
      });
    }
    const body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify([
        {
          id: "row-1",
          created_at: new Date().toISOString(),
          wallet_address: body.wallet_address,
          message: body.message,
          type: body.type,
        },
      ]),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  });
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function signedBody(
  message: string,
  {
    signer = alice,
    wallet = alice.address as string,
    timestamp = Date.now(),
    signedMessage = message,
  }: {
    signer?: typeof alice;
    wallet?: string;
    timestamp?: number;
    signedMessage?: string;
  } = {}
) {
  const signature = await signer.signMessage({
    message: buildChatSignMessage(wallet, signedMessage, timestamp),
  });
  return { wallet, message, timestamp, signature };
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  vi.stubGlobal("fetch", fetchMock);
  ({ POST } = await import("@/app/api/chat/send/route"));
});

beforeEach(() => {
  fetchMock.mockReset();
  mockSupabase();
});

describe("POST /api/chat/send — signature auth", () => {
  it("accepts a correctly signed message", async () => {
    const res = await POST(makeReq(await signedBody("gm from alice")));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message.message).toBe("gm from alice");
    expect(json.message.wallet_address).toBe(alice.address);
  });

  it("rejects a spoofed wallet (signed by someone else) with 401", async () => {
    // mallory signs, but claims to be alice
    const body = await signedBody("i am totally alice", {
      signer: mallory,
      wallet: alice.address,
    });
    const res = await POST(makeReq(body));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a tampered message with 401", async () => {
    const body = await signedBody("actually sent text", {
      signedMessage: "what alice really signed",
    });
    const res = await POST(makeReq(body));
    expect(res.status).toBe(401);
  });

  it("rejects a garbage signature with 401", async () => {
    const res = await POST(
      makeReq({
        wallet: alice.address,
        message: "gm",
        timestamp: Date.now(),
        signature: "0xdeadbeef",
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a missing signature with 401", async () => {
    const res = await POST(
      makeReq({ wallet: alice.address, message: "gm", timestamp: Date.now() })
    );
    expect(res.status).toBe(401);
  });

  it("rejects an expired timestamp with 401", async () => {
    const stale = Date.now() - 6 * 60 * 1000; // > 5 min window
    const body = await signedBody("late gm", { timestamp: stale });
    const res = await POST(makeReq(body));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/expired/);
  });

  it("rejects a future timestamp with 401", async () => {
    const future = Date.now() + 3 * 60 * 1000; // > 2 min skew
    const body = await signedBody("time traveler gm", { timestamp: future });
    const res = await POST(makeReq(body));
    expect(res.status).toBe(401);
  });

  it("a replayed valid payload inside the window still verifies (replay bounded by rate limit + expiry)", async () => {
    const body = await signedBody("replay me");
    expect((await POST(makeReq(body))).status).toBe(200);
    expect((await POST(makeReq(body))).status).toBe(200);
  });
});

describe("POST /api/chat/send — validation", () => {
  it("rejects an invalid wallet with 400", async () => {
    const res = await POST(
      makeReq({ wallet: "0xnope", message: "gm", timestamp: Date.now(), signature: "0xab" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing message with 400", async () => {
    const res = await POST(
      makeReq({ wallet: alice.address, timestamp: Date.now(), signature: "0xab" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing timestamp with 400", async () => {
    const res = await POST(
      makeReq({ wallet: alice.address, message: "gm", signature: "0xab" })
    );
    expect(res.status).toBe(400);
  });

  it("strips HTML before storing (signature covers the raw text)", async () => {
    const res = await POST(
      makeReq(await signedBody("<b>gm</b> <script>alert(1)</script>frens"))
    );
    expect(res.status).toBe(200);

    const insertCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(insertCall).toBeDefined();
    const inserted = JSON.parse(String(insertCall![1]!.body));
    expect(inserted.message).toBe("gm alert(1)frens");
  });

  it("rejects a message that is only HTML with 400", async () => {
    const res = await POST(makeReq(await signedBody("<script></script>")));
    expect(res.status).toBe(400);
  });

  it("rejects an over-length message with 400", async () => {
    const res = await POST(makeReq(await signedBody("x".repeat(281))));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/chat/send — Supabase wiring", () => {
  it("uses the service-role key for both count and insert", async () => {
    await POST(makeReq(await signedBody("key check")));
    for (const [, init] of fetchMock.mock.calls) {
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`);
      expect(headers.apikey).toBe(SERVICE_KEY);
    }
  });

  it("returns 429 once the wallet has 20 messages in the window, without inserting", async () => {
    mockSupabase({ count: 20 });
    const res = await POST(makeReq(await signedBody("message 21")));
    expect(res.status).toBe(429);
    const methods = fetchMock.mock.calls.map(([, init]) => (init as RequestInit)?.method);
    expect(methods).toEqual(["HEAD"]);
  });

  it("allows the send when under the limit", async () => {
    mockSupabase({ count: 19 });
    const res = await POST(makeReq(await signedBody("message 20")));
    expect(res.status).toBe(200);
  });

  it("scopes the rate-limit count to the sending wallet and the window", async () => {
    await POST(makeReq(await signedBody("scope check")));
    const headCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "HEAD");
    const url = new URL(String(headCall![0]));
    expect(url.searchParams.get("wallet_address")).toBe(`ilike.${alice.address}`);
    expect(url.searchParams.get("type")).toBe("eq.chat");
    expect(url.searchParams.get("created_at")).toMatch(/^gte\./);
  });
});
