import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.hoisted(() => vi.fn(() => ({ browser: true })));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

import {
  SupabaseConfigurationError,
  createSupabaseBrowserClient,
} from "./browser";
import {
  GroupRepositoryError,
  createGroupRepository,
  type GroupRepositoryClient,
} from "./group-repository";
import { mapGroupMember, mapRelationUnlock } from "./models";
import type { DerivedProfile } from "../astrology/types";

const profile: DerivedProfile = {
  version: 1,
  animalId: "fawn",
  animalGroup: "MOON",
  mbti: null,
  calculationMode: "date-only",
};

const groupRow = {
  id: "group-1",
  name: "Friends",
  max_members: 30,
  created_at: "2026-08-15T00:00:00Z",
};

const memberRow = {
  id: "member-1",
  group_id: "group-1",
  user_id: "user-1",
  nickname: "Mofu",
  animal_id: "fawn",
  animal_group: "MOON",
  mbti: null,
  profile_payload: profile,
  joined_at: "2026-08-15T00:01:00Z",
};

const unlockRow = {
  id: "unlock-1",
  group_id: "group-1",
  member_low_id: "member-1",
  member_high_id: "member-2",
  status: "unlocked",
  payment_provider: "mock",
  payment_reference: null,
  unlocked_by: "user-1",
  unlocked_at: "2026-08-15T00:02:00Z",
};

const invalidRpcRowSets: unknown[][] = [
  [],
  [
    { group_id: "g", member_id: "m" },
    { group_id: "g2", member_id: "m2" },
  ],
];

type Result = { data: unknown; error: unknown };

class FakeQuery {
  selected = "";
  filters: Array<[string, unknown]> = [];

  constructor(
    private readonly result: Result,
    private readonly rejection?: unknown,
  ) {}

