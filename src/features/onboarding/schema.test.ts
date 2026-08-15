import { describe, expect, it } from "vitest";

import { MBTI_TYPES, createOnboardingSchema } from "./schema";

const clock = () => new Date("2026-08-15T12:00:00+09:00");
const schema = createOnboardingSchema(clock);

const valid = {
  nickname: "  もふ  ",
  groupName: "  なかまたち  ",
  birthDate: "2000-02-29",
  birthTimeKnown: true,
  birthTime: "09:05",
  mbtiKnown: true,
  mbti: "ENFP",
};

describe("createOnboardingSchema", () => {
  it("trims names and returns only normalized safe values", () => {
    expect(schema.parse(valid)).toEqual({
      nickname: "もふ",
      groupName: "なかまたち",
      birthDate: "2000-02-29",
      birthTime: "09:05",
      mbti: "ENFP",
    });
  });

  it("normalizes unknown time and MBTI to null", () => {
    expect(
      schema.parse({
        ...valid,
        birthTimeKnown: false,
        birthTime: "23:59",
        mbtiKnown: false,
        mbti: "ISTJ",
      }),
    ).toMatchObject({ birthTime: null, mbti: null });
  });

  it.each([
    ["", "ニックネームを入力してください"],
    ["あ".repeat(21), "ニックネームは20文字以内で入力してください"],
  ])("validates nickname length", (nickname, message) => {
    expect(schema.safeParse({ ...valid, nickname }).error?.issues[0]?.message).toBe(
      message,
    );
  });

  it.each([
    ["", "グループ名を入力してください"],
    ["あ".repeat(31), "グループ名は30文字以内で入力してください"],
  ])("validates group name length", (groupName, message) => {
    expect(schema.safeParse({ ...valid, groupName }).error?.issues[0]?.message).toBe(
      message,
    );
  });

  it.each(["2025-02-29", "2026-13-01", "not-a-date"])(
    "rejects impossible ISO date %s",
    (birthDate) => {
      const result = schema.safeParse({ ...valid, birthDate });
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({
          path: ["birthDate"],
          message: "正しい生年月日を入力してください",
        }),
      );
    },
  );

  it("rejects a future local calendar date", () => {
    const result = schema.safeParse({ ...valid, birthDate: "2026-08-16" });
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ message: "未来の日付は入力できません" }),
    );
  });

  it("requires a valid time only when time is known", () => {
    for (const birthTime of ["", "24:00", "9:30"]) {
      const result = schema.safeParse({ ...valid, birthTime });
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({
          path: ["birthTime"],
          message: "正しい出生時刻を入力してください",
        }),
      );
    }
  });

  it("requires one of the 16 MBTI values only when known", () => {
    expect(MBTI_TYPES).toHaveLength(16);
    for (const mbti of ["", "ABCD"]) {
      const result = schema.safeParse({ ...valid, mbti });
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({
          path: ["mbti"],
          message: "MBTIを選択してください",
        }),
      );
    }
  });
});
