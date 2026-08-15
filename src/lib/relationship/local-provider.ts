import { ANIMALS } from "../astrology/animals";
import type { AnimalGroup, DerivedProfile } from "../astrology/types";
import { canonicalPairKey } from "./pair-key";
import type {
  CreateRelationshipInput,
  GroupDynamic,
  RelationshipDetail,
  RelationshipResult,
} from "./types";

type CopyTemplate = {
  freeTitleJa: string;
  freeSummaryJa: string;
  detail: RelationshipDetail;
};

const GROUP_DYNAMICS = {
  MOON: {
    MOON: "SAME_GROUP",
    EARTH: "MOON_OVER_EARTH",
    SUN: "SUN_OVER_MOON",
  },
  EARTH: {
    MOON: "MOON_OVER_EARTH",
    EARTH: "SAME_GROUP",
    SUN: "EARTH_OVER_SUN",
  },
  SUN: {
    MOON: "SUN_OVER_MOON",
    EARTH: "EARTH_OVER_SUN",
    SUN: "SAME_GROUP",
  },
} as const satisfies Readonly<
  Record<AnimalGroup, Readonly<Record<AnimalGroup, GroupDynamic>>>
>;

export type RelationshipValidationErrorCode = "INVALID_ANIMAL_GROUP";

export class RelationshipValidationError extends Error {
  constructor(
    public readonly code: RelationshipValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RelationshipValidationError";
  }
}

const COPY_TEMPLATES: Readonly<
  Record<GroupDynamic, (duo: string) => CopyTemplate>
> = {
  SAME_GROUP: (duo) => ({
    freeTitleJa: `${duo}、似たもの同士で話が早い`,
    freeSummaryJa:
      "テンポが自然にそろうコンビ。わかり合えるぶん、思い込みだけは言葉でほどこう。",
    detail: {
      attractionJa: "同じ景色に反応しやすく、初対面でも空気がすっとなじむ。",
      frictionJa: "似ているからこそ、苦手なことまで同時に避けがち。",
      unspokenJa: "『きっと同じ気持ち』で進めると、小さなズレを見落としやすい。",
      communicationJa: "結論だけでなく、そこに至った気持ちをひと言足すと強い。",
      reconciliationJa: "どちらかが先に本音を出せば、仲直りのリズムはすぐ戻る。",
      longTermJa: "慣れに甘えず新しい体験を共有すると、息の長い名コンビになる。",
    },
  }),
  MOON_OVER_EARTH: (duo) => ({
    freeTitleJa: `${duo}、やわらかさが現実を動かす`,
    freeSummaryJa:
      "気持ちを拾う月タイプと足場を固める地球タイプ。違う得意技が、意外といいパスになる。",
    detail: {
      attractionJa: "やさしいひらめきと頼れる段取りが出会い、お互いにない魅力が光る。",
      frictionJa: "気持ちを優先したい瞬間と、まず現実を整えたい瞬間がぶつかる。",
      unspokenJa: "月側は冷たさを、地球側は曖昧さを感じても飲み込みやすい。",
      communicationJa: "気持ちを伝えてから具体策へ進む、この順番が会話の近道。",
      reconciliationJa: "正しさ比べを止め、今ほしい助けを一つずつ言うと戻りやすい。",
      longTermJa: "安心と実行力を交換できれば、日常に強いしなやかな関係になる。",
    },
  }),
  EARTH_OVER_SUN: (duo) => ({
    freeTitleJa: `${duo}、勢いをちゃんと形にする`,
    freeSummaryJa:
      "走り出す太陽タイプと着地させる地球タイプ。熱量と段取りがかみ合えば頼もしい。",
    detail: {
      attractionJa: "大胆な一歩と確かな支えがそろい、一緒だと話が前へ進む。",
      frictionJa: "太陽側のスピードに、地球側の慎重さがブレーキに見えることがある。",
      unspokenJa: "地球側は振り回された感覚を、太陽側は水を差された感覚を抱えがち。",
      communicationJa: "まずゴールを合わせ、そのあと期限と役割を短く決めよう。",
      reconciliationJa: "熱が下がるまで少し置き、事実と希望を分けて話すとうまくいく。",
      longTermJa: "挑戦する人と守る人を固定せず交代できると、ぐっと強いチームになる。",
    },
  }),
  SUN_OVER_MOON: (duo) => ({
    freeTitleJa: `${duo}、まぶしさが心の扉を開く`,
    freeSummaryJa:
      "場を照らす太陽タイプと気配を読む月タイプ。勢いにやさしい余白が加わるコンビ。",
    detail: {
      attractionJa: "明るい突破力と細やかな共感が、お互いの世界を広げる。",
      frictionJa: "太陽側の直球が強すぎたり、月側の遠慮が伝わらなかったりする。",
      unspokenJa: "月側は置いていかれた気持ちを、太陽側は反応の薄さへの不安を隠しやすい。",
      communicationJa: "太陽側は一拍待ち、月側は小さくても本音を声にすると届く。",
      reconciliationJa: "謝るだけで終わらず、次はどう合図するかまで決めると晴れやすい。",
      longTermJa: "表に立つ役と支える役を尊重し合えば、温度のある関係が続く。",
    },
  }),
};

function validateAnimalGroup(value: unknown): asserts value is AnimalGroup {
  switch (value) {
    case "MOON":
    case "EARTH":
    case "SUN":
      return;
    default:
      throw new RelationshipValidationError(
        "INVALID_ANIMAL_GROUP",
        "Invalid animal group",
      );
  }
}

function groupDynamic(firstGroup: unknown, secondGroup: unknown): GroupDynamic {
  validateAnimalGroup(firstGroup);
  validateAnimalGroup(secondGroup);
  return GROUP_DYNAMICS[firstGroup][secondGroup];
}

function animalDuo(first: DerivedProfile, second: DerivedProfile): string {
  return [ANIMALS[first.animalId].nameJa, ANIMALS[second.animalId].nameJa]
    .sort()
    .join(" × ");
}

function mbtiModifier(
  first: DerivedProfile,
  second: DerivedProfile,
): string {
  if (first.mbti === null || second.mbti === null) {
    return "";
  }

  const duo = [first.mbti, second.mbti].sort().join(" × ");
  return ` MBTIは${duo}。考え方のクセも、ふたりらしい会話のスパイス。`;
}

export function createRelationship({
  memberA,
  memberB,
}: CreateRelationshipInput): RelationshipResult {
  const pairKey = canonicalPairKey(memberA.id, memberB.id);
  const dynamic = groupDynamic(
    memberA.profile.animalGroup,
    memberB.profile.animalGroup,
  );
  const template = COPY_TEMPLATES[dynamic](
    animalDuo(memberA.profile, memberB.profile),
  );

  return {
    pairKey,
    dynamic,
    freeTitleJa: template.freeTitleJa,
    freeSummaryJa:
      template.freeSummaryJa + mbtiModifier(memberA.profile, memberB.profile),
    detail: template.detail,
  };
}
