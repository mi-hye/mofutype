import { createCharacterCopy } from "./character";
import type { DerivedEtoProfile, FiveElement, MbtiType, Polarity } from "./types";
import { ZODIACS } from "./zodiac";

export interface MbtiAxisReading {
  code: "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
  labelJa: "エネルギー" | "情報の捉え方" | "判断の軸" | "進め方";
  summaryJa: string;
}

export interface PersonalReading {
  zodiac: Readonly<{ titleJa: string; summaryJa: string }>;
  mbti: Readonly<{
    titleJa: string;
    leadJa: string;
    axes: readonly [MbtiAxisReading, MbtiAxisReading, MbtiAxisReading, MbtiAxisReading];
  }> | null;
  fourPillars: Readonly<{ titleJa: string; summaryJa: string }>;
  combined: Readonly<{ titleJa: string; summaryJa: string }>;
}

const AXIS_READINGS: Readonly<Record<MbtiAxisReading["code"], Omit<MbtiAxisReading, "code">>> = Object.freeze({
  E: { labelJa: "エネルギー", summaryJa: "人とのやり取りから元気を得やすく、考えを声にしながら方向を見つけます。" },
  I: { labelJa: "エネルギー", summaryJa: "ひとりで考える時間で心を整え、内側で考えを深めてから言葉にします。" },
  S: { labelJa: "情報の捉え方", summaryJa: "具体的な事実や経験を手がかりに、今できることを着実に捉えます。" },
  N: { labelJa: "情報の捉え方", summaryJa: "背景にある意味やこれからの可能性を読み、全体像から発想を広げます。" },
  T: { labelJa: "判断の軸", summaryJa: "筋道と一貫性を大切にし、納得できる基準をもとに判断します。" },
  F: { labelJa: "判断の軸", summaryJa: "人の気持ちと大切にしたい価値を見つめ、調和を考えて判断します。" },
  J: { labelJa: "進め方", summaryJa: "見通しと区切りがあると力を発揮し、早めに方針を整えて進みます。" },
  P: { labelJa: "進め方", summaryJa: "選択肢を残すことで力を発揮し、状況に合わせて柔軟に動きます。" },
});

const ELEMENT_LABELS: Readonly<Record<FiveElement, string>> = Object.freeze({
  WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水",
});

const POLARITY_LABELS: Readonly<Record<Polarity, string>> = Object.freeze({
  YIN: "陰", YANG: "陽",
});

const ELEMENT_READINGS: Readonly<Record<FiveElement, string>> = Object.freeze({
  WOOD: "成長する力を軸に、可能性を見つけて少しずつ広げていく傾向があります。",
  FIRE: "情熱と表現力を軸に、心が動いたことを周りへあたたかく伝える傾向があります。",
  EARTH: "安定感と受容力を軸に、人や物事を受け止めながら着実に育てる傾向があります。",
  METAL: "判断基準と洗練する力を軸に、大切なものを選び取って形を整える傾向があります。",
  WATER: "洞察と適応力を軸に、状況の流れを読みながら柔軟な道を探す傾向があります。",
});

const POLARITY_READINGS: Readonly<Record<Polarity, string>> = Object.freeze({
  YIN: "強く押し出すより、内側で確かめながら繊細に力を育てるタイプです。",
  YANG: "内に留めるより、外へ働きかけながら率直に力を発揮するタイプです。",
});

function axis(code: MbtiAxisReading["code"]): MbtiAxisReading {
  return Object.freeze({ code, ...AXIS_READINGS[code] });
}

function mbtiAxes(mbti: MbtiType): readonly [
  MbtiAxisReading,
  MbtiAxisReading,
  MbtiAxisReading,
  MbtiAxisReading,
] {
  return Object.freeze([
    axis(mbti[0] as "E" | "I"),
    axis(mbti[1] as "S" | "N"),
    axis(mbti[2] as "T" | "F"),
    axis(mbti[3] as "J" | "P"),
  ]);
}

export function createPersonalReading(profile: DerivedEtoProfile): PersonalReading {
  const zodiac = ZODIACS[profile.zodiacId];
  const character = createCharacterCopy(profile.zodiacId, profile.mbti);
  const elementLabel = ELEMENT_LABELS[profile.dayMaster.element];
  const polarityLabel = POLARITY_LABELS[profile.dayMaster.polarity];
  const fourPillarsSummary = `${ELEMENT_READINGS[profile.dayMaster.element]}${POLARITY_READINGS[profile.dayMaster.polarity]}`;
  const traitPhrase = `「${character.zodiacTraitsJa.join("・")}」`;
  const combinedSummary = character.mbtiDescriptionJa === null
    ? `${zodiac.nameJa}の${traitPhrase}を土台に、${fourPillarsSummary}`
    : `${zodiac.nameJa}の${traitPhrase}を土台に、${character.mbtiDescriptionJa}${fourPillarsSummary}`;

  const mbti = profile.mbti === null ? null : Object.freeze({
    titleJa: `${profile.mbti}の思考と行動`,
    leadJa: character.mbtiDescriptionJa as string,
    axes: mbtiAxes(profile.mbti),
  });

  return Object.freeze({
    zodiac: Object.freeze({
      titleJa: `${zodiac.nameJa}の気質`,
      summaryJa: character.zodiacDescriptionJa,
    }),
    mbti,
    fourPillars: Object.freeze({
      titleJa: `${elementLabel}・${polarityLabel}の行動スタイル`,
      summaryJa: fourPillarsSummary,
    }),
    combined: Object.freeze({
      titleJa: profile.mbti === null
        ? `${zodiac.nameJa} × ${elementLabel}・${polarityLabel}`
        : `${zodiac.nameJa} × ${profile.mbti} × ${elementLabel}・${polarityLabel}`,
      summaryJa: combinedSummary,
    }),
  });
}
