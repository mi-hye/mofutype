import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { LOCAL_SUPABASE_URL } from "./helpers";

const animals = [
  ["fawn", "MOON"], ["raccoon", "MOON"], ["black-panther", "MOON"], ["sheep", "MOON"],
  ["wolf", "EARTH"], ["monkey", "EARTH"], ["tiger", "EARTH"], ["koala", "EARTH"],
  ["cheetah", "SUN"], ["lion", "SUN"], ["elephant", "SUN"], ["pegasus", "SUN"],
] as const;

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

  const rows = users.map((userId, index) => {
    const [animalId, animalGroup] = animals[index % animals.length];
    return {
      group_id: groupResult.data.id,
      user_id: userId,
      nickname: `メンバー${String(index + 2).padStart(2, "0")}`,
      animal_id: animalId,
      animal_group: animalGroup,
      mbti: null,
      profile_payload: {
        version: 1,
        animalId,
        animalGroup,
        mbti: null,
        calculationMode: "date-only",
      },
    };
  });
  const insertResult = await admin.from("group_members").insert(rows);
  if (insertResult.error) throw new Error("Unable to seed local E2E members");
}
