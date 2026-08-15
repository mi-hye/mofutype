import { ANIMAL_ORDER, ANIMALS } from "./animals";
import type { AstrologyProvider, MBTIType } from "./types";

const MILLISECONDS_PER_DAY = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_MBTI_TYPES: ReadonlySet<MBTIType> = new Set([
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

export type AstrologyValidationErrorCode =
  | "INVALID_BIRTH_DATE"
  | "INVALID_BIRTH_TIME"
  | "INVALID_MBTI";

export class AstrologyValidationError extends Error {
  constructor(
    public readonly code: AstrologyValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AstrologyValidationError";
  }
}

function parseUtcDay(value: string): number {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    throw new AstrologyValidationError(
      "INVALID_BIRTH_DATE",
      "Invalid birth date",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AstrologyValidationError(
      "INVALID_BIRTH_DATE",
      "Invalid birth date",
    );
  }

  return date.getTime() / MILLISECONDS_PER_DAY;
}

function parseTimeMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    throw new AstrologyValidationError(
      "INVALID_BIRTH_TIME",
      "Invalid birth time",
    );
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function validateMbti(value: MBTIType | null): void {
  if (value !== null && !VALID_MBTI_TYPES.has(value)) {
    throw new AstrologyValidationError("INVALID_MBTI", "Invalid MBTI");
  }
}

export const localAstrologyProvider: AstrologyProvider = {
  async derive(input) {
    validateMbti(input.mbti);
    const utcDay = parseUtcDay(input.birthDate);
    const timeMinutes =
      input.birthTime === null ? 0 : parseTimeMinutes(input.birthTime);
    const seed = utcDay + timeMinutes;
    const index = ((seed % ANIMAL_ORDER.length) + ANIMAL_ORDER.length) %
      ANIMAL_ORDER.length;
    const animalId = ANIMAL_ORDER[index];

    return {
      version: 1,
      animalId,
      animalGroup: ANIMALS[animalId].group,
      mbti: input.mbti,
      calculationMode:
        input.birthTime === null ? "date-only" : "date-time",
    };
  },
};
