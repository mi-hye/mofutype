import type { DerivedProfile } from "../astrology/types";
import { createSupabaseBrowserClient } from "./browser";
import {
  GroupRepositoryError,
  mapGroup,
  mapGroupMember,
  mapRelationUnlock,
  type Group,
  type GroupMember,
  type GroupRepositoryErrorCode,
  type RelationUnlock,
} from "./models";

export { GroupRepositoryError, type GroupRepositoryErrorCode } from "./models";

type ClientResult = { data: unknown; error: unknown };

interface QueryBuilder extends PromiseLike<ClientResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  maybeSingle(): Promise<ClientResult>;
}

interface RealtimeChannel {
  on(
    kind: "postgres_changes",
    options: {
      event: "INSERT" | "UPDATE" | "DELETE";
      schema: "public";
      table: "group_members" | "relation_unlocks";
      filter: string;
    },
    callback: (payload: RealtimePayload) => void,
  ): RealtimeChannel;
  subscribe(callback: (status: string, error?: unknown) => void): RealtimeChannel;
}

export interface GroupRepositoryClient {
  auth: {
    getSession(): Promise<{
      data: { session: { user: { id: string } } | null };
      error: unknown;
    }>;
    signInAnonymously(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  rpc(name: string, args: Record<string, unknown>): Promise<ClientResult>;
  from(table: string): QueryBuilder;
  channel(name: string): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): Promise<unknown> | unknown;
}

export interface CreateGroupInput {
  name: string;
  nickname: string;
  profile: DerivedProfile;
}

export interface JoinGroupInput {
  inviteToken: string;
  nickname: string;
  profile: DerivedProfile;
}

export interface GroupAggregate {
  group: Group;
  members: GroupMember[];
  unlocks: RelationUnlock[];
}

export type GroupChangeEvent<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
};

export interface GroupSubscriptionCallbacks {
  onMemberChange?(change: GroupChangeEvent<GroupMember>): void;
  onUnlockChange?(change: GroupChangeEvent<RelationUnlock>): void;
  onConnectionStatus?(status: string): void;
  onError?(error: GroupRepositoryError): void;
}

type RealtimePayload = {
  eventType?: unknown;
  new?: unknown;
  old?: unknown;
};

const publicMessages: Record<GroupRepositoryErrorCode, string> = {
  AUTH_FAILED: "Unable to establish an anonymous session.",
  CREATE_FAILED: "Unable to create the group.",
  JOIN_FAILED: "Unable to join the group.",
  LOAD_FAILED: "Unable to load the group.",
  NOT_FOUND: "The group was not found.",
  UNLOCK_FAILED: "Unable to unlock the relationship.",
  SUBSCRIPTION_FAILED: "The group subscription failed.",
  INVALID_DATA: "Supabase returned invalid group data.",
};

function repositoryError(
  code: GroupRepositoryErrorCode,
  cause?: unknown,
): GroupRepositoryError {
  return new GroupRepositoryError(
    code,
    publicMessages[code],
    cause === undefined ? undefined : { cause },
  );
}

function safeProfile(profile: DerivedProfile): DerivedProfile {
  return {
    version: 1,
    animalId: profile.animalId,
    animalGroup: profile.animalGroup,
    mbti: profile.mbti,
    calculationMode: profile.calculationMode,
  };
}

function exactlyOneRow(data: unknown): Record<string, unknown> {
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    typeof data[0] !== "object" ||
    data[0] === null ||
    Array.isArray(data[0])
  ) {
    throw repositoryError("INVALID_DATA");
  }
  return data[0] as Record<string, unknown>;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw repositoryError("INVALID_DATA");
  }
  return value;
}

function mapChange<T>(
  payload: RealtimePayload,
  mapper: (row: unknown) => T,
): GroupChangeEvent<T> {
  const eventType = payload.eventType;
  if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") {
    throw repositoryError("INVALID_DATA");
  }
  return {
    eventType,
    new: eventType === "DELETE" ? null : mapper(payload.new),
    old: eventType === "DELETE" ? mapper(payload.old) : null,
  };
}

