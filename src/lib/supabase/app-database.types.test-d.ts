import type { AppDatabase } from "./app-database.types";
import type { Database } from "./database.types";

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type GeneratedCreate = Database["public"]["Functions"]["create_group_and_join"];
type GeneratedJoin = Database["public"]["Functions"]["join_group"];
type Create = AppDatabase["public"]["Functions"]["create_group_and_join"];
type Join = AppDatabase["public"]["Functions"]["join_group"];

export type GeneratedCreateKeys = Assert<Equal<
  keyof GeneratedCreate["Args"],
  "p_mbti" | "p_name" | "p_nickname" | "p_profile_payload" | "p_zodiac_id"
>>;
export type GeneratedJoinKeys = Assert<Equal<
  keyof GeneratedJoin["Args"],
  "p_invite_token" | "p_mbti" | "p_nickname" | "p_profile_payload" | "p_zodiac_id"
>>;
export type CreateKeepsGeneratedKeys = Assert<Equal<keyof Create["Args"], keyof GeneratedCreate["Args"]>>;
export type JoinKeepsGeneratedKeys = Assert<Equal<keyof Join["Args"], keyof GeneratedJoin["Args"]>>;
export type GeneratedCreateRequiresZodiac = Assert<Equal<undefined extends GeneratedCreate["Args"]["p_zodiac_id"] ? true : false, false>>;
export type GeneratedJoinRequiresZodiac = Assert<Equal<undefined extends GeneratedJoin["Args"]["p_zodiac_id"] ? true : false, false>>;
export type NoGeneratedCreateAnimalId = Assert<Equal<Extract<"p_animal_id", keyof GeneratedCreate["Args"]>, never>>;
export type NoGeneratedCreateAnimalGroup = Assert<Equal<Extract<"p_animal_group", keyof GeneratedCreate["Args"]>, never>>;
export type NoGeneratedJoinAnimalId = Assert<Equal<Extract<"p_animal_id", keyof GeneratedJoin["Args"]>, never>>;
export type NoGeneratedJoinAnimalGroup = Assert<Equal<Extract<"p_animal_group", keyof GeneratedJoin["Args"]>, never>>;

export type CreateMbtiIsNullableString = Assert<Equal<Create["Args"]["p_mbti"], string | null>>;
export type JoinMbtiIsNullableString = Assert<Equal<Join["Args"]["p_mbti"], string | null>>;
export type CreateMbtiRejectsNumbers = Assert<Equal<Extract<number, Create["Args"]["p_mbti"]>, never>>;
export type JoinMbtiRejectsObjects = Assert<Equal<Extract<{ value: string }, Join["Args"]["p_mbti"]>, never>>;

export type GeneratedCreateReturnKeys = Assert<Equal<
  keyof GeneratedCreate["Returns"][number],
  "group_id" | "invite_token" | "member_id"
>>;
export type GeneratedJoinReturnKeys = Assert<Equal<
  keyof GeneratedJoin["Returns"][number],
  "group_id" | "member_id"
>>;
export type CreateReturnPreserved = Assert<Equal<Create["Returns"], GeneratedCreate["Returns"]>>;
export type JoinReturnPreserved = Assert<Equal<Join["Returns"], GeneratedJoin["Returns"]>>;
