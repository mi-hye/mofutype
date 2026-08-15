import { canonicalPairKey } from "../relationship/pair-key";
import { ZODIACS } from "./zodiac";
import {
  MBTI_TYPES,
  ZODIAC_IDS,
  type DerivedEtoProfile,
  type ElementCounts,
  type FiveElement,
  type MbtiType,
  type ZodiacId,
} from "./types";

export type EtoRelationshipCategory =
  | "NATURAL_INTERLOCK"
  | "EXPANDING_POSSIBILITIES"
  | "POSITIVE_STIMULATION"
  | "LEARNING_EACH_OTHERS_PACE";

export type ZodiacRelationship =
  | "LIUHE"
  | "SANHE"
  | "LIUCHONG"
  | "SAME_ZODIAC"
  | "GENERAL";

export type FiveElementRelationship =
  | "COMPLEMENT"
  | "GENERATING"
  | "CONTROLLING"
  | "SAME_RHYTHM"
  | "GENERAL";

export interface EtoRelationshipMember {
  id: string;
  profile: DerivedEtoProfile;
}

export interface CreateEtoRelationshipInput {
  memberA: EtoRelationshipMember;
  memberB: EtoRelationshipMember;
}

export interface ZodiacRelationshipInsight {
  relation: ZodiacRelationship;
  category: EtoRelationshipCategory;
  title: string;
  summary: string;
}

export interface FiveElementRelationshipInsight {
  relation: FiveElementRelationship;
  category: EtoRelationshipCategory;
  title: string;
  summary: string;
}

export interface MbtiRelationshipInsight {
  category: EtoRelationshipCategory;
  title: string;
  summary: string;
  axes: {
    energyJa: string;
    informationJa: string;
    decisionJa: string;
    lifestyleJa: string;
  };
}

export interface EtoRelationshipResult {
  pairKey: string;
  category: EtoRelationshipCategory;
  categoryLabelJa: string;
  headlineJa: string;
  zodiacInsight: ZodiacRelationshipInsight;
  fiveElementInsight: FiveElementRelationshipInsight;
  mbtiInsight: MbtiRelationshipInsight | null;
  tips: {
    togetherJa: string;
    forPersonAJa: string;
    forPersonBJa: string;
  };
}

export class RelationshipValidationError extends Error {
  readonly code = "INVALID_RELATIONSHIP_INPUT";

  constructor() {
    super("Relationship input is invalid");
    this.name = "RelationshipValidationError";
  }
}

const CATEGORY_LABELS: Readonly<Record<EtoRelationshipCategory, string>> = {
  NATURAL_INTERLOCK: "自然にかみ合う関係",
  EXPANDING_POSSIBILITIES: "一緒に可能性を広げる関係",
  POSITIVE_STIMULATION: "違いがよい刺激になる関係",
  LEARNING_EACH_OTHERS_PACE: "お互いのペースを学ぶ関係",
};

const ELEMENTS = ["WOOD", "FIRE", "EARTH", "METAL", "WATER"] as const;
const POLARITIES = ["YIN", "YANG"] as const;
const CALCULATION_MODES = ["date-time", "date-only"] as const;
const BOUNDARY_STATES = ["exact", "solar-term-ambiguous"] as const;
const ENGINE_VERSION = "mofu-eto-four-pillars-v1";

const ELEMENT_NAMES: Readonly<Record<FiveElement, string>> = {
  WOOD: "木",
  FIRE: "火",
  EARTH: "土",
  METAL: "金",
  WATER: "水",
};

const ZODIAC_NAMES = new Map(
  ZODIACS.map(({ id, nameJa }) => [id, nameJa] as const),
);

function pair(a: ZodiacId, b: ZodiacId): string {
  return [a, b].sort().join(":");
}

const LIUHE_PAIRS = new Set([
  pair("rat", "ox"),
  pair("tiger", "boar"),
  pair("rabbit", "dog"),
  pair("dragon", "rooster"),
  pair("snake", "monkey"),
  pair("horse", "sheep"),
]);

const SANHE_PAIRS = new Set<string>();
for (const group of [
  ["monkey", "rat", "dragon"],
  ["boar", "rabbit", "sheep"],
  ["tiger", "horse", "dog"],
  ["snake", "rooster", "ox"],
] as const) {
  for (let first = 0; first < group.length; first += 1) {
    for (let second = first + 1; second < group.length; second += 1) {
      SANHE_PAIRS.add(pair(group[first], group[second]));
    }
  }
}

