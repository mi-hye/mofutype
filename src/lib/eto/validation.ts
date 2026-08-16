import { MBTI_TYPES, type EtoInput, type MbtiType } from "./types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MIN_BIRTH_DATE = "1900-01-01";

type EtoValidationErrorCode =
  | "INVALID_BIRTH_DATE"
  | "INVALID_BIRTH_TIME"
  | "INVALID_MBTI";

export class EtoValidationError extends Error {
  constructor(
    public readonly code: EtoValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EtoValidationError";
  }
}

function parseCalendarDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const reconstructed = new Date(Date.UTC(year, month - 1, day));

  if (
    reconstructed.getUTCFullYear() !== year ||
    reconstructed.getUTCMonth() !== month - 1 ||
    reconstructed.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    normalizedIso: reconstructed.toISOString().slice(0, 10),
  };
}

export function parseEtoInput(input: EtoInput, todayIso: string) {
  const today = parseCalendarDate(todayIso);
  if (!today) {
    throw new TypeError("Invalid today ISO date");
  }

  const birthDate = parseCalendarDate(input.birthDate);
  if (
    !birthDate ||
    birthDate.normalizedIso < MIN_BIRTH_DATE ||
    birthDate.normalizedIso > today.normalizedIso
  ) {
    throw new EtoValidationError(
      "INVALID_BIRTH_DATE",
      "Invalid birth date",
    );
  }

  let hour: number | null = null;
  let minute: number | null = null;
  if (input.birthTime !== null) {
    if (typeof input.birthTime !== "string") {
      throw new EtoValidationError(
        "INVALID_BIRTH_TIME",
        "Invalid birth time",
      );
    }

    const timeMatch = TIME_PATTERN.exec(input.birthTime);
    if (!timeMatch) {
      throw new EtoValidationError(
        "INVALID_BIRTH_TIME",
        "Invalid birth time",
      );
    }

    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  }

  if (
    input.mbti !== null &&
    (typeof input.mbti !== "string" ||
      !MBTI_TYPES.includes(input.mbti as MbtiType))
  ) {
    throw new EtoValidationError("INVALID_MBTI", "Invalid MBTI");
  }

  return {
    year: birthDate.year,
    month: birthDate.month,
    day: birthDate.day,
    hour,
    minute,
    mbti: input.mbti,
  };
}
