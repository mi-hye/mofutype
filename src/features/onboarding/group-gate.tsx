"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { GroupScreen } from "@/features/group-graph/group-screen";
import { INVITE_TOKEN_PATTERN } from "@/lib/invite-token";
import { SupabaseConfigurationError } from "@/lib/supabase/browser";
import { createBrowserGroupRepository, type GroupAggregate, type GroupInvitePreview } from "@/lib/supabase/group-repository";
import { JoinGroupForm } from "./join-group-form";

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;

function canHashInviteToken() {
  return typeof globalThis.crypto?.subtle?.digest === "function";
}

interface GroupGateProps {
  inviteToken: string;
  repositoryFactory?: () => BrowserRepository;
  initialAggregate?: GroupAggregate;
  currentUserId?: string;
}

export function GroupGate(props: GroupGateProps) {
  return <GroupGateForInvite key={props.inviteToken} {...props} />;
}

function GroupGateForInvite({
  inviteToken,
  repositoryFactory = createBrowserGroupRepository,
  initialAggregate,
  currentUserId,
}: GroupGateProps) {
  const validToken = INVITE_TOKEN_PATTERN.test(inviteToken);
  const [aggregate, setAggregate] = useState<GroupAggregate | null>(initialAggregate ?? null);
  const [repository, setRepository] = useState<BrowserRepository | null>(null);
  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
  const [status, setStatus] = useState<"loading" | "join" | "missing" | "full" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!validToken) return;
    let current = true;
    (async () => {
      try {
        const activeRepository = repositoryFactory();
        setRepository(activeRepository);
        const foundPreview = await activeRepository.previewGroupInvite(inviteToken);
        if (!current) return;
        if (!foundPreview) {
          setStatus("missing");
          return;
        }
        const match = canHashInviteToken()
          ? await activeRepository.findJoinedGroupByInviteToken(inviteToken)
          : null;
        if (!current) return;
        if (match) {
          setAggregate(match);
        } else {
          setPreview(foundPreview);
          setStatus(
            foundPreview.memberCount >= foundPreview.maxMembers ? "full" : "join",
          );
        }
      } catch (error) {
        if (current) {
          const code = typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "";
          setErrorMessage(
            error instanceof SupabaseConfigurationError || code === "MISSING_SUPABASE_CONFIG"
              ? "現在グループ参加を利用できません。設定を確認してください。"
              : "グループを読み込めませんでした。通信環境を確認してください。",
          );
          setStatus("error");
        }
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
  if (aggregate) {
    return (
      <GroupScreen
        initialAggregate={aggregate}
        repository={repository ?? undefined}
        inviteToken={inviteToken}
        currentUserId={currentUserId}
      />
    );
  }
  if (status === "loading") return <main className="group-gate-message" role="status">参加状況を確認しています</main>;
  if (status === "missing") {
    return <main className="group-gate-message"><h1>招待リンクが無効か、削除されています</h1></main>;
  }
  if (status === "full" && preview) {
    return (
      <main className="group-gate-message">
        <h1>このグループは定員に達しています</h1>
        <p>{preview.name}</p>
      </main>
    );
  }
  if (status === "error") {
    return (
      <main className="group-gate-message">
        <p role="alert">{errorMessage}</p>
        <Button type="button" onClick={() => {
          setStatus("loading");
          setAttempt((value) => value + 1);
        }}>もう一度試す</Button>
      </main>
    );
  }
  return (
    <main className="group-gate-shell">
      <JoinGroupForm inviteToken={inviteToken} repositoryFactory={() => repository ?? repositoryFactory()}
        preview={preview ?? undefined} onJoined={(joined) => setAggregate(joined)} />
    </main>
  );
}
