"use client";

import { useId } from "react";

import { MBTI_TYPES } from "./schema";

export interface ProfileDraft {
  nickname: string;
  birthDate: string;
  birthTimeKnown: boolean;
  birthTime: string;
  mbtiKnown: boolean;
  mbti: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;

export function emptyProfileDraft(): ProfileDraft {
  return {
    nickname: "",
    birthDate: "",
    birthTimeKnown: true,
    birthTime: "",
    mbtiKnown: true,
    mbti: "",
  };
}

interface ProfileFormProps {
  value: ProfileDraft;
  onChange(value: ProfileDraft): void;
  errors: ProfileErrors;
  disabled?: boolean;
}

export function ProfileForm({ value, onChange, errors, disabled = false }: ProfileFormProps) {
  const prefix = useId();
  const update = <K extends keyof ProfileDraft>(key: K, next: ProfileDraft[K]) =>
    onChange({ ...value, [key]: next });
  const field = (name: keyof ProfileDraft, label: string, control: React.ReactNode) => {
    const error = errors[name];
    return (
      <div className="form-field">
        <label htmlFor={`${prefix}-${name}`}>{label}</label>
        {control}
        {error ? <p className="field-error" id={`${prefix}-${name}-error`} role="alert">{error}</p> : null}
      </div>
    );
  };
  const describedBy = (name: keyof ProfileDraft) =>
    errors[name] ? `${prefix}-${name}-error` : undefined;

  return (
    <div className="profile-fields">
      {field("nickname", "ニックネーム", (
        <input id={`${prefix}-nickname`} type="text" value={value.nickname} maxLength={20}
          onChange={(event) => update("nickname", event.target.value)} disabled={disabled}
          aria-describedby={describedBy("nickname")} aria-invalid={Boolean(errors.nickname) || undefined} />
      ))}
      {field("birthDate", "生年月日", (
        <input id={`${prefix}-birthDate`} type="date" required value={value.birthDate}
          onChange={(event) => update("birthDate", event.target.value)} disabled={disabled}
          aria-describedby={describedBy("birthDate")} aria-invalid={Boolean(errors.birthDate) || undefined} />
      ))}
      {field("birthTime", "出生時刻", (
        <input id={`${prefix}-birthTime`} type="time" value={value.birthTime}
          onChange={(event) => update("birthTime", event.target.value)}
          disabled={disabled || !value.birthTimeKnown} aria-describedby={describedBy("birthTime")}
          aria-invalid={Boolean(errors.birthTime) || undefined} />
      ))}
      <label className="unknown-toggle">
        <input type="checkbox" checked={!value.birthTimeKnown} disabled={disabled}
          onChange={(event) => onChange({ ...value, birthTimeKnown: !event.target.checked, birthTime: "" })} />
        出生時刻はわからない
      </label>
      {field("mbti", "MBTI", (
        <select id={`${prefix}-mbti`} value={value.mbti}
          onChange={(event) => update("mbti", event.target.value)}
          disabled={disabled || !value.mbtiKnown} aria-describedby={describedBy("mbti")}
          aria-invalid={Boolean(errors.mbti) || undefined}>
          <option value="">選択してください</option>
          {MBTI_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
        </select>
      ))}
      <label className="unknown-toggle">
        <input type="checkbox" checked={!value.mbtiKnown} disabled={disabled}
          onChange={(event) => onChange({ ...value, mbtiKnown: !event.target.checked, mbti: "" })} />
        MBTIはわからない
      </label>
    </div>
  );
}
