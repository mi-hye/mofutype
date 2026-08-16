export const ZODIAC_IDS = [
  "rat",
  "ox",
  "tiger",
  "rabbit",
  "dragon",
  "snake",
  "horse",
  "sheep",
  "monkey",
  "rooster",
  "dog",
  "boar",
] as const;

export type ZodiacId = (typeof ZODIAC_IDS)[number];

export const MBTI_TYPES = [
  "ISTJ",
  "ISFJ",
  "INFJ",
  "INTJ",
  "ISTP",
  "ISFP",
  "INFP",
  "INTP",
  "ESTP",
  "ESFP",
  "ENFP",
  "ENTP",
  "ESTJ",
  "ESFJ",
  "ENFJ",
  "ENTJ",
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];

export type FiveElement = "WOOD" | "FIRE" | "EARTH" | "METAL" | "WATER";
export type Polarity = "YIN" | "YANG";
export type CalculationMode = "date-time" | "date-only";
export type BoundaryState = "exact" | "solar-term-ambiguous";
export type ElementCounts = Readonly<Record<FiveElement, number>>;
export type YinYangCounts = Readonly<Record<Polarity, number>>;

export interface EtoInput {
  birthDate: string;
  birthTime: string | null;
  mbti: MbtiType | null;
}

export interface DerivedEtoProfile {
  version: 1;
  zodiacId: ZodiacId;
  mbti: MbtiType | null;
  dayMaster: {
    element: FiveElement;
    polarity: Polarity;
  };
  fiveElements: ElementCounts | null;
  yinYang: YinYangCounts | null;
  calculationMode: CalculationMode;
  boundaryState: BoundaryState;
  engineVersion: "mofu-eto-four-pillars-v1";
}

export interface EtoProvider {
  derive(input: EtoInput, todayIso?: string): Promise<DerivedEtoProfile>;
}
