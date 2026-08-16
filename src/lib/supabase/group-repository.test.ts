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
  createSupabaseGroupRepositoryAdapter,
  type GroupRepositoryClient,
} from "./group-repository";
import { mapGroupMember, mapPaymentOrder, mapRelationUnlock } from "./models";
import type { DerivedEtoProfile } from "../eto/types";

const profile: DerivedEtoProfile = {
  version: 1,
  zodiacId: "dragon",
  mbti: "INFP",
  dayMaster: { element: "WOOD", polarity: "YANG" },
  fiveElements: { WOOD: 2, FIRE: 1, EARTH: 1, METAL: 1, WATER: 1 },
  yinYang: { YIN: 3, YANG: 3 },
  calculationMode: "date-only",
  boundaryState: "exact",
  engineVersion: "mofu-eto-four-pillars-v1",
};

const dateTimeProfile: DerivedEtoProfile = {
  ...profile,
  fiveElements: { WOOD: 2, FIRE: 2, EARTH: 1, METAL: 2, WATER: 1 },
  yinYang: { YIN: 4, YANG: 4 },
  calculationMode: "date-time",
};

const ambiguousProfile: DerivedEtoProfile = {
  ...profile,
  fiveElements: null,
  yinYang: null,
  boundaryState: "solar-term-ambiguous",
};

const profileWithoutEngine = {
  version: profile.version,
  zodiacId: profile.zodiacId,
  mbti: profile.mbti,
  dayMaster: profile.dayMaster,
  fiveElements: profile.fiveElements,
  yinYang: profile.yinYang,
  calculationMode: profile.calculationMode,
  boundaryState: profile.boundaryState,
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
  zodiac_id: "dragon",
  mbti: "INFP",
  profile_payload: profile,
  profile_version: 1,
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

const paymentOrderRow = {
  id: "order-1",
  group_id: "group-1",
  member_low_id: "member-1",
  member_high_id: "member-2",
  amount_jpy: 300,
  currency: "JPY",
  method: "paypay",
  status: "pending",
  provider: null,
  provider_reference: null,
  created_by: "user-1",
  created_at: "2026-08-16T00:00:00Z",
  paid_at: null,
};

const invalidRpcRowSets: unknown[][] = [
  [],
  [
    { group_id: "g", member_id: "m" },
    { group_id: "g2", member_id: "m2" },
  ],
];

type Result = { data: unknown; error: unknown };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
  registrationError?: unknown;
  subscriptionError?: unknown;
  removeCallback?: () => Promise<"ok" | "timed out" | "error">;

  on(
    _kind: "postgres_changes",
    options: { event: string; schema: string; table: string; filter: string },
    callback: (payload: Record<string, unknown>) => void,
  ) {
    if (this.registrationError !== undefined) throw this.registrationError;
    this.registrations.push({ ...options, callback });
    return this;
  }

  subscribe(callback: (status: string, error?: unknown) => void) {
    if (this.subscriptionError !== undefined) throw this.subscriptionError;
    this.statusCallback = callback;
    return this;
  }

  async remove(): Promise<"ok" | "timed out" | "error"> {
    return (await this.removeCallback?.()) ?? "ok";
  }

  emit(table: string, event: string, row: Record<string, unknown>) {
    this.registrations
      .filter((item) => item.table === table && item.event === event)
      .forEach((item) =>
        item.callback({
          eventType: event,
          new: row,
          old: {},
        }),
      );
  }

  emitRaw(table: string, event: string, payload: Record<string, unknown>) {
    this.registrations
      .filter((item) => item.table === table && item.event === event)
      .forEach((item) => item.callback(payload));
  }
}

class FakeSupabaseClient implements GroupRepositoryClient {
  session: { user: { id: string } } | null = { user: { id: "user-1" } };
  getSessionError: unknown = null;
  anonymousResult: Result & { data: { user: { id: string } | null } } = {
    data: { user: { id: "anon-1" } },
    error: null,
  };
  anonymousSignIn?: () => Promise<
    Result & { data: { user: { id: string } | null } }
  >;
  anonymousSignInCalls = 0;
  rpcResults = new Map<string, Result>();
  rejectedRpcs = new Map<string, unknown>();
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  tableResults = new Map<string, Result>();
  rejectedTables = new Map<string, unknown>();
  queries = new Map<string, FakeQuery>();
  channels: FakeChannel[] = [];
  channelNames: string[] = [];
  removedChannels: FakeChannel[] = [];
  removeChannelCalls = 0;
  channelRegistrationError?: unknown;
  channelSubscriptionError?: unknown;
  removeChannelError?: unknown;
  removeStatuses: Array<"ok" | "timed out" | "error"> = [];

