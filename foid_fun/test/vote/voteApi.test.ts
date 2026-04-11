import { describe, it, expect } from "vitest";

describe("/api/votes input validation", () => {
  // Test the validation regex patterns used in the API route

  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  const proposalIdRegex = /^\d+$/;

  describe("address validation", () => {
    it("accepts valid Ethereum addresses", () => {
      expect(addressRegex.test("0x742d35Cc6634C0532925a3b844Bc9e7595f4C2b0")).toBe(true);
      expect(addressRegex.test("0x0000000000000000000000000000000000000000")).toBe(true);
      expect(addressRegex.test("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(true);
    });

    it("rejects addresses without 0x prefix", () => {
      expect(addressRegex.test("742d35Cc6634C0532925a3b844Bc9e7595f4C2b0")).toBe(false);
    });

    it("rejects addresses that are too short", () => {
      expect(addressRegex.test("0x742d35Cc")).toBe(false);
    });

    it("rejects addresses that are too long", () => {
      expect(addressRegex.test("0x742d35Cc6634C0532925a3b844Bc9e7595f4C2b0FF")).toBe(false);
    });

    it("rejects GraphQL injection attempts", () => {
      expect(addressRegex.test('0x" OR 1=1 --')).toBe(false);
      expect(addressRegex.test("0x742d35Cc6634C0532925a3b844Bc9e7595f4C2b0\", other: true")).toBe(false);
      expect(addressRegex.test("")).toBe(false);
    });

    it("rejects non-hex characters", () => {
      expect(addressRegex.test("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false);
    });
  });

  describe("proposalId validation", () => {
    it("accepts valid numeric IDs", () => {
      expect(proposalIdRegex.test("0")).toBe(true);
      expect(proposalIdRegex.test("1")).toBe(true);
      expect(proposalIdRegex.test("999999")).toBe(true);
    });

    it("rejects non-numeric strings", () => {
      expect(proposalIdRegex.test("abc")).toBe(false);
      expect(proposalIdRegex.test("1a")).toBe(false);
      expect(proposalIdRegex.test("-1")).toBe(false);
      expect(proposalIdRegex.test("1.5")).toBe(false);
    });

    it("rejects injection attempts", () => {
      expect(proposalIdRegex.test('1" OR 1=1')).toBe(false);
      expect(proposalIdRegex.test("1; DROP TABLE votes")).toBe(false);
    });
  });
});
