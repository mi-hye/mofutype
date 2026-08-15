import { describe, expect, it } from "vitest";

import type {
  AnimalGroup,
  AnimalId,
  DerivedProfile,
  MBTIType,
} from "../astrology/types";
import { canonicalPairKey } from "./pair-key";
import {
  createRelationship,
  RelationshipValidationError,
} from "./local-provider";

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

  it("rejects a malformed runtime animal group with a stable typed error", () => {
    expect(() =>
      relationship(
        {
          id: "member-a",
          profile: profile("fawn", "STAR" as never),
        },
        { id: "member-b", profile: profile("wolf", "EARTH") },
      ),
    ).toThrowError(
      new RelationshipValidationError(
        "INVALID_ANIMAL_GROUP",
        "Invalid animal group",
      ),
    );
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

  it("uses distinct dynamic copy with stable animal-name order", () => {
    const cases = [
      {
        result: relationship(
          { id: "member-a", profile: profile("sheep", "MOON") },
          { id: "member-b", profile: profile("fawn", "MOON") },
        ),
        title: "こじか × ひつじ、似たもの同士で話が早い",
        summary:
          "テンポが自然にそろうコンビ。わかり合えるぶん、思い込みだけは言葉でほどこう。",
      },
      {
        result: relationship(
          { id: "member-a", profile: profile("wolf", "EARTH") },
          { id: "member-b", profile: profile("fawn", "MOON") },
        ),
        title: "こじか × 狼、やわらかさが現実を動かす",
        summary:
          "気持ちを拾う月タイプと足場を固める地球タイプ。違う得意技が、意外といいパスになる。",
      },
      {
        result: relationship(
          { id: "member-a", profile: profile("wolf", "EARTH") },
          { id: "member-b", profile: profile("lion", "SUN") },
        ),
        title: "ライオン × 狼、勢いをちゃんと形にする",
        summary:
          "走り出す太陽タイプと着地させる地球タイプ。熱量と段取りがかみ合えば頼もしい。",
      },
      {
        result: relationship(
          { id: "member-a", profile: profile("lion", "SUN") },
          { id: "member-b", profile: profile("fawn", "MOON") },
        ),
        title: "こじか × ライオン、まぶしさが心の扉を開く",
        summary:
          "場を照らす太陽タイプと気配を読む月タイプ。勢いにやさしい余白が加わるコンビ。",
      },
    ];

    for (const { result, title, summary } of cases) {
      expect(result.freeTitleJa).toBe(title);
      expect(result.freeSummaryJa).toBe(summary);
    }
    expect(new Set(cases.map(({ result }) => result.freeTitleJa)).size).toBe(4);
    expect(new Set(cases.map(({ result }) => result.freeSummaryJa)).size).toBe(
      4,
    );
  });

  it("never returns score fields or score-like copy for any dynamic", () => {
    const results = [
      relationship(
        { id: "same-a", profile: profile("fawn", "MOON") },
        { id: "same-b", profile: profile("sheep", "MOON") },
      ),
      relationship(
        { id: "moon", profile: profile("fawn", "MOON") },
        { id: "earth", profile: profile("wolf", "EARTH") },
      ),
      relationship(
        { id: "earth", profile: profile("wolf", "EARTH") },
        { id: "sun", profile: profile("lion", "SUN") },
      ),
      relationship(
        { id: "sun", profile: profile("lion", "SUN") },
        { id: "moon", profile: profile("fawn", "MOON") },
      ),
    ];
    const scoreLikeCopy = /[%％]|\d+(?:\.\d+)?\s*点/;

    for (const result of results) {
      const copy = [
        result.freeTitleJa,
        result.freeSummaryJa,
        ...Object.values(result.detail),
      ];

      expect(result).not.toHaveProperty("score");
      expect(copy).not.toEqual(
        expect.arrayContaining([expect.stringMatching(scoreLikeCopy)]),
      );
    }
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
