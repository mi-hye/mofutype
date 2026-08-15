import { ZODIAC_IDS, type ZodiacId } from "./types";

export interface ZodiacCatalogEntry {
  readonly id: ZodiacId;
  readonly nameJa: string;
  readonly keywordsJa: readonly [string, string, string];
  readonly assetPath: `/zodiac/${ZodiacId}.png`;
}

function zodiac(
  id: ZodiacId,
  nameJa: string,
  keywordsJa: [string, string, string],
): ZodiacCatalogEntry {
  return Object.freeze({
    id,
    nameJa,
    keywordsJa: Object.freeze(keywordsJa),
    assetPath: `/zodiac/${id}.png`,
  });
}

export const ZODIACS: readonly ZodiacCatalogEntry[] = Object.freeze([
  zodiac("rat", "ねずみ", ["機転", "観察", "工夫"]),
  zodiac("ox", "うし", ["誠実", "持続", "安定"]),
  zodiac("tiger", "とら", ["勇気", "決断", "情熱"]),
  zodiac("rabbit", "うさぎ", ["感性", "柔軟", "気配り"]),
  zodiac("dragon", "たつ", ["理想", "飛躍", "存在感"]),
  zodiac("snake", "へび", ["洞察", "集中", "深さ"]),
  zodiac("horse", "うま", ["行動", "自由", "爽快"]),
  zodiac("sheep", "ひつじ", ["調和", "共感", "穏やかさ"]),
  zodiac("monkey", "さる", ["好奇心", "機知", "適応"]),
  zodiac("rooster", "とり", ["表現", "精密", "責任感"]),
  zodiac("dog", "いぬ", ["信頼", "忠実", "正義感"]),
  zodiac("boar", "いのしし", ["素直", "情熱", "温かさ"]),
]);

export function zodiacForGregorianYear(year: number): ZodiacId {
  if (!Number.isInteger(year)) {
    throw new RangeError("Gregorian year must be an integer");
  }

  return ZODIAC_IDS[((year - 2020) % 12 + 12) % 12];
}
