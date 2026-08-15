import type { SupabaseClient } from "@supabase/supabase-js";

import type { DerivedEtoProfile } from "../eto/types";
import type { AppDatabase } from "./app-database.types";
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

type Functions = AppDatabase["public"]["Functions"];
type CreateGroupArgs = Functions["create_group_and_join"]["Args"];
type JoinGroupArgs = Functions["join_group"]["Args"];
type PreviewGroupInviteArgs = Functions["get_group_invite_preview"]["Args"];
type UnlockRelationArgs = Functions["unlock_relation_mock"]["Args"];

interface RealtimeChannel {
  on(
    kind: "postgres_changes",
    options: {
      event: "INSERT" | "UPDATE";
      schema: "public";
      table: "group_members" | "relation_unlocks";
      filter: string;
    },
    callback: (payload: RealtimePayload) => void,
  ): RealtimeChannel;
  subscribe(callback: (status: string, error?: unknown) => void): RealtimeChannel;
  remove(): Promise<ChannelRemoveStatus>;
}

export type ChannelRemoveStatus = Awaited<
  ReturnType<SupabaseClient<AppDatabase>["removeChannel"]>
>;

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
  createGroupAndJoin(args: CreateGroupArgs): Promise<ClientResult>;
  joinGroup(args: JoinGroupArgs): Promise<ClientResult>;
  previewGroupInvite(args: PreviewGroupInviteArgs): Promise<ClientResult>;
  unlockRelation(args: UnlockRelationArgs): Promise<ClientResult>;
  loadGroup(groupId: string): Promise<ClientResult>;
  findJoinedGroupId(inviteTokenHash: string): Promise<ClientResult>;
  loadGroupMembers(groupId: string): Promise<ClientResult>;
  loadRelationUnlocks(groupId: string): Promise<ClientResult>;
  channel(name: string): RealtimeChannel;
}

export interface CreateGroupInput {
  name: string;
  nickname: string;
  profile: DerivedEtoProfile;
}

export interface JoinGroupInput {
  inviteToken: string;
  nickname: string;
  profile: DerivedEtoProfile;
}

export interface GroupAggregate {
  group: Group;
  members: GroupMember[];
  unlocks: RelationUnlock[];
}

export interface GroupInvitePreview {
  groupId: string;
  name: string;
  memberCount: number;
  maxMembers: number;
}

