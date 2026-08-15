import type { Metadata } from "next";

import { GroupGate } from "@/features/onboarding/group-gate";
import { INVITE_TOKEN_PATTERN } from "@/lib/invite-token";
import {
  createGroupRepository,
  createSupabaseGroupRepositoryAdapter,
  type GroupAggregate,
} from "@/lib/supabase/group-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSafeOgPayload } from "@/lib/share/og-payload";

interface GroupPageProps {
  params: Promise<{ inviteToken: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loadInitialGroup(inviteToken: string): Promise<{
  aggregate: GroupAggregate;
  currentUserId: string;
} | null> {
  if (!INVITE_TOKEN_PATTERN.test(inviteToken)) return null;
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const repository = createGroupRepository(
      createSupabaseGroupRepositoryAdapter(client),
    );
    const aggregate = await repository.findJoinedGroupByInviteToken(inviteToken);
    return aggregate ? { aggregate, currentUserId: data.user.id } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: GroupPageProps): Promise<Metadata> {
  const query: Record<string, string | string[] | undefined> = await (
    searchParams ?? Promise.resolve({})
  );
  const safeUrl = new URL("https://mofutype.local/api/og");
  const name = first(query.name);
  const count = first(query.count);
  if (name !== undefined) safeUrl.searchParams.set("name", name);
  if (count !== undefined) safeUrl.searchParams.set("count", count);
  const preview = createSafeOgPayload(safeUrl);
  const ogPath = `/api/og?${new URLSearchParams({
    name: preview.groupName,
    count: String(preview.memberCount),
  }).toString()}`;

  return {
    title: `${preview.groupName} | MofuType`,
    description: `${preview.memberCount}人の関係マップに参加しよう。`,
    openGraph: {
      title: `${preview.groupName} | MofuType`,
      description: `${preview.memberCount}人の関係マップに参加しよう。`,
      images: [ogPath],
    },
  };
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { inviteToken } = await params;
  const initial = await loadInitialGroup(inviteToken);
  return (
    <GroupGate
      inviteToken={inviteToken}
      initialAggregate={initial?.aggregate}
      currentUserId={initial?.currentUserId}
    />
  );
}
