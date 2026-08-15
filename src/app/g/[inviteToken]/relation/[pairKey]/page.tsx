import { RelationRouteGate } from "@/features/relationship/relation-route-gate";

interface RelationPageProps {
  params: Promise<{ inviteToken: string; pairKey: string }>;
}

export default async function RelationPage({ params }: RelationPageProps) {
  const { inviteToken, pairKey } = await params;
  return (
    <RelationRouteGate
      inviteToken={inviteToken}
      pairKey={pairKey}
      mode="detail"
    />
  );
}
