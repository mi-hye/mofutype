import { describe, expect, expectTypeOf, it } from "vitest";

import { MBTI_TYPES, ZODIAC_IDS, type MbtiType, type ZodiacId } from "./types";
import { ZODIACS } from "./zodiac";
import * as characterModule from "./character";
import { createCharacterCopy, type CharacterCopy } from "./character";

type IfExactly<X, Y, Then, Else> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? Then : Else;

type ReadonlyKeys<T> = {
  [Key in keyof T]-?: IfExactly<
    Pick<T, Key>,
    { -readonly [WritableKey in Key]: T[WritableKey] },
    never,
    Key
  >;
}[keyof T];

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
  it("exports every approved MBTI modifier under the exact public name", () => {
    expectTypeOf(characterModule).toHaveProperty("MBTI_MODIFIERS");
    expectTypeOf(characterModule.MBTI_MODIFIERS).toEqualTypeOf<
      Readonly<Record<MbtiType, string>>
    >();
    expect(characterModule).toHaveProperty("MBTI_MODIFIERS");
    expect(characterModule.MBTI_MODIFIERS).toEqual(EXPECTED_MODIFIERS);
    expect(Object.isFrozen(characterModule.MBTI_MODIFIERS)).toBe(true);
  });

  it("creates all 192 unique, deterministic and complete character copies", () => {
    const inputKeys = new Set<string>();

    for (const zodiacId of ZODIAC_IDS) {
      const zodiac = ZODIACS[zodiacId];
      for (const mbti of MBTI_TYPES) {
        inputKeys.add(`${zodiacId}:${mbti}`);
        const first = createCharacterCopy(zodiacId, mbti);
        const second = createCharacterCopy(zodiacId, mbti);

        expect(first).toEqual(second);
        expect(first.titleJa).toBe(`${EXPECTED_MODIFIERS[mbti]}${zodiac.nameJa}`);
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
    const zodiac = ZODIACS[zodiacId];
    const copy = createCharacterCopy(zodiacId, null);

    expect(copy.titleJa).toBe(`${zodiac.nameJa}タイプ`);
    expect(copy.mbtiModifierJa).toBeNull();
    expect(copy.zodiacDescriptionJa.length).toBeGreaterThanOrEqual(60);
    expect(copy.descriptionJa).not.toMatch(/未回答|不明|わからない|不足|欠け|劣|弱点/);
  });

  it("returns immutable copy data without exposing mutable catalog state", () => {
    const copy = createCharacterCopy("rat", "INTJ");

    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.zodiacTraitsJa)).toBe(true);
    expect(() => (copy.zodiacTraitsJa as unknown as string[]).push("変更")).toThrow();
    expect(createCharacterCopy("rat", "INTJ").zodiacTraitsJa).toEqual(["機転", "観察", "工夫"]);
  });

  it("keeps properties writable at the type level while traits remain a readonly tuple", () => {
    expectTypeOf<ReadonlyKeys<CharacterCopy>>().toEqualTypeOf<never>();
    expectTypeOf<CharacterCopy["zodiacTraitsJa"]>().toEqualTypeOf<
      readonly [string, string, string]
    >();
  });

  it.each([
    ["invalid-zodiac" as ZodiacId, null, "Invalid zodiac ID"],
    ["rat" as ZodiacId, "XXXX" as MbtiType, "Invalid MBTI"],
  ] as const)("rejects invalid runtime input safely", (zodiacId, mbti, message) => {
    expect(() => createCharacterCopy(zodiacId, mbti)).toThrowError(new RangeError(message));
  });
});
