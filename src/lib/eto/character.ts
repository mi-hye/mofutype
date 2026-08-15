import { MBTI_TYPES, type MbtiType, type ZodiacId } from "./types";
import { ZODIACS, type ZodiacCatalogEntry } from "./zodiac";

export interface CharacterCopy {
  titleJa: string;
  zodiacTraitsJa: readonly [string, string, string];
  mbtiModifierJa: string | null;
  descriptionJa: string;
}

export const MBTI_MODIFIERS_JA: Readonly<Record<MbtiType, string>> = Object.freeze({
  INTJ: "戦略的な",
  INTP: "探究心あふれる",
  ENTJ: "大胆に道を切り開く",
  ENTP: "ひらめきで挑む",
  INFJ: "静かに信念を貫く",
  INFP: "やさしく理想を描く",
  ENFJ: "人を励まし導く",
  ENFP: "好奇心のまま駆け出す",
  ISTJ: "誠実に積み重ねる",
  ISFJ: "そっとみんなを支える",
  ESTJ: "頼もしく場をまとめる",
  ESFJ: "あたたかく輪をつなぐ",
  ISTP: "冷静に工夫する",
  ISFP: "自分らしい感性を大切にする",
  ESTP: "勇気いっぱいに飛び込む",
  ESFP: "明るく場を彩る",
});

const BASE_DESCRIPTIONS_JA: Readonly<Record<ZodiacId, string>> = Object.freeze({
  rat: "機転と観察力を生かし、ひと工夫で毎日を楽しくできる人です。",
  ox: "誠実さを大切に、安定した歩みを粘り強く続けられる人です。",
  tiger: "勇気と情熱を胸に、自分で決めた道へ力強く進める人です。",
  rabbit: "豊かな感性と気配りで、変化にもしなやかに寄り添える人です。",
  dragon: "大きな理想を掲げ、その存在感で新しい景色へ飛躍できる人です。",
  snake: "物事を深く見つめる洞察力と、ひとつに集中する強さを持つ人です。",
  horse: "自由な心と軽やかな行動力で、爽快に一歩を踏み出せる人です。",
  sheep: "穏やかな共感と調和を大切に、周りに安心を広げられる人です。",
  monkey: "旺盛な好奇心と機知を生かし、どんな場にも柔軟に適応できる人です。",
  rooster: "細部まで丁寧に整え、責任感を持って自分らしく表現できる人です。",
  dog: "信頼と忠実さを大切に、まっすぐな正義感で仲間を支えられる人です。",
  boar: "素直な心と温かな情熱を持ち、目標へまっすぐ進める人です。",
});

const MBTI_CONTRIBUTIONS_JA: Readonly<Record<MbtiType, string>> = Object.freeze({
  INTJ: "先を見通す戦略を、自分らしい一歩につなげます。",
  INTP: "湧き上がる問いを楽しみ、納得できる答えを探究します。",
  ENTJ: "大きな目標を掲げ、仲間とともに新しい道を切り開きます。",
  ENTP: "自由なひらめきを力に変え、未知のテーマにも挑みます。",
  INFJ: "内にある信念を大切に、静かな強さで未来を描きます。",
  INFP: "やさしい想像力を広げ、心にある理想を形にしていきます。",
  ENFJ: "人の良さを見つけて励まし、みんなの歩みを明るく導きます。",
  ENFP: "心が動く方向へ駆け出し、新鮮な発見を周りと分かち合います。",
  ISTJ: "一つひとつを誠実に積み重ね、確かな成果へ結びつけます。",
  ISFJ: "細やかな心配りで、そっとみんなの安心を支えます。",
  ESTJ: "状況を頼もしく整理し、みんなが進みやすい場をつくります。",
  ESFJ: "あたたかな声かけで人と人をつなぎ、心地よい輪を育てます。",
  ISTP: "落ち着いて仕組みを見つめ、実用的な工夫を重ねます。",
  ISFP: "自分らしい感性を慈しみ、日々にささやかな彩りを添えます。",
  ESTP: "目の前の好機をつかみ、勇気いっぱいに飛び込みます。",
  ESFP: "持ち前の明るさを生かし、その場に楽しい彩りを届けます。",
});

const ZODIAC_BY_ID = new Map<ZodiacId, ZodiacCatalogEntry>(
  ZODIACS.map((entry) => [entry.id, entry]),
);
const VALID_MBTI_TYPES: ReadonlySet<string> = new Set(MBTI_TYPES);

export function createCharacterCopy(
  zodiacId: ZodiacId,
  mbti: MbtiType | null,
): CharacterCopy {
  const zodiac = ZODIAC_BY_ID.get(zodiacId);
  if (!zodiac) {
    throw new RangeError("Invalid zodiac ID");
  }
  if (mbti !== null && !VALID_MBTI_TYPES.has(mbti)) {
    throw new RangeError("Invalid MBTI");
  }

  const modifier = mbti === null ? null : MBTI_MODIFIERS_JA[mbti];
  const descriptionJa = mbti === null
    ? BASE_DESCRIPTIONS_JA[zodiacId]
    : `${BASE_DESCRIPTIONS_JA[zodiacId]}${MBTI_CONTRIBUTIONS_JA[mbti]}`;

  return Object.freeze({
    titleJa: modifier === null ? `${zodiac.nameJa}タイプ` : `${modifier}${zodiac.nameJa}`,
    zodiacTraitsJa: zodiac.keywordsJa,
    mbtiModifierJa: modifier,
    descriptionJa,
  });
}
