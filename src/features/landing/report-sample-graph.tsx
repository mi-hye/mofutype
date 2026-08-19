"use client";

import { GroupGraph } from "@/features/group-graph/group-graph";
import type { RelationshipGraphMember } from "@/features/group-graph/build-graph";
import type { DerivedEtoProfile, MbtiType, ZodiacId } from "@/lib/eto/types";

function sampleProfile(zodiacId: ZodiacId, mbti: MbtiType): DerivedEtoProfile {
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

function sampleMember(
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
    profile: sampleProfile(zodiacId, mbti),
  };
}

const SAMPLE_MEMBERS: readonly RelationshipGraphMember[] = [
  sampleMember("sample-a", "Aさん", "rat", "INTJ"),
  sampleMember("sample-b", "Bさん", "rabbit", "ENFP"),
  sampleMember("sample-c", "Cさん", "horse", "ISFJ"),
  sampleMember("sample-d", "Dさん", "sheep", "ENTP"),
];

const ignoreSamplePairSelection = () => undefined;

export function ReportSampleGraph() {
  return (
    <div className="report-sample-graph">
      <p className="report-sample-graph__eyebrow">GROUP RELATION MAP</p>
      <GroupGraph
        members={SAMPLE_MEMBERS}
        unlocks={[]}
        onPairSelect={ignoreSamplePairSelection}
      />
      <p className="report-sample-graph__note">
        実際のグループ画面と同じ関係グラフです。メンバーを選ぶと、つながる線をまとめて確認できます。
      </p>
    </div>
  );
}
