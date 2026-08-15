import { GroupGate } from "@/features/onboarding/group-gate";

interface GroupPageProps {
  params: Promise<{ inviteToken: string }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { inviteToken } = await params;
  return <GroupGate inviteToken={inviteToken} />;
}