  select(columns: string) {
    this.selected = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  maybeSingle(): Promise<Result> {
    if (this.rejection !== undefined) return Promise.reject(this.rejection);
    return Promise.resolve(this.result);
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this.rejection !== undefined) {
      return Promise.reject(this.rejection).then(onfulfilled, onrejected);
    }
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

type RealtimeRegistration = {
  event: string;
  table: string;
  filter: string;
  callback: (payload: Record<string, unknown>) => void;
};

class FakeChannel {
  registrations: RealtimeRegistration[] = [];
  statusCallback?: (status: string, error?: unknown) => void;

  on(
    _kind: "postgres_changes",
    options: { event: string; schema: string; table: string; filter: string },
    callback: (payload: Record<string, unknown>) => void,
  ) {
    this.registrations.push({ ...options, callback });
    return this;
  }

  subscribe(callback: (status: string, error?: unknown) => void) {
    this.statusCallback = callback;
    return this;
  }

  emit(table: string, event: string, row: Record<string, unknown>) {
    this.registrations
      .filter((item) => item.table === table && item.event === event)
      .forEach((item) =>
        item.callback({
          eventType: event,
          new: event === "DELETE" ? {} : row,
          old: event === "DELETE" ? row : {},
        }),
      );
  }
}

class FakeSupabaseClient implements GroupRepositoryClient {
  session: { user: { id: string } } | null = { user: { id: "user-1" } };
  getSessionError: unknown = null;
  anonymousResult: Result & { data: { user: { id: string } | null } } = {
    data: { user: { id: "anon-1" } },
    error: null,
  };
  rpcResults = new Map<string, Result>();
  rejectedRpcs = new Map<string, unknown>();
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  tableResults = new Map<string, Result>();
  rejectedTables = new Map<string, unknown>();
  queries = new Map<string, FakeQuery>();
  channels: FakeChannel[] = [];
  removedChannels: FakeChannel[] = [];

  auth = {
    getSession: async () => ({
      data: { session: this.session },
      error: this.getSessionError,
    }),
    signInAnonymously: async () => this.anonymousResult,
  };

  rpc(name: string, args: Record<string, unknown>): Promise<Result> {
    this.rpcCalls.push({ name, args });
    if (this.rejectedRpcs.has(name)) {
      return Promise.reject(this.rejectedRpcs.get(name));
    }
    return Promise.resolve(
      this.rpcResults.get(name) ?? { data: null, error: new Error("not configured") },
    );
  }

  from(table: string): FakeQuery {
    const query = new FakeQuery(
      this.tableResults.get(table) ?? { data: null, error: new Error("not configured") },
      this.rejectedTables.get(table),
    );
    this.queries.set(table, query);
    return query;
  }

  channel(name: string): FakeChannel {
    void name;
    const channel = new FakeChannel();
    this.channels.push(channel);
    return channel;
  }

  async removeChannel(channel: FakeChannel): Promise<void> {
    this.removedChannels.push(channel);
  }
}

function expectRepositoryError(code: string) {
  return expect.objectContaining({ name: "GroupRepositoryError", code });
}

describe("Supabase browser configuration", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    createBrowserClient.mockClear();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it.each([
    ["", "key"],
    ["https://example.supabase.co", "   "],
    ["not a url", "key"],
  ])("rejects incomplete or malformed configuration", (url, key) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;

    expect(() => createSupabaseBrowserClient()).toThrow(
      expect.objectContaining({
        name: "SupabaseConfigurationError",
        code: "MISSING_SUPABASE_CONFIG",
      }),
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("constructs the typed client without exposing the key in errors", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-secret-value";

    expect(createSupabaseBrowserClient()).toEqual({ browser: true });
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-secret-value",
    );
    expect(SupabaseConfigurationError).toBeDefined();
  });
});

describe("group repository", () => {
  it("reuses an existing valid session", async () => {
    const client = new FakeSupabaseClient();

    await expect(createGroupRepository(client).ensureAnonymousSession()).resolves.toBe(
      "user-1",
    );
  });

  it("creates an anonymous session when none exists", async () => {
    const client = new FakeSupabaseClient();
    client.session = null;

    await expect(createGroupRepository(client).ensureAnonymousSession()).resolves.toBe(
      "anon-1",
    );
  });

  it("wraps authentication failures without leaking their details", async () => {
    const client = new FakeSupabaseClient();
    client.session = null;
    client.anonymousResult = {
      data: { user: null },
      error: new Error("secret upstream auth detail"),
    };

    await expect(createGroupRepository(client).ensureAnonymousSession()).rejects.toEqual(
      expectRepositoryError("AUTH_FAILED"),
    );
    await createGroupRepository(client)
      .ensureAnonymousSession()
      .catch((error: GroupRepositoryError) => {
        expect(error.message).not.toContain("secret upstream auth detail");
        expect(error.cause).toBeInstanceOf(Error);
      });
  });

  it("creates a group with the exact safe derived profile payload", async () => {
    const client = new FakeSupabaseClient();
    client.rpcResults.set("create_group_and_join", {
      data: [{ group_id: "group-1", member_id: "member-1", invite_token: "token" }],
      error: null,
    });

    await expect(
      createGroupRepository(client).createGroup({ name: "Friends", nickname: "Mofu", profile }),
    ).resolves.toEqual({ groupId: "group-1", memberId: "member-1", inviteToken: "token" });
    expect(client.rpcCalls).toEqual([
      {
        name: "create_group_and_join",
        args: {
          p_name: "Friends",
          p_nickname: "Mofu",
          p_animal_id: "fawn",
          p_animal_group: "MOON",
          p_mbti: null,
          p_profile_payload: profile,
        },
      },
    ]);
    expect(JSON.stringify(client.rpcCalls)).not.toMatch(/birthDate|birthTime/);
  });

  it("joins a group with the exact safe payload and no nested raw birth keys", async () => {
    const client = new FakeSupabaseClient();
    const nestedSource = Object.assign({}, profile) as DerivedProfile & {
      ignored?: { birthDate: string; birthTime: string };
    };
    nestedSource.ignored = { birthDate: "2000-01-01", birthTime: "12:00" };
    client.rpcResults.set("join_group", {
      data: [{ group_id: "group-1", member_id: "member-2" }],
      error: null,
    });

    await expect(
      createGroupRepository(client).joinGroup({
        inviteToken: "token",
        nickname: "Friend",
        profile: nestedSource,
      }),
    ).resolves.toEqual({ groupId: "group-1", memberId: "member-2" });
    expect(client.rpcCalls[0]).toEqual({
      name: "join_group",
      args: {
        p_invite_token: "token",
        p_nickname: "Friend",
        p_animal_id: "fawn",
        p_animal_group: "MOON",
        p_mbti: null,
        p_profile_payload: profile,
      },
    });
    expect(JSON.stringify(client.rpcCalls)).not.toMatch(/birthDate|birthTime|ignored/);
  });

  it.each(invalidRpcRowSets)(
    "rejects empty or multiple RPC rows",
    async (data) => {
      const client = new FakeSupabaseClient();
      client.rpcResults.set("join_group", { data, error: null });

      await expect(
        createGroupRepository(client).joinGroup({ inviteToken: "token", nickname: "Mofu", profile }),
      ).rejects.toEqual(expectRepositoryError("INVALID_DATA"));
    },
  );

  it("wraps create and join RPC errors with operation-specific codes", async () => {
    const client = new FakeSupabaseClient();
    client.rpcResults.set("create_group_and_join", { data: null, error: new Error("private") });
    client.rpcResults.set("join_group", { data: null, error: new Error("private") });
    const repository = createGroupRepository(client);

    await expect(
      repository.createGroup({ name: "Friends", nickname: "Mofu", profile }),
    ).rejects.toEqual(expectRepositoryError("CREATE_FAILED"));
    await expect(
      repository.joinGroup({ inviteToken: "token", nickname: "Mofu", profile }),
    ).rejects.toEqual(expectRepositoryError("JOIN_FAILED"));
  });

  it("wraps rejected RPC promises with operation-specific codes", async () => {
    const client = new FakeSupabaseClient();
    client.rejectedRpcs.set("create_group_and_join", new Error("private rejection"));
    client.rejectedRpcs.set("unlock_relation_mock", new Error("private rejection"));
    const repository = createGroupRepository(client);

    await expect(
      repository.createGroup({ name: "Friends", nickname: "Mofu", profile }),
    ).rejects.toEqual(expectRepositoryError("CREATE_FAILED"));
    await expect(
      repository.unlockPair("group-1", "member-1", "member-2"),
    ).rejects.toEqual(expectRepositoryError("UNLOCK_FAILED"));
  });

  it("loads and maps a group aggregate using only required selected columns", async () => {
    const client = new FakeSupabaseClient();
    client.tableResults.set("groups", { data: groupRow, error: null });
    client.tableResults.set("group_members", { data: [memberRow], error: null });
    client.tableResults.set("relation_unlocks", { data: [unlockRow], error: null });

    await expect(createGroupRepository(client).loadGroup("group-1")).resolves.toEqual({
      group: { id: "group-1", name: "Friends", maxMembers: 30, createdAt: groupRow.created_at },
      members: [
        {
          id: "member-1",
          groupId: "group-1",
          userId: "user-1",
          nickname: "Mofu",
          animalId: "fawn",
          animalGroup: "MOON",
          mbti: null,
          profile,
          joinedAt: memberRow.joined_at,
        },
      ],
      unlocks: [
        {
          id: "unlock-1",
          groupId: "group-1",
          memberLowId: "member-1",
          memberHighId: "member-2",
          status: "unlocked",
          paymentProvider: "mock",
          paymentReference: null,
          unlockedBy: "user-1",
          unlockedAt: unlockRow.unlocked_at,
        },
      ],
    });
    expect(client.queries.get("groups")?.selected).toBe("id,name,max_members,created_at");
    expect(client.queries.get("group_members")?.selected).toBe(
      "id,group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload,joined_at",
    );
    expect(client.queries.get("relation_unlocks")?.selected).toBe(
      "id,group_id,member_low_id,member_high_id,status,payment_provider,payment_reference,unlocked_by,unlocked_at",
    );
    expect(client.queries.get("groups")?.selected).not.toMatch(/invite_token_hash|created_by/);
  });

  it("distinguishes a missing group from other load errors", async () => {
    const missing = new FakeSupabaseClient();
    missing.tableResults.set("groups", { data: null, error: null });
    await expect(createGroupRepository(missing).loadGroup("missing")).rejects.toEqual(
      expectRepositoryError("NOT_FOUND"),
    );

    const failed = new FakeSupabaseClient();
    failed.tableResults.set("groups", { data: null, error: new Error("private") });
    await expect(createGroupRepository(failed).loadGroup("group-1")).rejects.toEqual(
      expectRepositoryError("LOAD_FAILED"),
    );

    const rejected = new FakeSupabaseClient();
    rejected.rejectedTables.set("groups", new Error("private rejection"));
    await expect(createGroupRepository(rejected).loadGroup("group-1")).rejects.toEqual(
      expectRepositoryError("LOAD_FAILED"),
    );
  });

  it.each([
    [{ ...memberRow, profile_payload: "not-json-object" }],
    [{ ...memberRow, animal_group: "STARS" }],
    [{ ...memberRow, animal_id: "dragon" }],
    [{ ...memberRow, profile_payload: { ...profile, animalId: "wolf" } }],
  ])("rejects invalid member row data", (row) => {
    expect(() => mapGroupMember(row)).toThrow(expectRepositoryError("INVALID_DATA"));
  });

  it("maps unlock rows and rejects malformed unlock data", () => {
    expect(mapRelationUnlock(unlockRow)).toMatchObject({
      id: "unlock-1",
      memberLowId: "member-1",
      status: "unlocked",
    });
    expect(() => mapRelationUnlock({ ...unlockRow, status: "paid-ish" })).toThrow(
      expectRepositoryError("INVALID_DATA"),
    );
  });

  it("unlocks a pair through the canonicalizing RPC and maps its only row", async () => {
    const client = new FakeSupabaseClient();
    client.rpcResults.set("unlock_relation_mock", { data: [unlockRow], error: null });

    await expect(
      createGroupRepository(client).unlockPair("group-1", "member-2", "member-1"),
    ).resolves.toMatchObject({ id: "unlock-1", memberLowId: "member-1" });
    expect(client.rpcCalls[0]).toEqual({
      name: "unlock_relation_mock",
      args: { p_group_id: "group-1", p_member_a: "member-2", p_member_b: "member-1" },
    });

    client.rpcResults.set("unlock_relation_mock", { data: null, error: new Error("private") });
    await expect(
      createGroupRepository(client).unlockPair("group-1", "member-1", "member-2"),
    ).rejects.toEqual(expectRepositoryError("UNLOCK_FAILED"));
  });

  it("subscribes once per table/event, maps events, reports status, and cleans up once", async () => {
    const client = new FakeSupabaseClient();
    const members = vi.fn();
    const unlocks = vi.fn();
    const statuses = vi.fn();
    const errors = vi.fn();

    const cleanup = createGroupRepository(client).subscribeToGroup("group-1", {
      onMemberChange: members,
      onUnlockChange: unlocks,
      onConnectionStatus: statuses,
      onError: errors,
    });
    const channel = client.channels[0];

    expect(channel.registrations).toHaveLength(6);
    expect(
      channel.registrations.map(({ table, event, filter }) => ({ table, event, filter })),
    ).toEqual([
      { table: "group_members", event: "INSERT", filter: "group_id=eq.group-1" },
      { table: "group_members", event: "UPDATE", filter: "group_id=eq.group-1" },
      { table: "group_members", event: "DELETE", filter: "group_id=eq.group-1" },
      { table: "relation_unlocks", event: "INSERT", filter: "group_id=eq.group-1" },
      { table: "relation_unlocks", event: "UPDATE", filter: "group_id=eq.group-1" },
      { table: "relation_unlocks", event: "DELETE", filter: "group_id=eq.group-1" },
    ]);
    channel.emit("group_members", "INSERT", memberRow);
    channel.emit("relation_unlocks", "UPDATE", unlockRow);
    expect(members).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INSERT", new: expect.objectContaining({ id: "member-1" }) }),
    );
    expect(unlocks).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "UPDATE", new: expect.objectContaining({ id: "unlock-1" }) }),
    );
    channel.statusCallback?.("SUBSCRIBED");
    expect(statuses).toHaveBeenCalledWith("SUBSCRIBED");

    await cleanup();
    await cleanup();
    expect(client.removedChannels).toEqual([channel]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("surfaces malformed realtime payloads and subscription failures safely", () => {
    const client = new FakeSupabaseClient();
    const errors = vi.fn();
    createGroupRepository(client).subscribeToGroup("group-1", { onError: errors });
    const channel = client.channels[0];

    channel.emit("group_members", "INSERT", { ...memberRow, animal_id: "dragon" });
    expect(errors).toHaveBeenCalledWith(expectRepositoryError("INVALID_DATA"));
    channel.statusCallback?.("CHANNEL_ERROR", new Error("private socket detail"));
    expect(errors).toHaveBeenCalledWith(expectRepositoryError("SUBSCRIPTION_FAILED"));
  });
});
