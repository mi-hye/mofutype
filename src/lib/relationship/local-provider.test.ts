import { describe, expect, it } from "vitest";

import type {
  AnimalGroup,
  AnimalId,
  DerivedProfile,
  MBTIType,
} from "../astrology/types";
import { canonicalPairKey } from "./pair-key";
import { createRelationship } from "./local-provider";

function profile(
  animalId: AnimalId,
  animalGroup: AnimalGroup,
  mbti: MBTIType | null = null,
): DerivedProfile {
  return {
    version: 1,
    animalId,
    animalGroup,
    mbti,
    calculationMode: "date-only",
  };
}

function relationship(
  memberA: { id: string; profile: DerivedProfile },
  memberB: { id: string; profile: DerivedProfile },
) {
  return createRelationship({ memberA, memberB });
}

describe("canonicalPairKey", () => {
  it("sorts member IDs lexicographically", () => {
    expect(canonicalPairKey("member-z", "member-a")).toBe(
      "member-a:member-z",
    );
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

describe("createRelationship", () => {
  it.each([
    {
      first: profile("fawn", "MOON"),
      second: profile("wolf", "EARTH"),
      expected: "MOON_OVER_EARTH",
    },
    {
      first: profile("wolf", "EARTH"),
      second: profile("lion", "SUN"),
      expected: "EARTH_OVER_SUN",
    },
    {
      first: profile("lion", "SUN"),
      second: profile("fawn", "MOON"),
      expected: "SUN_OVER_MOON",
    },
  ] as const)(
    "uses the $expected group dynamic in both member orders",
    ({ first, second, expected }) => {
      expect(
        relationship(
          { id: "member-a", profile: first },
          { id: "member-b", profile: second },
        ).dynamic,
      ).toBe(expected);
      expect(
        relationship(
          { id: "member-b", profile: second },
          { id: "member-a", profile: first },
        ).dynamic,
      ).toBe(expected);
    },
  );

  it("uses SAME_GROUP when both animals share a group", () => {
    expect(
      relationship(
        { id: "member-a", profile: profile("fawn", "MOON") },
        { id: "member-b", profile: profile("sheep", "MOON") },
      ).dynamic,
    ).toBe("SAME_GROUP");
  });

  it("returns exactly the same result when members are swapped", () => {
    const memberA = {
      id: "member-z",
      profile: profile("lion", "SUN", "ENTJ"),
    };
    const memberB = {
      id: "member-a",
      profile: profile("fawn", "MOON", "INFP"),
    };

    expect(relationship(memberA, memberB)).toEqual(
      relationship(memberB, memberA),
    );
  });

  it("never returns a numeric compatibility score or percentage copy", () => {
    const result = relationship(
      { id: "member-a", profile: profile("wolf", "EARTH") },
      { id: "member-b", profile: profile("lion", "SUN") },
    );
    const copy = [
      result.freeTitleJa,
      result.freeSummaryJa,
      ...Object.values(result.detail),
    ];

    expect(result).not.toHaveProperty("score");
    expect(copy.every((value) => !value.includes("%"))).toBe(true);
  });

  it("adds the same deterministic modifier when both MBTI values are known", () => {
    const memberA = {
      id: "member-a",
      profile: profile("fawn", "MOON", "INFP"),
    };
    const memberB = {
      id: "member-b",
      profile: profile("wolf", "EARTH", "ENTJ"),
    };

    const first = relationship(memberA, memberB);
    const second = relationship(memberA, memberB);

    expect(first).toEqual(second);
    expect(first.freeSummaryJa).toContain("ENTJ");
    expect(first.freeSummaryJa).toContain("INFP");
  });

  it("omits MBTI copy when either value is unknown and stays complete", () => {
    const result = relationship(
      { id: "member-a", profile: profile("fawn", "MOON", null) },
      { id: "member-b", profile: profile("wolf", "EARTH", "ENTJ") },
    );
    const allCopy = JSON.stringify(result);

    expect(allCopy).not.toContain("MBTI");
    expect(allCopy).not.toContain("ENTJ");
    expect(result.freeTitleJa.trim()).not.toBe("");
    expect(result.freeSummaryJa.trim()).not.toBe("");
  });

  it("returns all six non-empty relationship detail sections", () => {
    const detail = relationship(
      { id: "member-a", profile: profile("fawn", "MOON") },
      { id: "member-b", profile: profile("wolf", "EARTH") },
    ).detail;

    expect(Object.keys(detail).sort()).toEqual(
      [
        "attractionJa",
        "communicationJa",
        "frictionJa",
        "longTermJa",
        "reconciliationJa",
        "unspokenJa",
      ].sort(),
    );
    expect(Object.values(detail).every((value) => value.trim() !== "")).toBe(
      true,
    );
  });
});
