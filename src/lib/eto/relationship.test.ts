import { describe, expect, it } from "vitest";

import {
  createEtoRelationship,
  RelationshipValidationError,
  type EtoRelationshipCategory,
} from "./relationship";
import {
  MBTI_TYPES,
  ZODIAC_IDS,
  type DerivedEtoProfile,
  type FiveElement,
  type MbtiType,
  type Polarity,
} from "./types";

function profile(overrides: Partial<DerivedEtoProfile> = {}): DerivedEtoProfile {
  return {
    version: 1,
    zodiacId: "rat",
    mbti: null,
    dayMaster: { element: "WOOD", polarity: "YANG" },
    fiveElements: null,
    yinYang: null,
    calculationMode: "date-only",
    boundaryState: "solar-term-ambiguous",
    engineVersion: "mofu-eto-four-pillars-v1",
    ...overrides,
  };
}

function relationship(
  profileA: DerivedEtoProfile,
  profileB: DerivedEtoProfile,
) {
  return createEtoRelationship({
    memberA: { id: "member-a", profile: profileA },
    memberB: { id: "member-b", profile: profileB },
  });
}

function key(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function collectKeys(value: unknown, result: string[] = []): string[] {
  if (value === null || typeof value !== "object") return result;
  for (const [field, nested] of Object.entries(value)) {
    result.push(field);
    collectKeys(nested, result);
  }
  return result;
}

describe("zodiac relationship layer", () => {
  const natural = [
    ["rat", "ox"],
    ["tiger", "boar"],
    ["rabbit", "dog"],
    ["dragon", "rooster"],
    ["snake", "monkey"],
    ["horse", "sheep"],
  ] as const;
  const expandingGroups = [
    ["monkey", "rat", "dragon"],
    ["boar", "rabbit", "sheep"],
    ["tiger", "horse", "dog"],
    ["snake", "rooster", "ox"],
  ] as const;
  const stimulation = [
    ["rat", "horse"],
    ["ox", "sheep"],
    ["tiger", "monkey"],
    ["rabbit", "rooster"],
    ["dragon", "dog"],
    ["snake", "boar"],
  ] as const;

  const expected = new Map<string, EtoRelationshipCategory>();
  for (const [a, b] of natural) expected.set(key(a, b), "NATURAL_INTERLOCK");
  for (const group of expandingGroups) {
    for (let a = 0; a < group.length; a += 1) {
      for (let b = a + 1; b < group.length; b += 1) {
        expected.set(key(group[a], group[b]), "EXPANDING_POSSIBILITIES");
      }
    }
  }
  for (const [a, b] of stimulation) {
    expected.set(key(a, b), "POSITIVE_STIMULATION");
  }

  it("classifies all 66 unordered distinct pairs without reverse duplicates", () => {
    const seen = new Set<string>();
    let pairCount = 0;

    for (let a = 0; a < ZODIAC_IDS.length; a += 1) {
      for (let b = a + 1; b < ZODIAC_IDS.length; b += 1) {
        const zodiacA = ZODIAC_IDS[a];
        const zodiacB = ZODIAC_IDS[b];
        const identity = key(zodiacA, zodiacB);
        const result = relationship(
          profile({ zodiacId: zodiacA }),
          profile({ zodiacId: zodiacB }),
        );

        pairCount += 1;
        expect(seen.has(identity)).toBe(false);
        seen.add(identity);
        expect(result.zodiacInsight.category, identity).toBe(
          expected.get(identity) ?? "LEARNING_EACH_OTHERS_PACE",
        );
      }
    }

    expect(pairCount).toBe(66);
    expect(seen.size).toBe(66);
    expect(expected.size).toBe(24);
  });

  it("classifies all 12 same-zodiac pairs as learning each other's pace", () => {
    for (const zodiacId of ZODIAC_IDS) {
      expect(
        relationship(
          profile({ zodiacId }),
          profile({ zodiacId }),
        ).zodiacInsight,
      ).toMatchObject({
        relation: "SAME_ZODIAC",
        category: "LEARNING_EACH_OTHERS_PACE",
      });
    }
  });
});

describe("five-element and yin-yang layer", () => {
  const generating: readonly (readonly [FiveElement, FiveElement])[] = [
    ["WOOD", "FIRE"],
    ["FIRE", "EARTH"],
    ["EARTH", "METAL"],
    ["METAL", "WATER"],
    ["WATER", "WOOD"],
  ];
  const controlling: readonly (readonly [FiveElement, FiveElement])[] = [
    ["WOOD", "EARTH"],
    ["EARTH", "WATER"],
    ["WATER", "FIRE"],
    ["FIRE", "METAL"],
    ["METAL", "WOOD"],
  ];

  function dayMaster(element: FiveElement, polarity: Polarity = "YANG") {
    return { element, polarity } as const;
  }

  it.each(generating)(
    "classifies generating %s -> %s in both member orders",
    (from, to) => {
      for (const [a, b] of [
        [from, to],
        [to, from],
      ] as const) {
        expect(
          relationship(
            profile({ dayMaster: dayMaster(a) }),
            profile({ dayMaster: dayMaster(b) }),
          ).fiveElementInsight,
        ).toMatchObject({
          relation: "GENERATING",
          category: "EXPANDING_POSSIBILITIES",
        });
      }
    },
  );

  it.each(controlling)(
    "frames controlling %s -> %s as positive stimulation in both orders",
    (from, to) => {
      for (const [a, b] of [
        [from, to],
        [to, from],
      ] as const) {
        const insight = relationship(
          profile({ dayMaster: dayMaster(a) }),
          profile({ dayMaster: dayMaster(b) }),
        ).fiveElementInsight;
        expect(insight).toMatchObject({
          relation: "CONTROLLING",
          category: "POSITIVE_STIMULATION",
        });
        expect(insight.summary).not.toMatch(/悪い|優劣|相性が悪/);
      }
    },
  );

  it("gives complement precedence and supports tied dominant/deficient elements", () => {
    const a = profile({
      dayMaster: dayMaster("WOOD"),
      fiveElements: { WOOD: 3, FIRE: 3, EARTH: 1, METAL: 1, WATER: 2 },
      boundaryState: "exact",
    });
    const b = profile({
      dayMaster: dayMaster("EARTH"),
      fiveElements: { WOOD: 0, FIRE: 2, EARTH: 2, METAL: 0, WATER: 1 },
      boundaryState: "exact",
    });

    expect(relationship(a, b).fiveElementInsight).toMatchObject({
      relation: "COMPLEMENT",
      category: "NATURAL_INTERLOCK",
    });
  });

  it("uses same rhythm only for equal element and polarity", () => {
    expect(
      relationship(
        profile({ dayMaster: dayMaster("WATER", "YIN") }),
        profile({ dayMaster: dayMaster("WATER", "YIN") }),
      ).fiveElementInsight,
    ).toMatchObject({
      relation: "SAME_RHYTHM",
      category: "LEARNING_EACH_OTHERS_PACE",
    });

    expect(
      relationship(
        profile({ dayMaster: dayMaster("WATER", "YIN") }),
        profile({ dayMaster: dayMaster("WATER", "YANG") }),
      ).fiveElementInsight,
    ).toMatchObject({
      relation: "GENERAL",
      category: "LEARNING_EACH_OTHERS_PACE",
    });
  });

  it("does not guess distributions when either side is null", () => {
    const apparentlyComplementary = {
      WOOD: 4,
      FIRE: 0,
      EARTH: 0,
      METAL: 0,
      WATER: 0,
    } as const;

    const insight = relationship(
      profile({ fiveElements: apparentlyComplementary }),
      profile({
        dayMaster: dayMaster("FIRE"),
        fiveElements: null,
      }),
    ).fiveElementInsight;

    expect(insight.relation).toBe("GENERATING");
  });
});

describe("MBTI layer", () => {
  function expectedCategory(a: MbtiType, b: MbtiType): EtoRelationshipCategory {
    const sameAxes = [...a].filter((letter, index) => letter === b[index]).length;
    if (sameAxes === 4) return "NATURAL_INTERLOCK";
    if (sameAxes === 3) return "EXPANDING_POSSIBILITIES";
    if (sameAxes === 2) {
      const differing = [...a]
        .map((letter, index) => (letter === b[index] ? "" : `${index}`))
        .join("");
      return differing === "03"
        ? "LEARNING_EACH_OTHERS_PACE"
        : "POSITIVE_STIMULATION";
    }
    return "LEARNING_EACH_OTHERS_PACE";
  }

  it("classifies all 256 ordered combinations symmetrically", () => {
    let count = 0;
    for (const mbtiA of MBTI_TYPES) {
      for (const mbtiB of MBTI_TYPES) {
        const forward = relationship(profile({ mbti: mbtiA }), profile({ mbti: mbtiB }));
        const reverse = relationship(profile({ mbti: mbtiB }), profile({ mbti: mbtiA }));
        count += 1;

        expect(forward.mbtiInsight?.category, `${mbtiA}/${mbtiB}`).toBe(
          expectedCategory(mbtiA, mbtiB),
        );
        expect(reverse.mbtiInsight?.category).toBe(forward.mbtiInsight?.category);
        expect(reverse.mbtiInsight?.summary).toBe(forward.mbtiInsight?.summary);
      }
    }
    expect(count).toBe(256);
  });

  it("returns four non-empty Japanese axis insights without score fields", () => {
    const insight = relationship(
      profile({ mbti: "INTJ" }),
      profile({ mbti: "ESFP" }),
    ).mbtiInsight;

    expect(insight).not.toBeNull();
    expect(insight?.axes).toEqual({
      energyJa: expect.stringMatching(/[ぁ-んァ-ヶ一-龠]/),
      informationJa: expect.stringMatching(/[ぁ-んァ-ヶ一-龠]/),
      decisionJa: expect.stringMatching(/[ぁ-んァ-ヶ一-龠]/),
      lifestyleJa: expect.stringMatching(/[ぁ-んァ-ヶ一-龠]/),
    });
    expect(collectKeys(insight)).not.toEqual(
      expect.arrayContaining(["score", "percentage", "rank", "point", "count"]),
    );
  });

  it("excludes the optional layer when either MBTI is null", () => {
    expect(
      relationship(profile({ mbti: null }), profile({ mbti: "INTJ" })).mbtiInsight,
    ).toBeNull();
  });
});

describe("balanced relationship result", () => {
  it("uses a category appearing in at least two available layers", () => {
    const result = relationship(
      profile({ zodiacId: "rat", mbti: "INTJ", dayMaster: { element: "WOOD", polarity: "YIN" } }),
      profile({ zodiacId: "horse", mbti: "INFJ", dayMaster: { element: "FIRE", polarity: "YANG" } }),
    );

    expect(result.zodiacInsight.category).toBe("POSITIVE_STIMULATION");
    expect(result.fiveElementInsight.category).toBe("EXPANDING_POSSIBILITIES");
    expect(result.mbtiInsight?.category).toBe("EXPANDING_POSSIBILITIES");
    expect(result.category).toBe("EXPANDING_POSSIBILITIES");
  });

  it("uses zodiac when all three layers differ", () => {
    const result = relationship(
      profile({ zodiacId: "rat", mbti: "INTJ", dayMaster: { element: "WOOD", polarity: "YIN" } }),
      profile({ zodiacId: "ox", mbti: "ENTJ", dayMaster: { element: "EARTH", polarity: "YANG" } }),
    );

    expect(result.zodiacInsight.category).toBe("NATURAL_INTERLOCK");
    expect(result.fiveElementInsight.category).toBe("POSITIVE_STIMULATION");
    expect(result.mbtiInsight?.category).toBe("EXPANDING_POSSIBILITIES");
    expect(result.category).toBe("NATURAL_INTERLOCK");
  });

  it("uses zodiac when the two mandatory layers disagree", () => {
    const result = relationship(
      profile({ zodiacId: "rat", dayMaster: { element: "WOOD", polarity: "YIN" } }),
      profile({ zodiacId: "ox", dayMaster: { element: "FIRE", polarity: "YANG" } }),
    );
    expect(result.category).toBe("NATURAL_INTERLOCK");
  });

  it("is symmetric except that member-specific tips swap exactly", () => {
    const a = profile({ zodiacId: "dragon", mbti: "ENFP", dayMaster: { element: "WOOD", polarity: "YANG" } });
    const b = profile({ zodiacId: "rat", mbti: "ISTJ", dayMaster: { element: "FIRE", polarity: "YIN" } });
    const forward = createEtoRelationship({
      memberA: { id: "z-person", profile: a },
      memberB: { id: "a-person", profile: b },
    });
    const reverse = createEtoRelationship({
      memberA: { id: "a-person", profile: b },
      memberB: { id: "z-person", profile: a },
    });

    expect(reverse.pairKey).toBe(forward.pairKey);
    expect(reverse.category).toBe(forward.category);
    expect(reverse.categoryLabelJa).toBe(forward.categoryLabelJa);
    expect(reverse.headlineJa).toBe(forward.headlineJa);
    expect(reverse.zodiacInsight).toEqual(forward.zodiacInsight);
    expect(reverse.fiveElementInsight).toEqual(forward.fiveElementInsight);
    expect(reverse.mbtiInsight?.summary).toBe(forward.mbtiInsight?.summary);
    expect(reverse.tips.togetherJa).toBe(forward.tips.togetherJa);
    expect(reverse.tips.forPersonAJa).toBe(forward.tips.forPersonBJa);
    expect(reverse.tips.forPersonBJa).toBe(forward.tips.forPersonAJa);
    expect(forward.headlineJa.indexOf("たつ")).toBeLessThan(
      forward.headlineJa.indexOf("ねずみ"),
    );
  });

  it("returns only qualitative, non-empty Japanese public copy", () => {
    const result = relationship(profile({ mbti: "INFP" }), profile({ mbti: "ESTJ" }));
    const forbidden = /score|percentage|rank|point|count/i;
    expect(collectKeys(result).some((field) => forbidden.test(field))).toBe(false);

    const strings: string[] = [];
    const visit = (value: unknown) => {
      if (typeof value === "string") strings.push(value);
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit({
      categoryLabelJa: result.categoryLabelJa,
      headlineJa: result.headlineJa,
      zodiacInsight: result.zodiacInsight,
      fiveElementInsight: result.fiveElementInsight,
      mbtiInsight: result.mbtiInsight,
      tips: result.tips,
    });
    expect(strings.every((text) => text.trim().length > 0)).toBe(true);
  });
});

describe("relationship validation", () => {
  it("rejects identical member IDs with a stable typed error", () => {
    expect(() =>
      createEtoRelationship({
        memberA: { id: "same", profile: profile() },
        memberB: { id: "same", profile: profile() },
      }),
    ).toThrowError(RelationshipValidationError);
  });

  it.each([
    ["zodiac", { zodiacId: "cat" }],
    ["MBTI", { mbti: "XXXX" }],
    ["day-master element", { dayMaster: { element: "AIR", polarity: "YIN" } }],
    ["day-master polarity", { dayMaster: { element: "WOOD", polarity: "NEUTRAL" } }],
    ["negative count", { fiveElements: { WOOD: -1, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 } }],
    ["fractional count", { yinYang: { YIN: 1.5, YANG: 2 } }],
    ["wrong count key", { fiveElements: { WOOD: 1, FIRE: 1, EARTH: 1, METAL: 1, AIR: 1 } }],
  ])("fails safely for malformed runtime %s", (_label, override) => {
    const secret = "private-member-value";
    let thrown: unknown;
    try {
      relationship(
        profile(),
        { ...profile(), ...override } as unknown as DerivedEtoProfile,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RelationshipValidationError);
    expect(thrown).not.toBeInstanceOf(TypeError);
    expect((thrown as Error).message).not.toContain(secret);
  });

  it("rejects malformed callable-boundary values instead of throwing TypeError", () => {
    expect(() => createEtoRelationship(null as never)).toThrowError(
      RelationshipValidationError,
    );
  });
});
