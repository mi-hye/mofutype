import { describe, expect, it } from "vitest";

import { canonicalPairKey } from "./pair-key";

describe("canonicalPairKey", () => {
  it("sorts member IDs lexicographically", () => {
    expect(canonicalPairKey("member-z", "member-a")).toBe(
      "member-a:member-z",
    );
  });

  it("keeps delimiter-bearing member pairs unambiguous", () => {
    const firstPair = canonicalPairKey("a", "b:c");
    const secondPair = canonicalPairKey("a:b", "c");

    expect(firstPair).toBe("a:b%3Ac");
    expect(secondPair).toBe("a%3Ab:c");
    expect(firstPair).not.toBe(secondPair);
  });

  it("sorts raw IDs before encoding colon and percent characters", () => {
    expect(canonicalPairKey("b%", "a:")).toBe("a%3A:b%25");
    expect(canonicalPairKey("a:", "b%")).toBe("a%3A:b%25");
  });

  it.each(["", "   "])("rejects an empty member ID (%j)", (emptyId) => {
    expect(() => canonicalPairKey(emptyId, "member-b")).toThrowError(
      "Member ID must not be empty",
    );
    expect(() => canonicalPairKey("member-a", emptyId)).toThrowError(
      "Member ID must not be empty",
    );
  });

  it("rejects equal member IDs", () => {
    expect(() => canonicalPairKey("member-a", "member-a")).toThrowError(
      "Relationship requires two distinct member IDs",
    );
  });
});
