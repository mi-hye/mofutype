"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { localEtoProvider } from "@/lib/eto/provider";
import type { EtoProvider } from "@/lib/eto/types";
import { createBrowserGroupRepository } from "@/lib/supabase/group-repository";
import { ProfileForm, emptyProfileDraft, type ProfileDraft, type ProfileErrors } from "./profile-form";
import { createOnboardingSchema, todayIsoInTokyo } from "./schema";

export const CREATE_DRAFT_KEY = "mofutype:create-group:draft";
export const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;
type Draft = ProfileDraft & { groupName: string };

function emptyDraft(): Draft {
  return { groupName: "", ...emptyProfileDraft() };
}

function publicCreateError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "AUTH_FAILED") return "接続を準備できませんでした。しばらくしてから、もう一度お試しください。";
  if (code === "MISSING_SUPABASE_CONFIG") return "現在グループ作成を利用できません。設定を確認してください。";
  return "グループを作成できませんでした。通信環境を確認して、もう一度お試しください。";
}

export interface CreateGroupFormProps {
  repositoryFactory?: () => Pick<BrowserRepository, "createGroup">;
  etoProvider?: EtoProvider;
  navigate?: (path: string) => void;
  storage?: Storage;
  clock?: () => Date;
}

export function CreateGroupForm({
  repositoryFactory = createBrowserGroupRepository,
  etoProvider = localEtoProvider,
  navigate = (path) => window.location.assign(path),
  storage,
  clock = () => new Date(),
}: CreateGroupFormProps) {
  const activeStorage = storage ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
  const maxBirthDate = todayIsoInTokyo(clock);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    try {
      activeStorage?.removeItem(CREATE_DRAFT_KEY);
    } catch {
      // Removing obsolete privacy-sensitive drafts is best-effort.
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [activeStorage]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setFailure("");
    const result = createOnboardingSchema(clock).safeParse(draft);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const name = String(issue.path[0] ?? "form");
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
    let inviteToken = "";
    try {
      const response = await repositoryFactory().createGroup({
        name: result.data.groupName!,
        nickname: result.data.nickname,
        profile,
      });
      if (!isCurrent()) return;
      if (!INVITE_TOKEN_PATTERN.test(response.inviteToken)) throw new Error("invalid invite token");
      inviteToken = response.inviteToken;
    } catch (error) {
      if (!isCurrent()) return;
      setFailure(publicCreateError(error));
      setLoading(false);
      return;
    }
    if (!isCurrent()) return;
    flushSync(() => setDraft(emptyDraft()));
    try {
      navigate(`/g/${inviteToken}`);
    } catch {
      if (isCurrent()) {
        setFailure("作成したグループを開けませんでした。もう一度リンクを開いてください。");
      }
    }
    if (isCurrent()) setLoading(false);
  }

  return (
    <form className="onboarding-form" aria-label="グループ作成フォーム" onSubmit={submit} noValidate>
      <div className="form-field">
        <label htmlFor="create-group-name">グループ名</label>
        <input id="create-group-name" type="text" maxLength={30} value={draft.groupName}
          onChange={(event) => setDraft({ ...draft, groupName: event.target.value })}
          disabled={loading} aria-describedby={errors.groupName ? "create-group-name-error" : undefined}
          aria-invalid={Boolean(errors.groupName) || undefined} />
        {errors.groupName ? <p className="field-error" id="create-group-name-error" role="alert">{errors.groupName}</p> : null}
      </div>
      <ProfileForm value={draft} onChange={(profile) => setDraft({ ...draft, ...profile })}
        errors={errors as ProfileErrors} maxBirthDate={maxBirthDate} disabled={loading} />
      {failure ? <p className="form-error" role="alert">{failure}</p> : null}
      <Button type="submit" size="lg" loading={loading}>グループを作成</Button>
    </form>
  );
}
