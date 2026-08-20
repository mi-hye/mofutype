"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PersonalReadingSummary } from "@/features/personal-reading/personal-reading-view";
import { StatusBanner, type ConnectionStatus } from "@/components/ui/status-banner";
import { RelationSheet } from "@/features/relationship/relation-sheet";
import { GroupShareControls } from "@/features/share/group-share-controls";
import { createEtoRelationship } from "@/lib/eto/relationship";
import type {
  GroupAggregate,
  GroupSubscriptionCallbacks,
  createBrowserGroupRepository,
} from "@/lib/supabase/group-repository";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";
import { GroupGraph, type PairSelection } from "./group-graph";

type GroupRepository = Pick<
  ReturnType<typeof createBrowserGroupRepository>,
  "loadGroup" | "subscribeToGroup"
> & Partial<Pick<ReturnType<typeof createBrowserGroupRepository>, "ensureAnonymousSession">>;

interface GroupScreenProps {
  initialAggregate: GroupAggregate;
  repository?: GroupRepository;
  inviteToken?: string;
  currentUserId?: string;
}

function upsertById<T extends { id: string }>(items: readonly T[], incoming: T): T[] {
  const index = items.findIndex((item) => item.id === incoming.id);
  if (index < 0) return [...items, incoming];
  return items.map((item, itemIndex) => itemIndex === index ? incoming : item);
}

function mergeSnapshotItems<T extends { id: string }>(
  snapshot: readonly T[],
  current: readonly T[],
  revisions: ReadonlyMap<string, number>,
  revisionBeforeLoad: number,
): T[] {
  const merged = [...snapshot];
  const indexes = new Map(merged.map((item, index) => [item.id, index]));
  for (const item of current) {
    const index = indexes.get(item.id);
    if (index === undefined) {
      indexes.set(item.id, merged.length);
      merged.push(item);
    } else if ((revisions.get(item.id) ?? 0) > revisionBeforeLoad) {
      merged[index] = item;
    }
  }
  return merged;
}

function mergeSnapshotAggregate(
  snapshot: GroupAggregate,
  current: GroupAggregate,
  memberRevisions: ReadonlyMap<string, number>,
  unlockRevisions: ReadonlyMap<string, number>,
  revisionBeforeLoad: number,
): GroupAggregate {
  return {
    ...snapshot,
    members: mergeSnapshotItems(
      snapshot.members,
      current.members,
      memberRevisions,
      revisionBeforeLoad,
    ),
    unlocks: mergeSnapshotItems(
      snapshot.unlocks,
      current.unlocks,
      unlockRevisions,
      revisionBeforeLoad,
    ),
  };
}

function connectionStatus(status: string): ConnectionStatus {
  switch (status) {
    case "SUBSCRIBED": return "success";
    case "TIMED_OUT":
    case "CLOSED": return "offline";
    case "CHANNEL_ERROR": return "error";
    default: return "connecting";
  }
}

function isPairUnlocked(
  unlocks: readonly RelationUnlock[],
  memberIds: readonly [string, string],
): boolean {
  const [low, high] = [...memberIds].sort();
  return unlocks.some((unlock) =>
    unlock.status === "unlocked" &&
    unlock.memberLowId === low &&
    unlock.memberHighId === high,
  );
}

function findSelectedMembers(
  members: readonly GroupMember[],
  memberIds: readonly [string, string],
): readonly [GroupMember, GroupMember] | null {
  const memberA = members.find((member) => member.id === memberIds[0]);
  const memberB = members.find((member) => member.id === memberIds[1]);
  return memberA && memberB ? [memberA, memberB] : null;
}

export function GroupScreen(props: GroupScreenProps) {
  return <GroupScreenForGroup key={props.initialAggregate.group.id} {...props} />;
}

