import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { GroupAggregate, GroupSubscriptionCallbacks } from "@/lib/supabase/group-repository";
import type { GroupMember, RelationUnlock } from "@/lib/supabase/models";

vi.mock("./group-graph", () => ({
  GroupGraph: ({ members, unlocks, onPairSelect }: {
    members: GroupMember[];
    unlocks: RelationUnlock[];
    onPairSelect(selection: unknown): void;
  }) => (
    <div data-testid="graph-state">
      members:{members.map((member) => `${member.id}:${member.nickname}`).join(",")};
      pairs:{members.length * (members.length - 1) / 2};
      unlocks:{unlocks.map((unlock) => `${unlock.id}:${unlock.status}`).join(",")}
      {members.length >= 2 ? (
        <button type="button" onClick={() => onPairSelect({
          pairKey: "a:b",
          memberIds: ["a", "b"],
          unlocked: false,
          relationship: {
            pairKey: "a:b",
            category: "NATURAL_INTERLOCK",
            categoryLabelJa: "自然にかみ合う関係",
            headlineJa: "たつとうさぎは、自然にかみ合う関係です",
            zodiacInsight: {
              relation: "LIUHE",
              category: "NATURAL_INTERLOCK",
              title: "自然に支え合う十二支",
              summary: "十二支の本文",
            },
            fiveElementInsight: {
              relation: "COMPLEMENT",
              category: "NATURAL_INTERLOCK",
              title: "五行を補い合う関係",
              summary: "五行と陰陽の本文",
            },
            mbtiInsight: null,
            tips: {
              togetherJa: "ふたりで試すヒント",
              forPersonAJa: "aへのヒント",
              forPersonBJa: "bへのヒント",
            },
          },
        })}>aとbの関係を選択</button>
      ) : null}
    </div>
  ),
}));

import { GroupScreen } from "./group-screen";

function member(id: string, nickname = id): GroupMember {
  return {
    id, groupId: "g1", userId: `u-${id}`, nickname,
    zodiacId: id === "b" ? "rabbit" : "dragon", mbti: null,
    profile: {
      version: 1,
      zodiacId: id === "b" ? "rabbit" : "dragon",
      mbti: null,
      dayMaster: { element: id === "b" ? "FIRE" : "WOOD", polarity: "YANG" },
      fiveElements: { WOOD: 2, FIRE: 2, EARTH: 1, METAL: 1, WATER: 2 },
      yinYang: { YIN: 4, YANG: 4 },
      calculationMode: "date-time",
      boundaryState: "exact",
      engineVersion: "mofu-eto-four-pillars-v1",
    },
    joinedAt: "2026-08-15T00:00:00Z",
  };
}

function ambiguousMember(id: string, nickname = id): GroupMember {
  const base = member(id, nickname);
  return {
    ...base,
    zodiacId: "rooster",
    profile: {
      ...base.profile,
      zodiacId: "rooster",
      dayMaster: { element: "EARTH", polarity: "YIN" },
      fiveElements: null,
      yinYang: null,
      calculationMode: "date-only",
      boundaryState: "solar-term-ambiguous",
    },
  };
}

function unlock(id: string, status: RelationUnlock["status"] = "pending"): RelationUnlock {
  return {
    id, groupId: "g1", memberLowId: "a", memberHighId: "b", status,
    paymentProvider: "mock", paymentReference: null, unlockedBy: "a", unlockedAt: null,
  };
}

