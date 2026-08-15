import type {
  AnimalGroup,
  AnimalId,
  DerivedProfile,
  MBTIType,
} from "../astrology/types";

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
  animalId: AnimalId;
  animalGroup: AnimalGroup;
  mbti: MBTIType | null;
  profile: DerivedProfile;
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

const animalIds = new Set<AnimalId>([
  "fawn",
  "raccoon",
  "black-panther",
  "sheep",
  "wolf",
  "monkey",
  "tiger",
  "koala",
  "cheetah",
  "lion",
  "elephant",
  "pegasus",
]);
const animalGroups = new Set<AnimalGroup>(["MOON", "EARTH", "SUN"]);
const mbtiTypes = new Set<MBTIType>([
  "ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ",
]);

function invalidData(cause?: unknown): GroupRepositoryError {
  return new GroupRepositoryError(
    "INVALID_DATA",
    "Supabase returned invalid group data.",
    cause === undefined ? undefined : { cause },
  );
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidData();
  }
  return value as Record<string, unknown>;
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

export function mapDerivedProfile(value: unknown): DerivedProfile {
  const row = record(value);
  const animalId = row.animalId;
  const animalGroup = row.animalGroup;
  const mbti = row.mbti;
  const calculationMode = row.calculationMode;
  if (
    row.version !== 1 ||
    typeof animalId !== "string" ||
    !animalIds.has(animalId as AnimalId) ||
    typeof animalGroup !== "string" ||
    !animalGroups.has(animalGroup as AnimalGroup) ||
    (mbti !== null &&
      (typeof mbti !== "string" || !mbtiTypes.has(mbti as MBTIType))) ||
    (calculationMode !== "date-time" && calculationMode !== "date-only")
  ) {
    throw invalidData();
  }
  return {
    version: 1,
    animalId: animalId as AnimalId,
    animalGroup: animalGroup as AnimalGroup,
    mbti: mbti as MBTIType | null,
    calculationMode,
  };
}

export function mapGroup(value: unknown): Group {
  const row = record(value);
  const maxMembers = row.max_members;
  if (!Number.isInteger(maxMembers) || (maxMembers as number) < 1) {
    throw invalidData();
  }
  return {
    id: stringField(row, "id"),
    name: stringField(row, "name"),
    maxMembers: maxMembers as number,
    createdAt: stringField(row, "created_at"),
  };
}

export function mapGroupMember(value: unknown): GroupMember {
  const row = record(value);
  const animalId = stringField(row, "animal_id");
  const animalGroup = stringField(row, "animal_group");
  const mbti = row.mbti;
  if (
    !animalIds.has(animalId as AnimalId) ||
    !animalGroups.has(animalGroup as AnimalGroup) ||
    (mbti !== null &&
      (typeof mbti !== "string" || !mbtiTypes.has(mbti as MBTIType)))
  ) {
    throw invalidData();
  }
  const profile = mapDerivedProfile(row.profile_payload);
  if (
    profile.animalId !== animalId ||
    profile.animalGroup !== animalGroup ||
    profile.mbti !== mbti
  ) {
    throw invalidData();
  }
  return {
    id: stringField(row, "id"),
    groupId: stringField(row, "group_id"),
    userId: stringField(row, "user_id"),
    nickname: stringField(row, "nickname"),
    animalId: animalId as AnimalId,
    animalGroup: animalGroup as AnimalGroup,
    mbti: mbti as MBTIType | null,
    profile,
    joinedAt: stringField(row, "joined_at"),
  };
}

export function mapRelationUnlock(value: unknown): RelationUnlock {
  const row = record(value);
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
}
