"use client";

import { useEffect, useState } from "react";

import { CheckoutPanel } from "@/features/checkout/checkout-panel";
import { MockPaymentProvider } from "@/features/checkout/mock-payment-provider";
import { createRelationship } from "@/lib/relationship/local-provider";
import { canonicalPairKey } from "@/lib/relationship/pair-key";
import { createBrowserGroupRepository } from "@/lib/supabase/group-repository";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";
import { RelationSheet } from "./relation-sheet";

const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;
type RelationRepository = Pick<
  BrowserRepository,
  "findJoinedGroupByInviteToken" | "loadGroup" | "subscribeToGroup" | "unlockPair"
>;

interface PairData {
  groupId: string;
  members: readonly [GroupMember, GroupMember];
  unlocks: RelationUnlock[];
}

interface RelationRouteGateProps {
  inviteToken: string;
  pairKey: string;
  mode: "detail" | "checkout";
  repositoryFactory?: () => RelationRepository;
  navigate?: (path: string) => void;
}

function findPair(
  members: readonly GroupMember[],
  pairKey: string,
): readonly [GroupMember, GroupMember] | null {
  for (let first = 0; first < members.length; first += 1) {
    for (let second = first + 1; second < members.length; second += 1) {
      if (canonicalPairKey(members[first].id, members[second].id) === pairKey) {
        return [members[first], members[second]];
      }
    }
  }
  return null;
}

function normalizeRoutePairKey(pairKey: string): string {
  if (pairKey.includes(":")) return pairKey;
  try {
    return decodeURIComponent(pairKey);
  } catch {
    return pairKey;
  }
}

function pairIsUnlocked(
  unlocks: readonly RelationUnlock[],
  members: readonly [GroupMember, GroupMember],
): boolean {
  const [low, high] = [members[0].id, members[1].id].sort();
  return unlocks.some((unlock) =>
    unlock.status === "unlocked" &&
    unlock.memberLowId === low &&
    unlock.memberHighId === high,
  );
}

function upsertUnlock(
  unlocks: readonly RelationUnlock[],
  incoming: RelationUnlock,
): RelationUnlock[] {
  const index = unlocks.findIndex((unlock) => unlock.id === incoming.id);
  if (index < 0) return [...unlocks, incoming];
  return unlocks.map((unlock, itemIndex) => itemIndex === index ? incoming : unlock);
}

export function RelationRouteGate(props: RelationRouteGateProps) {
  return (
    <RelationRouteGateForPair
      key={`${props.mode}:${props.inviteToken}:${props.pairKey}`}
      {...props}
    />
  );
}

function RelationRouteGateForPair({
  inviteToken,
  pairKey,
  mode,
  repositoryFactory = createBrowserGroupRepository,
  navigate = (path) => window.location.assign(path),
}: RelationRouteGateProps) {
  const validInvite = INVITE_TOKEN_PATTERN.test(inviteToken);
  const normalizedPairKey = normalizeRoutePairKey(pairKey);
  const [repository, setRepository] = useState<RelationRepository | null>(null);
  const [pair, setPair] = useState<PairData | null>(null);
  const [status, setStatus] = useState<"loading" | "member" | "pair" | "error">("loading");

  useEffect(() => {
    if (!validInvite) return;
    let active = true;
    let cleanup: (() => Promise<void>) | undefined;
    const realtimeUnlocks: RelationUnlock[] = [];

    void (async () => {
      try {
        const activeRepository = repositoryFactory();
        const aggregate = await activeRepository.findJoinedGroupByInviteToken(inviteToken);
        if (!active) return;
        if (!aggregate) {
          setStatus("member");
          return;
        }
        const members = findPair(aggregate.members, normalizedPairKey);
        if (!members) {
          setStatus("pair");
          return;
        }
        setRepository(activeRepository);
        setPair({ groupId: aggregate.group.id, members, unlocks: aggregate.unlocks });
        cleanup = activeRepository.subscribeToGroup(aggregate.group.id, {
          onUnlockChange: ({ new: unlock }) => {
            if (active) {
              const index = realtimeUnlocks.findIndex((item) => item.id === unlock.id);
              if (index < 0) realtimeUnlocks.push(unlock);
              else realtimeUnlocks[index] = unlock;
              setPair((current) => current ? {
                ...current,
                unlocks: upsertUnlock(current.unlocks, unlock),
              } : current);
            }
          },
          onError: () => {
            if (active) setStatus("error");
          },
        });
        const fresh = await activeRepository.loadGroup(aggregate.group.id);
        if (!active) return;
        const freshMembers = findPair(fresh.members, normalizedPairKey);
        if (!freshMembers) {
          setPair(null);
          setStatus("pair");
          return;
        }
        setPair({
          groupId: fresh.group.id,
          members: freshMembers,
          unlocks: realtimeUnlocks.reduce(upsertUnlock, fresh.unlocks),
        });
      } catch {
        if (active) setStatus("error");
      }
    })();

    return () => {
      active = false;
      if (cleanup) void cleanup();
    };
  }, [inviteToken, normalizedPairKey, repositoryFactory, validInvite]);

  if (!validInvite) {
    return <main className="group-gate-message"><h1>関係ページを開けません</h1></main>;
  }
  if (status === "loading" && !pair) {
    return <main className="group-gate-message" role="status">関係を確認しています</main>;
  }
  if (status === "member") {
    return (
      <main className="group-gate-message">
        <h1>この関係を見るにはグループに参加してください</h1>
        <a href={`/g/${encodeURIComponent(inviteToken)}`}>グループに参加する</a>
      </main>
    );
  }
  if (status === "pair") {
    return <main className="group-gate-message"><h1>この関係は見つかりません</h1></main>;
  }
  if (status === "error" || !pair || !repository) {
    return (
      <main className="group-gate-message">
        <h1>関係を読み込めませんでした</h1>
        <p>通信環境を確認して、もう一度お試しください。</p>
      </main>
    );
  }

  const [memberA, memberB] = pair.members;
  const relationship = createRelationship({ memberA, memberB });
  const unlocked = pairIsUnlocked(pair.unlocks, pair.members);
  const encodedPairKey = encodeURIComponent(normalizedPairKey);
  const encodedInvite = encodeURIComponent(inviteToken);
  const detailHref = `/g/${encodedInvite}/relation/${encodedPairKey}`;

  if (mode === "checkout" && !unlocked) {
    return (
      <main className="group-gate-shell">
        <CheckoutPanel
          pairNames={[memberA.nickname, memberB.nickname]}
          input={{ groupId: pair.groupId, memberA: memberA.id, memberB: memberB.id }}
          provider={new MockPaymentProvider(repository)}
          onSuccess={() => navigate(detailHref)}
        />
      </main>
    );
  }

  return (
    <main className="group-gate-shell">
      <RelationSheet
        relationship={relationship}
        memberNames={[memberA.nickname, memberB.nickname]}
        unlocked={unlocked}
        checkoutHref={`/checkout/${encodedPairKey}?invite=${encodedInvite}`}
        detailHref={detailHref}
      />
    </main>
  );
}
