import { describe, expect, it, vi } from "vitest";
import { submitVoteBatch } from "@/lib/voteBatch";
describe("vote batch confirmation", () => {
  it("marks a vote confirmed only after a successful receipt", async () => {
    const receipt = vi.fn(async () => ({ status: "success" as const }));
    const result = await submitVoteBatch([[1, true]], async () => "0xabc", receipt, () => {});
    expect(result.submissions[0].status).toBe("confirmed"); expect(receipt).toHaveBeenCalledWith("0xabc");
  });
  it("preserves a partial batch when the next wallet request is rejected", async () => {
    const send = vi.fn().mockResolvedValueOnce("0xabc").mockRejectedValue(new Error("rejected"));
    const result = await submitVoteBatch([[1, true], [2, false], [3, true]], send, async () => ({ status: "success" }), () => {});
    expect(result.submissions.map((r) => r.id)).toEqual([1]); expect(send).toHaveBeenCalledTimes(2); expect(result.errors).toHaveLength(1);
  });
  it("stops on an uncertain receipt without resending it", async () => {
    const send = vi.fn().mockResolvedValue("0xabc");
    const result = await submitVoteBatch([[1, true], [2, true]], send, async () => { throw new Error("timeout"); }, () => {});
    expect(result.submissions[0].status).toBe("pending"); expect(send).toHaveBeenCalledOnce();
  });
  it("does not treat a reverted receipt as a successful vote", async () => {
    const result = await submitVoteBatch([[1, true]], async () => "0xabc", async () => ({ status: "reverted" }), () => {});
    expect(result.submissions[0].status).toBe("reverted"); expect(result.errors).toHaveLength(1);
  });
});
