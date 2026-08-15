import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DerivedEtoProfile } from "@/lib/eto/types";
import { SupabaseConfigurationError } from "@/lib/supabase/browser";
import type { GroupAggregate } from "@/lib/supabase/group-repository";
import { JoinGroupForm, joinDraftKey } from "./join-group-form";

const token = "c".repeat(64);
const nextToken = "d".repeat(64);
const clock = () => new Date("2026-08-15T15:30:00.000Z");
const rawDate = "2000-02-29";
const rawTime = "09:05";
const profile: DerivedEtoProfile = {
  version: 1,
  zodiacId: "dragon",
  mbti: null,
  dayMaster: { element: "EARTH", polarity: "YANG" },
  fiveElements: { WOOD: 2, FIRE: 1, EARTH: 2, METAL: 1, WATER: 2 },
  yinYang: { YIN: 4, YANG: 4 },
  calculationMode: "date-only",
  boundaryState: "exact",
  engineVersion: "mofu-eto-four-pillars-v1",
};
const aggregate = {
  group: { id: "g1", name: "なかまたち", maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
  members: [],
  unlocks: [],
} satisfies GroupAggregate;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function recordingStorage(seed?: Record<string, string>, throwOnRemove = false) {
  const values = new Map(Object.entries(seed ?? {}));
  const getItem = vi.fn(() => { throw new Error("getItem must not be called"); });
  const setItem = vi.fn(() => { throw new Error("setItem must not be called"); });
  const removeItem = vi.fn((key: string) => {
    if (throwOnRemove) throw new Error("storage unavailable");
    values.delete(key);
  });
  return {
    storage: { getItem, setItem, removeItem } as unknown as Storage,
    values,
    getItem,
    setItem,
    removeItem,
  };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("ニックネーム"), "  もふ  ");
  fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: rawDate } });
  fireEvent.change(screen.getByLabelText("出生時刻"), { target: { value: rawTime } });
  await user.click(screen.getByRole("checkbox", { name: "出生時刻はわからない" }));
  await user.click(screen.getByRole("checkbox", { name: "MBTIはわからない" }));
}

function expectNoRawPersistence(recorder: ReturnType<typeof recordingStorage>) {
  expect(recorder.getItem).not.toHaveBeenCalled();
  expect(recorder.setItem).not.toHaveBeenCalled();
  expect([...recorder.values.values()].join(" ")).not.toMatch(/2000-02-29|09:05|もふ/);
}

