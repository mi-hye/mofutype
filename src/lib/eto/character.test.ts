import { describe, expect, it } from "vitest";

import { MBTI_TYPES, ZODIAC_IDS, type MbtiType, type ZodiacId } from "./types";
import { ZODIACS } from "./zodiac";
import { createCharacterCopy, MBTI_MODIFIERS_JA } from "./character";

const EXPECTED_MODIFIERS = {
  INTJ: "戦略的な",
  INTP: "探究心あふれる",
  ENTJ: "大胆に道を切り開く",
  ENTP: "ひらめきで挑む",
  INFJ: "静かに信念を貫く",
  INFP: "やさしく理想を描く",
  ENFJ: "人を励まし導く",
  ENFP: "好奇心のまま駆け出す",
  ISTJ: "誠実に積み重ねる",
  ISFJ: "そっとみんなを支える",
  ESTJ: "頼もしく場をまとめる",
  ESFJ: "あたたかく輪をつなぐ",
  ISTP: "冷静に工夫する",
  ISFP: "自分らしい感性を大切にする",
  ESTP: "勇気いっぱいに飛び込む",
  ESFP: "明るく場を彩る",
} as const;

describe("createCharacterCopy", () => {
  it("uses every approved MBTI modifier", () => {
    expect(MBTI_MODIFIERS_JA).toEqual(EXPECTED_MODIFIERS);
    expect(Object.isFrozen(MBTI_MODIFIERS_JA)).toBe(true);
  });

  it("creates all 192 unique, deterministic and complete character copies", () => {
    const inputKeys = new Set<string>();

    for (const [index, zodiacId] of ZODIAC_IDS.entries()) {
      const zodiac = ZODIACS[index];
      for (const mbti of MBTI_TYPES) {
        inputKeys.add(`${zodiacId}:${mbti}`);
        const first = createCharacterCopy(zodiacId, mbti);
        const second = createCharacterCopy(zodiacId, mbti);

        expect(first).toEqual(second);
        expect(first.titleJa).toContain(zodiac.nameJa);
        expect(first.titleJa).toContain(EXPECTED_MODIFIERS[mbti]);
        expect(first.titleJa.trim().length).toBeGreaterThan(0);
        expect(first.descriptionJa.trim().length).toBeGreaterThan(0);
        expect(first.descriptionJa).toMatch(/[。！？]$/);
        expect(first.zodiacTraitsJa).toEqual(zodiac.keywordsJa);
        expect(first.mbtiModifierJa).toBe(EXPECTED_MODIFIERS[mbti]);
      }
    }

    expect(inputKeys).toHaveLength(192);
  });

  it.each(ZODIAC_IDS)("creates a positive zodiac-only copy for %s", (zodiacId) => {
    const zodiac = ZODIACS.find(({ id }) => id === zodiacId)!;
    const copy = createCharacterCopy(zodiacId, null);

    expect(copy.titleJa).toBe(`${zodiac.nameJa}タイプ`);
    expect(copy.mbtiModifierJa).toBeNull();
    expect(copy.descriptionJa).not.toMatch(/未回答|不明|わからない|不足|欠け|劣|弱点/);
  });

  it("returns immutable copy data without exposing mutable catalog state", () => {
    const copy = createCharacterCopy("rat", "INTJ");

    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.zodiacTraitsJa)).toBe(true);
    expect(() => (copy.zodiacTraitsJa as unknown as string[]).push("変更")).toThrow();
    expect(createCharacterCopy("rat", "INTJ").zodiacTraitsJa).toEqual(["機転", "観察", "工夫"]);
  });

  it.each([
    ["invalid-zodiac" as ZodiacId, null, "Invalid zodiac ID"],
    ["rat" as ZodiacId, "XXXX" as MbtiType, "Invalid MBTI"],
  ] as const)("rejects invalid runtime input safely", (zodiacId, mbti, message) => {
    expect(() => createCharacterCopy(zodiacId, mbti)).toThrowError(new RangeError(message));
  });
});