function aggregate(groupId = "g1", members = [member("a"), member("b")], unlocks: RelationUnlock[] = []): GroupAggregate {
  return {
    group: { id: groupId, name: `グループ${groupId}`, maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
    members: members.map((item) => ({ ...item, groupId })),
    unlocks: unlocks.map((item) => ({ ...item, groupId })),
  };
}

function repository(initial: GroupAggregate) {
  let callbacks: GroupSubscriptionCallbacks | undefined;
  const cleanup = vi.fn(async () => undefined);
  const loadGroup = vi.fn(async () => initial);
  const subscribeToGroup = vi.fn((_groupId: string, nextCallbacks: GroupSubscriptionCallbacks) => {
    callbacks = nextCallbacks;
    return cleanup;
  });
  return {
    api: { loadGroup, subscribeToGroup } as never,
    loadGroup,
    subscribeToGroup,
    cleanup,
    callbacks: () => callbacks,
  };
}

describe("GroupScreen", () => {
  it("keeps the group capsule and share actions in one aligned top row", () => {
    const initial = aggregate();
    const repo = repository(initial);

    render(<GroupScreen initialAggregate={initial} repository={repo.api} inviteToken="token-a" />);

    const topbar = screen.getByText("MofuType グループ").closest(".group-member-header__topbar");
    expect(topbar).not.toBeNull();
    expect(topbar?.querySelector(".group-member-actions")).not.toBeNull();
    expect(topbar).toContainElement(screen.getByRole("button", { name: "最新の情報に更新" }));
  });

  it("shows the signed-in member's derived astrology result below the graph", () => {
    const initial = aggregate("g1", [
      member("a", "わたし"),
      { ...member("b", "ともだち"), mbti: "ENTJ",
        profile: { ...member("b").profile, mbti: "ENTJ" } },
    ]);
    const repo = repository(initial);

    render(<GroupScreen initialAggregate={initial} repository={repo.api} currentUserId="u-b" />);

    expect(screen.getByText("わたしの四柱推命")).toBeInTheDocument();
    expect(screen.queryByText("MY PROFILE")).not.toBeInTheDocument();
    expect(screen.getByText("大胆に道を切り開くうさぎ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "十二支の気質" })).toBeInTheDocument();
    expect(screen.getByText(/豊かな感性と気配り/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ENTJの思考と行動" })).toBeInTheDocument();
    const mbtiAxes = screen.getByRole("list", { name: "MBTIの4つの視点" });
    expect(mbtiAxes).toHaveTextContent("E · エネルギー");
    expect(mbtiAxes).toHaveTextContent("N · 情報の捉え方");
    expect(mbtiAxes).toHaveTextContent("T · 判断の軸");
    expect(mbtiAxes).toHaveTextContent("J · 進め方");
    expect(screen.getByRole("heading", { name: "火・陽の行動スタイル" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "うさぎ × ENTJ × 火・陽" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "診断結果の詳細" })).toHaveTextContent("ENTJ火・陽出生時刻を反映");
    expect(screen.queryByText("たつタイプとして")).not.toBeInTheDocument();
  });

  it("keeps the personal result complete and neutral when MBTI is unknown", () => {
    const initial = aggregate("g1", [member("a", "わたし")]);
    const repo = repository(initial);

    render(<GroupScreen initialAggregate={initial} repository={repo.api} currentUserId="u-a" />);

    expect(screen.getByRole("heading", { name: "十二支の気質" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "木・陽の行動スタイル" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "たつ × 木・陽" })).toBeInTheDocument();
    expect(screen.queryByText(/MBTIの思考と行動/)).not.toBeInTheDocument();
    expect(screen.getByText("MBTI未設定")).toBeInTheDocument();
  });

  it("subscribes once with the group filter, refreshes initial data, and cleans up", async () => {
    const initial = aggregate();
    const repo = repository(initial);
    const view = render(<GroupScreen initialAggregate={initial} repository={repo.api} />);

    expect(repo.subscribeToGroup).toHaveBeenCalledOnce();
    expect(repo.subscribeToGroup).toHaveBeenCalledWith("g1", expect.any(Object));
    await waitFor(() => expect(repo.loadGroup).toHaveBeenCalledOnce());
    view.rerender(<GroupScreen initialAggregate={initial} repository={repo.api} />);
    expect(repo.subscribeToGroup).toHaveBeenCalledOnce();
    view.unmount();
    expect(repo.cleanup).toHaveBeenCalledOnce();
  });

  it("immutably upserts realtime member and unlock INSERT/UPDATE events", async () => {
    const initial = aggregate();
    const repo = repository(initial);
    render(<GroupScreen initialAggregate={initial} repository={repo.api} />);
    await waitFor(() => expect(repo.callbacks()).toBeDefined());

    act(() => repo.callbacks()?.onMemberChange?.({ eventType: "INSERT", new: member("c", "しろ") }));
    expect(screen.getByTestId("graph-state")).toHaveTextContent(/members:a:a,b:b,c:しろ;\s*pairs:3/);
    act(() => repo.callbacks()?.onMemberChange?.({ eventType: "UPDATE", new: member("c", "くろ") }));
    expect(screen.getByTestId("graph-state")).toHaveTextContent(/members:a:a,b:b,c:くろ;\s*pairs:3/);

    act(() => repo.callbacks()?.onUnlockChange?.({ eventType: "INSERT", new: unlock("u1") }));
    expect(screen.getByTestId("graph-state")).toHaveTextContent("unlocks:u1:pending");
    act(() => repo.callbacks()?.onUnlockChange?.({ eventType: "UPDATE", new: unlock("u1", "unlocked") }));
    expect(screen.getByTestId("graph-state")).toHaveTextContent("unlocks:u1:unlocked");
  });

  it("opens the pair report and shares a realtime unlock across two sessions", async () => {
    const user = userEvent.setup();
    const initial = aggregate();
    const firstRepository = repository(initial);
    const secondRepository = repository(initial);
    render(
      <>
        <section aria-label="セッションA">
          <GroupScreen initialAggregate={initial} repository={firstRepository.api} inviteToken="token-a" />
        </section>
        <section aria-label="セッションB">
          <GroupScreen initialAggregate={initial} repository={secondRepository.api} inviteToken="token-a" />
        </section>
      </>,
    );
    await waitFor(() => {
      expect(firstRepository.callbacks()).toBeDefined();
      expect(secondRepository.callbacks()).toBeDefined();
    });

    const sessionA = within(screen.getByRole("region", { name: "セッションA" }));
    const sessionB = within(screen.getByRole("region", { name: "セッションB" }));
    await user.click(sessionA.getByRole("button", { name: "aとbの関係を選択" }));
    await user.click(sessionB.getByRole("button", { name: "aとbの関係を選択" }));
    expect(sessionA.getByRole("link", { name: "このふたりを300円で解放" })).toHaveAttribute(
      "href",
      "/checkout/a%3Ab?invite=token-a",
    );
    expect(sessionB.getByRole("link", { name: "このふたりを300円で解放" })).toBeInTheDocument();

    const sharedUnlock = unlock("shared", "unlocked");
    act(() => {
      firstRepository.callbacks()?.onUnlockChange?.({ eventType: "INSERT", new: sharedUnlock });
      secondRepository.callbacks()?.onUnlockChange?.({ eventType: "INSERT", new: sharedUnlock });
    });

    expect(sessionA.getByText("解放済み")).toBeInTheDocument();
    expect(sessionB.getByText("解放済み")).toBeInTheDocument();
    expect(sessionA.queryByRole("link", { name: "このふたりを300円で解放" })).not.toBeInTheDocument();
    expect(sessionB.getByText("言葉を交わしながら互いに心地よい進み方を見つけていける組み合わせです。")).toBeInTheDocument();
  });

  it("recomputes an open relationship from the latest realtime member profiles", async () => {
    const user = userEvent.setup();
    const initial = aggregate("g1", [member("a"), member("b")], [unlock("open", "unlocked")]);
    const repo = repository(initial);
    render(<GroupScreen initialAggregate={initial} repository={repo.api} inviteToken="token-a" />);
    await waitFor(() => expect(repo.callbacks()).toBeDefined());
    await user.click(screen.getByRole("button", { name: "aとbの関係を選択" }));

    act(() => repo.callbacks()?.onMemberChange?.({
      eventType: "UPDATE",
      new: ambiguousMember("b", "更新もも"),
    }));

    expect(screen.getByRole("heading", {
      name: "たつととりは、自然にかみ合う関係です",
    })).toBeInTheDocument();
    expect(screen.getByText("互いの持ち味が無理なくかみ合い、自然な連携を育てやすい組み合わせです。")).toBeInTheDocument();
    expect(screen.getByText("木の視点を穏やかに伝え、相手の土の選択肢を広げましょう。")).toBeInTheDocument();
    expect(screen.getByText("節入りの境界に近いため、五行と陰陽の分布は表示していません。")).toBeInTheDocument();
    expect(screen.queryByText("十二支の本文")).not.toBeInTheDocument();
  });

  it("maps connection states to Japanese status and can retry", async () => {
    const user = userEvent.setup();
    const initial = aggregate();
    const repo = repository(initial);
    render(<GroupScreen initialAggregate={initial} repository={repo.api} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => repo.callbacks()?.onConnectionStatus?.("SUBSCRIBED"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => repo.callbacks()?.onConnectionStatus?.("TIMED_OUT"));
    expect(screen.getByRole("alert")).toHaveTextContent("オフライン");
    await user.click(screen.getByRole("button", { name: "接続を再試行" }));
    expect(repo.cleanup).toHaveBeenCalledOnce();
    expect(repo.subscribeToGroup).toHaveBeenCalledTimes(2);
  });

  it("periodically reconciles the snapshot while realtime is connected", async () => {
    vi.useFakeTimers();
    try {
      const initial = aggregate("g1", [member("a")]);
      const repo = repository(initial);
      const reconciled = aggregate("g1", [member("a"), member("b")]);
      repo.loadGroup
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(reconciled)
        .mockResolvedValueOnce(reconciled);
      render(<GroupScreen initialAggregate={initial} repository={repo.api} />);

      await act(async () => repo.callbacks()?.onConnectionStatus?.("SUBSCRIBED"));
      expect(repo.loadGroup).toHaveBeenCalledTimes(2);
      await act(async () => vi.advanceTimersByTimeAsync(5_000));

      expect(repo.loadGroup).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId("graph-state")).toHaveTextContent(/members:a:a,b:b;\s*pairs:1/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serializes periodic reconciliation and clears a recovered load error", async () => {
    vi.useFakeTimers();
    try {
      let resolveReconciliation!: (value: GroupAggregate) => void;
      const initial = aggregate("g1", [member("a")]);
      const repo = repository(initial);
      repo.loadGroup
        .mockRejectedValueOnce(new Error("temporary"))
        .mockImplementationOnce(() => new Promise<GroupAggregate>((resolve) => {
          resolveReconciliation = resolve;
        }))
        .mockResolvedValue(initial);
      render(<GroupScreen initialAggregate={initial} repository={repo.api} />);
      await act(async () => Promise.resolve());
      expect(screen.getByText("グループを更新できませんでした。通信環境を確認してください。")).toBeInTheDocument();

      act(() => repo.callbacks()?.onConnectionStatus?.("SUBSCRIBED"));
      await act(async () => vi.advanceTimersByTimeAsync(5_000));
      expect(repo.loadGroup).toHaveBeenCalledTimes(2);

      await act(async () => resolveReconciliation(initial));
      expect(screen.queryByText("グループを更新できませんでした。通信環境を確認してください。")).not.toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(30_000));
      expect(repo.loadGroup).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers manual refresh and hides raw load failures", async () => {
    const user = userEvent.setup();
    const initial = aggregate();
    const repo = repository(initial);
    repo.loadGroup.mockRejectedValueOnce(new Error("secret database detail"));
    render(<GroupScreen initialAggregate={initial} repository={repo.api} />);

    expect(await screen.findByText("グループを更新できませんでした。通信環境を確認してください。")).toBeInTheDocument();
    expect(screen.queryByText(/secret database detail/)).not.toBeInTheDocument();
    repo.loadGroup.mockResolvedValueOnce(aggregate("g1", [member("a"), member("b"), member("c")]));
    await user.click(screen.getByRole("button", { name: "最新の情報に更新" }));
    await waitFor(() => expect(screen.getByTestId("graph-state")).toHaveTextContent("pairs:3"));
  });

  it("merges a deferred initial snapshot with newer realtime member and unlock upserts", async () => {
    let resolveLoad!: (value: GroupAggregate) => void;
    let callbacks: GroupSubscriptionCallbacks | undefined;
    const initial = aggregate("g1", [member("a", "initial-a")], [unlock("u1")]);
    const repositoryApi = {
      loadGroup: vi.fn(() => new Promise<GroupAggregate>((resolve) => { resolveLoad = resolve; })),
      subscribeToGroup: vi.fn((_groupId: string, next: GroupSubscriptionCallbacks) => {
        callbacks = next;
        return vi.fn(async () => undefined);
      }),
    } as never;
    render(<GroupScreen initialAggregate={initial} repository={repositoryApi} />);

    act(() => {
      callbacks?.onMemberChange?.({ eventType: "UPDATE", new: member("a", "realtime-a") });
      callbacks?.onMemberChange?.({ eventType: "INSERT", new: member("c", "realtime-c") });
      callbacks?.onUnlockChange?.({ eventType: "UPDATE", new: unlock("u1", "unlocked") });
      callbacks?.onUnlockChange?.({ eventType: "INSERT", new: unlock("u2", "unlocked") });
    });
    await act(async () => resolveLoad(aggregate(
      "g1",
      [member("a", "snapshot-a"), member("b", "snapshot-b")],
      [unlock("u1", "failed"), unlock("snapshot-only", "pending")],
    )));

    expect(screen.getByTestId("graph-state")).toHaveTextContent(/members:a:realtime-a,b:snapshot-b,c:realtime-c/);
    expect(screen.getByTestId("graph-state")).toHaveTextContent(/unlocks:u1:unlocked,snapshot-only:pending,u2:unlocked/);
  });

  it("merges a deferred manual snapshot without losing concurrent realtime upserts", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: GroupAggregate) => void;
    let callbacks: GroupSubscriptionCallbacks | undefined;
    const initial = aggregate("g1", [member("a", "initial-a")], [unlock("u1")]);
    const loadGroup = vi.fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => new Promise<GroupAggregate>((resolve) => { resolveRefresh = resolve; }));
    const repositoryApi = {
      loadGroup,
      subscribeToGroup: vi.fn((_groupId: string, next: GroupSubscriptionCallbacks) => {
        callbacks = next;
        return vi.fn(async () => undefined);
      }),
    } as never;
    render(<GroupScreen initialAggregate={initial} repository={repositoryApi} />);
    await waitFor(() => expect(loadGroup).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("button", { name: "最新の情報に更新" }));
    act(() => {
      callbacks?.onMemberChange?.({ eventType: "UPDATE", new: member("a", "realtime-a") });
      callbacks?.onUnlockChange?.({ eventType: "UPDATE", new: unlock("u1", "unlocked") });
    });
    await act(async () => resolveRefresh(aggregate(
      "g1",
      [member("a", "snapshot-a"), member("b", "snapshot-b")],
      [unlock("u1", "failed"), unlock("snapshot-only", "pending")],
    )));

    expect(screen.getByTestId("graph-state")).toHaveTextContent(/members:a:realtime-a,b:snapshot-b/);
    expect(screen.getByTestId("graph-state")).toHaveTextContent(/unlocks:u1:unlocked,snapshot-only:pending/);
  });

  it("ignores an older initial-load failure after a newer manual load succeeds", async () => {
    const user = userEvent.setup();
    let rejectInitial!: (reason: unknown) => void;
    const initial = aggregate();
    const newer = aggregate("g1", [member("newer")]);
    const loadGroup = vi.fn()
      .mockImplementationOnce(() => new Promise<GroupAggregate>((_resolve, reject) => { rejectInitial = reject; }))
      .mockResolvedValueOnce(newer);
    const repositoryApi = {
      loadGroup,
      subscribeToGroup: vi.fn(() => vi.fn(async () => undefined)),
    } as never;
    render(<GroupScreen initialAggregate={initial} repository={repositoryApi} />);

    await user.click(screen.getByRole("button", { name: "最新の情報に更新" }));
    await waitFor(() => expect(screen.getByTestId("graph-state")).toHaveTextContent("members:newer:newer"));
    await act(async () => rejectInitial(new Error("older initial failure")));

    expect(screen.queryByText("グループを更新できませんでした。通信環境を確認してください。")).not.toBeInTheDocument();
  });

  it("ignores an older manual-load failure after a newer manual load succeeds", async () => {
    const user = userEvent.setup();
    let rejectOlderRefresh!: (reason: unknown) => void;
    const initial = aggregate();
    const newer = aggregate("g1", [member("newer")]);
    const loadGroup = vi.fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => new Promise<GroupAggregate>((_resolve, reject) => { rejectOlderRefresh = reject; }))
      .mockResolvedValueOnce(newer);
    const repositoryApi = {
      loadGroup,
      subscribeToGroup: vi.fn(() => vi.fn(async () => undefined)),
    } as never;
    render(<GroupScreen initialAggregate={initial} repository={repositoryApi} />);
    await waitFor(() => expect(loadGroup).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "最新の情報に更新" }));
    await user.click(screen.getByRole("button", { name: "最新の情報に更新" }));
    await waitFor(() => expect(screen.getByTestId("graph-state")).toHaveTextContent("members:newer:newer"));
    await act(async () => rejectOlderRefresh(new Error("older manual failure")));

    expect(screen.queryByText("グループを更新できませんでした。通信環境を確認してください。")).not.toBeInTheDocument();
  });

  it("ignores stale events and load results after a group change", async () => {
    let resolveFirst!: (value: GroupAggregate) => void;
    const first = aggregate("g1");
    const second = aggregate("g2", [member("x")]);
    const oldCallbacks: { value?: GroupSubscriptionCallbacks } = {};
    const cleanupFirst = vi.fn(async () => undefined);
    const cleanupSecond = vi.fn(async () => undefined);
    const repositoryApi = {
      loadGroup: vi.fn((groupId: string) => groupId === "g1"
        ? new Promise<GroupAggregate>((resolve) => { resolveFirst = resolve; })
        : Promise.resolve(second)),
      subscribeToGroup: vi.fn((groupId: string, callbacks: GroupSubscriptionCallbacks) => {
        if (groupId === "g1") oldCallbacks.value = callbacks;
        return groupId === "g1" ? cleanupFirst : cleanupSecond;
      }),
    } as never;
    const view = render(<GroupScreen initialAggregate={first} repository={repositoryApi} />);
    view.rerender(<GroupScreen initialAggregate={second} repository={repositoryApi} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "グループg2" })).toBeInTheDocument());

    act(() => oldCallbacks.value?.onMemberChange?.({ eventType: "INSERT", new: member("stale") }));
    await act(async () => resolveFirst(aggregate("g1", [member("stale-load")] )));
    expect(screen.getByTestId("graph-state")).toHaveTextContent(/members:x:x;\s*pairs:0/);
    expect(cleanupFirst).toHaveBeenCalledOnce();
  });
});
