"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { localAstrologyProvider } from "@/lib/astrology/local-provider";
import type { AstrologyProvider } from "@/lib/astrology/types";
import { createBrowserGroupRepository, type GroupAggregate } from "@/lib/supabase/group-repository";
import { ProfileForm, emptyProfileDraft, type ProfileDraft, type ProfileErrors } from "./profile-form";
import { createOnboardingSchema } from "./schema";

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;

export function joinDraftKey(inviteToken: string) {
  return `mofutype:join-group:${inviteToken}:draft`;
}

function readDraft(storage: Storage | undefined, key: string): ProfileDraft {
  try {
    if (!storage) return emptyProfileDraft();
    const value = JSON.parse(storage.getItem(key) ?? "null") as Partial<ProfileDraft> | null;
    if (!value || typeof value !== "object") return emptyProfileDraft();
    const initial = emptyProfileDraft();
    for (const name of Object.keys(initial) as (keyof ProfileDraft)[]) {
      if (typeof value[name] !== typeof initial[name]) return initial;
    }
    return value as ProfileDraft;
  } catch {
    return emptyProfileDraft();
  }
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
  if (/full|capacity|max.?members|定員/.test(fingerprint)) return "このグループは定員に達しています。";
  if (/invalid|deleted|not.?found|invite|招待/.test(fingerprint)) return "招待リンクが無効か、削除されています。";
  if (/auth/.test(fingerprint)) return "接続を準備できませんでした。しばらくしてから、もう一度お試しください。";
  if (/missing_supabase_config/.test(fingerprint)) return "現在グループ参加を利用できません。設定を確認してください。";
  return "グループに参加できませんでした。通信環境を確認して、もう一度お試しください。";
}

export interface JoinGroupFormProps {
  inviteToken: string;
  onJoined(aggregate: GroupAggregate): void;
  repositoryFactory?: () => Pick<BrowserRepository, "joinGroup" | "loadGroup">;
  astrologyProvider?: AstrologyProvider;
  storage?: Storage;
  clock?: () => Date;
}

export function JoinGroupForm({
  inviteToken,
  onJoined,
  repositoryFactory = createBrowserGroupRepository,
  astrologyProvider = localAstrologyProvider,
  storage,
  clock = () => new Date(),
}: JoinGroupFormProps) {
  const key = joinDraftKey(inviteToken);
  const activeStorage = storage ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
  const [draft, setDraft] = useState(() => readDraft(activeStorage, key));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(false);

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
    let profile;
    try {
      profile = await astrologyProvider.derive({
        birthDate: result.data.birthDate,
        birthTime: result.data.birthTime,
        mbti: result.data.mbti,
      });
    } catch {
      setFailure("プロフィールを作成できませんでした。入力内容を確認してください。");
      setLoading(false);
      return;
    }
    let aggregate: GroupAggregate;
    try {
      const repository = repositoryFactory();
      const membership = await repository.joinGroup({
        inviteToken,
        nickname: result.data.nickname,
        profile,
      });
      aggregate = await repository.loadGroup(membership.groupId);
    } catch (error) {
      try { activeStorage?.setItem(key, JSON.stringify(draft)); } catch { /* storage may be unavailable */ }
      setFailure(publicJoinError(error));
      setLoading(false);
      return;
    }
    try {
      activeStorage?.removeItem(key);
    } catch {
      // Browser storage cleanup is best-effort after a successful mutation.
    }
    try {
      onJoined(aggregate);
    } catch {
      setFailure("参加したグループを表示できませんでした。ページを再読み込みしてください。");
    }
    setLoading(false);
  }

  return (
    <section className="join-panel" aria-labelledby="join-title">
      <h1 id="join-title">グループに招待されています</h1>
      <p>プロフィールを入力して、グループに参加しましょう。</p>
      <form className="onboarding-form" aria-label="グループ参加フォーム" onSubmit={submit} noValidate>
        <ProfileForm value={draft} onChange={setDraft} errors={errors} disabled={loading} />
        {failure ? <p className="form-error" role="alert">{failure}</p> : null}
        <Button type="submit" size="lg" loading={loading}>グループに参加</Button>
      </form>
    </section>
  );
}
