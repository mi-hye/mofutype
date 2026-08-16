import { describe, expect, it } from "vitest";

import { MBTI_TYPES } from "./types";
import { EtoValidationError, parseEtoInput } from "./validation";

const TODAY_ISO = "2026-08-15";

const validInput = {
  birthDate: "2000-02-29",
  birthTime: "09:05",
  mbti: "INFP" as const,
};

function expectValidationCode(
  input: Parameters<typeof parseEtoInput>[0],
  code: EtoValidationError["code"],
) {
  try {
    parseEtoInput(input, TODAY_ISO);
  } catch (error) {
    expect(error).toBeInstanceOf(EtoValidationError);
    expect((error as EtoValidationError).code).toBe(code);
    return;
  }

  throw new Error(`Expected validation to fail with ${code}`);
}

describe("parseEtoInput", () => {
  it("accepts the inclusive minimum birth date", () => {
    expect(
      parseEtoInput(
        { ...validInput, birthDate: "1900-01-01" },
        TODAY_ISO,
      ),
    ).toEqual({
      year: 1900,
      month: 1,
      day: 1,
      hour: 9,
      minute: 5,
      mbti: "INFP",
    });
  });

  it("accepts a real leap day", () => {
    expect(parseEtoInput(validInput, TODAY_ISO)).toEqual({
      year: 2000,
      month: 2,
      day: 29,
      hour: 9,
      minute: 5,
      mbti: "INFP",
    });
  });

  it("rejects a date before 1900-01-01", () => {
    expectValidationCode(
      { ...validInput, birthDate: "1899-12-31" },
      "INVALID_BIRTH_DATE",
    );
  });

  it("rejects an impossible calendar date", () => {
    expectValidationCode(
      { ...validInput, birthDate: "2000-02-30" },
      "INVALID_BIRTH_DATE",
    );
  });

  it("rejects a future date relative to the injected date", () => {
    expectValidationCode(
      { ...validInput, birthDate: "2026-08-16" },
      "INVALID_BIRTH_DATE",
    );
  });

  it.each([
    ["00:00", 0, 0],
    ["23:59", 23, 59],
  ])("accepts valid time %s", (birthTime, hour, minute) => {
    expect(
      parseEtoInput({ ...validInput, birthTime }, TODAY_ISO),
    ).toMatchObject({ hour, minute });
  });

  it("rejects 24:00", () => {
    expectValidationCode(
      { ...validInput, birthTime: "24:00" },
      "INVALID_BIRTH_TIME",
    );
  });

  it("exports and accepts every MBTI value in its stable order", () => {
    expect(MBTI_TYPES).toEqual([
      "ISTJ",
      "ISFJ",
      "INFJ",
      "INTJ",
      "ISTP",
      "ISFP",
      "INFP",
      "INTP",
      "ESTP",
      "ESFP",
      "ENFP",
      "ENTP",
      "ESTJ",
      "ESFJ",
      "ENFJ",
      "ENTJ",
    ]);

    for (const mbti of MBTI_TYPES) {
      expect(parseEtoInput({ ...validInput, mbti }, TODAY_ISO).mbti).toBe(
        mbti,
      );
    }
  });

  it("rejects lowercase MBTI without coercion", () => {
    expectValidationCode(
      { ...validInput, mbti: "infp" as never },
      "INVALID_MBTI",
    );
  });

  it("accepts null birth time and null MBTI", () => {
    expect(
      parseEtoInput(
        { ...validInput, birthTime: null, mbti: null },
        TODAY_ISO,
      ),
    ).toEqual({
      year: 2000,
      month: 2,
      day: 29,
      hour: null,
      minute: null,
      mbti: null,
    });
  });

  it.each(["2026-8-15", "2026-02-30", "not-a-date"])(
    "rejects malformed injected date %s",
    (todayIso) => {
      expect(() => parseEtoInput(validInput, todayIso)).toThrow(
        "Invalid today ISO date",
      );
    },
  );

  it("does not expose raw birth input in validation errors", () => {
    const rawBirthDate = "secret-invalid-birth-date";

    try {
      parseEtoInput({ ...validInput, birthDate: rawBirthDate }, TODAY_ISO);
    } catch (error) {
      expect(error).toBeInstanceOf(EtoValidationError);
      expect((error as Error).message).not.toContain(rawBirthDate);
      return;
    }

    throw new Error("Expected invalid birth date to be rejected");
  });
});
