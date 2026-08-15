"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createBrowserGroupRepository, type GroupAggregate } from "@/lib/supabase/group-repository";
import { INVITE_TOKEN_PATTERN } from "./create-group-form";
import { JoinGroupForm } from "./join-group-form";

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;

interface GroupGateProps {
  inviteToken: string;
  repositoryFactory?: () => BrowserRepository;
}

function MemberGraphPlaceholder({ aggregate }: { aggregate: GroupAggregate }) {
  return (
    <main className="group-member-shell">
      <header>
        <p className="hero__eyebrow">MofuType グループ</p>
        <h1>{aggregate.group.name}</h1>
        <p>メンバー {aggregate.members.length}人</p>
      </header>
      <section className="graph-placeholder" aria-label="関係性グラフ準備中"
        data-testid="relationship-graph-placeholder" data-task8-seam="relationship-graph">
        <h2>関係性グラフ</h2>
        <p>グループの関係性を表示する準備をしています。</p>
      </section>
    </main>
  );
}

export function GroupGate(props: GroupGateProps) {
  return <GroupGateForInvite key={props.inviteToken} {...props} />;
}

function GroupGateForInvite({ inviteToken, repositoryFactory = createBrowserGroupRepository }: GroupGateProps) {
  const validToken = INVITE_TOKEN_PATTERN.test(inviteToken);
  const [aggregate, setAggregate] = useState<GroupAggregate | null>(null);
  const [status, setStatus] = useState<"loading" | "join" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!validToken) return;
    let current = true;
    (async () => {
      try {
        const match = await repositoryFactory().findJoinedGroupByInviteToken(inviteToken);
        if (!current) return;
        if (match) {
          setAggregate(match);
        } else {
          setStatus("join");
        }
      } catch {
        if (current) setStatus("error");
      }
    })();
    return () => { current = false; };
  }, [attempt, inviteToken, repositoryFactory, validToken]);

  if (!validToken) {
    return (
      <main className="group-gate-message">
        <h1>招待リンクが無効です</h1>
        <p>リンクを確認するか、招待した人に新しいリンクを確認してください。</p>
      </main>
    );
  }
  if (aggregate) return <MemberGraphPlaceholder aggregate={aggregate} />;
  if (status === "loading") return <main className="group-gate-message" role="status">参加状況を確認しています</main>;
  if (status === "error") {
    return (
      <main className="group-gate-message">
        <p role="alert">グループを読み込めませんでした。通信環境を確認してください。</p>
        <Button type="button" onClick={() => {
          setStatus("loading");
          setAttempt((value) => value + 1);
        }}>もう一度試す</Button>
      </main>
    );
  }
  return (
    <main className="group-gate-shell">
      <JoinGroupForm inviteToken={inviteToken} repositoryFactory={repositoryFactory}
        onJoined={(joined) => setAggregate(joined)} />
    </main>
  );
}
