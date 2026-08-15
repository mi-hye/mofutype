"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { localEtoProvider } from "@/lib/eto/provider";
import type { EtoProvider } from "@/lib/eto/types";
import { SupabaseConfigurationError } from "@/lib/supabase/browser";
import { createBrowserGroupRepository, type GroupAggregate, type GroupInvitePreview } from "@/lib/supabase/group-repository";
import { ProfileForm, emptyProfileDraft, type ProfileDraft, type ProfileErrors } from "./profile-form";
import { createOnboardingSchema, todayIsoInTokyo } from "./schema";

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;

export function joinDraftKey(inviteToken: string) {
  return `mofutype:join-group:${inviteToken}:draft`;
}

function errorFingerprint(error: unknown): string {
  const parts: string[] = [];
  let value = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof value !== "object" || value === null) break;
    const row = value as Record<string, unknown>;
    for (const name of ["code", "message", "details", "hint"]) {
      if (typeof row[name] === "string") parts.push(row[name]);
    }
    value = row.cause;
  }
  return parts.join(" ").toLowerCase();
}

function publicJoinError(error: unknown): string {
  const fingerprint = errorFingerprint(error);
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (error instanceof SupabaseConfigurationError || code === "MISSING_SUPABASE_CONFIG") {
    return "現在グループ参加を利用できません。設定を確認してください。";
  }
  if (code === "AUTH_FAILED" || fingerprint.includes("unauthenticated")) {
    return "接続を準備できませんでした。しばらくしてから、もう一度お試しください。";
  }
  if (fingerprint.includes("group_full")) return "このグループは定員に達しています。";
  if (fingerprint.includes("invalid_invite")) return "招待リンクが無効か、削除されています。";
  if (/full|capacity|max.?members|定員/.test(fingerprint)) return "このグループは定員に達しています。";
  if (/invalid|deleted|not.?found|invite|招待/.test(fingerprint)) return "招待リンクが無効か、削除されています。";
  if (/auth/.test(fingerprint)) return "接続を準備できませんでした。しばらくしてから、もう一度お試しください。";
  return "グループに参加できませんでした。通信環境を確認して、もう一度お試しください。";
}

export interface JoinGroupFormProps {
  inviteToken: string;
  onJoined(aggregate: GroupAggregate): void;
  preview?: GroupInvitePreview;
  repositoryFactory?: () => Pick<BrowserRepository, "joinGroup" | "loadGroup">;
  etoProvider?: EtoProvider;
  storage?: Storage;
  clock?: () => Date;
}

export function JoinGroupForm(props: JoinGroupFormProps) {
  return <JoinGroupFormForInvite key={props.inviteToken} {...props} />;
}

function JoinGroupFormForInvite({
  inviteToken,
  onJoined,
  preview,
  repositoryFactory = createBrowserGroupRepository,
  etoProvider = localEtoProvider,
  storage,
  clock = () => new Date(),
}: JoinGroupFormProps) {
  const key = joinDraftKey(inviteToken);
  const activeStorage = storage ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
  const maxBirthDate = todayIsoInTokyo(clock);
  const [draft, setDraft] = useState(emptyProfileDraft);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    try {
      activeStorage?.removeItem(key);
    } catch {
      // Removing obsolete privacy-sensitive drafts is best-effort.
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [activeStorage, key]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setFailure("");
    const result = createOnboardingSchema(clock).safeParse(draft);
    if (!result.success) {
      const next: ProfileErrors = {};
      for (const issue of result.error.issues) {
        const name = issue.path[0] as keyof ProfileDraft;
        next[name] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    const submission = ++generation.current;
    const isCurrent = () => mounted.current && generation.current === submission;
    let profile;
    try {
      profile = await etoProvider.derive({
        birthDate: result.data.birthDate,
        birthTime: result.data.birthTime,
        mbti: result.data.mbti,
      }, maxBirthDate);
    } catch {
      if (!isCurrent()) return;
      setFailure("プロフィールを作成できませんでした。入力内容を確認してください。");
      setLoading(false);
      return;
    }
    if (!isCurrent()) return;
    let aggregate: GroupAggregate;
    try {
      const repository = repositoryFactory();
      const membership = await repository.joinGroup({
        inviteToken,
        nickname: result.data.nickname,
        profile,
      });
      if (!isCurrent()) return;
      aggregate = await repository.loadGroup(membership.groupId);
      if (!isCurrent()) return;
    } catch (error) {
      if (!isCurrent()) return;
      setFailure(publicJoinError(error));
      setLoading(false);
      return;
    }
    if (!isCurrent()) return;
    flushSync(() => setDraft(emptyProfileDraft()));
    try {
      onJoined(aggregate);
    } catch {
      if (isCurrent()) {
        setFailure("参加したグループを表示できませんでした。ページを再読み込みしてください。");
      }
    }
    if (isCurrent()) setLoading(false);
  }

  return (
    <section className="join-panel" aria-labelledby="join-title">
      <h1 id="join-title">グループに招待されています</h1>
      {preview ? (
        <div className="invite-preview" aria-label="招待されたグループ">
          <strong>{preview.name}</strong>
          <span>メンバー {preview.memberCount} / {preview.maxMembers}人</span>
        </div>
      ) : null}
      <p>プロフィールを入力して、グループに参加しましょう。</p>
      <form className="onboarding-form" aria-label="グループ参加フォーム" onSubmit={submit} noValidate>
        <ProfileForm value={draft} onChange={setDraft} errors={errors}
          maxBirthDate={maxBirthDate} disabled={loading} />
        {failure ? <p className="form-error" role="alert">{failure}</p> : null}
        <Button type="submit" size="lg" loading={loading}>グループに参加</Button>
      </form>
    </section>
  );
}
