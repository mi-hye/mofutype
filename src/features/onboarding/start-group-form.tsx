"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { CREATE_DRAFT_KEY } from "./create-group-form";
import { emptyProfileDraft } from "./profile-form";
import { groupNameSchema } from "./schema";

interface StartGroupFormProps {
  storage?: Storage;
  navigate?: (path: string) => void;
}

export function StartGroupForm({
  storage,
  navigate = (path) => window.location.assign(path),
}: StartGroupFormProps) {
  const activeStorage = storage ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = groupNameSchema.safeParse(groupName);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "グループ名を確認してください");
      return;
    }
    try {
      activeStorage?.setItem(CREATE_DRAFT_KEY, JSON.stringify({
        groupName,
        ...emptyProfileDraft(),
      }));
      navigate("/create/profile");
    } catch {
      setError("入力内容を保存できませんでした。もう一度お試しください。");
    }
  }

  return (
    <form className="onboarding-form start-group-form" aria-label="グループ名入力フォーム"
      onSubmit={submit} noValidate>
      <div className="form-field">
        <label htmlFor="start-group-name">グループ名</label>
        <input id="start-group-name" type="text" maxLength={30} value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          aria-describedby={error ? "start-group-name-error" : undefined}
          aria-invalid={Boolean(error) || undefined} autoComplete="organization" />
        {error ? <p className="field-error" id="start-group-name-error" role="alert">{error}</p> : null}
      </div>
      <Button type="submit" size="lg">次へ</Button>
    </form>
  );
}
