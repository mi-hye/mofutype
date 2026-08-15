"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { AnimalAvatar } from "@/components/animal-avatar";
import { Button } from "@/components/ui/button";
import { StatusBanner, type ConnectionStatus } from "@/components/ui/status-banner";
import { RelationSheet } from "@/features/relationship/relation-sheet";
import { GroupShareControls } from "@/features/share/group-share-controls";
import { ANIMALS } from "@/lib/astrology/animals";
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
  repository: GroupRepository;
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

export function GroupScreen(props: GroupScreenProps) {
  return <GroupScreenForGroup key={props.initialAggregate.group.id} {...props} />;
}

function GroupScreenForGroup({ initialAggregate, repository, inviteToken, currentUserId }: GroupScreenProps) {
  const [aggregate, setAggregate] = useState(initialAggregate);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [selectedPair, setSelectedPair] = useState<PairSelection | null>(null);
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
    if (currentUserId) return;
    if (!repository.ensureAnonymousSession) return;
    let current = true;
    void repository.ensureAnonymousSession().then((userId) => {
      if (current) setResolvedUserId(userId);
    }).catch(() => {
      // Connection status already provides the user-facing recovery path.
    });
    return () => { current = false; };
  }, [currentUserId, repository]);

  const activeUserId = currentUserId ?? resolvedUserId;
  const currentMember = activeUserId
    ? aggregate.members.find((member) => member.userId === activeUserId) ?? null
    : null;
  const currentAnimal = currentMember ? ANIMALS[currentMember.animalId] : null;
  const animalGroupLabel = currentMember
    ? { MOON: "月タイプ", EARTH: "地球タイプ", SUN: "太陽タイプ" }[currentMember.animalGroup]
    : null;

  return (
    <main className="group-member-shell">
      <header className="group-member-header">
        <div>
          <p className="hero__eyebrow">MofuType グループ</p>
          <h1>{aggregate.group.name}</h1>
          <p>メンバー {aggregate.members.length}人</p>
        </div>
        <div className="group-member-actions">
          {status !== "success" ? <StatusBanner status={status} /> : null}
          {inviteToken ? (
            <GroupShareControls
              groupName={aggregate.group.name}
              inviteToken={inviteToken}
              memberCount={aggregate.members.length}
            />
          ) : null}
          {status === "offline" || status === "error" ? (
            <Button type="button" variant="secondary" onClick={() => {
              setStatus("connecting");
              setLoadError(false);
              setSubscriptionAttempt((value) => value + 1);
            }}>
              接続を再試行
            </Button>
          ) : null}
          <Button
            type="button"
            className="group-refresh-button"
            variant="ghost"
            aria-label="最新の情報に更新"
            title="最新の情報に更新"
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" focusable="false" strokeWidth={2.2} />
          </Button>
        </div>
      </header>

      {loadError ? (
        <p className="form-error" role="alert">
          グループを更新できませんでした。通信環境を確認してください。
        </p>
      ) : null}

      <GroupGraph members={aggregate.members} unlocks={aggregate.unlocks} onPairSelect={setSelectedPair} />
      {currentMember && currentAnimal ? (
        <section className="my-result-card" aria-labelledby="my-result-title">
          <div className="my-result-card__heading">
            <h2 id="my-result-title">わたしの四柱推命結果</h2>
          </div>
          <div className="my-result-card__content">
            <AnimalAvatar
              animalId={currentMember.animalId}
              nickname={currentMember.nickname}
              size="md"
              src={`/animals/faces/${currentMember.animalId}.png`}
            />
            <div>
              <span className="my-result-card__label">動物タイプ</span>
              <strong>{currentAnimal.nameJa}</strong>
              <p>{currentMember.nickname}さんの生年月日から導いたタイプです。</p>
              <ul aria-label="診断結果の詳細">
                <li>{currentMember.mbti ?? "MBTI未設定"}</li>
                <li>{animalGroupLabel}</li>
                <li>{currentMember.profile.calculationMode === "date-time" ? "出生時刻を反映" : "生年月日で診断"}</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}
      {selectedPair ? (
        <RelationSheet
          relationship={selectedPair.relationship}
          memberNames={selectedPair.memberIds.map((memberId) =>
            aggregate.members.find((member) => member.id === memberId)?.nickname ?? "メンバー"
          ) as [string, string]}
          unlocked={isPairUnlocked(aggregate.unlocks, selectedPair.memberIds)}
          checkoutHref={inviteToken
            ? `/checkout/${encodeURIComponent(selectedPair.pairKey)}?invite=${encodeURIComponent(inviteToken)}`
            : "#"}
          detailHref={inviteToken
            ? `/g/${encodeURIComponent(inviteToken)}/relation/${encodeURIComponent(selectedPair.pairKey)}`
            : undefined}
          onClose={() => setSelectedPair(null)}
        />
      ) : null}
    </main>
  );
}
