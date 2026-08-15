import { describe, expect, it, vi } from "vitest";

import { createGroupRepository, createSupabaseGroupRepositoryAdapter } from "./group-repository";

const token = "a".repeat(64);
const expectedHash = "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb";
const group = {
  id: "group-1",
  name: "なかまたち",
  max_members: 30,
  created_at: "2026-08-15T00:00:00Z",
};

function client(findResult: { data: unknown; error: unknown }) {
  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } }, error: null }),
      signInAnonymously: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    findJoinedGroupId: vi.fn(async () => findResult),
    loadGroup: vi.fn(async () => ({ data: group, error: null })),
    loadGroupMembers: vi.fn(async () => ({ data: [], error: null })),
    loadRelationUnlocks: vi.fn(async () => ({ data: [], error: null })),
  };
}

describe("findJoinedGroupByInviteToken", () => {
  it("hashes the raw token with browser SHA-256 and loads the matching aggregate", async () => {
    const fake = client({ data: { id: "group-1" }, error: null });

    await expect(
      createGroupRepository(fake as never).findJoinedGroupByInviteToken(token),
    ).resolves.toEqual({
      group: { id: "group-1", name: "なかまたち", maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
      members: [],
      unlocks: [],
    });
    expect(fake.findJoinedGroupId).toHaveBeenCalledWith(expectedHash);
    expect(JSON.stringify(await fake.findJoinedGroupId.mock.results[0]?.value)).not.toContain(expectedHash);
  });

  it("returns null when RLS exposes no matching joined group", async () => {
    const fake = client({ data: null, error: null });
    await expect(createGroupRepository(fake as never).findJoinedGroupByInviteToken(token)).resolves.toBeNull();
    expect(fake.loadGroup).not.toHaveBeenCalled();
  });

  it("maps a lookup query error to a safe load error", async () => {
    const fake = client({ data: null, error: new Error("secret database detail") });
    await expect(createGroupRepository(fake as never).findJoinedGroupByInviteToken(token)).rejects.toEqual(
      expect.objectContaining({ code: "LOAD_FAILED", message: "Unable to load the group." }),
    );
  });
});

describe("joined-group Supabase adapter", () => {
  it("selects only the id and filters by invite_token_hash", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const transport = { from: vi.fn(() => query) };
    const adapter = createSupabaseGroupRepositoryAdapter(transport as never);

    await adapter.findJoinedGroupId(expectedHash);

    expect(transport.from).toHaveBeenCalledWith("groups");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.eq).toHaveBeenCalledWith("invite_token_hash", expectedHash);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
    expect(query.select).not.toHaveBeenCalledWith(expect.stringContaining("invite_token_hash"));
  });
});

describe("previewGroupInvite", () => {
  function previewClient(result: { data: unknown; error: unknown }) {
    return {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "user-1" } } }, error: null }),
        signInAnonymously: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      previewGroupInvite: vi.fn(async () => result),
    };
  }

  it("maps exactly one safe invite preview row", async () => {
    const fake = previewClient({
      data: [{ group_id: "group-1", name: "なかまたち", member_count: 2, max_members: 30 }],
      error: null,
    });
    await expect(createGroupRepository(fake as never).previewGroupInvite(token)).resolves.toEqual({
      groupId: "group-1", name: "なかまたち", memberCount: 2, maxMembers: 30,
    });
    expect(fake.previewGroupInvite).toHaveBeenCalledWith({ p_invite_token: token });
  });

  it("returns null for zero rows and rejects unsafe cardinality/data", async () => {
    await expect(
      createGroupRepository(previewClient({ data: [], error: null }) as never).previewGroupInvite(token),
    ).resolves.toBeNull();
    await expect(
      createGroupRepository(previewClient({ data: [{}, {}], error: null }) as never).previewGroupInvite(token),
    ).rejects.toEqual(expect.objectContaining({ code: "INVALID_DATA" }));
    await expect(
      createGroupRepository(previewClient({ data: [{ group_id: "g", name: "x", member_count: -1, max_members: 30 }], error: null }) as never).previewGroupInvite(token),
    ).rejects.toEqual(expect.objectContaining({ code: "INVALID_DATA" }));
  });

  it("maps preview transport errors to a safe load error", async () => {
    await expect(
      createGroupRepository(previewClient({ data: null, error: new Error("secret") }) as never).previewGroupInvite(token),
    ).rejects.toEqual(expect.objectContaining({ code: "LOAD_FAILED", message: "Unable to load the group." }));
  });

  it("uses the typed preview RPC adapter", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const adapter = createSupabaseGroupRepositoryAdapter({ rpc } as never);
    await adapter.previewGroupInvite({ p_invite_token: token });
    expect(rpc).toHaveBeenCalledWith("get_group_invite_preview", { p_invite_token: token });
  });
});
