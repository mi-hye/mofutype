"use client";

import { useEffect, useState } from "react";

import { INVITE_TOKEN_PATTERN } from "@/lib/invite-token";
import {
  createBrowserGroupRepository,
  type GroupAggregate,
} from "@/lib/supabase/group-repository";
import { PersonalReadingDetail } from "./personal-reading-view";
import { createRelationshipDetailLinks } from "./relationship-detail-links";

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;
type PersonalRepository = Pick<
  BrowserRepository,
  "ensureAnonymousSession" | "findJoinedGroupByInviteToken"
>;

interface PersonalRouteGateProps {
  inviteToken: string;
  repositoryFactory?: () => PersonalRepository;
}

export function PersonalRouteGate({
  inviteToken,
  repositoryFactory = createBrowserGroupRepository,
}: PersonalRouteGateProps) {
  const validInvite = INVITE_TOKEN_PATTERN.test(inviteToken);
  const [result, setResult] = useState<{ aggregate: GroupAggregate; userId: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "member" | "profile" | "error">("loading");

  useEffect(() => {
    if (!validInvite) return;
    let active = true;
    void (async () => {
      try {
        const repository = repositoryFactory();
        const userId = await repository.ensureAnonymousSession();
        const aggregate = await repository.findJoinedGroupByInviteToken(inviteToken);
        if (!active) return;
        if (!aggregate) {
          setStatus("member");
          return;
        }
        if (!aggregate.members.some((member) => member.userId === userId)) {
          setStatus("profile");
          return;
        }
        setResult({ aggregate, userId });
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => { active = false; };
  }, [inviteToken, repositoryFactory, validInvite]);

  if (!validInvite) return <main className="group-gate-message"><h1>結果ページを開けません</h1></main>;
  if (status === "loading" && !result) return <main className="group-gate-message" role="status">結果を確認しています</main>;
  if (status === "member" || status === "profile") {
    return (
      <main className="group-gate-message">
        <h1>この結果を見るにはプロフィールを登録してください</h1>
        <a href={`/g/${encodeURIComponent(inviteToken)}`}>グループに戻る</a>
      </main>
    );
  }
  if (status === "error" || !result) {
    return <main className="group-gate-message"><h1>結果を読み込めませんでした</h1><p>通信環境を確認してください。</p></main>;
  }

  const member = result.aggregate.members.find((item) => item.userId === result.userId);
  if (!member) return null;
  return (
    <PersonalReadingDetail
      member={member}
      groupName={result.aggregate.group.name}
      memberCount={result.aggregate.members.length}
      inviteToken={inviteToken}
      relationshipLinks={createRelationshipDetailLinks(
        member,
        result.aggregate.members,
        inviteToken,
      )}
    />
  );
}