export function createGroupRepository(client: GroupRepositoryClient) {
  async function callRpc(
    name: string,
    args: Record<string, unknown>,
    errorCode: "CREATE_FAILED" | "JOIN_FAILED" | "UNLOCK_FAILED",
  ): Promise<ClientResult> {
    try {
      const result = await client.rpc(name, args);
      if (result.error) throw repositoryError(errorCode, result.error);
      return result;
    } catch (cause) {
      if (cause instanceof GroupRepositoryError) throw cause;
      throw repositoryError(errorCode, cause);
    }
  }

  async function ensureAnonymousSession(): Promise<string> {
    let sessionResult;
    try {
      sessionResult = await client.auth.getSession();
    } catch (cause) {
      throw repositoryError("AUTH_FAILED", cause);
    }
    const sessionUserId = sessionResult.data.session?.user.id;
    if (!sessionResult.error && sessionUserId) return sessionUserId;

    try {
      const result = await client.auth.signInAnonymously();
      const userId = result.data.user?.id;
      if (result.error || !userId) throw repositoryError("AUTH_FAILED", result.error);
      return userId;
    } catch (cause) {
      if (cause instanceof GroupRepositoryError) throw cause;
      throw repositoryError("AUTH_FAILED", cause);
    }
  }

  async function createGroup(input: CreateGroupInput) {
    await ensureAnonymousSession();
    const payload = safeProfile(input.profile);
    const result = await callRpc("create_group_and_join", {
      p_name: input.name,
      p_nickname: input.nickname,
      p_animal_id: payload.animalId,
      p_animal_group: payload.animalGroup,
      p_mbti: payload.mbti,
      p_profile_payload: payload,
    }, "CREATE_FAILED");
    const row = exactlyOneRow(result.data);
    return {
      groupId: requiredString(row, "group_id"),
      memberId: requiredString(row, "member_id"),
      inviteToken: requiredString(row, "invite_token"),
    };
  }

  async function joinGroup(input: JoinGroupInput) {
    await ensureAnonymousSession();
    const payload = safeProfile(input.profile);
    const result = await callRpc("join_group", {
      p_invite_token: input.inviteToken,
      p_nickname: input.nickname,
      p_animal_id: payload.animalId,
      p_animal_group: payload.animalGroup,
      p_mbti: payload.mbti,
      p_profile_payload: payload,
    }, "JOIN_FAILED");
    const row = exactlyOneRow(result.data);
    return {
      groupId: requiredString(row, "group_id"),
      memberId: requiredString(row, "member_id"),
    };
  }

  async function loadGroup(groupId: string): Promise<GroupAggregate> {
    await ensureAnonymousSession();
    let groupResult: ClientResult;
    try {
      groupResult = await client
        .from("groups")
        .select("id,name,max_members,created_at")
        .eq("id", groupId)
        .maybeSingle();
    } catch (cause) {
      throw repositoryError("LOAD_FAILED", cause);
    }
    if (groupResult.error) throw repositoryError("LOAD_FAILED", groupResult.error);
    if (groupResult.data === null) throw repositoryError("NOT_FOUND");

    let membersResult: ClientResult;
    let unlocksResult: ClientResult;
    try {
      [membersResult, unlocksResult] = await Promise.all([
        client
          .from("group_members")
          .select(
            "id,group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload,joined_at",
          )
          .eq("group_id", groupId),
        client
          .from("relation_unlocks")
          .select(
            "id,group_id,member_low_id,member_high_id,status,payment_provider,payment_reference,unlocked_by,unlocked_at",
          )
          .eq("group_id", groupId),
      ]);
    } catch (cause) {
      throw repositoryError("LOAD_FAILED", cause);
    }
    if (membersResult.error || unlocksResult.error) {
      throw repositoryError("LOAD_FAILED", membersResult.error ?? unlocksResult.error);
    }
    if (!Array.isArray(membersResult.data) || !Array.isArray(unlocksResult.data)) {
      throw repositoryError("INVALID_DATA");
    }
    return {
      group: mapGroup(groupResult.data),
      members: membersResult.data.map(mapGroupMember),
      unlocks: unlocksResult.data.map(mapRelationUnlock),
    };
  }

  async function unlockPair(
    groupId: string,
    memberA: string,
    memberB: string,
  ): Promise<RelationUnlock> {
    await ensureAnonymousSession();
    const result = await callRpc("unlock_relation_mock", {
      p_group_id: groupId,
      p_member_a: memberA,
      p_member_b: memberB,
    }, "UNLOCK_FAILED");
    return mapRelationUnlock(exactlyOneRow(result.data));
  }

  function subscribeToGroup(
    groupId: string,
    callbacks: GroupSubscriptionCallbacks,
  ): () => Promise<void> {
    try {
      const channel = client.channel(`group:${groupId}`);
      const filter = `group_id=eq.${groupId}`;
      const register = <T>(
        table: "group_members" | "relation_unlocks",
        mapper: (row: unknown) => T,
        callback: ((change: GroupChangeEvent<T>) => void) | undefined,
      ) => {
        for (const event of ["INSERT", "UPDATE", "DELETE"] as const) {
          channel.on(
            "postgres_changes",
            { event, schema: "public", table, filter },
            (payload) => {
              try {
                const change = mapChange(payload, mapper);
                callback?.(change);
              } catch (cause) {
                callbacks.onError?.(
                  cause instanceof GroupRepositoryError
                    ? cause
                    : repositoryError("INVALID_DATA", cause),
                );
              }
            },
          );
        }
      };
      register("group_members", mapGroupMember, callbacks.onMemberChange);
      register("relation_unlocks", mapRelationUnlock, callbacks.onUnlockChange);
      channel.subscribe((status, error) => {
        callbacks.onConnectionStatus?.(status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          callbacks.onError?.(repositoryError("SUBSCRIPTION_FAILED", error));
        }
      });

      let cleaned = false;
      return async () => {
        if (cleaned) return;
        cleaned = true;
        try {
          await client.removeChannel(channel);
        } catch (cause) {
          callbacks.onError?.(repositoryError("SUBSCRIPTION_FAILED", cause));
        }
      };
    } catch (cause) {
      throw repositoryError("SUBSCRIPTION_FAILED", cause);
    }
  }

  return {
    ensureAnonymousSession,
    createGroup,
    joinGroup,
    loadGroup,
    unlockPair,
    subscribeToGroup,
  };
}

export function createBrowserGroupRepository() {
  return createGroupRepository(
    createSupabaseBrowserClient() as unknown as GroupRepositoryClient,
  );
}
