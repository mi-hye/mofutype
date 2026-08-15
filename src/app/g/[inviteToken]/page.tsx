import type { Metadata } from "next";

import { GroupGate } from "@/features/onboarding/group-gate";
import { createSafeOgPayload } from "@/lib/share/og-payload";

interface GroupPageProps {
  params: Promise<{ inviteToken: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
  return <GroupGate inviteToken={inviteToken} />;
}
