"use client";

import { GroupGraph } from "@/features/group-graph/group-graph";
import type { RelationshipGraphMember } from "@/features/group-graph/build-graph";
import type { DerivedEtoProfile, MbtiType, ZodiacId } from "@/lib/eto/types";

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

export function LandingRelationshipPreview() {
  return (
    <div className="hero__decor">
      <GroupGraph
        members={PREVIEW_MEMBERS}
        unlocks={[]}
        onPairSelect={ignorePreviewPairSelection}
      />
    </div>
  );
}
