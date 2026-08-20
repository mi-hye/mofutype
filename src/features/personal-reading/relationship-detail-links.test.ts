import { describe, expect, it } from "vitest";

import type { GroupMember } from "@/lib/supabase/models";
import { createRelationshipDetailLinks } from "./relationship-detail-links";

function member(id: string, nickname: string): GroupMember {
  return {
    id,
    groupId: "group-a",
    userId: `user-${id}`,
    nickname,
    zodiacId: "rat",
    mbti: null,
    profile: {
      version: 1,
      zodiacId: "rat",
      mbti: null,
      dayMaster: { element: "WOOD", polarity: "YANG" },
      fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 2, WATER: 2 },
      yinYang: { YIN: 4, YANG: 4 },
      calculationMode: "date-only",
      boundaryState: "exact",
      engineVersion: "mofu-eto-four-pillars-v1",
    },
    joinedAt: "2026-08-20T00:00:00Z",
  };
}

describe("createRelationshipDetailLinks", () => {
  it("creates a canonical detail URL for every other group member", () => {
    const current = member("b", "わたし");

    expect(createRelationshipDetailLinks(
      current,
      [member("a", "あお"), current, member("c", "しろ")],
      "invite-token",
    )).toEqual([
      {
        memberId: "a",
        nickname: "あお",
        href: "/g/invite-token/relation/a%3Ab",
      },
      {
        memberId: "c",
        nickname: "しろ",
        href: "/g/invite-token/relation/b%3Ac",
      },
    ]);
  });
});
