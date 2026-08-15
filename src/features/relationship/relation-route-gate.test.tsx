import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { GroupAggregate, GroupSubscriptionCallbacks } from "@/lib/supabase/group-repository";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";
import { RelationRouteGate } from "./relation-route-gate";

const token = "a".repeat(64);

function member(id: string, nickname: string, animalId: "fawn" | "sheep" = "fawn"): GroupMember {
  return {
    id,
    groupId: "g1",
    userId: `u-${id}`,
    nickname,
    animalId,
    animalGroup: "MOON",
    mbti: null,
    profile: {
      version: 1,
      animalId,
      animalGroup: "MOON",
      mbti: null,
      calculationMode: "date-only",
    },
    joinedAt: "2026-08-15T00:00:00Z",
  };
}

function unlocked(): RelationUnlock {
  return {
    id: "unlock-1",
    groupId: "g1",
    memberLowId: "a",
    memberHighId: "b",
    status: "unlocked",
    paymentProvider: "mock",
    paymentReference: null,
    unlockedBy: "a",
    unlockedAt: "2026-08-15T00:00:00Z",
  };
}

function aggregate(unlocks: RelationUnlock[] = []): GroupAggregate {
  return {
    group: { id: "g1", name: "なかよし", maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
    members: [member("a", "あお"), member("b", "もも", "sheep")],
    unlocks,
  };
}

function repository(group: GroupAggregate | null = aggregate()) {
  let callbacks: GroupSubscriptionCallbacks | undefined;
  const cleanup = vi.fn(async () => undefined);
  const api = {
    findJoinedGroupByInviteToken: vi.fn(async () => group),
    loadGroup: vi.fn(async () => {
      if (!group) throw new Error("missing group");
      return group;
    }),
    subscribeToGroup: vi.fn((_groupId: string, next: GroupSubscriptionCallbacks) => {
      callbacks = next;
      return cleanup;
    }),
    unlockPair: vi.fn(async () => unlocked()),
  };
  return { api, callbacks: () => callbacks, cleanup };
}

describe("RelationRouteGate", () => {
  it("loads the member pair and reuses the locked relation sheet", async () => {
    const repo = repository();
    render(
      <RelationRouteGate
        inviteToken={token}
        pairKey="a:b"
        mode="detail"
        repositoryFactory={() => repo.api as never}
      />,
    );

    expect(await screen.findByRole("heading", { name: /似たもの同士で話が早い/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "このふたりを300円で解放" })).toHaveAttribute(
      "href",
      `/checkout/a%3Ab?invite=${token}`,
    );
    expect(repo.api.findJoinedGroupByInviteToken).toHaveBeenCalledWith(token);
    expect(repo.api.subscribeToGroup).toHaveBeenCalledWith("g1", expect.any(Object));
  });

  it("rejects malformed invitations and pairs outside the joined group", async () => {
    const repositoryFactory = vi.fn(() => repository().api as never);
    const invalid = render(
      <RelationRouteGate inviteToken="bad" pairKey="a:b" mode="detail" repositoryFactory={repositoryFactory} />,
    );
    expect(screen.getByRole("heading", { name: "関係ページを開けません" })).toBeInTheDocument();
    expect(repositoryFactory).not.toHaveBeenCalled();

    invalid.rerender(
      <RelationRouteGate inviteToken={token} pairKey="a:missing" mode="detail" repositoryFactory={repositoryFactory} />,
    );
    expect(await screen.findByRole("heading", { name: "この関係は見つかりません" })).toBeInTheDocument();
  });

  it("updates an open shared detail when realtime reports the group unlock", async () => {
    const repo = repository();
    render(
      <RelationRouteGate
        inviteToken={token}
        pairKey="a:b"
        mode="detail"
        repositoryFactory={() => repo.api as never}
      />,
    );
    await screen.findByRole("link", { name: "このふたりを300円で解放" });
    await waitFor(() => expect(repo.callbacks()).toBeDefined());

    act(() => repo.callbacks()?.onUnlockChange?.({ eventType: "INSERT", new: unlocked() }));
    expect(screen.getByText("解放済み")).toBeInTheDocument();
    expect(screen.getByText(/同じ景色に反応しやすく/)).toBeInTheDocument();
  });

  it("does not lose an unlock received while closing the initial subscribe/load gap", async () => {
    let callbacks: GroupSubscriptionCallbacks | undefined;
    let resolveFresh!: (value: GroupAggregate) => void;
    const repositoryApi = {
      findJoinedGroupByInviteToken: vi.fn(async () => aggregate()),
      loadGroup: vi.fn(() => new Promise<GroupAggregate>((resolve) => { resolveFresh = resolve; })),
      subscribeToGroup: vi.fn((_groupId: string, next: GroupSubscriptionCallbacks) => {
        callbacks = next;
        return vi.fn(async () => undefined);
      }),
      unlockPair: vi.fn(async () => unlocked()),
    };
    render(
      <RelationRouteGate
        inviteToken={token}
        pairKey="a:b"
        mode="detail"
        repositoryFactory={() => repositoryApi as never}
      />,
    );
    await waitFor(() => expect(callbacks).toBeDefined());

    act(() => callbacks?.onUnlockChange?.({ eventType: "INSERT", new: unlocked() }));
    await act(async () => resolveFresh(aggregate()));

    expect(screen.getByText("解放済み")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "このふたりを300円で解放" })).not.toBeInTheDocument();
  });

  it("runs mock checkout and returns to the canonical shared detail", async () => {
    const user = userEvent.setup();
    const repo = repository();
    const navigate = vi.fn();
    render(
      <RelationRouteGate
        inviteToken={token}
        pairKey="a:b"
        mode="checkout"
        repositoryFactory={() => repo.api as never}
        navigate={navigate}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "モック決済を完了" }));
    expect(repo.api.unlockPair).toHaveBeenCalledWith("g1", "a", "b");
    expect(navigate).toHaveBeenCalledWith(`/g/${token}/relation/a%3Ab`);
  });

  it("cleans up its subscription when leaving the route", async () => {
    const repo = repository();
    const view = render(
      <RelationRouteGate
        inviteToken={token}
        pairKey="a:b"
        mode="detail"
        repositoryFactory={() => repo.api as never}
      />,
    );
    await waitFor(() => expect(repo.api.subscribeToGroup).toHaveBeenCalledOnce());
    view.unmount();
    expect(repo.cleanup).toHaveBeenCalledOnce();
  });
});