function GroupScreenForGroup({ initialAggregate, repository, inviteToken, currentUserId }: GroupScreenProps) {
  const [aggregate, setAggregate] = useState(initialAggregate);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [selectedPair, setSelectedPair] = useState<PairSelection | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const generation = useRef(0);
  const changeRevision = useRef(0);
  const memberRevisions = useRef(new Map<string, number>());
  const unlockRevisions = useRef(new Map<string, number>());
  const loadRequest = useRef(0);

  const applyMember = useCallback((member: GroupMember) => {
    changeRevision.current += 1;
    memberRevisions.current.set(member.id, changeRevision.current);
    setAggregate((current) => ({
      ...current,
      members: upsertById(current.members, member),
    }));
  }, []);
  const applyUnlock = useCallback((unlock: RelationUnlock) => {
    changeRevision.current += 1;
    unlockRevisions.current.set(unlock.id, changeRevision.current);
    setAggregate((current) => ({
      ...current,
      unlocks: upsertById(current.unlocks, unlock),
    }));
  }, []);

  useEffect(() => {
    if (!repository) return;
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    const revisionBeforeLoad = changeRevision.current;
    const request = loadRequest.current + 1;
    loadRequest.current = request;
    let reconciliationTimer: ReturnType<typeof setTimeout> | undefined;
    let periodicReconciliationActive = false;
    let reconciliationInFlight: Promise<void> | null = null;
    const reconcileLatestSnapshot = () => {
      if (reconciliationInFlight) return reconciliationInFlight;
      const run = (async () => {
        const revisionBeforeReconcile = changeRevision.current;
        const reconcileRequest = loadRequest.current + 1;
        loadRequest.current = reconcileRequest;
        try {
          const fresh = await repository.loadGroup(initialAggregate.group.id);
          if (
            generation.current === currentGeneration &&
            loadRequest.current === reconcileRequest
          ) {
            setLoadError(false);
            setAggregate((current) => mergeSnapshotAggregate(
              fresh,
              current,
              memberRevisions.current,
              unlockRevisions.current,
              revisionBeforeReconcile,
            ));
          }
        } catch {
          if (
            generation.current === currentGeneration &&
            loadRequest.current === reconcileRequest
          ) setLoadError(true);
        }
      })();
      reconciliationInFlight = run;
      void run.then(() => {
        if (reconciliationInFlight === run) reconciliationInFlight = null;
      });
      return run;
    };
    const scheduleReconciliation = (delay: number) => {
      reconciliationTimer = setTimeout(() => {
        if (document.visibilityState === "hidden") {
          if (periodicReconciliationActive) scheduleReconciliation(30_000);
          return;
        }
        void reconcileLatestSnapshot().finally(() => {
          if (
            periodicReconciliationActive &&
            generation.current === currentGeneration
          ) scheduleReconciliation(30_000);
        });
      }, delay);
    };
    const callbacks: GroupSubscriptionCallbacks = {
      onMemberChange: ({ new: member }) => {
        if (generation.current === currentGeneration) applyMember(member);
      },
      onUnlockChange: ({ new: unlock }) => {
        if (generation.current === currentGeneration) applyUnlock(unlock);
      },
      onConnectionStatus: (nextStatus) => {
        if (generation.current === currentGeneration) {
          setStatus(connectionStatus(nextStatus));
          if (nextStatus === "SUBSCRIBED") {
            void reconcileLatestSnapshot();
            if (!periodicReconciliationActive) {
              periodicReconciliationActive = true;
              scheduleReconciliation(5_000);
            }
          } else {
            periodicReconciliationActive = false;
            if (reconciliationTimer !== undefined) {
              clearTimeout(reconciliationTimer);
              reconciliationTimer = undefined;
            }
          }
        }
      },
      onError: () => {
        if (generation.current === currentGeneration) setStatus("error");
      },
    };

    let cleanup: (() => Promise<void>) | undefined;
    try {
      cleanup = repository.subscribeToGroup(initialAggregate.group.id, callbacks);
    } catch {
      queueMicrotask(() => {
        if (generation.current === currentGeneration) setStatus("error");
      });
    }

    void repository.loadGroup(initialAggregate.group.id).then((fresh) => {
      if (
        generation.current === currentGeneration &&
        loadRequest.current === request
      ) {
        setAggregate((current) => mergeSnapshotAggregate(
          fresh,
          current,
          memberRevisions.current,
          unlockRevisions.current,
          revisionBeforeLoad,
        ));
      }
    }).catch(() => {
      if (
        generation.current === currentGeneration &&
        loadRequest.current === request
      ) setLoadError(true);
    });

    return () => {
      periodicReconciliationActive = false;
      if (reconciliationTimer !== undefined) clearTimeout(reconciliationTimer);
      if (generation.current === currentGeneration) generation.current += 1;
      if (cleanup) void cleanup();
    };
  }, [applyMember, applyUnlock, initialAggregate.group.id, repository, subscriptionAttempt]);

  const refresh = useCallback(async () => {
    if (!repository) return;
    const currentGeneration = generation.current;
    const revisionBeforeLoad = changeRevision.current;
    const request = loadRequest.current + 1;
    loadRequest.current = request;
    setLoadError(false);
    try {
      const fresh = await repository.loadGroup(initialAggregate.group.id);
      if (
        generation.current === currentGeneration &&
        loadRequest.current === request
      ) {
        setAggregate((current) => mergeSnapshotAggregate(
          fresh,
          current,
          memberRevisions.current,
          unlockRevisions.current,
          revisionBeforeLoad,
        ));
      }
    } catch {
      if (
        generation.current === currentGeneration &&
        loadRequest.current === request
      ) setLoadError(true);
    }
  }, [initialAggregate.group.id, repository]);

  useEffect(() => {
    if (currentUserId || !repository?.ensureAnonymousSession) return;
    let active = true;
    void repository.ensureAnonymousSession().then((userId) => {
      if (active) setResolvedUserId(userId);
    }).catch(() => {
      // The connection banner already exposes the recovery state.
    });
    return () => { active = false; };
  }, [currentUserId, repository]);

  const activeUserId = currentUserId ?? resolvedUserId;
  const currentMember = activeUserId
    ? aggregate.members.find((member) => member.userId === activeUserId) ?? null
    : null;
  const selectedMembers = selectedPair
    ? findSelectedMembers(aggregate.members, selectedPair.memberIds)
    : null;
  const selectedRelationship = selectedMembers
    ? createEtoRelationship({
        memberA: { id: selectedMembers[0].id, profile: selectedMembers[0].profile },
        memberB: { id: selectedMembers[1].id, profile: selectedMembers[1].profile },
      })
    : null;
  const relationshipDetail = selectedPair && selectedMembers && selectedRelationship ? (
    <RelationSheet
      relationship={selectedRelationship}
      memberNames={[selectedMembers[0].nickname, selectedMembers[1].nickname]}
      memberProfiles={[selectedMembers[0].profile, selectedMembers[1].profile]}
      unlocked={isPairUnlocked(aggregate.unlocks, selectedPair.memberIds)}
      checkoutHref={inviteToken
        ? `/checkout/${encodeURIComponent(selectedPair.pairKey)}?invite=${encodeURIComponent(inviteToken)}`
        : "#"}
      detailHref={inviteToken
        ? `/g/${encodeURIComponent(inviteToken)}/relation/${encodeURIComponent(selectedPair.pairKey)}`
        : undefined}
      compact
      onClose={() => setSelectedPair(null)}
    />
  ) : null;
  const personalReadingContent = currentMember ? (
    <PersonalReadingSummary
      member={currentMember}
      groupName={aggregate.group.name}
      memberCount={aggregate.members.length}
      inviteToken={inviteToken}
    />
  ) : null;

  return (
    <main className="group-member-shell">
      <header className="group-member-header">
        <div className="group-member-header__topbar">
          <p className="hero__eyebrow">MofuType グループ</p>
          <div className="group-member-actions">
            {inviteToken ? (
              <GroupShareControls
                groupName={aggregate.group.name}
                inviteToken={inviteToken}
                memberCount={aggregate.members.length}
              />
            ) : null}
            <Button
              type="button"
              className="group-refresh-button"
              variant="ghost"
              aria-label="最新の情報に更新"
              title="最新の情報に更新"
              disabled={!repository}
              onClick={() => void refresh()}
            >
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
              </svg>
            </Button>
          </div>
        </div>
        <div className="group-member-header__identity">
          <h1>{aggregate.group.name}</h1>
          <p>メンバー {aggregate.members.length}人</p>
        </div>
        {status === "offline" || status === "error" ? (
          <div className="group-member-connection">
            <StatusBanner status={status} />
            <Button type="button" variant="secondary" onClick={() => {
              setStatus("connecting");
              setLoadError(false);
              setSubscriptionAttempt((value) => value + 1);
            }}>
              接続を再試行
            </Button>
          </div>
        ) : null}
      </header>

      {loadError ? (
        <p className="form-error" role="alert">
          グループを更新できませんでした。通信環境を確認してください。
        </p>
      ) : null}

      <GroupGraph
        anchorId="relationship-map"
        members={aggregate.members}
        unlocks={aggregate.unlocks}
        onPairSelect={setSelectedPair}
        interstitialContent={personalReadingContent}
        relationshipDetail={relationshipDetail}
      />
    </main>
  );
}