const LIUCHONG_PAIRS = new Set([
  pair("rat", "horse"),
  pair("ox", "sheep"),
  pair("tiger", "monkey"),
  pair("rabbit", "rooster"),
  pair("dragon", "dog"),
  pair("snake", "boar"),
]);

const GENERATING_NEXT: Readonly<Record<FiveElement, FiveElement>> = {
  WOOD: "FIRE",
  FIRE: "EARTH",
  EARTH: "METAL",
  METAL: "WATER",
  WATER: "WOOD",
};

const CONTROLLING_NEXT: Readonly<Record<FiveElement, FiveElement>> = {
  WOOD: "EARTH",
  EARTH: "WATER",
  WATER: "FIRE",
  FIRE: "METAL",
  METAL: "WOOD",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((field, index) => field === expected[index])
  );
}

function isCounts(
  value: unknown,
  keys: readonly string[],
): value is Record<string, number> {
  return (
    isObject(value) &&
    hasExactKeys(value, keys) &&
    keys.every(
      (field) =>
        Number.isInteger(value[field]) && (value[field] as number) >= 0,
    )
  );
}

function isProfile(value: unknown): value is DerivedEtoProfile {
  if (!isObject(value) || !isObject(value.dayMaster)) return false;

  const fiveElementsValid =
    value.fiveElements === null || isCounts(value.fiveElements, ELEMENTS);
  const yinYangValid =
    value.yinYang === null || isCounts(value.yinYang, POLARITIES);

  return (
    value.version === 1 &&
    isOneOf(value.zodiacId, ZODIAC_IDS) &&
    (value.mbti === null || isOneOf(value.mbti, MBTI_TYPES)) &&
    isOneOf(value.dayMaster.element, ELEMENTS) &&
    isOneOf(value.dayMaster.polarity, POLARITIES) &&
    fiveElementsValid &&
    yinYangValid &&
    isOneOf(value.calculationMode, CALCULATION_MODES) &&
    isOneOf(value.boundaryState, BOUNDARY_STATES) &&
    value.engineVersion === ENGINE_VERSION
  );
}

function assertInput(
  input: unknown,
): asserts input is CreateEtoRelationshipInput {
  if (
    !isObject(input) ||
    !isObject(input.memberA) ||
    !isObject(input.memberB) ||
    typeof input.memberA.id !== "string" ||
    input.memberA.id.trim() === "" ||
    typeof input.memberB.id !== "string" ||
    input.memberB.id.trim() === "" ||
    input.memberA.id === input.memberB.id ||
    !isProfile(input.memberA.profile) ||
    !isProfile(input.memberB.profile)
  ) {
    throw new RelationshipValidationError();
  }
}

function zodiacInsight(
  zodiacA: ZodiacId,
  zodiacB: ZodiacId,
): ZodiacRelationshipInsight {
  const identity = pair(zodiacA, zodiacB);
  if (zodiacA === zodiacB) {
    return {
      relation: "SAME_ZODIAC",
      category: "LEARNING_EACH_OTHERS_PACE",
      title: "似た感覚を持つ十二支",
      summary: "共通する感覚を大切にしながら、それぞれの歩幅も確かめ合える関係です。",
    };
  }
  if (LIUHE_PAIRS.has(identity)) {
    return {
      relation: "LIUHE",
      category: "NATURAL_INTERLOCK",
      title: "自然に支え合う十二支",
      summary: "互いの持ち味が無理なくかみ合い、自然な連携を育てやすい組み合わせです。",
    };
  }
  if (SANHE_PAIRS.has(identity)) {
    return {
      relation: "SANHE",
      category: "EXPANDING_POSSIBILITIES",
      title: "視野を広げ合う十二支",
      summary: "同じ方向へ力を合わせることで、新しい可能性を見つけやすい組み合わせです。",
    };
  }
  if (LIUCHONG_PAIRS.has(identity)) {
    return {
      relation: "LIUCHONG",
      category: "POSITIVE_STIMULATION",
      title: "違いを活かせる十二支",
      summary: "異なる視点が気づきを生み、互いの選択肢を増やせる組み合わせです。",
    };
  }
  return {
    relation: "GENERAL",
    category: "LEARNING_EACH_OTHERS_PACE",
    title: "歩幅を確かめ合う十二支",
    summary: "言葉を交わしながら互いに心地よい進み方を見つけていける組み合わせです。",
  };
}

