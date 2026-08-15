"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { localAstrologyProvider } from "@/lib/astrology/local-provider";
import type { AstrologyProvider } from "@/lib/astrology/types";
import { createBrowserGroupRepository } from "@/lib/supabase/group-repository";
import { ProfileForm, emptyProfileDraft, type ProfileDraft, type ProfileErrors } from "./profile-form";
import { createOnboardingSchema } from "./schema";

export const CREATE_DRAFT_KEY = "mofutype:create-group:draft";
export const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type BrowserRepository = ReturnType<typeof createBrowserGroupRepository>;
type Draft = ProfileDraft & { groupName: string };

function emptyDraft(): Draft {
  return { groupName: "", ...emptyProfileDraft() };
}

function readDraft(storage?: Storage): Draft {
  try {
    if (!storage) return emptyDraft();
    const value = JSON.parse(storage.getItem(CREATE_DRAFT_KEY) ?? "null") as Partial<Draft> | null;
    if (!value || typeof value !== "object") return emptyDraft();
    const initial = emptyDraft();
    for (const key of Object.keys(initial) as (keyof Draft)[]) {
      if (typeof value[key] !== typeof initial[key]) return initial;
    }
    return value as Draft;
  } catch {
    return emptyDraft();
  }
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
  astrologyProvider?: AstrologyProvider;
  navigate?: (path: string) => void;
  storage?: Storage;
  clock?: () => Date;
}

export function CreateGroupForm({
  repositoryFactory = createBrowserGroupRepository,
  astrologyProvider = localAstrologyProvider,
  navigate = (path) => window.location.assign(path),
  storage,
  clock = () => new Date(),
}: CreateGroupFormProps) {
  const activeStorage = storage ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
  const [draft, setDraft] = useState<Draft>(() => readDraft(activeStorage));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

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
      profile = await astrologyProvider.derive({
        birthDate: result.data.birthDate,
        birthTime: result.data.birthTime,
        mbti: result.data.mbti,
      });
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
      try { activeStorage?.setItem(CREATE_DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage may be unavailable */ }
      setFailure(publicCreateError(error));
      setLoading(false);
      return;
    }
    try {
      activeStorage?.removeItem(CREATE_DRAFT_KEY);
    } catch {
      // Browser storage cleanup is best-effort after a successful mutation.
    }
    if (!isCurrent()) return;
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
        errors={errors as ProfileErrors} disabled={loading} />
      {failure ? <p className="form-error" role="alert">{failure}</p> : null}
      <Button type="submit" size="lg" loading={loading}>グループを作成</Button>
    </form>
  );
}
