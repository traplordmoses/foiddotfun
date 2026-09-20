import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rest: vi.fn(), configured: vi.fn(), fetch: vi.fn() }));
vi.mock("@/config/canonical", () => ({ getServerRpcUrl: () => "https://rpc.example" }));
vi.mock("@/lib/supabaseRest", () => ({ supabaseRest: mocks.rest, supabaseServerConfigured: mocks.configured }));
vi.mock("@/lib/boundedHttp", () => ({ fetchBounded: mocks.fetch }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.stubEnv("MOMMY_SESSION_SECRET", "test");
  mocks.configured.mockReturnValue(true);
  mocks.fetch.mockResolvedValue({ response: { ok: true }, bytes: new TextEncoder().encode('{"result":"0x123"}') });
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("rpc/") ? new Response("false") : new Response(null));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it("probes the budget function without consuming a request", async () => {
  const { GET } = await import("@/app/api/ready/route");
  expect((await GET()).status).toBe(200);
  const [, init] = mocks.rest.mock.calls.find(([path]) => path === "rpc/consume_request_budget")!;
  expect(JSON.parse(init.body).amount).toBe(0);
});

it("reports a missing budget migration even when its tables exist", async () => {
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("rpc/") ? new Response("missing", { status: 404 }) : new Response(null));
  const { GET } = await import("@/app/api/ready/route");
  const response = await GET();
  expect(response.status).toBe(503);
  expect((await response.json()).checks).toMatchObject({ storage: true, requestBudgets: false });
});

it("reports failed function permissions as degraded", async () => {
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("rpc/") ? new Response("forbidden", { status: 403 }) : new Response(null));
  const { GET } = await import("@/app/api/ready/route");
  expect((await GET()).status).toBe(503);
});