function extremes(counts: ElementCounts) {
  const values = ELEMENTS.map((element) => counts[element]);
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  return {
    dominant: ELEMENTS.filter((element) => counts[element] === maximum),
    deficient: ELEMENTS.filter((element) => counts[element] === minimum),
  };
}

function intersects(a: readonly FiveElement[], b: readonly FiveElement[]) {
  return a.some((element) => b.includes(element));
}

function fiveElementInsight(
  profileA: DerivedEtoProfile,
  profileB: DerivedEtoProfile,
): FiveElementRelationshipInsight {
  if (profileA.fiveElements !== null && profileB.fiveElements !== null) {
    const a = extremes(profileA.fiveElements);
    const b = extremes(profileB.fiveElements);
    if (
      intersects(a.dominant, b.deficient) ||
      intersects(b.dominant, a.deficient)
    ) {
      return {
        relation: "COMPLEMENT",
        category: "NATURAL_INTERLOCK",
        title: "五行を補い合う関係",
        summary: "それぞれの豊かな要素が相手の少ない要素を補い、自然な支え合いにつながります。",
      };
    }
  }

  const elementA = profileA.dayMaster.element;
  const elementB = profileB.dayMaster.element;
  if (
    GENERATING_NEXT[elementA] === elementB ||
    GENERATING_NEXT[elementB] === elementA
  ) {
    return {
      relation: "GENERATING",
      category: "EXPANDING_POSSIBILITIES",
      title: "力を育て合う五行",
      summary: "五行の流れが新しい行動や発想を育て、二人の可能性を広げます。",
    };
  }
  if (
    CONTROLLING_NEXT[elementA] === elementB ||
    CONTROLLING_NEXT[elementB] === elementA
  ) {
    return {
      relation: "CONTROLLING",
      category: "POSITIVE_STIMULATION",
      title: "輪郭を磨き合う五行",
      summary: "異なる力の働きが互いの考えを磨き、建設的な気づきをもたらします。",
    };
  }
  if (
    elementA === elementB &&
    profileA.dayMaster.polarity === profileB.dayMaster.polarity
  ) {
    return {
      relation: "SAME_RHYTHM",
      category: "LEARNING_EACH_OTHERS_PACE",
      title: "同じリズムを持つ五行",
      summary: "似たリズムを土台に、互いの小さな違いを丁寧に知っていけます。",
    };
  }
  return {
    relation: "GENERAL",
    category: "LEARNING_EACH_OTHERS_PACE",
    title: "ペースを学び合う五行",
    summary: "それぞれの感じ方を言葉にすると、心地よい関わり方を育てられます。",
  };
}

function mbtiCategory(a: MbtiType, b: MbtiType): EtoRelationshipCategory {
  const matching = [...a].filter((letter, index) => letter === b[index]).length;
  if (matching === 4) return "NATURAL_INTERLOCK";
  if (matching === 3) return "EXPANDING_POSSIBILITIES";
  if (matching === 2) {
    const energyDiffers = a[0] !== b[0];
    const lifestyleDiffers = a[3] !== b[3];
    return energyDiffers && lifestyleDiffers
      ? "LEARNING_EACH_OTHERS_PACE"
      : "POSITIVE_STIMULATION";
  }
  return "LEARNING_EACH_OTHERS_PACE";
}

function axisCopy(same: boolean, sameCopy: string, differentCopy: string) {
  return same ? sameCopy : differentCopy;
}

