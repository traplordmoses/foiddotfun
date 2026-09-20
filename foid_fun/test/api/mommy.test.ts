import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), session: vi.fn(), budget: vi.fn() }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));
vi.mock("@/lib/mommySession", () => ({ consumeSessionToken: mocks.session }));
vi.mock("@/lib/requestBudget", () => ({ consumeBudget: mocks.budget, requestIdentity: () => "test" }));
import { POST } from "@/app/api/foid-mommy/route";
const req = (body: unknown) => new Request("https://foid.fun/api/foid-mommy", { method: "POST", body: JSON.stringify(body) });
const feeling = { feelingKey: "hopeful", feelingText: "looking forward to tomorrow" };
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "test-key"); mocks.session.mockResolvedValue({ ok: true }); mocks.budget.mockResolvedValue(true); mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ response: "a reflection", prayer: "a prayer" }) } }] }); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("AI generation", () => {
  it("generates reflection and prayer in one provider call", async () => {
    const res = await POST(req({ ...feeling, userResponse: "meeting a friend" }));
    expect(await res.json()).toEqual({ response: "a reflection", prayer: "a prayer" });
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("rejects invalid inputs before spending any provider budget", async () => {
    expect((await POST(req({ ...feeling, feelingText: "x".repeat(501) }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled();
  });
  it("requires a valid session", async () => { mocks.session.mockResolvedValue({ ok: false, reason: "invalid" }); expect((await POST(req(feeling))).status).toBe(401); expect(mocks.create).not.toHaveBeenCalled(); });
  it("checks the global budget", async () => { mocks.budget.mockResolvedValue(false); expect((await POST(req(feeling))).status).toBe(429); expect(mocks.create).not.toHaveBeenCalled(); });
  it("does not publish an incomplete provider reply", async () => { mocks.create.mockResolvedValue({ choices: [{ message: { content: '{"response":"hello"}' } }] }); expect((await POST(req({ ...feeling, userResponse: "hello" }))).status).toBe(502); });
});
