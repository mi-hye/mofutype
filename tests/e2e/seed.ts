import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  MBTI_TYPES,
  ZODIAC_IDS,
  type DerivedEtoProfile,
  type MbtiType,
} from "../../src/lib/eto/types";
import { LOCAL_SUPABASE_URL } from "./helpers";

const DATE_ONLY_FACTS = [
  {
    dayMaster: { element: "WOOD", polarity: "YANG" },
    fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
    yinYang: { YIN: 3, YANG: 3 },
  },
  {
    dayMaster: { element: "FIRE", polarity: "YIN" },
    fiveElements: { WOOD: 1, FIRE: 2, EARTH: 1, METAL: 1, WATER: 1 },
    yinYang: { YIN: 4, YANG: 2 },
  },
  {
    dayMaster: { element: "EARTH", polarity: "YANG" },
    fiveElements: { WOOD: 1, FIRE: 1, EARTH: 2, METAL: 1, WATER: 1 },
    yinYang: { YIN: 2, YANG: 4 },
  },
  {
    dayMaster: { element: "METAL", polarity: "YIN" },
    fiveElements: { WOOD: 1, FIRE: 1, EARTH: 1, METAL: 2, WATER: 1 },
    yinYang: { YIN: 5, YANG: 1 },
  },
  {
    dayMaster: { element: "WATER", polarity: "YANG" },
    fiveElements: { WOOD: 1, FIRE: 1, EARTH: 1, METAL: 1, WATER: 2 },
    yinYang: { YIN: 1, YANG: 5 },
  },
] as const satisfies readonly Pick<
  DerivedEtoProfile,
  "dayMaster" | "fiveElements" | "yinYang"
>[];

const SEED_MBTIS: readonly (MbtiType | null)[] = [null, ...MBTI_TYPES];

export function buildSeedMemberRows(
  groupId: string,
  userIds: readonly string[],
) {
  return userIds.map((userId, index) => {
    const zodiacId = ZODIAC_IDS[index % ZODIAC_IDS.length];
    const mbti = SEED_MBTIS[index % SEED_MBTIS.length];
    const facts = DATE_ONLY_FACTS[index % DATE_ONLY_FACTS.length];
    const profile: DerivedEtoProfile = {
      version: 1,
      zodiacId,
      mbti,
      dayMaster: { ...facts.dayMaster },
      fiveElements: { ...facts.fiveElements },
      yinYang: { ...facts.yinYang },
      calculationMode: "date-only",
      boundaryState: "exact",
      engineVersion: "mofu-eto-four-pillars-v1",
    };

    return {
      group_id: groupId,
      user_id: userId,
      nickname: `メンバー${String(index + 2).padStart(2, "0")}`,
      zodiac_id: zodiacId,
      mbti,
      profile_payload: profile,
      profile_version: 1,
    };
  });
}

function localServiceRoleKey(): string {
  const status = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
  });
  const match = status.match(/^SERVICE_ROLE_KEY="([^"]+)"$/m);
  if (!match) throw new Error("Local Supabase service role key is unavailable");
  return match[1];
}

export async function seedGroupMembers(inviteToken: string, count: number): Promise<void> {
  const admin = createClient(LOCAL_SUPABASE_URL, localServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const inviteTokenHash = createHash("sha256").update(inviteToken).digest("hex");
  const groupResult = await admin
    .from("groups")
    .select("id")
    .eq("invite_token_hash", inviteTokenHash)
    .single();
  if (groupResult.error) throw new Error("Unable to locate the local E2E group");

  const users = await Promise.all(Array.from({ length: count }, async () => {
    const identity = randomUUID();
    const result = await admin.auth.admin.createUser({
      email: `${identity}@e2e.invalid`,
      password: randomUUID(),
      email_confirm: true,
    });
    if (result.error || !result.data.user) {
      throw new Error("Unable to create a local E2E fixture user");
    }
    return result.data.user.id;
  }));

  const rows = buildSeedMemberRows(groupResult.data.id, users);
  const insertResult = await admin.from("group_members").insert(rows);
  if (insertResult.error) throw new Error("Unable to seed local E2E members");
}