describe("JoinGroupForm", () => {
  it("removes only the current invite legacy draft on mount without reading it", async () => {
    const recorder = recordingStorage({
      [joinDraftKey(token)]: JSON.stringify({ nickname: "保存した名前", birthDate: "1999-01-01" }),
    });

    render(<JoinGroupForm inviteToken={token} onJoined={vi.fn()} storage={recorder.storage} clock={clock} />);

    await waitFor(() => expect(recorder.removeItem).toHaveBeenCalledWith(joinDraftKey(token)));
    expect(screen.getByLabelText("ニックネーム")).toHaveValue("");
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("max", "2026-08-16");
    expectNoRawPersistence(recorder);
  });

  it("validates without storage reads or writes", () => {
    const recorder = recordingStorage();
    render(<JoinGroupForm inviteToken={token} onJoined={vi.fn()} storage={recorder.storage} clock={clock} repositoryFactory={vi.fn()} />);

    fireEvent.submit(screen.getByRole("form", { name: "グループ参加フォーム" }));

    expect(screen.getByText("ニックネームを入力してください")).toBeInTheDocument();
    expect(screen.getByText("正しい生年月日を入力してください")).toBeInTheDocument();
    expectNoRawPersistence(recorder);
  });

  it("normalizes unknown inputs, submits the exact new profile, clears memory, then joins", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const derive = vi.fn(async () => profile);
    const joinGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1" }));
    const loadGroup = vi.fn(async () => aggregate);
    const onJoined = vi.fn((value: GroupAggregate) => {
      expect(value).toBe(aggregate);
      expect(screen.getByLabelText("ニックネーム")).toHaveValue("");
      expect(screen.getByLabelText("生年月日")).toHaveValue("");
      expect(screen.getByLabelText("出生時刻")).toHaveValue("");
    });
    render(
      <JoinGroupForm inviteToken={token} onJoined={onJoined} storage={recorder.storage} clock={clock}
        etoProvider={{ derive }} repositoryFactory={() => ({ joinGroup, loadGroup } as never)} />,
    );
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "グループに参加" }));

    await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
    expect(derive).toHaveBeenCalledWith(
      { birthDate: rawDate, birthTime: null, mbti: null },
      "2026-08-16",
    );
    expect(joinGroup).toHaveBeenCalledWith({ inviteToken: token, nickname: "もふ", profile });
    expect(JSON.stringify(joinGroup.mock.calls)).not.toMatch(/2000-02-29|09:05|birth/i);
    expect(loadGroup).toHaveBeenCalledWith("g1");
    expectNoRawPersistence(recorder);
  });

  it.each([
    ["provider", "プロフィールを作成できませんでした。入力内容を確認してください。"],
    ["repository", "グループに参加できませんでした。通信環境を確認して、もう一度お試しください。"],
    ["callback", "参加したグループを表示できませんでした。ページを再読み込みしてください。"],
  ])("never persists inputs or exposes causes after a %s failure", async (failureAt, safeMessage) => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const secret = `${rawDate}-${rawTime}-秘密`;
    const derive = vi.fn(async () => {
      if (failureAt === "provider") throw new Error(secret);
      return profile;
    });
    const joinGroup = vi.fn(async () => {
      if (failureAt === "repository") throw Object.assign(new Error(secret), { code: "JOIN_FAILED" });
      return { groupId: "g1", memberId: "m1" };
    });
    const loadGroup = vi.fn(async () => aggregate);
    const onJoined = vi.fn(() => {
      if (failureAt === "callback") throw new Error(secret);
    });
    render(
      <JoinGroupForm inviteToken={token} onJoined={onJoined} storage={recorder.storage} clock={clock}
        etoProvider={{ derive }} repositoryFactory={() => ({ joinGroup, loadGroup } as never)} />,
    );
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "グループに参加" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(safeMessage);
    expect(screen.getByRole("alert")).not.toHaveTextContent(secret);
    expect(screen.getByLabelText("生年月日")).toHaveValue(failureAt === "callback" ? "" : rawDate);
    expectNoRawPersistence(recorder);
  });

  it.each([
    ["group is full", "このグループは定員に達しています。"],
    ["invalid or deleted invite token", "招待リンクが無効か、削除されています。"],
  ])("maps repository causes to safe Japanese: %s", async (causeMessage, expected) => {
    const user = userEvent.setup();
    const joinGroup = vi.fn(async () => {
      throw Object.assign(new Error("safe wrapper"), { code: "JOIN_FAILED", cause: { message: causeMessage } });
    });
    render(<JoinGroupForm inviteToken={token} clock={clock} repositoryFactory={() => ({ joinGroup } as never)} onJoined={vi.fn()} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByRole("alert")).not.toHaveTextContent(causeMessage);
  });

  it("continues when best-effort cleanup throws and blocks duplicate submits", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage({}, true);
    const pending = deferred<{ groupId: string; memberId: string }>();
    const joinGroup = vi.fn(() => pending.promise);
    render(
      <JoinGroupForm inviteToken={token} onJoined={vi.fn()} storage={recorder.storage} clock={clock}
        etoProvider={{ derive: async () => profile }}
        repositoryFactory={() => ({ joinGroup, loadGroup: async () => aggregate } as never)} />,
    );
    await fillValid(user);
    const submit = screen.getByRole("button", { name: "グループに参加" });

    await user.click(submit);
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(joinGroup).toHaveBeenCalledOnce();
    pending.resolve({ groupId: "g1", memberId: "m1" });
    await waitFor(() => expect(submit).not.toBeDisabled());
    expectNoRawPersistence(recorder);
  });

  it("prioritizes the actual Supabase configuration error class", async () => {
    const user = userEvent.setup();
    render(<JoinGroupForm inviteToken={token} clock={clock} repositoryFactory={() => { throw new SupabaseConfigurationError(); }} onJoined={vi.fn()} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("現在グループ参加を利用できません。設定を確認してください。");
  });

  it("has no post-unmount effects from a deferred derivation", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const pending = deferred<DerivedEtoProfile>();
    const joinGroup = vi.fn();
    const onJoined = vi.fn();
    const view = render(
      <JoinGroupForm inviteToken={token} onJoined={onJoined} storage={recorder.storage} clock={clock}
        etoProvider={{ derive: () => pending.promise }} repositoryFactory={() => ({ joinGroup } as never)} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));
    await waitFor(() => expect(recorder.removeItem).toHaveBeenCalledOnce());
    view.unmount();

    pending.resolve(profile);
    await pending.promise;
    await Promise.resolve();

    expect(joinGroup).not.toHaveBeenCalled();
    expect(onJoined).not.toHaveBeenCalled();
    expect(recorder.removeItem).toHaveBeenCalledOnce();
    expectNoRawPersistence(recorder);
  });

  it("invalidates an in-flight submit when the invite token is superseded", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const pending = deferred<DerivedEtoProfile>();
    const joinGroup = vi.fn();
    const onJoined = vi.fn();
    const view = render(
      <JoinGroupForm inviteToken={token} onJoined={onJoined} storage={recorder.storage} clock={clock}
        etoProvider={{ derive: () => pending.promise }} repositoryFactory={() => ({ joinGroup } as never)} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));

    view.rerender(
      <JoinGroupForm inviteToken={nextToken} onJoined={onJoined} storage={recorder.storage} clock={clock}
        etoProvider={{ derive: () => pending.promise }} repositoryFactory={() => ({ joinGroup } as never)} />,
    );
    await waitFor(() => expect(recorder.removeItem).toHaveBeenCalledWith(joinDraftKey(nextToken)));
    pending.resolve(profile);
    await pending.promise;
    await Promise.resolve();

    expect(joinGroup).not.toHaveBeenCalled();
    expect(onJoined).not.toHaveBeenCalled();
    expectNoRawPersistence(recorder);
  });
});
