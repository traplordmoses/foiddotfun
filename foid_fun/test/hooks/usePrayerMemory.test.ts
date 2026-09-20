/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePrayerMemory } from "@/hooks/usePrayerMemory";
beforeEach(() => localStorage.clear());
describe("prayer memory consent", () => {
  it("does not inherit the old automatically granted consent", async () => {
    localStorage.setItem("foid-prayer-memory-consent", "granted");
    const { result } = renderHook(() => usePrayerMemory());
    await waitFor(() => expect(result.current.needsConsentPrompt).toBe(true));
    expect(result.current.hasConsent).toBe(false);
  });
  it("only stores entries after an explicit opt-in and deletes them on revoke", async () => {
    const { result } = renderHook(() => usePrayerMemory());
    act(() => result.current.addEntry("hopeful"));
    expect(localStorage.getItem("foid-prayer-journal")).toBeNull();
    act(() => result.current.grantConsent());
    act(() => result.current.addEntry("hopeful"));
    expect(localStorage.getItem("foid-prayer-journal")).toContain("hopeful");
    act(() => result.current.revokeConsent());
    expect(localStorage.getItem("foid-prayer-journal")).toBeNull();
    expect(result.current.hasConsent).toBe(false);
  });
});