  auth = {
    getSession: async () => ({
      data: { session: this.session },
      error: this.getSessionError,
    }),
    signInAnonymously: async () => {
      this.anonymousSignInCalls += 1;
      return this.anonymousSignIn?.() ?? this.anonymousResult;
    },
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

  createGroupAndJoin(args: Record<string, unknown>): Promise<Result> {
    return this.rpc("create_group_and_join", args);
  }

  joinGroup(args: Record<string, unknown>): Promise<Result> {
    return this.rpc("join_group", args);
  }

  previewGroupInvite(args: Record<string, unknown>): Promise<Result> {
    return this.rpc("get_group_invite_preview", args);
  }

  unlockRelation(args: Record<string, unknown>): Promise<Result> {
    return this.rpc("unlock_relation_mock", args);
  }

  createPaymentOrder(args: Record<string, unknown>): Promise<Result> {
    return this.rpc("create_payment_order", args);
  }

  from(table: string): FakeQuery {
    const query = new FakeQuery(
      this.tableResults.get(table) ?? { data: null, error: new Error("not configured") },
      this.rejectedTables.get(table),
    );
    this.queries.set(table, query);
    return query;
  }

  loadGroup(groupId: string): Promise<Result> {
    return this.from("groups")
      .select("id,name,max_members,created_at")
      .eq("id", groupId)
      .maybeSingle();
  }

  findJoinedGroupId(inviteTokenHash: string): Promise<Result> {
    return this.from("groups")
      .select("id")
      .eq("invite_token_hash", inviteTokenHash)
      .maybeSingle();
  }

  async loadGroupMembers(groupId: string): Promise<Result> {
    return await this.from("group_members")
      .select(
        "id,group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version,joined_at",
      )
      .eq("group_id", groupId);
  }

  async loadRelationUnlocks(groupId: string): Promise<Result> {
    return await this.from("relation_unlocks")
      .select(
        "id,group_id,member_low_id,member_high_id,status,payment_provider,payment_reference,unlocked_by,unlocked_at",
      )
      .eq("group_id", groupId);
  }

  channel(name: string): FakeChannel {
    this.channelNames.push(name);
    const channel = new FakeChannel();
    channel.registrationError = this.channelRegistrationError;
    channel.subscriptionError = this.channelSubscriptionError;
    channel.removeCallback = () => this.removeChannel(channel);
    this.channels.push(channel);
    return channel;
  }

  async removeChannel(
    channel: FakeChannel,
  ): Promise<"ok" | "timed out" | "error"> {
    this.removeChannelCalls += 1;
    if (this.removeChannelError !== undefined) throw this.removeChannelError;
    this.removedChannels.push(channel);
    return this.removeStatuses.shift() ?? "ok";
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

  it("wraps a throwing browser client factory without leaking its secrets", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://secret-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "secret-key-value";
    const cause = new Error("factory saw secret-key-value");
    const factory = vi.fn(() => {
      throw cause;
    });

    try {
      createSupabaseBrowserClient(factory);
      throw new Error("expected configuration failure");
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          name: "SupabaseConfigurationError",
          code: "MISSING_SUPABASE_CONFIG",
          cause,
        }),
      );
      expect((error as Error).message).not.toMatch(/secret-key-value|secret-project/);
    }
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

