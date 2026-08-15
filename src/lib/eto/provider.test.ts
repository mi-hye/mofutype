import { beforeEach, describe, expect, it, vi } from "vitest";

const parseEtoInputCall = vi.hoisted(() => vi.fn());

vi.mock("./validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./validation")>();
  return {
    ...actual,
    parseEtoInput: (...args: Parameters<typeof actual.parseEtoInput>) => {
      parseEtoInputCall();
      return actual.parseEtoInput(...args);
    },
  };
});

import type { FourPillarsFacts } from "./four-pillars";
import { deriveEtoProfile, localEtoProvider } from "./provider";
import { EtoValidationError } from "./validation";

const TODAY_ISO = "2026-08-15";

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (value === null || typeof value !== "object") return keys;

  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectKeys(nested, keys);
  }
  return keys;
}

describe("localEtoProvider", () => {
  beforeEach(() => {
    parseEtoInputCall.mockClear();
  });

  it("returns exactly the privacy-safe profile contract", async () => {
    const profile = await localEtoProvider.derive(
      { birthDate: "2024-02-04", birthTime: "17:27", mbti: "INFP" },
      TODAY_ISO,
    );

    expect(profile).toEqual({
      version: 1,
      zodiacId: "dragon",
      mbti: "INFP",
      dayMaster: { element: "EARTH", polarity: "YANG" },
      fiveElements: { WOOD: 2, FIRE: 0, EARTH: 3, METAL: 2, WATER: 1 },
      yinYang: { YIN: 6, YANG: 2 },
      calculationMode: "date-time",
      boundaryState: "exact",
      engineVersion: "mofu-eto-four-pillars-v1",
    });
    expect(Object.keys(profile)).toEqual([
      "version",
      "zodiacId",
      "mbti",
      "dayMaster",
      "fiveElements",
      "yinYang",
      "calculationMode",
      "boundaryState",
      "engineVersion",
    ]);

    const forbidden = ["birth", "date", "time", "pillar", "stem", "branch"];
    for (const key of collectKeys(profile)) {
      expect(forbidden.some((word) => key.toLowerCase().includes(word))).toBe(
        false,
      );
    }
  });

  it("uses the Gregorian Jan-1 zodiac boundary independently of 立春", async () => {
    const profile = await localEtoProvider.derive(
      { birthDate: "2024-01-01", birthTime: "00:00", mbti: null },
      TODAY_ISO,
    );

    expect(profile.zodiacId).toBe("dragon");
  });

  it("validates exactly once before composing a profile", async () => {
    await localEtoProvider.derive(
      { birthDate: "2024-02-29", birthTime: null, mbti: "ENTJ" },
      TODAY_ISO,
    );

    expect(parseEtoInputCall).toHaveBeenCalledTimes(1);
  });

  it("composes a cloned persisted profile directly from validated facts", () => {
    const facts: FourPillarsFacts = {
      birthYear: 2024,
      mbti: "ENTJ",
      dayMaster: { element: "WATER", polarity: "YIN" },
      fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 0, WATER: 2 },
      yinYang: { YIN: 2, YANG: 4 },
      calculationMode: "date-only",
      boundaryState: "exact",
    };

    const profile = deriveEtoProfile(facts);

    expect(profile).toEqual({
      version: 1,
      zodiacId: "dragon",
      mbti: "ENTJ",
      dayMaster: { element: "WATER", polarity: "YIN" },
      fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 0, WATER: 2 },
      yinYang: { YIN: 2, YANG: 4 },
      calculationMode: "date-only",
      boundaryState: "exact",
      engineVersion: "mofu-eto-four-pillars-v1",
    });
    expect(profile.dayMaster).not.toBe(facts.dayMaster);
    expect(profile.fiveElements).not.toBe(facts.fiveElements);
    expect(profile.yinYang).not.toBe(facts.yinYang);
    expect(parseEtoInputCall).not.toHaveBeenCalled();
    expect(collectKeys(profile)).not.toContain("birthYear");
  });

  it("is deterministic and does not mutate the input", async () => {
    const input = {
      birthDate: "2000-02-29",
      birthTime: null,
      mbti: "ENTJ" as const,
    };
    const snapshot = structuredClone(input);

    const first = await localEtoProvider.derive(input, TODAY_ISO);
    const second = await localEtoProvider.derive(input, TODAY_ISO);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.dayMaster).not.toBe(first.dayMaster);
    expect(second.fiveElements).not.toBe(first.fiveElements);
    expect(second.yinYang).not.toBe(first.yinYang);
    expect(input).toEqual(snapshot);
  });

  it("preserves typed privacy-safe validation errors", async () => {
    const rawBirthDate = "secret-invalid-birth-date";

    try {
      await localEtoProvider.derive(
        { birthDate: rawBirthDate, birthTime: null, mbti: null },
        TODAY_ISO,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(EtoValidationError);
      expect((error as EtoValidationError).code).toBe("INVALID_BIRTH_DATE");
      expect((error as Error).message).not.toContain(rawBirthDate);
      return;
    }

    throw new Error("Expected invalid input to be rejected");
  });
});
