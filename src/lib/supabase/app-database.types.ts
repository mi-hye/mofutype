import type { Database } from "./database.types";

type GeneratedFunctions = Database["public"]["Functions"];

type WithNullableMbtiArgs<
  Definition extends { Args: { p_mbti: string } },
> = Omit<Definition, "Args"> & {
  Args: Omit<Definition["Args"], "p_mbti"> & {
    // Supabase codegen currently omits SQL argument nullability metadata, even
    // though these RPC parameters accept SQL NULL. Keep generated types intact
    // and maintain the application-facing correction in this wrapper.
    p_mbti: string | null;
  };
};

export type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Omit<
      GeneratedFunctions,
      "create_group_and_join" | "join_group"
    > & {
      create_group_and_join: WithNullableMbtiArgs<
        GeneratedFunctions["create_group_and_join"]
      >;
      join_group: WithNullableMbtiArgs<GeneratedFunctions["join_group"]>;
    };
  };
};
