import { describe, expect, expectTypeOf, it } from "vitest";

import { ZODIAC_IDS, type ZodiacId } from "./types";
import {
  ZODIACS,
  zodiacForGregorianYear,
  type ZodiacCatalogEntry,
} from "./zodiac";

const EXPECTED_ZODIACS = {
  rat: { id: "rat", nameJa: "ねずみ", keywordsJa: ["機転", "観察", "工夫"], assetPath: "/zodiac/rat.png" },
  ox: { id: "ox", nameJa: "うし", keywordsJa: ["誠実", "持続", "安定"], assetPath: "/zodiac/ox.png" },
  tiger: { id: "tiger", nameJa: "とら", keywordsJa: ["勇気", "決断", "情熱"], assetPath: "/zodiac/tiger.png" },
  rabbit: { id: "rabbit", nameJa: "うさぎ", keywordsJa: ["感性", "柔軟", "気配り"], assetPath: "/zodiac/rabbit.png" },
  dragon: { id: "dragon", nameJa: "たつ", keywordsJa: ["理想", "飛躍", "存在感"], assetPath: "/zodiac/dragon.png" },
  snake: { id: "snake", nameJa: "へび", keywordsJa: ["洞察", "集中", "深さ"], assetPath: "/zodiac/snake.png" },
  horse: { id: "horse", nameJa: "うま", keywordsJa: ["行動", "自由", "爽快"], assetPath: "/zodiac/horse.png" },
  sheep: { id: "sheep", nameJa: "ひつじ", keywordsJa: ["調和", "共感", "穏やかさ"], assetPath: "/zodiac/sheep.png" },
  monkey: { id: "monkey", nameJa: "さる", keywordsJa: ["好奇心", "機知", "適応"], assetPath: "/zodiac/monkey.png" },
  rooster: { id: "rooster", nameJa: "とり", keywordsJa: ["表現", "精密", "責任感"], assetPath: "/zodiac/rooster.png" },
  dog: { id: "dog", nameJa: "いぬ", keywordsJa: ["信頼", "忠実", "正義感"], assetPath: "/zodiac/dog.png" },
  boar: { id: "boar", nameJa: "いのしし", keywordsJa: ["素直", "情熱", "温かさ"], assetPath: "/zodiac/boar.png" },
} as const satisfies Readonly<Record<ZodiacId, ZodiacCatalogEntry>>;

describe("zodiacForGregorianYear", () => {
  it.each([
    [2020, "rat"],
    [2021, "ox"],
    [2022, "tiger"],
    [2023, "rabbit"],
    [2024, "dragon"],
    [2019, "boar"],
    [2031, "boar"],
  ] as const)("maps %i to %s", (year, zodiacId) => {
    expect(zodiacForGregorianYear(year)).toBe(zodiacId);
  });

  it("covers the complete 12-year cycle in stable order", () => {
    expect(Array.from({ length: 12 }, (_, offset) => zodiacForGregorianYear(2020 + offset))).toEqual(ZODIAC_IDS);
  });

  it("handles years before 1900 with positive wraparound", () => {
    expect(zodiacForGregorianYear(1899)).toBe("boar");
    expect(zodiacForGregorianYear(-1)).toBe("sheep");
  });

  it.each([2020.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects non-integer year %s", (year) => {
    expect(() => zodiacForGregorianYear(year)).toThrowError(new RangeError("Gregorian year must be an integer"));
  });
});

describe("ZODIACS", () => {
  it("supports typed keyed access to the approved immutable catalog", () => {
    expectTypeOf(ZODIACS).toEqualTypeOf<
      Readonly<Record<ZodiacId, ZodiacCatalogEntry>>
    >();
    expect(ZODIACS).toEqual(EXPECTED_ZODIACS);
    expect(Object.isFrozen(ZODIACS)).toBe(true);
    expect(ZODIAC_IDS.map((zodiacId) => ZODIACS[zodiacId].id)).toEqual(
      ZODIAC_IDS,
    );
    for (const zodiacId of ZODIAC_IDS) {
      const zodiac = ZODIACS[zodiacId];
      expect(Object.isFrozen(zodiac)).toBe(true);
      expect(Object.isFrozen(zodiac.keywordsJa)).toBe(true);
    }
  });
});
