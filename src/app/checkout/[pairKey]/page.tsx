import { RelationRouteGate } from "@/features/relationship/relation-route-gate";

interface CheckoutPageProps {
  params: Promise<{ pairKey: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const [{ pairKey }, query] = await Promise.all([params, searchParams]);
  const inviteToken = typeof query.invite === "string" ? query.invite : "";
  return (
    <RelationRouteGate
      inviteToken={inviteToken}
      pairKey={pairKey}
      mode="checkout"
    />
  );
}
