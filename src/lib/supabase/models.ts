import {
  MBTI_TYPES,
  ZODIAC_IDS,
  type DerivedEtoProfile,
  type ElementCounts,
  type MbtiType,
  type YinYangCounts,
  type ZodiacId,
} from "../eto/types";

export type GroupRepositoryErrorCode =
  | "AUTH_FAILED"
  | "CREATE_FAILED"
  | "JOIN_FAILED"
  | "LOAD_FAILED"
  | "NOT_FOUND"
  | "UNLOCK_FAILED"
  | "SUBSCRIPTION_FAILED"
  | "INVALID_DATA";

export class GroupRepositoryError extends Error {
  constructor(
    readonly code: GroupRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GroupRepositoryError";
  }
}

export interface Group {
  id: string;
  name: string;
  maxMembers: number;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  nickname: string;
  zodiacId: ZodiacId;
  mbti: MbtiType | null;
  profile: DerivedEtoProfile;
  joinedAt: string;
}

export interface RelationUnlock {
  id: string;
  groupId: string;
  memberLowId: string;
  memberHighId: string;
  status: "pending" | "unlocked" | "failed";
  paymentProvider: string;
  paymentReference: string | null;
  unlockedBy: string;
  unlockedAt: string | null;
}

const FIVE_ELEMENTS = ["WOOD", "FIRE", "EARTH", "METAL", "WATER"] as const;
const POLARITIES = ["YIN", "YANG"] as const;

function invalidData(): GroupRepositoryError {
  return new GroupRepositoryError(
    "INVALID_DATA",
    "Supabase returned invalid group data.",
  );
}

function safelyMap<T>(mapper: () => T): T {
  try {
    return mapper();
  } catch {
    throw invalidData();
  }
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidData();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw invalidData();

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    throw invalidData();
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const snapshot: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw invalidData();
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw invalidData();
  return value;
}

function nullableStringField(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  if (value !== null && typeof value !== "string") throw invalidData();
  return value;
}

function countField(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw invalidData();
  }
  return value;
}

function mapFiveElements(value: unknown): ElementCounts {
  const row = exactRecord(value, FIVE_ELEMENTS);
  return {
    WOOD: countField(row, "WOOD"),
    FIRE: countField(row, "FIRE"),
    EARTH: countField(row, "EARTH"),
    METAL: countField(row, "METAL"),
    WATER: countField(row, "WATER"),
  };
}

function mapYinYang(value: unknown): YinYangCounts {
  const row = exactRecord(value, POLARITIES);
  return {
    YIN: countField(row, "YIN"),
    YANG: countField(row, "YANG"),
  };
}

function sumCounts(counts: Readonly<Record<string, number>>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function mapDerivedProfileUnsafe(value: unknown): DerivedEtoProfile {
  const row = exactRecord(value, [
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
  const zodiacId = row.zodiacId;
  const mbti = row.mbti;
  const calculationMode = row.calculationMode;
  const boundaryState = row.boundaryState;
  if (
    row.version !== 1 ||
    !isOneOf(zodiacId, ZODIAC_IDS) ||
    (mbti !== null && !isOneOf(mbti, MBTI_TYPES)) ||
    (calculationMode !== "date-only" && calculationMode !== "date-time") ||
    (boundaryState !== "exact" && boundaryState !== "solar-term-ambiguous") ||
    row.engineVersion !== "mofu-eto-four-pillars-v1"
  ) {
    throw invalidData();
  }

  const dayMasterRow = exactRecord(row.dayMaster, ["element", "polarity"]);
  const element = dayMasterRow.element;
  const polarity = dayMasterRow.polarity;
  if (!isOneOf(element, FIVE_ELEMENTS) || !isOneOf(polarity, POLARITIES)) {
    throw invalidData();
  }

  let fiveElements: ElementCounts | null;
  let yinYang: YinYangCounts | null;
  if (boundaryState === "solar-term-ambiguous") {
    if (
      calculationMode !== "date-only" ||
      row.fiveElements !== null ||
      row.yinYang !== null
    ) {
      throw invalidData();
    }
    fiveElements = null;
    yinYang = null;
  } else {
    if (row.fiveElements === null || row.yinYang === null) throw invalidData();
    fiveElements = mapFiveElements(row.fiveElements);
    yinYang = mapYinYang(row.yinYang);
    const expectedTotal = calculationMode === "date-only" ? 6 : 8;
    if (
      sumCounts(fiveElements) !== expectedTotal ||
      sumCounts(yinYang) !== expectedTotal
    ) {
      throw invalidData();
    }
  }

  return {
    version: 1,
    zodiacId,
    mbti,
    dayMaster: { element, polarity },
    fiveElements,
    yinYang,
    calculationMode,
    boundaryState,
    engineVersion: "mofu-eto-four-pillars-v1",
  };
}

export function mapDerivedProfile(value: unknown): DerivedEtoProfile {
  return safelyMap(() => mapDerivedProfileUnsafe(value));
}

export function mapGroup(value: unknown): Group {
  return safelyMap(() => {
    const row = exactRecord(value, ["id", "name", "max_members", "created_at"]);
    const maxMembers = row.max_members;
    if (typeof maxMembers !== "number" || !Number.isInteger(maxMembers) || maxMembers < 1) {
      throw invalidData();
    }
    return {
      id: stringField(row, "id"),
      name: stringField(row, "name"),
      maxMembers,
      createdAt: stringField(row, "created_at"),
    };
  });
}

export function mapGroupMember(value: unknown): GroupMember {
  return safelyMap(() => {
    const row = exactRecord(value, [
      "id",
      "group_id",
      "user_id",
      "nickname",
      "zodiac_id",
      "mbti",
      "profile_payload",
      "profile_version",
      "joined_at",
    ]);
    const zodiacId = row.zodiac_id;
    const mbti = row.mbti;
    if (
      !isOneOf(zodiacId, ZODIAC_IDS) ||
      (mbti !== null && !isOneOf(mbti, MBTI_TYPES))
    ) {
      throw invalidData();
    }
    const profile = mapDerivedProfileUnsafe(row.profile_payload);
    const profileVersion = row.profile_version;
    if (
      typeof profileVersion !== "number" ||
      !Number.isInteger(profileVersion) ||
      profileVersion !== 1 ||
      profileVersion !== profile.version ||
      profile.zodiacId !== zodiacId ||
      profile.mbti !== mbti
    ) {
      throw invalidData();
    }
    return {
      id: stringField(row, "id"),
      groupId: stringField(row, "group_id"),
      userId: stringField(row, "user_id"),
      nickname: stringField(row, "nickname"),
      zodiacId,
      mbti,
      profile,
      joinedAt: stringField(row, "joined_at"),
    };
  });
}

export function mapRelationUnlock(value: unknown): RelationUnlock {
  return safelyMap(() => {
    const row = exactRecord(value, [
      "id",
      "group_id",
      "member_low_id",
      "member_high_id",
      "status",
      "payment_provider",
      "payment_reference",
      "unlocked_by",
      "unlocked_at",
    ]);
    const status = row.status;
    if (status !== "pending" && status !== "unlocked" && status !== "failed") {
      throw invalidData();
    }
    return {
      id: stringField(row, "id"),
      groupId: stringField(row, "group_id"),
      memberLowId: stringField(row, "member_low_id"),
      memberHighId: stringField(row, "member_high_id"),
      status,
      paymentProvider: stringField(row, "payment_provider"),
      paymentReference: nullableStringField(row, "payment_reference"),
      unlockedBy: stringField(row, "unlocked_by"),
      unlockedAt: nullableStringField(row, "unlocked_at"),
    };
  });
}
