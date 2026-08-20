import { z } from "zod";

import { MBTI_TYPES, type MbtiType } from "@/lib/eto/types";

export { MBTI_TYPES };

const mbtiValues = new Set<string>(MBTI_TYPES);
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_BIRTH_DATE = "1900-01-01";

export function todayIsoInTokyo(clock: () => Date = () => new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(clock());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const groupNameSchema = z.string().trim()
  .min(1, "グループ名を入力してください")
  .max(30, "グループ名は30文字以内で入力してください");

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = datePattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function createOnboardingSchema(clock: () => Date = () => new Date()) {
  return z
    .object({
      nickname: z.string().trim().min(1, "ニックネームを入力してください").max(20, "ニックネームは20文字以内で入力してください"),
      groupName: groupNameSchema.optional(),
      birthDate: z.string(),
      birthTimeKnown: z.boolean(),
      birthTime: z.string(),
      mbtiKnown: z.boolean(),
      mbti: z.string(),
    })
    .superRefine((value, context) => {
      const parsedDate = parseIsoDate(value.birthDate);
      if (!parsedDate) {
        context.addIssue({ code: "custom", path: ["birthDate"], message: "正しい生年月日を入力してください" });
      } else {
        const dateNumber = parsedDate.year * 10_000 + parsedDate.month * 100 + parsedDate.day;
        const isoDate = value.birthDate;
        if (isoDate < MIN_BIRTH_DATE) {
          context.addIssue({
            code: "custom",
            path: ["birthDate"],
            message: "1900年1月1日以降の生年月日を入力してください",
          });
        } else {
          const [todayYear, todayMonth, todayDay] = todayIsoInTokyo(clock).split("-").map(Number);
          const todayNumber = todayYear * 10_000 + todayMonth * 100 + todayDay;
          if (dateNumber > todayNumber) {
            context.addIssue({ code: "custom", path: ["birthDate"], message: "未来の日付は入力できません" });
          }
        }
      }
      if (value.birthTimeKnown && !timePattern.test(value.birthTime)) {
        context.addIssue({ code: "custom", path: ["birthTime"], message: "正しい出生時刻を入力してください" });
      }
      if (value.mbtiKnown && !mbtiValues.has(value.mbti)) {
        context.addIssue({ code: "custom", path: ["mbti"], message: "MBTIを選択してください" });
      }
    })
    .transform((value) => ({
      nickname: value.nickname,
      ...(value.groupName === undefined ? {} : { groupName: value.groupName }),
      birthDate: value.birthDate,
      birthTime: value.birthTimeKnown ? value.birthTime : null,
      mbti: value.mbtiKnown ? value.mbti as MbtiType : null,
    }));
}

export type OnboardingOutput = z.output<ReturnType<typeof createOnboardingSchema>>;
