"use client";

import { GroupGraph } from "@/features/group-graph/group-graph";
import type { RelationshipGraphMember } from "@/features/group-graph/build-graph";
import {
  createEtoRelationship,
  type CreateEtoRelationshipInput,
  type EtoRelationshipResult,
  type RelationshipCategory,
} from "@/lib/eto/relationship";
import type { DerivedEtoProfile, MbtiType, ZodiacId } from "@/lib/eto/types";
import { ZODIACS } from "@/lib/eto/zodiac";

function previewProfile(zodiacId: ZodiacId, mbti: MbtiType): DerivedEtoProfile {
  return {
    version: 1,
    zodiacId,
    mbti,
    dayMaster: { element: "WOOD", polarity: "YANG" },
    fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
    yinYang: { YIN: 3, YANG: 3 },
    calculationMode: "date-only",
    boundaryState: "exact",
    engineVersion: "mofu-eto-four-pillars-v1",
  };
}

function previewMember(
  id: string,
  nickname: string,
  zodiacId: ZodiacId,
  mbti: MbtiType,
): RelationshipGraphMember {
  return {
    id,
    nickname,
    zodiacId,
    mbti,
    profile: previewProfile(zodiacId, mbti),
  };
}

const PREVIEW_MEMBERS: readonly RelationshipGraphMember[] = [
  previewMember("preview-entj", "とら", "tiger", "ENTJ"),
  previewMember("preview-infp", "ねずみ", "rat", "INFP"),
  previewMember("preview-isfj", "うさぎ", "rabbit", "ISFJ"),
];

const ignorePreviewPairSelection = () => undefined;

const LANDING_RELATIONSHIP_CATEGORIES: Readonly<Record<string, RelationshipCategory>> = {
  "rat:tiger": "NATURAL_INTERLOCK",
  "rabbit:rat": "EXPANDING_POSSIBILITIES",
  "rabbit:tiger": "CAREFUL_COORDINATION",
};

const LANDING_CATEGORY_LABELS: Readonly<Record<RelationshipCategory, string>> = {
  NATURAL_INTERLOCK: "自然にかみ合う関係",
  EXPANDING_POSSIBILITIES: "一緒に可能性を広げる関係",
  LEARNING_EACH_OTHERS_PACE: "お互いのペースを学ぶ関係",
  POSITIVE_STIMULATION: "違いがよい刺激になる関係",
  CAREFUL_COORDINATION: "すれ違いに気をつけたい関係",
};

function landingRelationshipFactory(
  input: CreateEtoRelationshipInput,
): EtoRelationshipResult {
  const relationship = createEtoRelationship(input);
  const zodiacIds = [
    input.memberA.profile.zodiacId,
    input.memberB.profile.zodiacId,
  ].sort() as [ZodiacId, ZodiacId];
  const category = LANDING_RELATIONSHIP_CATEGORIES[zodiacIds.join(":")];
  if (!category) return relationship;

  const categoryLabelJa = LANDING_CATEGORY_LABELS[category];
  const zodiacNames = zodiacIds.map((zodiacId) => ZODIACS[zodiacId].nameJa).sort();
  return {
    ...relationship,
    category,
    categoryLabelJa,
    headlineJa: `${zodiacNames[0]}と${zodiacNames[1]}は、${categoryLabelJa}です`,
  };
}

export function LandingRelationshipPreview() {
  return (
    <div className="hero__decor">
      <GroupGraph
        members={PREVIEW_MEMBERS}
        unlocks={[]}
        onPairSelect={ignorePreviewPairSelection}
        relationshipFactory={landingRelationshipFactory}
        variant="minimal"
        showTapHint
      />
    </div>
  );
}