export type GroupChangeEvent<T> = {
  eventType: "INSERT" | "UPDATE";
  new: T;
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

function safeProfile(profile: DerivedEtoProfile) {
  return {
    version: 1 as const,
    zodiacId: profile.zodiacId,
    mbti: profile.mbti,
    dayMaster: {
      element: profile.dayMaster.element,
      polarity: profile.dayMaster.polarity,
    },
    fiveElements: profile.fiveElements === null ? null : {
      WOOD: profile.fiveElements.WOOD,
      FIRE: profile.fiveElements.FIRE,
      EARTH: profile.fiveElements.EARTH,
      METAL: profile.fiveElements.METAL,
      WATER: profile.fiveElements.WATER,
    },
    yinYang: profile.yinYang === null ? null : {
      YIN: profile.yinYang.YIN,
      YANG: profile.yinYang.YANG,
    },
    calculationMode: profile.calculationMode,
    boundaryState: profile.boundaryState,
    engineVersion: "mofu-eto-four-pillars-v1",
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
  if (eventType !== "INSERT" && eventType !== "UPDATE") {
    throw repositoryError("INVALID_DATA");
  }
  return {
    eventType,
    new: mapper(payload.new),
  };
}

function invokeSafely<TArgs extends unknown[]>(
  callback: ((...args: TArgs) => void) | undefined,
  ...args: TArgs
): void {
  try {
    callback?.(...args);
  } catch {
    // Consumer callbacks are isolated from repository and realtime control flow.
  }
}

export function createGroupRepository(client: GroupRepositoryClient) {
  let anonymousSessionPromise: Promise<string> | null = null;
  let subscriptionSequence = 0;

  async function callOperation(
    operation: () => Promise<ClientResult>,
    errorCode: "CREATE_FAILED" | "JOIN_FAILED" | "UNLOCK_FAILED",
  ): Promise<ClientResult> {
    try {
      const result = await operation();
      if (result.error) throw repositoryError(errorCode, result.error);
      return result;
    } catch (cause) {
      if (cause instanceof GroupRepositoryError) throw cause;
      throw repositoryError(errorCode, cause);
    }
  }

  async function ensureAnonymousSession(): Promise<string> {
    if (anonymousSessionPromise) return anonymousSessionPromise;

    const sessionAttempt = (async () => {
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
        if (result.error || !userId) {
          throw repositoryError("AUTH_FAILED", result.error);
        }
        return userId;
      } catch (cause) {
        if (cause instanceof GroupRepositoryError) throw cause;
        throw repositoryError("AUTH_FAILED", cause);
      }
    })();
    anonymousSessionPromise = sessionAttempt;
    try {
      return await sessionAttempt;
    } finally {
      if (anonymousSessionPromise === sessionAttempt) {
        anonymousSessionPromise = null;
      }
    }
  }

  async function createGroup(input: CreateGroupInput) {
    await ensureAnonymousSession();
    const payload = safeProfile(input.profile);
    const args: CreateGroupArgs = {
      p_name: input.name,
      p_nickname: input.nickname,
      p_zodiac_id: payload.zodiacId,
      p_mbti: payload.mbti,
      p_profile_payload: payload,
    };
    const result = await callOperation(
      () => client.createGroupAndJoin(args),
      "CREATE_FAILED",
    );
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
    const args: JoinGroupArgs = {
      p_invite_token: input.inviteToken,
      p_nickname: input.nickname,
      p_zodiac_id: payload.zodiacId,
      p_mbti: payload.mbti,
      p_profile_payload: payload,
    };
    const result = await callOperation(() => client.joinGroup(args), "JOIN_FAILED");
    const row = exactlyOneRow(result.data);
    return {
      groupId: requiredString(row, "group_id"),
      memberId: requiredString(row, "member_id"),
    };
  }

  async function previewGroupInvite(
    inviteToken: string,
  ): Promise<GroupInvitePreview | null> {
    await ensureAnonymousSession();
    let result: ClientResult;
    try {
      result = await client.previewGroupInvite({ p_invite_token: inviteToken });
    } catch (cause) {
      throw repositoryError("LOAD_FAILED", cause);
    }
    if (result.error) throw repositoryError("LOAD_FAILED", result.error);
    if (!Array.isArray(result.data)) throw repositoryError("INVALID_DATA");
    if (result.data.length === 0) return null;
    if (result.data.length !== 1) throw repositoryError("INVALID_DATA");
    const row = exactlyOneRow(result.data);
    const memberCount = row.member_count;
    const maxMembers = row.max_members;
    if (
      !Number.isInteger(memberCount) ||
      (memberCount as number) < 0 ||
      !Number.isInteger(maxMembers) ||
      (maxMembers as number) < 1 ||
      (memberCount as number) > (maxMembers as number)
    ) throw repositoryError("INVALID_DATA");
    return {
      groupId: requiredString(row, "group_id"),
      name: requiredString(row, "name"),
      memberCount: memberCount as number,
      maxMembers: maxMembers as number,
    };
  }

  async function loadGroup(groupId: string): Promise<GroupAggregate> {
    await ensureAnonymousSession();
    let groupResult: ClientResult;
    try {
      groupResult = await client.loadGroup(groupId);
    } catch (cause) {
      throw repositoryError("LOAD_FAILED", cause);
    }
    if (groupResult.error) throw repositoryError("LOAD_FAILED", groupResult.error);
    if (groupResult.data === null) throw repositoryError("NOT_FOUND");

    let membersResult: ClientResult;
    let unlocksResult: ClientResult;
    try {
      [membersResult, unlocksResult] = await Promise.all([
        client.loadGroupMembers(groupId),
        client.loadRelationUnlocks(groupId),
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

  async function findJoinedGroupByInviteToken(
    inviteToken: string,
  ): Promise<GroupAggregate | null> {
    await ensureAnonymousSession();
    let lookupResult: ClientResult;
    try {
      const bytes = new TextEncoder().encode(inviteToken);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      const inviteTokenHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      lookupResult = await client.findJoinedGroupId(inviteTokenHash);
    } catch (cause) {
      throw repositoryError("LOAD_FAILED", cause);
    }
    if (lookupResult.error) throw repositoryError("LOAD_FAILED", lookupResult.error);
    if (lookupResult.data === null) return null;
    if (
      typeof lookupResult.data !== "object" ||
      Array.isArray(lookupResult.data)
    ) throw repositoryError("INVALID_DATA");
    const groupId = requiredString(
      lookupResult.data as Record<string, unknown>,
      "id",
    );
    return await loadGroup(groupId);
  }

  async function unlockPair(
    groupId: string,
    memberA: string,
    memberB: string,
  ): Promise<RelationUnlock> {
    await ensureAnonymousSession();
    const args: UnlockRelationArgs = {
      p_group_id: groupId,
      p_member_a: memberA,
      p_member_b: memberB,
    };
    const result = await callOperation(
      () => client.unlockRelation(args),
      "UNLOCK_FAILED",
    );
    return mapRelationUnlock(exactlyOneRow(result.data));
  }

  function subscribeToGroup(
    groupId: string,
    callbacks: GroupSubscriptionCallbacks,
  ): () => Promise<void> {
    let partialChannel: RealtimeChannel | undefined;
    const reportError = (error: GroupRepositoryError) => {
      invokeSafely(callbacks.onError, error);
    };
    try {
      subscriptionSequence += 1;
      const channel = client.channel(`group:${groupId}:${subscriptionSequence}`);
      partialChannel = channel;
      const filter = `group_id=eq.${groupId}`;
      const register = <T>(
        table: "group_members" | "relation_unlocks",
        mapper: (row: unknown) => T,
        callback: ((change: GroupChangeEvent<T>) => void) | undefined,
      ) => {
        // PostgreSQL Changes cannot apply the group_id filter to DELETE events.
        // A future moderation/deletion feature must use a separately authorized
        // refetch mechanism instead of subscribing to unscoped DELETE payloads.
        for (const event of ["INSERT", "UPDATE"] as const) {
          channel.on(
            "postgres_changes",
            { event, schema: "public", table, filter },
            (payload) => {
              let change: GroupChangeEvent<T>;
              try {
                change = mapChange(payload, mapper);
              } catch (cause) {
                reportError(
                  cause instanceof GroupRepositoryError
                    ? cause
                    : repositoryError("INVALID_DATA", cause),
                );
                return;
              }
              invokeSafely(callback, change);
            },
          );
        }
      };
      register("group_members", mapGroupMember, callbacks.onMemberChange);
      register("relation_unlocks", mapRelationUnlock, callbacks.onUnlockChange);
      channel.subscribe((status, error) => {
        invokeSafely(callbacks.onConnectionStatus, status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reportError(repositoryError("SUBSCRIPTION_FAILED", error));
        }
      });

      let cleaned = false;
      return async () => {
        if (cleaned) return;
        try {
          const status = await channel.remove();
          if (status === "ok") {
            cleaned = true;
          } else {
            reportError(repositoryError("SUBSCRIPTION_FAILED", status));
          }
        } catch (cause) {
          reportError(repositoryError("SUBSCRIPTION_FAILED", cause));
        }
      };
    } catch (cause) {
      if (partialChannel) {
        void partialChannel.remove().catch(() => undefined);
      }
      throw repositoryError("SUBSCRIPTION_FAILED", cause);
    }
  }

  return {
    ensureAnonymousSession,
    createGroup,
    joinGroup,
    previewGroupInvite,
    findJoinedGroupByInviteToken,
    loadGroup,
    unlockPair,
    subscribeToGroup,
  };
}

export function createBrowserGroupRepository() {
  return createGroupRepository(
    createSupabaseGroupRepositoryAdapter(createSupabaseBrowserClient()),
  );
}

const GROUP_COLUMNS = "id,name,max_members,created_at";
const MEMBER_COLUMNS =
  "id,group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version,joined_at";
const UNLOCK_COLUMNS =
  "id,group_id,member_low_id,member_high_id,status,payment_provider,payment_reference,unlocked_by,unlocked_at";

export type SupabaseGroupTransport = Pick<
  SupabaseClient<AppDatabase>,
  "rpc" | "from" | "channel" | "removeChannel"
> & {
  auth: Pick<
    SupabaseClient<AppDatabase>["auth"],
    "getSession" | "signInAnonymously"
  >;
};

export function createSupabaseGroupRepositoryAdapter(
  client: SupabaseGroupTransport,
): GroupRepositoryClient {
  return {
    auth: {
      async getSession() {
        const { data, error } = await client.auth.getSession();
        return {
          data: {
            session: data.session
              ? { user: { id: data.session.user.id } }
              : null,
          },
          error,
        };
      },
      async signInAnonymously() {
        const { data, error } = await client.auth.signInAnonymously();
        return {
          data: { user: data.user ? { id: data.user.id } : null },
          error,
        };
      },
    },
    createGroupAndJoin: async (args) =>
      await client.rpc("create_group_and_join", args),
    joinGroup: async (args) => await client.rpc("join_group", args),
    previewGroupInvite: async (args) =>
      await client.rpc("get_group_invite_preview", args),
    unlockRelation: async (args) =>
      await client.rpc("unlock_relation_mock", args),
    loadGroup: async (groupId) =>
      await client
        .from("groups")
        .select(GROUP_COLUMNS)
        .eq("id", groupId)
        .maybeSingle(),
    findJoinedGroupId: async (inviteTokenHash) =>
      await client
        .from("groups")
        .select("id")
        .eq("invite_token_hash", inviteTokenHash)
        .maybeSingle(),
    loadGroupMembers: async (groupId) =>
      await client
        .from("group_members")
        .select(MEMBER_COLUMNS)
        .eq("group_id", groupId),
    loadRelationUnlocks: async (groupId) =>
      await client
        .from("relation_unlocks")
        .select(UNLOCK_COLUMNS)
        .eq("group_id", groupId),
    channel(name) {
      const supabaseChannel = client.channel(name);
      const channel: RealtimeChannel = {
        on(kind, options, callback) {
          supabaseChannel.on(kind, options, (payload) =>
            callback({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            }),
          );
          return channel;
        },
        subscribe(callback) {
          supabaseChannel.subscribe((status, error) => callback(status, error));
          return channel;
        },
        async remove() {
          return await client.removeChannel(supabaseChannel);
        },
      };
      return channel;
    },
  };
}
