import { canonicalPairKey } from "@/lib/relationship/pair-key";
import type { GroupMember } from "@/lib/supabase/models";

export interface RelationshipDetailLink {
  memberId: string;
  nickname: string;
  href: string;
}

export function createRelationshipDetailLinks(
  currentMember: GroupMember,
  members: readonly GroupMember[],
  inviteToken: string,
): RelationshipDetailLink[] {
  const encodedInviteToken = encodeURIComponent(inviteToken);
  return members
    .filter((member) => member.id !== currentMember.id)
    .map((member) => ({
      memberId: member.id,
      nickname: member.nickname,
      href: `/g/${encodedInviteToken}/relation/${encodeURIComponent(
        canonicalPairKey(currentMember.id, member.id),
      )}`,
    }));
}
