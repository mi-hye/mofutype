import type { AppDatabase } from "./app-database.types";

type Assert<T extends true> = T;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type CreateArgs = AppDatabase["public"]["Functions"]["create_group_and_join"]["Args"];
type JoinArgs = AppDatabase["public"]["Functions"]["join_group"]["Args"];

export type CreateMbtiAcceptsNull = Assert<null extends CreateArgs["p_mbti"] ? true : false>;
export type JoinMbtiAcceptsNull = Assert<null extends JoinArgs["p_mbti"] ? true : false>;
export type CreateMbtiRejectsNumbers = Assert<Equal<Extract<number, CreateArgs["p_mbti"]>, never>>;
export type JoinMbtiRejectsObjects = Assert<Equal<Extract<{ value: string }, JoinArgs["p_mbti"]>, never>>;
export type CreateKeepsGeneratedShape = Assert<Equal<
  keyof CreateArgs,
  | "p_animal_group"
  | "p_animal_id"
  | "p_mbti"
  | "p_name"
  | "p_nickname"
  | "p_profile_payload"
>>;