function mbtiInsight(
  mbtiA: MbtiType | null,
  mbtiB: MbtiType | null,
): MbtiRelationshipInsight | null {
  if (mbtiA === null || mbtiB === null) return null;

  const category = mbtiCategory(mbtiA, mbtiB);
  return {
    category,
    title: "考え方の重なりと違い",
    summary:
      category === "NATURAL_INTERLOCK"
        ? "物事の受け止め方が自然に重なり、意思を伝えやすい関係です。"
        : category === "EXPANDING_POSSIBILITIES"
          ? "多くの感覚を共有しつつ、一つの違いが新しい可能性を運びます。"
          : category === "POSITIVE_STIMULATION"
            ? "共通点を土台に異なる視点を交換し、発想を磨き合える関係です。"
            : "違うペースを急がず確かめることで、理解を深めていける関係です。",
    axes: {
      energyJa: axisCopy(
        mbtiA[0] === mbtiB[0],
        "エネルギーの向け方が似ており、休み方を共有しやすいです。",
        "エネルギーの向け方が異なるため、休む時間を尊重すると安心です。",
      ),
      informationJa: axisCopy(
        mbtiA[1] === mbtiB[1],
        "情報の受け取り方が近く、話の焦点を合わせやすいです。",
        "情報の受け取り方が異なり、事実と発想の両方を持ち寄れます。",
      ),
      decisionJa: axisCopy(
        mbtiA[2] === mbtiB[2],
        "判断で大切にする観点が近く、納得点を見つけやすいです。",
        "判断の観点が異なるため、理由を伝え合うと視野が広がります。",
      ),
      lifestyleJa: axisCopy(
        mbtiA[3] === mbtiB[3],
        "暮らしの進め方が似ており、予定のリズムを整えやすいです。",
        "暮らしの進め方が異なるため、余白と見通しを相談すると心地よく進めます。",
      ),
    },
  };
}

function balancedCategory(
  zodiac: EtoRelationshipCategory,
  element: EtoRelationshipCategory,
  mbti: EtoRelationshipCategory | null,
) {
  if (zodiac === element) return zodiac;
  if (mbti !== null && (mbti === zodiac || mbti === element)) return mbti;
  return zodiac;
}

function directionalElementTip(
  profile: DerivedEtoProfile,
  other: DerivedEtoProfile,
) {
  const own = profile.dayMaster.element;
  const counterpart = other.dayMaster.element;
  if (GENERATING_NEXT[own] === counterpart) {
    return `${ELEMENT_NAMES[own]}の持ち味で、相手の${ELEMENT_NAMES[counterpart]}の力を育ててみましょう。`;
  }
  if (GENERATING_NEXT[counterpart] === own) {
    return `相手の${ELEMENT_NAMES[counterpart]}から受け取る力を、${ELEMENT_NAMES[own]}らしい形で活かしてみましょう。`;
  }
  if (CONTROLLING_NEXT[own] === counterpart) {
    return `${ELEMENT_NAMES[own]}の視点を穏やかに伝え、相手の${ELEMENT_NAMES[counterpart]}の選択肢を広げましょう。`;
  }
  if (CONTROLLING_NEXT[counterpart] === own) {
    return `相手の${ELEMENT_NAMES[counterpart]}の視点を受け取り、${ELEMENT_NAMES[own]}の考えを磨いてみましょう。`;
  }
  return `${ELEMENT_NAMES[own]}らしいペースを言葉にし、相手が受け取りやすい形で伝えてみましょう。`;
}

export function createEtoRelationship(
  input: CreateEtoRelationshipInput,
): EtoRelationshipResult {
  assertInput(input);

  const zodiac = zodiacInsight(
    input.memberA.profile.zodiacId,
    input.memberB.profile.zodiacId,
  );
  const element = fiveElementInsight(
    input.memberA.profile,
    input.memberB.profile,
  );
  const mbti = mbtiInsight(
    input.memberA.profile.mbti,
    input.memberB.profile.mbti,
  );
  const category = balancedCategory(
    zodiac.category,
    element.category,
    mbti?.category ?? null,
  );
  const zodiacNames = [
    ZODIAC_NAMES.get(input.memberA.profile.zodiacId) ?? "十二支",
    ZODIAC_NAMES.get(input.memberB.profile.zodiacId) ?? "十二支",
  ].sort();

  return {
    pairKey: canonicalPairKey(input.memberA.id, input.memberB.id),
    category,
    categoryLabelJa: CATEGORY_LABELS[category],
    headlineJa: `${zodiacNames[0]}と${zodiacNames[1]}は、${CATEGORY_LABELS[category]}です`,
    zodiacInsight: zodiac,
    fiveElementInsight: element,
    mbtiInsight: mbti,
    tips: {
      togetherJa: "結論を急がず、共通点と違いの両方を言葉にしてみましょう。",
      forPersonAJa: directionalElementTip(
        input.memberA.profile,
        input.memberB.profile,
      ),
      forPersonBJa: directionalElementTip(
        input.memberB.profile,
        input.memberA.profile,
      ),
    },
  };
}