  it("single-flights simultaneous anonymous sign-ins and retries after failure", async () => {
    const client = new FakeSupabaseClient();
    client.session = null;
    const first = deferred<
      Result & { data: { user: { id: string } | null } }
    >();
    client.anonymousSignIn = () => first.promise;
    const repository = createGroupRepository(client);

    const firstCall = repository.ensureAnonymousSession();
    const secondCall = repository.ensureAnonymousSession();
    await Promise.resolve();
    expect(client.anonymousSignInCalls).toBe(1);
    first.resolve({ data: { user: { id: "shared-anon" } }, error: null });
    await expect(Promise.all([firstCall, secondCall])).resolves.toEqual([
      "shared-anon",
      "shared-anon",
    ]);

    const failure = deferred<
      Result & { data: { user: { id: string } | null } }
    >();
    client.anonymousSignIn = () => failure.promise;
    const failedCall = repository.ensureAnonymousSession();
    await Promise.resolve();
    failure.reject(new Error("private auth failure"));
    await expect(failedCall).rejects.toEqual(expectRepositoryError("AUTH_FAILED"));
    client.anonymousSignIn = async () => ({
      data: { user: { id: "retry-anon" } },
      error: null,
    });
    await expect(repository.ensureAnonymousSession()).resolves.toBe("retry-anon");
    expect(client.anonymousSignInCalls).toBe(3);
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
          p_zodiac_id: "dragon",
          p_mbti: "INFP",
          p_profile_payload: profile,
        },
      },
    ]);
    const sentProfile = client.rpcCalls[0].args.p_profile_payload as Record<string, unknown>;
    expect(sentProfile).not.toBe(profile);
    expect(sentProfile.dayMaster).not.toBe(profile.dayMaster);
    expect(sentProfile.fiveElements).not.toBe(profile.fiveElements);
    expect(sentProfile.yinYang).not.toBe(profile.yinYang);
    expect(JSON.stringify(client.rpcCalls)).not.toMatch(/birthDate|birthTime/);
  });

  it("preserves null distributions while cloning an ambiguous profile", async () => {
    const client = new FakeSupabaseClient();
    client.rpcResults.set("create_group_and_join", {
      data: [{ group_id: "group-1", member_id: "member-1", invite_token: "token" }],
      error: null,
    });

    await createGroupRepository(client).createGroup({
      name: "Friends",
      nickname: "Mofu",
      profile: ambiguousProfile,
    });

    expect(client.rpcCalls[0].args.p_profile_payload).toEqual(ambiguousProfile);
    expect(client.rpcCalls[0].args.p_profile_payload).not.toBe(ambiguousProfile);
  });

  it("recursively excludes raw birth keys from create payloads", async () => {
    const client = new FakeSupabaseClient();
    const source = Object.assign({}, profile) as DerivedEtoProfile & {
      raw?: { birthDate: string; nested: { birthTime: string } };
    };
    source.raw = { birthDate: "2000-01-01", nested: { birthTime: "12:00" } };
    client.rpcResults.set("create_group_and_join", {
      data: [{ group_id: "group-1", member_id: "member-1", invite_token: "token" }],
      error: null,
    });

    await createGroupRepository(client).createGroup({
      name: "Friends",
      nickname: "Mofu",
      profile: source,
    });
    expect(JSON.stringify(client.rpcCalls)).not.toMatch(/birthDate|birthTime|raw|nested/);
  });

  it("joins a group with the exact safe payload and no nested raw birth keys", async () => {
    const client = new FakeSupabaseClient();
    const nestedSource = Object.assign({}, profile) as DerivedEtoProfile & {
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
        p_zodiac_id: "dragon",
        p_mbti: "INFP",
        p_profile_payload: profile,
      },
    });
    expect(JSON.stringify(client.rpcCalls)).not.toMatch(/birthDate|birthTime|ignored/);
  });

  it.each(["create_group_and_join", "join_group"] as const)(
    "rejects empty or multiple %s RPC rows",
    async (rpcName) => {
      for (const data of invalidRpcRowSets) {
        const client = new FakeSupabaseClient();
        client.rpcResults.set(rpcName, { data, error: null });
        const repository = createGroupRepository(client);

        await expect(
          rpcName === "create_group_and_join"
            ? repository.createGroup({ name: "Friends", nickname: "Mofu", profile })
            : repository.joinGroup({ inviteToken: "token", nickname: "Mofu", profile }),
        ).rejects.toEqual(expectRepositoryError("INVALID_DATA"));
      }
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
          zodiacId: "dragon",
          mbti: "INFP",
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
      "id,group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version,joined_at",
    );
    expect(client.queries.get("relation_unlocks")?.selected).toBe(
      "id,group_id,member_low_id,member_high_id,status,payment_provider,payment_reference,unlocked_by,unlocked_at",
    );
    expect(client.queries.get("groups")?.selected).not.toMatch(/invite_token_hash|created_by/);
  });

  it("rejects invalid group rows", async () => {
    const client = new FakeSupabaseClient();
    client.tableResults.set("groups", {
      data: { ...groupRow, max_members: "thirty" },
      error: null,
    });
    client.tableResults.set("group_members", { data: [], error: null });
    client.tableResults.set("relation_unlocks", { data: [], error: null });

    await expect(createGroupRepository(client).loadGroup("group-1")).rejects.toEqual(
      expectRepositoryError("INVALID_DATA"),
    );
  });

  it.each(["group_members", "relation_unlocks"])(
    "wraps %s query errors as LOAD_FAILED",
    async (table) => {
      const client = new FakeSupabaseClient();
      client.tableResults.set("groups", { data: groupRow, error: null });
      client.tableResults.set("group_members", { data: [], error: null });
      client.tableResults.set("relation_unlocks", { data: [], error: null });
      client.tableResults.set(table, { data: null, error: new Error("private load detail") });

      await expect(createGroupRepository(client).loadGroup("group-1")).rejects.toEqual(
        expectRepositoryError("LOAD_FAILED"),
      );
    },
  );

  it.each([
    ["group_members", null],
    ["relation_unlocks", {}],
    ["group_members", [{ ...memberRow, profile_payload: { version: 9 } }]],
    ["relation_unlocks", [{ ...unlockRow, status: "unknown" }]],
  ])("rejects invalid %s collections or rows", async (table, data) => {
    const client = new FakeSupabaseClient();
    client.tableResults.set("groups", { data: groupRow, error: null });
    client.tableResults.set("group_members", { data: [], error: null });
    client.tableResults.set("relation_unlocks", { data: [], error: null });
    client.tableResults.set(table, { data, error: null });

    await expect(createGroupRepository(client).loadGroup("group-1")).rejects.toEqual(
      expectRepositoryError("INVALID_DATA"),
    );
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
    ["date-only", profile],
    ["date-time", dateTimeProfile],
    ["solar-term ambiguity", ambiguousProfile],
  ])("maps a valid %s Eto profile", (_name, validProfile) => {
    expect(
      mapGroupMember({
        ...memberRow,
        mbti: validProfile.mbti,
        profile_payload: validProfile,
      }),
    ).toEqual({
      id: "member-1",
      groupId: "group-1",
      userId: "user-1",
      nickname: "Mofu",
      zodiacId: "dragon",
      mbti: validProfile.mbti,
      profile: validProfile,
      joinedAt: memberRow.joined_at,
    });
  });

  it.each([
    ["non-object profile", { ...memberRow, profile_payload: "not-json-object" }],
    ["legacy member keys", { ...memberRow, animal_id: "fawn", animal_group: "MOON" }],
    ["legacy profile keys", { ...memberRow, profile_payload: { ...profile, animalId: "fawn", animalGroup: "MOON" } }],
    ["extra member key", { ...memberRow, raw_secret: "private-secret" }],
    ["extra profile key", { ...memberRow, profile_payload: { ...profile, raw: "private-secret" } }],
    ["missing profile key", { ...memberRow, profile_payload: profileWithoutEngine }],
    ["wrong day-master keys", { ...memberRow, profile_payload: { ...profile, dayMaster: { element: "WOOD", yin: "YANG" } } }],
    ["extra element key", { ...memberRow, profile_payload: { ...profile, fiveElements: { ...profile.fiveElements, VOID: 0 } } }],
    ["missing polarity key", { ...memberRow, profile_payload: { ...profile, yinYang: { YIN: 6 } } }],
    ["zodiac scalar mismatch", { ...memberRow, zodiac_id: "rat" }],
    ["MBTI scalar mismatch", { ...memberRow, mbti: null }],
    ["profile version mismatch", { ...memberRow, profile_version: 2 }],
    ["invalid scalar profile version", { ...memberRow, profile_version: 1.5 }],
    ["invalid zodiac", { ...memberRow, zodiac_id: "phoenix", profile_payload: { ...profile, zodiacId: "phoenix" } }],
    ["invalid MBTI", { ...memberRow, mbti: "XXXX", profile_payload: { ...profile, mbti: "XXXX" } }],
    ["invalid day-master enum", { ...memberRow, profile_payload: { ...profile, dayMaster: { element: "LIGHT", polarity: "YANG" } } }],
    ["negative count", { ...memberRow, profile_payload: { ...profile, fiveElements: { ...profile.fiveElements, WOOD: -1, FIRE: 4 } } }],
    ["fractional count", { ...memberRow, profile_payload: { ...profile, yinYang: { YIN: 2.5, YANG: 3.5 } } }],
    ["wrong date-only total", { ...memberRow, profile_payload: { ...profile, yinYang: { YIN: 4, YANG: 4 } } }],
    ["wrong date-time total", { ...memberRow, profile_payload: { ...dateTimeProfile, fiveElements: { ...dateTimeProfile.fiveElements, WOOD: 0 } } }],
    ["one null distribution", { ...memberRow, profile_payload: { ...profile, fiveElements: null } }],
    ["exact null distributions", { ...memberRow, profile_payload: { ...profile, fiveElements: null, yinYang: null } }],
    ["ambiguous counts", { ...memberRow, profile_payload: { ...ambiguousProfile, fiveElements: profile.fiveElements, yinYang: profile.yinYang } }],
    ["ambiguous date-time", { ...memberRow, profile_payload: { ...ambiguousProfile, calculationMode: "date-time" } }],
    ["invalid boundary state", { ...memberRow, profile_payload: { ...profile, boundaryState: "close-enough" } }],
    ["invalid calculation mode", { ...memberRow, profile_payload: { ...profile, calculationMode: "approximate" } }],
    ["invalid version", { ...memberRow, profile_payload: { ...profile, version: 2 } }],
    ["invalid engine", { ...memberRow, profile_payload: { ...profile, engineVersion: "private-engine-v2" } }],
  ])("rejects invalid member row data: %s", (_name, row) => {
    expect(() => mapGroupMember(row)).toThrow(expectRepositoryError("INVALID_DATA"));
  });

  it("normalizes hostile getters and proxies to a generic safe error", () => {
    const getterSecret = "raw-private-getter-secret";
    const hostileProfile = Object.defineProperty({ ...profile }, "zodiacId", {
      enumerable: true,
      get() {
        throw new Error(getterSecret);
      },
    });
    const hostileProxy = new Proxy(memberRow, {
      ownKeys() {
        throw new Error("raw-private-proxy-secret");
      },
    });

    for (const row of [
      { ...memberRow, profile_payload: hostileProfile },
      hostileProxy,
    ]) {
      try {
        mapGroupMember(row);
        throw new Error("expected invalid data");
      } catch (error) {
        expect(error).toEqual(expectRepositoryError("INVALID_DATA"));
        expect((error as Error).message).toBe("Supabase returned invalid group data.");
        expect(String(error)).not.toMatch(/raw-private-(getter|proxy)-secret/);
      }
    }
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

  it("maps exact pending and paid payment orders and rejects inconsistent data", () => {
    expect(mapPaymentOrder(paymentOrderRow)).toEqual({
      id: "order-1",
      groupId: "group-1",
      memberLowId: "member-1",
      memberHighId: "member-2",
      amountJpy: 300,
      currency: "JPY",
      method: "paypay",
      status: "pending",
      provider: null,
      providerReference: null,
      createdBy: "user-1",
      createdAt: "2026-08-16T00:00:00Z",
      paidAt: null,
    });
    expect(mapPaymentOrder({
      ...paymentOrderRow,
      status: "paid",
      provider: "mock",
      provider_reference: "ref-1",
      paid_at: "2026-08-16T00:01:00Z",
    })).toMatchObject({ status: "paid", provider: "mock", providerReference: "ref-1" });

    for (const invalid of [
      { ...paymentOrderRow, amount_jpy: 301 },
      { ...paymentOrderRow, currency: "USD" },
      { ...paymentOrderRow, method: "cash" },
      { ...paymentOrderRow, provider: "forged" },
      { ...paymentOrderRow, status: "paid" },
      { ...paymentOrderRow, private_secret: "must-not-pass" },
    ]) {
      expect(() => mapPaymentOrder(invalid)).toThrow(expectRepositoryError("INVALID_DATA"));
    }
  });

  it("creates a fixed-price pending order through the canonical server RPC", async () => {
    const client = new FakeSupabaseClient();
    client.rpcResults.set("create_payment_order", { data: [paymentOrderRow], error: null });

    await expect(createGroupRepository(client).createPaymentOrder(
      "group-1", "member-2", "member-1", "paypay",
    )).resolves.toMatchObject({ id: "order-1", amountJpy: 300, status: "pending" });
    expect(client.rpcCalls[0]).toEqual({
      name: "create_payment_order",
      args: {
        p_group_id: "group-1",
        p_member_a: "member-2",
        p_member_b: "member-1",
        p_method: "paypay",
      },
    });

    client.rpcResults.set("create_payment_order", {
      data: null,
      error: new Error("private payment details"),
    });
    await expect(createGroupRepository(client).createPaymentOrder(
      "group-1", "member-1", "member-2", "card",
    )).rejects.toEqual(expectRepositoryError("PAYMENT_FAILED"));
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

  it.each(invalidRpcRowSets)("rejects empty or multiple unlock rows", async (data) => {
    const client = new FakeSupabaseClient();
    client.rpcResults.set("unlock_relation_mock", { data, error: null });

    await expect(
      createGroupRepository(client).unlockPair("group-1", "member-1", "member-2"),
    ).rejects.toEqual(expectRepositoryError("INVALID_DATA"));
  });

  it("subscribes only to group-filtered INSERT/UPDATE events and cleans up once", async () => {
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

    expect(channel.registrations).toHaveLength(4);
    expect(
      channel.registrations.map(({ table, event, filter }) => ({ table, event, filter })),
    ).toEqual([
      { table: "group_members", event: "INSERT", filter: "group_id=eq.group-1" },
      { table: "group_members", event: "UPDATE", filter: "group_id=eq.group-1" },
      { table: "relation_unlocks", event: "INSERT", filter: "group_id=eq.group-1" },
      { table: "relation_unlocks", event: "UPDATE", filter: "group_id=eq.group-1" },
    ]);
    expect(channel.registrations.some(({ event }) => event === "DELETE")).toBe(false);
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

  it("uses a unique realtime topic for overlapping subscriptions to one group", async () => {
    const client = new FakeSupabaseClient();
    const repository = createGroupRepository(client);

    const cleanupFirst = repository.subscribeToGroup("group-1", {});
    const cleanupSecond = repository.subscribeToGroup("group-1", {});

    expect(client.channelNames).toHaveLength(2);
    expect(new Set(client.channelNames).size).toBe(2);
    expect(client.channelNames.every((name) => name.startsWith("group:group-1:"))).toBe(true);

    await cleanupFirst();
    await cleanupSecond();
  });

  it("surfaces malformed realtime payloads and subscription failures safely", () => {
    const client = new FakeSupabaseClient();
    const errors = vi.fn();
    createGroupRepository(client).subscribeToGroup("group-1", { onError: errors });
    const channel = client.channels[0];

    channel.emit("group_members", "INSERT", { ...memberRow, zodiac_id: "not-a-zodiac" });
    expect(errors).toHaveBeenCalledWith(expectRepositoryError("INVALID_DATA"));
    channel.statusCallback?.("CHANNEL_ERROR", new Error("private socket detail"));
    expect(errors).toHaveBeenCalledWith(expectRepositoryError("SUBSCRIPTION_FAILED"));
    channel.statusCallback?.("TIMED_OUT", new Error("private timeout detail"));
    expect(errors).toHaveBeenCalledWith(expectRepositoryError("SUBSCRIPTION_FAILED"));
    expect(errors.mock.calls.flatMap((call) => call).map(String).join(" ")).not.toMatch(
      /private socket detail|private timeout detail/,
    );
  });

  it("wraps synchronous registration failures", () => {
    const client = new FakeSupabaseClient();
    client.channelRegistrationError = new Error("private registration detail");

    try {
      createGroupRepository(client).subscribeToGroup("group-1", {});
      throw new Error("expected subscription failure");
    } catch (error) {
      expect(error).toEqual(expectRepositoryError("SUBSCRIPTION_FAILED"));
      expect((error as Error).message).not.toContain("private registration detail");
    }
  });

  it.each(["on", "subscribe"] as const)(
    "best-effort removes a channel when %s registration throws without masking it",
    async (failurePoint) => {
      const client = new FakeSupabaseClient();
      const registrationCause = new Error("private registration detail");
      if (failurePoint === "on") {
        client.channelRegistrationError = registrationCause;
      } else {
        client.channelSubscriptionError = registrationCause;
      }
      client.removeChannelError = new Error("private removal detail");

      try {
        createGroupRepository(client).subscribeToGroup("group-1", {});
        throw new Error("expected subscription failure");
      } catch (error) {
        expect(error).toEqual(expectRepositoryError("SUBSCRIPTION_FAILED"));
        expect((error as Error & { cause?: unknown }).cause).toBe(registrationCause);
      }
      await Promise.resolve();
      expect(client.removeChannelCalls).toBe(1);
    },
  );

  it("isolates throwing consumer callbacks from realtime delivery", () => {
    const client = new FakeSupabaseClient();
    const onError = vi.fn(() => {
      throw new Error("consumer onError failure");
    });
    createGroupRepository(client).subscribeToGroup("group-1", {
      onMemberChange: () => {
        throw new Error("consumer member failure");
      },
      onUnlockChange: () => {
        throw new Error("consumer unlock failure");
      },
      onConnectionStatus: () => {
        throw new Error("consumer status failure");
      },
      onError,
    });
    const channel = client.channels[0];

    expect(() => channel.emit("group_members", "INSERT", memberRow)).not.toThrow();
    expect(() => channel.emit("relation_unlocks", "UPDATE", unlockRow)).not.toThrow();
    expect(onError).not.toHaveBeenCalled();
    expect(() => channel.statusCallback?.("CHANNEL_ERROR", new Error("socket"))).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(() =>
      channel.emitRaw("group_members", "INSERT", {
        eventType: "INSERT",
        new: { ...memberRow, zodiac_id: "not-a-zodiac" },
        old: {},
      }),
    ).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("reports cleanup exceptions stably and keeps cleanup retryable", async () => {
    const client = new FakeSupabaseClient();
    client.removeChannelError = new Error("private cleanup detail");
    const errors = vi.fn();
    const cleanup = createGroupRepository(client).subscribeToGroup("group-1", {
      onError: errors,
    });

    await cleanup();
    await cleanup();
    expect(client.removeChannelCalls).toBe(2);
    expect(errors).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalledWith(expectRepositoryError("SUBSCRIPTION_FAILED"));
    expect((errors.mock.calls[0][0] as Error).message).not.toContain("private cleanup detail");
  });

  it.each(["timed out", "error"] as const)(
    "keeps cleanup retryable when removeChannel returns %s",
    async (status) => {
      const client = new FakeSupabaseClient();
      client.removeStatuses.push(status, "ok");
      const errors = vi.fn(() => {
        throw new Error("consumer cleanup callback failure");
      });
      const cleanup = createGroupRepository(client).subscribeToGroup("group-1", {
        onError: errors,
      });

      await expect(cleanup()).resolves.toBeUndefined();
      await expect(cleanup()).resolves.toBeUndefined();
      await cleanup();
      expect(client.removedChannels).toHaveLength(2);
      expect(errors).toHaveBeenCalledTimes(1);
      expect(errors).toHaveBeenCalledWith(expectRepositoryError("SUBSCRIPTION_FAILED"));
    },
  );
});

describe("production Supabase adapter", () => {
  it("forwards exact typed operations, selects, realtime status, and cleanup", async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    let realtimeCallback: ((payload: Record<string, unknown>) => void) | undefined;
    let statusCallback: ((status: string, error?: unknown) => void) | undefined;
    const nativeChannel = {
      on(kind: string, options: unknown, callback: (payload: Record<string, unknown>) => void) {
        calls.push({ kind: "channel.on", value: { kind, options } });
        realtimeCallback = callback;
        return this;
      },
      subscribe(callback: (status: string, error?: unknown) => void) {
        statusCallback = callback;
        return this;
      },
    };
    class AdapterQuery {
      private columns = "";
      private filter: [string, unknown] | undefined;

      constructor(private readonly table: string) {}

      select(columns: string) {
        this.columns = columns;
        return this;
      }

      eq(column: string, value: unknown) {
        this.filter = [column, value];
        return this;
      }

      maybeSingle() {
        calls.push({
          kind: "query",
          value: { table: this.table, columns: this.columns, filter: this.filter, single: true },
        });
        return Promise.resolve({ data: groupRow, error: null });
      }

      then<TResult1 = Result, TResult2 = never>(
        onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        calls.push({
          kind: "query",
          value: { table: this.table, columns: this.columns, filter: this.filter, single: false },
        });
        return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
      }
    }
    const transport = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInAnonymously: async () => ({ data: { user: null }, error: null }),
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ kind: "rpc", value: { name, args } });
        return { data: [], error: null };
      },
      from: (table: string) => new AdapterQuery(table),
      channel: (name: string) => {
        calls.push({ kind: "channel", value: name });
        return nativeChannel;
      },
      removeChannel: async (channel: unknown) => {
        calls.push({ kind: "removeChannel", value: channel });
        return "timed out" as const;
      },
    };
    const adapter = createSupabaseGroupRepositoryAdapter(
      transport as unknown as Parameters<
        typeof createSupabaseGroupRepositoryAdapter
      >[0],
    );
    const createArgs = {
      p_name: "Friends",
      p_nickname: "Mofu",
      p_zodiac_id: "dragon",
      p_mbti: "INFP",
      p_profile_payload: { ...profile },
    };
    const joinArgs = {
      p_invite_token: "token",
      p_nickname: "Mofu",
      p_zodiac_id: "dragon",
      p_mbti: "INFP",
      p_profile_payload: { ...profile },
    };

    await adapter.createGroupAndJoin(createArgs);
    await adapter.joinGroup(joinArgs);
    await adapter.unlockRelation({
      p_group_id: "group-1",
      p_member_a: "member-1",
      p_member_b: "member-2",
    });
    await adapter.createPaymentOrder({
      p_group_id: "group-1",
      p_member_a: "member-1",
      p_member_b: "member-2",
      p_method: "paypay",
    });
    await adapter.loadGroup("group-1");
    await adapter.loadGroupMembers("group-1");
    await adapter.loadRelationUnlocks("group-1");

    expect(calls.filter(({ kind }) => kind === "rpc").map(({ value }) => value)).toEqual([
      { name: "create_group_and_join", args: createArgs },
      { name: "join_group", args: joinArgs },
      {
        name: "unlock_relation_mock",
        args: { p_group_id: "group-1", p_member_a: "member-1", p_member_b: "member-2" },
      },
      {
        name: "create_payment_order",
        args: {
          p_group_id: "group-1",
          p_member_a: "member-1",
          p_member_b: "member-2",
          p_method: "paypay",
        },
      },
    ]);
    expect(calls.filter(({ kind }) => kind === "query").map(({ value }) => value)).toEqual([
      {
        table: "groups",
        columns: "id,name,max_members,created_at",
        filter: ["id", "group-1"],
        single: true,
      },
      {
        table: "group_members",
        columns:
          "id,group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version,joined_at",
        filter: ["group_id", "group-1"],
        single: false,
      },
      {
        table: "relation_unlocks",
        columns:
          "id,group_id,member_low_id,member_high_id,status,payment_provider,payment_reference,unlocked_by,unlocked_at",
        filter: ["group_id", "group-1"],
        single: false,
      },
    ]);

    const channel = adapter.channel("group:group-1");
    const changes = vi.fn();
    const statuses = vi.fn();
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "group_members",
        filter: "group_id=eq.group-1",
      },
      changes,
    );
    channel.subscribe(statuses);
    realtimeCallback?.({ eventType: "INSERT", new: memberRow, old: {} });
    statusCallback?.("SUBSCRIBED");
    expect(calls).toContainEqual({ kind: "channel", value: "group:group-1" });
    expect(calls).toContainEqual({
      kind: "channel.on",
      value: {
        kind: "postgres_changes",
        options: {
          event: "INSERT",
          schema: "public",
          table: "group_members",
          filter: "group_id=eq.group-1",
        },
      },
    });
    expect(changes).toHaveBeenCalledWith({ eventType: "INSERT", new: memberRow, old: {} });
    expect(statuses).toHaveBeenCalledWith("SUBSCRIBED", undefined);
    await expect(channel.remove()).resolves.toBe("timed out");
    expect(calls).toContainEqual({ kind: "removeChannel", value: nativeChannel });
  });
});
