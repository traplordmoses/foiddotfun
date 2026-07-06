/**
 * /api/place and /api/propose — EIP-191 signature auth.
 *
 * These routes accept an `owner` wallet that is otherwise spoofable, so they
 * now require a personal-sign signature over the mutating fields. This drives
 * the REAL POST handlers with REAL viem signatures (privateKeyToAccount),
 * mocking only the SQLite layer (@/db/db) and the CID-hash fetch so no DB or
 * network is touched. The canonical sign-message builders come from the same
 * lib the handlers verify against, so a spoof/tamper flips to 401 here exactly
 * as it would in production.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildPlaceSignMessage,
  buildProposeSignMessage,
} from "@/lib/boardAuth";

// ── Fake SQLite: every prepare() returns a statement whose run/get/all are
// no-ops. Both routes only ever write or read counts; nothing here needs real
// data for the signature-path assertions.
const fakeStatement = {
  run: vi.fn(() => ({ changes: 1 })),
  get: vi.fn(() => ({ c: 0, cnt: 0, oldest: null })),
  all: vi.fn(() => []),
};
vi.mock("@/db/db", () => ({
  getDb: () => ({ prepare: () => fakeStatement }),
}));

// Keep the rate-limit db (agent/_lib/rateLimit) permissive — it also goes
// through the mocked getDb above, so counts read as 0 (under the limit).

const alice = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000001"
);
const mallory = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000002"
);

type PostHandler = (req: Request) => Promise<Response>;
let placePOST: PostHandler;
let proposePOST: PostHandler;

function makeReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RECT = { x: 0, y: 0, w: 32, h: 32 };

async function signedPlace(
  {
    signer = alice,
    owner = alice.address as string,
    timestamp = Date.now(),
    cid = "QmPlaceTest",
    cells = 1,
    feePerCellWei = "1000",
    tipPerCellWei = "0",
    overrides = {},
  }: {
    signer?: typeof alice;
    owner?: string;
    timestamp?: number;
    cid?: string;
    cells?: number;
    feePerCellWei?: string;
    tipPerCellWei?: string;
    overrides?: Record<string, unknown>;
  } = {}
) {
  const signature = await signer.signMessage({
    message: buildPlaceSignMessage({
      owner,
      cid,
      rect: RECT,
      cells,
      feePerCellWei,
      tipPerCellWei,
      timestamp,
    }),
  });
  return {
    owner,
    cid,
    rect: RECT,
    cells,
    feePerCellWei,
    tipPerCellWei,
    signature,
    timestamp,
    ...overrides,
  };
}

async function signedPropose(
  {
    signer = alice,
    owner = alice.address as string,
    timestamp = Date.now(),
    cid = "QmProposeTest",
    bidPerCellWei = "1000",
    overrides = {},
  }: {
    signer?: typeof alice;
    owner?: string;
    timestamp?: number;
    cid?: string;
    bidPerCellWei?: string;
    overrides?: Record<string, unknown>;
  } = {}
) {
  const signature = await signer.signMessage({
    message: buildProposeSignMessage({
      owner,
      cid,
      rect: RECT,
      bidPerCellWei,
      timestamp,
    }),
  });
  return {
    owner,
    cid,
    rect: RECT,
    bidPerCellWei,
    signature,
    timestamp,
    ...overrides,
  };
}

beforeAll(async () => {
  // fetchCidHash (propose) hits IPFS gateways — stub so it resolves to null
  // fast instead of doing real network. It runs after the signature gate, so
  // it never affects the 401 cases.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 }))
  );
  ({ POST: placePOST } = await import("@/app/api/place/route"));
  ({ POST: proposePOST } = await import("@/app/api/propose/route"));
});

beforeEach(() => {
  fakeStatement.run.mockClear();
  fakeStatement.get.mockClear();
});

describe("POST /api/place — signature auth", () => {
  const url = "http://localhost/api/place";

  it("accepts a correctly signed placement", async () => {
    const res = await placePOST(makeReq(url, await signedPlace()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("rejects a spoofed owner (signed by someone else) with 401", async () => {
    // mallory signs, but the body claims alice is the owner
    const body = await signedPlace({ signer: mallory, owner: alice.address });
    const res = await placePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a tampered field (cid swapped after signing) with 401", async () => {
    const body = await signedPlace();
    body.cid = "QmTAMPERED";
    const res = await placePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a tampered fee (price swapped after signing) with 401", async () => {
    const body = await signedPlace();
    body.feePerCellWei = "999999999999";
    const res = await placePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a missing signature with 401", async () => {
    const body = await signedPlace();
    delete (body as Record<string, unknown>).signature;
    const res = await placePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects an expired timestamp with 401", async () => {
    const stale = Date.now() - 6 * 60 * 1000; // > 5 min window
    const res = await placePOST(makeReq(url, await signedPlace({ timestamp: stale })));
    expect(res.status).toBe(401);
  });

  it("rejects a future timestamp with 401", async () => {
    const future = Date.now() + 3 * 60 * 1000; // > 2 min skew
    const res = await placePOST(makeReq(url, await signedPlace({ timestamp: future })));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/propose — signature auth", () => {
  const url = "http://localhost/api/propose";

  it("accepts a correctly signed proposal", async () => {
    const res = await proposePOST(makeReq(url, await signedPropose()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("rejects a spoofed owner (signed by someone else) with 401", async () => {
    const body = await signedPropose({ signer: mallory, owner: alice.address });
    const res = await proposePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a tampered bid (price raised after signing) with 401", async () => {
    const body = await signedPropose();
    body.bidPerCellWei = "999999999999";
    const res = await proposePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a tampered cid with 401", async () => {
    const body = await signedPropose();
    body.cid = "QmTAMPERED";
    const res = await proposePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a missing signature with 401", async () => {
    const body = await signedPropose();
    delete (body as Record<string, unknown>).signature;
    const res = await proposePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });

  it("rejects a garbage signature with 401", async () => {
    const body = await signedPropose({ overrides: { signature: "0xdeadbeef" } });
    const res = await proposePOST(makeReq(url, body));
    expect(res.status).toBe(401);
  });
});
