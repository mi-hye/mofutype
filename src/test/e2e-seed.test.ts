import { describe, expect, it } from "vitest";

import { ZODIAC_IDS } from "../lib/eto/types";

type SeedModule = typeof import("../../tests/e2e/seed") & {
  buildSeedMemberRows?: (
    groupId: string,
    userIds: readonly string[],
  ) => readonly Record<string, unknown>[];
};

describe("local E2E zodiac seed", () => {
  it("builds exact date-only profiles while cycling all twelve zodiac IDs", async () => {
    const seed = await import("../../tests/e2e/seed") as SeedModule;
    expect(seed.buildSeedMemberRows).toBeTypeOf("function");

    const userIds = Array.from({ length: 17 }, (_, index) => `user-${index}`);
    const rows = seed.buildSeedMemberRows!("group-1", userIds);

    expect(rows).toHaveLength(17);
    expect(rows.map((row) => row.zodiac_id)).toEqual(
      userIds.map((_, index) => ZODIAC_IDS[index % ZODIAC_IDS.length]),
    );
    expect(rows.some((row) => row.mbti === null)).toBe(true);
    expect(rows.some((row) => row.mbti !== null)).toBe(true);

    for (const [index, row] of rows.entries()) {
      expect(Object.keys(row).sort()).toEqual([
        "group_id",
        "mbti",
        "nickname",
        "profile_payload",
        "profile_version",
        "user_id",
        "zodiac_id",
      ]);
      expect(row).toMatchObject({
        group_id: "group-1",
        user_id: userIds[index],
        zodiac_id: ZODIAC_IDS[index % ZODIAC_IDS.length],
        profile_version: 1,
      });

      const profile = row.profile_payload as unknown as Record<string, unknown>;
      expect(Object.keys(profile).sort()).toEqual([
        "boundaryState",
        "calculationMode",
        "dayMaster",
        "engineVersion",
        "fiveElements",
        "mbti",
        "version",
        "yinYang",
        "zodiacId",
      ]);
      expect(profile).toMatchObject({
        version: 1,
        zodiacId: row.zodiac_id,
        mbti: row.mbti,
        calculationMode: "date-only",
        boundaryState: "exact",
        engineVersion: "mofu-eto-four-pillars-v1",
      });
      expect(Object.values(profile.fiveElements as Record<string, number>))
        .toHaveLength(5);
      expect(Object.values(profile.fiveElements as Record<string, number>)
        .reduce((total, value) => total + value, 0)).toBe(6);
      expect(Object.values(profile.yinYang as Record<string, number>)
        .reduce((total, value) => total + value, 0)).toBe(6);
    }
  });
});
