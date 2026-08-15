import { describe, expect, it } from "vitest";

import { ZODIAC_IDS } from "./types";
import { ZODIACS, zodiacForGregorianYear } from "./zodiac";

const EXPECTED_ZODIACS = [
  { id: "rat", nameJa: "ねずみ", keywordsJa: ["機転", "観察", "工夫"], assetPath: "/zodiac/rat.png" },
  { id: "ox", nameJa: "うし", keywordsJa: ["誠実", "持続", "安定"], assetPath: "/zodiac/ox.png" },
  { id: "tiger", nameJa: "とら", keywordsJa: ["勇気", "決断", "情熱"], assetPath: "/zodiac/tiger.png" },
  { id: "rabbit", nameJa: "うさぎ", keywordsJa: ["感性", "柔軟", "気配り"], assetPath: "/zodiac/rabbit.png" },
  { id: "dragon", nameJa: "たつ", keywordsJa: ["理想", "飛躍", "存在感"], assetPath: "/zodiac/dragon.png" },
  { id: "snake", nameJa: "へび", keywordsJa: ["洞察", "集中", "深さ"], assetPath: "/zodiac/snake.png" },
  { id: "horse", nameJa: "うま", keywordsJa: ["行動", "自由", "爽快"], assetPath: "/zodiac/horse.png" },
  { id: "sheep", nameJa: "ひつじ", keywordsJa: ["調和", "共感", "穏やかさ"], assetPath: "/zodiac/sheep.png" },
  { id: "monkey", nameJa: "さる", keywordsJa: ["好奇心", "機知", "適応"], assetPath: "/zodiac/monkey.png" },
  { id: "rooster", nameJa: "とり", keywordsJa: ["表現", "精密", "責任感"], assetPath: "/zodiac/rooster.png" },
  { id: "dog", nameJa: "いぬ", keywordsJa: ["信頼", "忠実", "正義感"], assetPath: "/zodiac/dog.png" },
  { id: "boar", nameJa: "いのしし", keywordsJa: ["素直", "情熱", "温かさ"], assetPath: "/zodiac/boar.png" },
] as const;

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
  it("contains the approved immutable catalog in ZODIAC_IDS order", () => {
    expect(ZODIACS).toEqual(EXPECTED_ZODIACS);
    expect(ZODIACS.map(({ id }) => id)).toEqual(ZODIAC_IDS);
    expect(Object.isFrozen(ZODIACS)).toBe(true);
    for (const zodiac of ZODIACS) {
      expect(Object.isFrozen(zodiac)).toBe(true);
      expect(Object.isFrozen(zodiac.keywordsJa)).toBe(true);
    }
  });
});
