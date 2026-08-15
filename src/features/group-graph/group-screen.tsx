"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBanner, type ConnectionStatus } from "@/components/ui/status-banner";
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
>;

interface GroupScreenProps {
  initialAggregate: GroupAggregate;
  repository: GroupRepository;
}

function upsertById<T extends { id: string }>(items: readonly T[], incoming: T): T[] {
  const index = items.findIndex((item) => item.id === incoming.id);
  if (index < 0) return [...items, incoming];
  return items.map((item, itemIndex) => itemIndex === index ? incoming : item);
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

export function GroupScreen(props: GroupScreenProps) {
  return <GroupScreenForGroup key={props.initialAggregate.group.id} {...props} />;
}

function GroupScreenForGroup({ initialAggregate, repository }: GroupScreenProps) {
  const [aggregate, setAggregate] = useState(initialAggregate);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [selectedPair, setSelectedPair] = useState<PairSelection | null>(null);
  const generation = useRef(0);
  const eventVersion = useRef(0);

  const applyMember = useCallback((member: GroupMember) => {
    eventVersion.current += 1;
    setAggregate((current) => ({
      ...current,
      members: upsertById(current.members, member),
    }));
  }, []);
  const applyUnlock = useCallback((unlock: RelationUnlock) => {
    eventVersion.current += 1;
    setAggregate((current) => ({
      ...current,
      unlocks: upsertById(current.unlocks, unlock),
    }));
  }, []);

  useEffect(() => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    const versionBeforeLoad = eventVersion.current;
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
        eventVersion.current === versionBeforeLoad
      ) {
        setAggregate(fresh);
      }
    }).catch(() => {
      if (generation.current === currentGeneration) setLoadError(true);
    });

    return () => {
      if (generation.current === currentGeneration) generation.current += 1;
      if (cleanup) void cleanup();
    };
  }, [applyMember, applyUnlock, initialAggregate.group.id, repository, subscriptionAttempt]);

  const refresh = useCallback(async () => {
    const currentGeneration = generation.current;
    const versionBeforeLoad = eventVersion.current;
    setLoadError(false);
    try {
      const fresh = await repository.loadGroup(initialAggregate.group.id);
      if (
        generation.current === currentGeneration &&
        eventVersion.current === versionBeforeLoad
      ) {
        setAggregate(fresh);
      }
    } catch {
      if (generation.current === currentGeneration) setLoadError(true);
    }
  }, [initialAggregate.group.id, repository]);

  return (
    <main className="group-member-shell">
      <header className="group-member-header">
        <div>
          <p className="hero__eyebrow">MofuType グループ</p>
          <h1>{aggregate.group.name}</h1>
          <p>メンバー {aggregate.members.length}人</p>
        </div>
        <div className="group-member-actions">
          <StatusBanner status={status} />
          {status === "offline" || status === "error" ? (
            <Button type="button" variant="secondary" onClick={() => {
              setStatus("connecting");
              setLoadError(false);
              setSubscriptionAttempt((value) => value + 1);
            }}>
              接続を再試行
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void refresh()}>
            最新の情報に更新
          </Button>
        </div>
      </header>

      {loadError ? (
        <p className="form-error" role="alert">
          グループを更新できませんでした。通信環境を確認してください。
        </p>
      ) : null}

      <GroupGraph members={aggregate.members} unlocks={aggregate.unlocks} onPairSelect={setSelectedPair} />
      {selectedPair ? (
        <p className="group-pair-selection" role="status" aria-label="選択中の関係">
          {selectedPair.relationship.freeTitleJa}
        </p>
      ) : null}
    </main>
  );
}
