import { PersonalRouteGate } from "@/features/personal-reading/personal-route-gate";

interface PersonalPageProps {
  params: Promise<{ inviteToken: string }>;
}

export default async function PersonalPage({ params }: PersonalPageProps) {
  const { inviteToken } = await params;
  return <PersonalRouteGate inviteToken={inviteToken} />;
}
