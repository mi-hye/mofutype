import { describe, expect, it } from "vitest";

import { ANIMAL_ORDER, ANIMALS } from "./animals";
import {
  AstrologyValidationError,
  localAstrologyProvider,
} from "./local-provider";

describe("localAstrologyProvider", () => {
  it("returns equal profiles for the same input", async () => {
    const input = {
      birthDate: "1992-08-15",
      birthTime: "13:45",
      mbti: "INFP" as const,
    };

    const [first, second] = await Promise.all([
      localAstrologyProvider.derive(input),
      localAstrologyProvider.derive(input),
    ]);

    expect(first).toEqual(second);
  });

  it("uses the explicit date-only mode when birth time is unknown", async () => {
    const profile = await localAstrologyProvider.derive({
      birthDate: "1992-08-15",
      birthTime: null,
      mbti: null,
    });

    expect(profile.calculationMode).toBe("date-only");
  });

  it("returns one of the twelve supported animals", async () => {
    const profile = await localAstrologyProvider.derive({
      birthDate: "2001-01-01",
      birthTime: null,
      mbti: null,
    });

    expect(ANIMAL_ORDER).toContain(profile.animalId);
    expect(ANIMAL_ORDER).toHaveLength(12);
  });

  it("uses date-time mode for a known valid time", async () => {
    const profile = await localAstrologyProvider.derive({
      birthDate: "2001-01-01",
      birthTime: "00:00",
      mbti: "ENTJ",
    });

    expect(profile).toMatchObject({
      version: 1,
      calculationMode: "date-time",
      mbti: "ENTJ",
    });
  });

  it("never includes raw birth fields in the derived profile", async () => {
    const profile = await localAstrologyProvider.derive({
      birthDate: "2001-01-01",
      birthTime: "12:34",
      mbti: null,
    });

    expect(profile).not.toHaveProperty("birthDate");
    expect(profile).not.toHaveProperty("birthTime");
  });

  it("rejects a date that does not use YYYY-MM-DD", async () => {
    await expect(
      localAstrologyProvider.derive({
        birthDate: "2001-1-01",
        birthTime: null,
        mbti: null,
      }),
    ).rejects.toEqual(
      new AstrologyValidationError("INVALID_BIRTH_DATE", "Invalid birth date"),
    );
  });

  it("rejects an impossible calendar date", async () => {
    await expect(
      localAstrologyProvider.derive({
        birthDate: "2024-02-30",
        birthTime: null,
        mbti: null,
      }),
    ).rejects.toEqual(
      new AstrologyValidationError("INVALID_BIRTH_DATE", "Invalid birth date"),
    );
  });

  it("rejects an invalid 24-hour time", async () => {
    await expect(
      localAstrologyProvider.derive({
        birthDate: "2024-02-29",
        birthTime: "24:00",
        mbti: null,
      }),
    ).rejects.toEqual(
      new AstrologyValidationError("INVALID_BIRTH_TIME", "Invalid birth time"),
    );
  });

  it("maps the Unix epoch deterministically through the stable order", async () => {
    await expect(
      localAstrologyProvider.derive({
        birthDate: "1970-01-01",
        birthTime: "00:00",
        mbti: null,
      }),
    ).resolves.toMatchObject({ animalId: "fawn", animalGroup: "MOON" });

    await expect(
      localAstrologyProvider.derive({
        birthDate: "1970-01-01",
        birthTime: "00:01",
        mbti: null,
      }),
    ).resolves.toMatchObject({ animalId: "raccoon", animalGroup: "MOON" });
  });
});

describe("ANIMALS", () => {
  it("has the exact names, groups, and derived asset paths", () => {
    expect(ANIMALS).toEqual({
      fawn: { nameJa: "こじか", asset: "/animals/fawn.svg", group: "MOON" },
      raccoon: { nameJa: "たぬき", asset: "/animals/raccoon.svg", group: "MOON" },
      "black-panther": { nameJa: "黒ひょう", asset: "/animals/black-panther.svg", group: "MOON" },
      sheep: { nameJa: "ひつじ", asset: "/animals/sheep.svg", group: "MOON" },
      wolf: { nameJa: "狼", asset: "/animals/wolf.svg", group: "EARTH" },
      monkey: { nameJa: "猿", asset: "/animals/monkey.svg", group: "EARTH" },
      tiger: { nameJa: "虎", asset: "/animals/tiger.svg", group: "EARTH" },
      koala: { nameJa: "コアラ", asset: "/animals/koala.svg", group: "EARTH" },
      cheetah: { nameJa: "チータ", asset: "/animals/cheetah.svg", group: "SUN" },
      lion: { nameJa: "ライオン", asset: "/animals/lion.svg", group: "SUN" },
      elephant: { nameJa: "ゾウ", asset: "/animals/elephant.svg", group: "SUN" },
      pegasus: { nameJa: "ペガサス", asset: "/animals/pegasus.svg", group: "SUN" },
    });
  });

  it("keeps catalog keys aligned with the stable calculation order", () => {
    expect(Object.keys(ANIMALS)).toEqual(ANIMAL_ORDER);
  });
});
