import { describe, expect, it } from "vitest";

import {
  createEtoRelationship,
  RelationshipValidationError,
  type RelationshipCategory,
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

function exactProfile(
  overrides: Partial<DerivedEtoProfile> = {},
): DerivedEtoProfile {
  return profile({
    fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
    yinYang: { YIN: 3, YANG: 3 },
    boundaryState: "exact",
    ...overrides,
  });
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

  const expected = new Map<
    string,
    { relation: "LIUHE" | "SANHE" | "LIUCHONG"; category: RelationshipCategory }
  >();
  for (const [a, b] of natural) {
    expected.set(key(a, b), {
      relation: "LIUHE",
      category: "NATURAL_INTERLOCK",
    });
  }
  for (const group of expandingGroups) {
    for (let a = 0; a < group.length; a += 1) {
      for (let b = a + 1; b < group.length; b += 1) {
        expected.set(key(group[a], group[b]), {
          relation: "SANHE",
          category: "EXPANDING_POSSIBILITIES",
        });
      }
    }
  }
  for (const [a, b] of stimulation) {
    expected.set(key(a, b), {
      relation: "LIUCHONG",
      category: "POSITIVE_STIMULATION",
    });
  }

  it("classifies all 78 unordered pairs with exact relation totals", () => {
    const seen = new Set<string>();
    const relationTotals = {
      LIUHE: 0,
      SANHE: 0,
      LIUCHONG: 0,
      GENERAL: 0,
    };

    for (let a = 0; a < ZODIAC_IDS.length; a += 1) {
      for (let b = a; b < ZODIAC_IDS.length; b += 1) {
        const zodiacA = ZODIAC_IDS[a];
        const zodiacB = ZODIAC_IDS[b];
        const identity = key(zodiacA, zodiacB);
        const insight = relationship(
          profile({ zodiacId: zodiacA }),
          profile({ zodiacId: zodiacB }),
        ).zodiacInsight;
        const expectedInsight = expected.get(identity) ?? {
          relation: "GENERAL",
          category: "LEARNING_EACH_OTHERS_PACE",
        };

        expect(seen.has(identity)).toBe(false);
        seen.add(identity);
        expect(insight.relation, identity).toBe(expectedInsight.relation);
        expect(insight.category, identity).toBe(expectedInsight.category);
        relationTotals[insight.relation] += 1;
      }
    }

    expect(seen.size).toBe(78);
    expect(expected.size).toBe(24);
    expect(relationTotals).toEqual({
      LIUHE: 6,
      SANHE: 12,
      LIUCHONG: 6,
      GENERAL: 54,
    });
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
      fiveElements: { WOOD: 2, FIRE: 2, EARTH: 0, METAL: 0, WATER: 2 },
      yinYang: { YIN: 3, YANG: 3 },
      boundaryState: "exact",
    });
    const b = profile({
      dayMaster: dayMaster("EARTH"),
      fiveElements: { WOOD: 0, FIRE: 1, EARTH: 3, METAL: 1, WATER: 1 },
      yinYang: { YIN: 2, YANG: 4 },
      boundaryState: "exact",
    });

    expect(relationship(a, b).fiveElementInsight).toMatchObject({
      relation: "COMPLEMENT",
      category: "NATURAL_INTERLOCK",
    });
  });

  it.each([
    [
      "uniform-uniform",
      { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 },
      { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 },
    ],
    [
      "uniform-nonuniform",
      { WOOD: 0, FIRE: 0, EARTH: 0, METAL: 0, WATER: 0 },
      { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
    ],
  ])("rejects %s distributions before they can produce a false complement", (_label, a, b) => {
    expect(() =>
      relationship(
        exactProfile({ fiveElements: a }),
        exactProfile({ fiveElements: b }),
      ),
    ).toThrowError(RelationshipValidationError);
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

  it("does not guess distributions when solar-term ambiguity makes both null", () => {
    const insight = relationship(
      profile({ dayMaster: dayMaster("WOOD") }),
      profile({ dayMaster: dayMaster("FIRE") }),
    ).fiveElementInsight;

    expect(insight.relation).toBe("GENERATING");
  });
});

describe("MBTI layer", () => {
  function expectedCategory(a: MbtiType, b: MbtiType): RelationshipCategory {
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
        expect(reverse.mbtiInsight).toEqual(forward.mbtiInsight);
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

  const generatingAndControlling = [
    ["WOOD", "FIRE"],
    ["FIRE", "EARTH"],
    ["EARTH", "METAL"],
    ["METAL", "WATER"],
    ["WATER", "WOOD"],
    ["FIRE", "WOOD"],
    ["EARTH", "FIRE"],
    ["METAL", "EARTH"],
    ["WATER", "METAL"],
    ["WOOD", "WATER"],
    ["WOOD", "EARTH"],
    ["EARTH", "WATER"],
    ["WATER", "FIRE"],
    ["FIRE", "METAL"],
    ["METAL", "WOOD"],
    ["EARTH", "WOOD"],
    ["WATER", "EARTH"],
    ["FIRE", "WATER"],
    ["METAL", "FIRE"],
    ["WOOD", "METAL"],
  ] as const;

  const reversalCases: readonly (readonly [string, DerivedEtoProfile, DerivedEtoProfile])[] = [
    ...generatingAndControlling.map(
      ([elementA, elementB]) =>
        [
          `${elementA}/${elementB}`,
          profile({ mbti: "ENFP", dayMaster: { element: elementA, polarity: "YANG" } }),
          profile({ mbti: "ISTJ", dayMaster: { element: elementB, polarity: "YIN" } }),
        ] as const,
    ),
    [
      "same rhythm",
      profile({ dayMaster: { element: "WATER", polarity: "YIN" } }),
      profile({ dayMaster: { element: "WATER", polarity: "YIN" } }),
    ],
    [
      "general",
      profile({ dayMaster: { element: "WATER", polarity: "YIN" } }),
      profile({ dayMaster: { element: "WATER", polarity: "YANG" } }),
    ],
    [
      "complement",
      exactProfile({
        fiveElements: { WOOD: 2, FIRE: 2, EARTH: 0, METAL: 0, WATER: 2 },
      }),
      exactProfile({
        fiveElements: { WOOD: 0, FIRE: 1, EARTH: 3, METAL: 1, WATER: 1 },
      }),
    ],
  ];

  it.each(reversalCases)(
    "preserves all symmetric fields and swaps exact tips for %s",
    (_label, a, b) => {
      const forward = createEtoRelationship({
        memberA: { id: "z-person", profile: a },
        memberB: { id: "a-person", profile: b },
      });
      const reverse = createEtoRelationship({
        memberA: { id: "a-person", profile: b },
        memberB: { id: "z-person", profile: a },
      });

      expect({ ...reverse, tips: undefined }).toEqual({
        ...forward,
        tips: undefined,
      });
      expect(reverse.tips.togetherJa).toBe(forward.tips.togetherJa);
      expect(reverse.tips.forPersonAJa).toBe(forward.tips.forPersonBJa);
      expect(reverse.tips.forPersonBJa).toBe(forward.tips.forPersonAJa);
    },
  );

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
  const exactProfileKeys = [
    "version",
    "zodiacId",
    "mbti",
    "dayMaster",
    "fiveElements",
    "yinYang",
    "calculationMode",
    "boundaryState",
    "engineVersion",
  ] as const;

  it("rejects identical member IDs with a stable typed error", () => {
    expect(() =>
      createEtoRelationship({
        memberA: { id: "same", profile: profile() },
        memberB: { id: "same", profile: profile() },
      }),
    ).toThrowError(RelationshipValidationError);
  });

  it.each([
    ["version", { version: 2 }],
    ["zodiac", { zodiacId: "cat" }],
    ["MBTI", { mbti: "XXXX" }],
    ["day-master element", { dayMaster: { element: "AIR", polarity: "YIN" } }],
    ["day-master polarity", { dayMaster: { element: "WOOD", polarity: "NEUTRAL" } }],
    ["calculation mode", { calculationMode: "month-only" }],
    ["boundary state", { boundaryState: "uncertain" }],
    ["engine version", { engineVersion: "private-engine-version" }],
    [
      "negative count",
      {
        ...exactProfile(),
        fiveElements: { WOOD: -1, FIRE: 2, EARTH: 2, METAL: 2, WATER: 1 },
      },
    ],
    [
      "fractional count",
      { ...exactProfile(), yinYang: { YIN: 1.5, YANG: 4.5 } },
    ],
    [
      "wrong count key",
      {
        ...exactProfile(),
        fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, AIR: 1 },
      },
    ],
  ])("fails safely for malformed runtime %s", (_label, override) => {
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
    expect(thrown).toMatchObject({
      name: "RelationshipValidationError",
      code: "INVALID_RELATIONSHIP_INPUT",
      message: "Relationship input is invalid",
    });
  });

  it("does not leak a secret embedded in malformed input", () => {
    const secret = "private-member-value";
    let thrown: unknown;
    try {
      relationship(
        profile(),
        { ...profile(), mbti: secret } as unknown as DerivedEtoProfile,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      name: "RelationshipValidationError",
      code: "INVALID_RELATIONSHIP_INPUT",
      message: "Relationship input is invalid",
    });
    expect(JSON.stringify(thrown)).not.toContain(secret);
    expect(String(thrown)).not.toContain(secret);
  });

  it.each([
    ["profile extra key", { ...profile(), extra: true }],
    [
      "profile missing key",
      Object.fromEntries(
        Object.entries(profile()).filter(([field]) => field !== "engineVersion"),
      ),
    ],
    [
      "profile symbol key",
      Object.assign(profile(), { [Symbol("secret")]: true }),
    ],
    [
      "profile inherited required keys",
      Object.assign(Object.create({ engineVersion: "mofu-eto-four-pillars-v1" }),
        Object.fromEntries(
          Object.entries(profile()).filter(([field]) => field !== "engineVersion"),
        ),
      ),
    ],
    ["day-master extra key", { ...profile(), dayMaster: { ...profile().dayMaster, extra: true } }],
    ["day-master missing key", { ...profile(), dayMaster: { element: "WOOD" } }],
    ["day-master inherited key", { ...profile(), dayMaster: Object.create({ element: "WOOD", polarity: "YANG" }) }],
  ])("requires exact plain own-key shape for %s", (_label, malformed) => {
    expect(Object.keys(profile())).toEqual(exactProfileKeys);
    expect(() =>
      relationship(profile(), malformed as unknown as DerivedEtoProfile),
    ).toThrowError(RelationshipValidationError);
  });

  it.each([
    ["ambiguous date-time", { calculationMode: "date-time" }],
    ["ambiguous with five counts", { fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 } }],
    ["ambiguous with yin-yang counts", { yinYang: { YIN: 3, YANG: 3 } }],
    ["exact with null counts", { boundaryState: "exact" }],
    ["exact with one null", { ...exactProfile(), yinYang: null }],
    ["date-only five total", { ...exactProfile(), fiveElements: { WOOD: 1, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 } }],
    ["date-only yin-yang total", { ...exactProfile(), yinYang: { YIN: 2, YANG: 3 } }],
    ["date-time five total", { ...exactProfile(), calculationMode: "date-time", fiveElements: { WOOD: 2, FIRE: 2, EARTH: 1, METAL: 1, WATER: 1 }, yinYang: { YIN: 4, YANG: 4 } }],
    ["date-time yin-yang total", { ...exactProfile(), calculationMode: "date-time", fiveElements: { WOOD: 2, FIRE: 2, EARTH: 2, METAL: 1, WATER: 1 }, yinYang: { YIN: 3, YANG: 4 } }],
    ["count extra key", { ...exactProfile(), fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1, AIR: 0 } }],
  ])("rejects inconsistent boundary/count state: %s", (_label, malformed) => {
    expect(() =>
      relationship(profile(), malformed as unknown as DerivedEtoProfile),
    ).toThrowError(RelationshipValidationError);
  });

  it("accepts exact date-only and date-time count totals", () => {
    expect(() => relationship(exactProfile(), exactProfile())).not.toThrow();
    const dateTime = exactProfile({
      calculationMode: "date-time",
      fiveElements: { WOOD: 2, FIRE: 2, EARTH: 2, METAL: 1, WATER: 1 },
      yinYang: { YIN: 4, YANG: 4 },
    });
    expect(() => relationship(dateTime, dateTime)).not.toThrow();
  });

  it("wraps URI-unsafe member IDs in the stable validation error", () => {
    let thrown: unknown;
    try {
      createEtoRelationship({
        memberA: { id: "unsafe-\uD800", profile: profile() },
        memberB: { id: "safe", profile: profile() },
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RelationshipValidationError);
    expect(thrown).not.toBeInstanceOf(URIError);
    expect(thrown).toMatchObject({
      name: "RelationshipValidationError",
      code: "INVALID_RELATIONSHIP_INPUT",
      message: "Relationship input is invalid",
    });
  });

  it("rejects malformed callable-boundary values instead of throwing TypeError", () => {
    expect(() => createEtoRelationship(null as never)).toThrowError(
      RelationshipValidationError,
    );
  });
});
