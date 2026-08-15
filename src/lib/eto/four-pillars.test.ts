import { afterEach, describe, expect, it } from "vitest";

import { calculateFourPillarsFacts } from "./four-pillars";

const TODAY_ISO = "2026-08-15";
const ORIGINAL_TZ = process.env.TZ;

function input(birthDate: string, birthTime: string | null) {
  return { birthDate, birthTime, mbti: null } as const;
}

function countTotal(counts: Readonly<Record<string, number>>) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

describe("calculateFourPillarsFacts", () => {
  afterEach(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it("uses the actual 2024 Japan 立春 instant for exact year and month facts", () => {
    const before = calculateFourPillarsFacts(
      input("2024-02-04", "17:26"),
      TODAY_ISO,
    );
    const after = calculateFourPillarsFacts(
      input("2024-02-04", "17:28"),
      TODAY_ISO,
    );

    expect(before).toMatchObject({
      fiveElements: { WOOD: 2, FIRE: 0, EARTH: 3, METAL: 2, WATER: 1 },
      yinYang: { YIN: 6, YANG: 2 },
      boundaryState: "exact",
    });
    expect(after).toMatchObject({
      fiveElements: { WOOD: 2, FIRE: 1, EARTH: 3, METAL: 2, WATER: 0 },
      yinYang: { YIN: 2, YANG: 6 },
      boundaryState: "exact",
    });
  });

  it("changes exact month facts at the 2024 啓蟄 boundary even when elements match", () => {
    const before = calculateFourPillarsFacts(
      input("2024-03-05", "11:22"),
      TODAY_ISO,
    );
    const after = calculateFourPillarsFacts(
      input("2024-03-05", "11:23"),
      TODAY_ISO,
    );

    expect(before.fiveElements).toEqual({
      WOOD: 2,
      FIRE: 2,
      EARTH: 4,
      METAL: 0,
      WATER: 0,
    });
    expect(after.fiveElements).toEqual(before.fiveElements);
    expect(before.yinYang).toEqual({ YIN: 0, YANG: 8 });
    expect(after.yinYang).toEqual({ YIN: 2, YANG: 6 });
  });

  it("changes the day master at JST midnight", () => {
    expect(
      calculateFourPillarsFacts(
        input("2024-02-29", "23:59"),
        TODAY_ISO,
      ).dayMaster,
    ).toEqual({ element: "WATER", polarity: "YIN" });
    expect(
      calculateFourPillarsFacts(
        input("2024-03-01", "00:00"),
        TODAY_ISO,
      ).dayMaster,
    ).toEqual({ element: "WOOD", polarity: "YANG" });
  });

  it("is independent of the host timezone", () => {
    process.env.TZ = "America/Los_Angeles";
    const losAngeles = calculateFourPillarsFacts(
      input("2024-02-29", "00:00"),
      TODAY_ISO,
    );
    process.env.TZ = "Pacific/Kiritimati";
    const kiritimati = calculateFourPillarsFacts(
      input("2024-02-29", "00:00"),
      TODAY_ISO,
    );

    expect(kiritimati).toEqual(losAngeles);
  });

  it("handles a leap-day date-time and counts all eight characters", () => {
    const facts = calculateFourPillarsFacts(
      input("2024-02-29", "00:00"),
      TODAY_ISO,
    );

    expect(facts).toEqual({
      birthYear: 2024,
      mbti: null,
      dayMaster: { element: "WATER", polarity: "YIN" },
      fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 0, WATER: 4 },
      yinYang: { YIN: 2, YANG: 6 },
      calculationMode: "date-time",
      boundaryState: "exact",
    });
    expect(countTotal(facts.fiveElements!)).toBe(8);
    expect(countTotal(facts.yinYang!)).toBe(8);
  });

  it("carries only the validated identity facts needed for profile composition", () => {
    const facts = calculateFourPillarsFacts(
      { birthDate: "2024-02-29", birthTime: null, mbti: "ENTJ" },
      TODAY_ISO,
    );

    expect(facts.birthYear).toBe(2024);
    expect(facts.mbti).toBe("ENTJ");
  });

  it("counts six characters for an ordinary date-only calculation", () => {
    const facts = calculateFourPillarsFacts(
      input("2024-02-29", null),
      TODAY_ISO,
    );

    expect(facts).toEqual({
      birthYear: 2024,
      mbti: null,
      dayMaster: { element: "WATER", polarity: "YIN" },
      fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 0, WATER: 2 },
      yinYang: { YIN: 2, YANG: 4 },
      calculationMode: "date-only",
      boundaryState: "exact",
    });
    expect(countTotal(facts.fiveElements!)).toBe(6);
    expect(countTotal(facts.yinYang!)).toBe(6);
  });

  it("returns null distributions for an unknown-time solar-term date", () => {
    expect(
      calculateFourPillarsFacts(input("2024-02-04", null), TODAY_ISO),
    ).toEqual({
      birthYear: 2024,
      mbti: null,
      dayMaster: { element: "EARTH", polarity: "YANG" },
      fiveElements: null,
      yinYang: null,
      calculationMode: "date-only",
      boundaryState: "solar-term-ambiguous",
    });
  });

  it("treats a month-only solar-term date as ambiguous without a time", () => {
    expect(
      calculateFourPillarsFacts(input("2024-03-05", null), TODAY_ISO),
    ).toMatchObject({
      fiveElements: null,
      yinYang: null,
      calculationMode: "date-only",
      boundaryState: "solar-term-ambiguous",
    });
  });
});
