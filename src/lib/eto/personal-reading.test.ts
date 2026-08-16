import { describe, expect, it } from "vitest";

import { MBTI_TYPES, ZODIAC_IDS, type DerivedEtoProfile } from "./types";
import { createPersonalReading } from "./personal-reading";

function profile(overrides: Partial<DerivedEtoProfile> = {}): DerivedEtoProfile {
  return {
    version: 1,
    zodiacId: "snake",
    mbti: "INTJ",
    dayMaster: { element: "FIRE", polarity: "YIN" },
    fiveElements: { WOOD: 2, FIRE: 2, EARTH: 1, METAL: 1, WATER: 2 },
    yinYang: { YIN: 4, YANG: 4 },
    calculationMode: "date-time",
    boundaryState: "exact",
    engineVersion: "mofu-eto-four-pillars-v1",
    ...overrides,
  };
}

describe("createPersonalReading", () => {
  it("separates zodiac, all four MBTI axes, four pillars and the combined reading", () => {
    const reading = createPersonalReading(profile());

    expect(reading.zodiac.titleJa).toBe("へびの気質");
    expect(reading.zodiac.summaryJa).toContain("洞察力");
    expect(reading.mbti?.titleJa).toBe("INTJの思考と行動");
    expect(reading.mbti?.axes.map((axis) => axis.code)).toEqual(["I", "N", "T", "J"]);
    expect(reading.mbti?.axes.map((axis) => axis.labelJa)).toEqual([
      "エネルギー", "情報の捉え方", "判断の軸", "進め方",
    ]);
    expect(reading.mbti?.axes.every((axis) => axis.summaryJa.length > 12)).toBe(true);
    expect(reading.fourPillars.titleJa).toBe("火・陰の行動スタイル");
    expect(reading.fourPillars.summaryJa).toContain("内側");
    expect(reading.combined.titleJa).toBe("へび × INTJ × 火・陰");
    expect(reading.combined.summaryJa).toContain("洞察");
    expect(reading.combined.summaryJa).toContain("戦略");
  });

  it("is deterministic and complete for all 192 zodiac and MBTI combinations", () => {
    for (const zodiacId of ZODIAC_IDS) {
      for (const mbti of MBTI_TYPES) {
        const input = profile({ zodiacId, mbti });
        const first = createPersonalReading(input);
        const second = createPersonalReading(input);

        expect(first).toEqual(second);
        expect(first.mbti?.axes).toHaveLength(4);
        expect(first.combined.summaryJa).toMatch(/[。！？]$/);
      }
    }
  });

  it("keeps unknown MBTI neutral without weakening the zodiac or four-pillars result", () => {
    const reading = createPersonalReading(profile({ mbti: null }));

    expect(reading.mbti).toBeNull();
    expect(reading.zodiac.summaryJa).toContain("洞察力");
    expect(reading.fourPillars.summaryJa).toContain("情熱");
    expect(reading.combined.titleJa).toBe("へび × 火・陰");
    expect(reading.combined.summaryJa).not.toMatch(/不足|未回答|不明|弱点|劣/);
  });
});
