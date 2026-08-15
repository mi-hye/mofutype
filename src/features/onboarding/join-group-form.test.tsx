import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupAggregate } from "@/lib/supabase/group-repository";
import { JoinGroupForm, joinDraftKey } from "./join-group-form";

const token = "c".repeat(64);
const aggregate = {
  group: { id: "g1", name: "なかまたち", maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
  members: [],
  unlocks: [],
} satisfies GroupAggregate;

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("ニックネーム"), "  もふ  ");
  fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: "2000-02-29" } });
  await user.click(screen.getByRole("checkbox", { name: "出生時刻はわからない" }));
  await user.click(screen.getByRole("checkbox", { name: "MBTIはわからない" }));
}

describe("JoinGroupForm", () => {
  beforeEach(() => sessionStorage.clear());

  it("communicates invitation, excludes group name, sends safe data and enters member state", async () => {
    const user = userEvent.setup();
    const joinGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1" }));
    const loadGroup = vi.fn(async () => aggregate);
    const onJoined = vi.fn();
    render(<JoinGroupForm inviteToken={token} repositoryFactory={() => ({ joinGroup, loadGroup } as never)} onJoined={onJoined} />);

    expect(screen.getByRole("heading", { name: "グループに招待されています" })).toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(aggregate));
    expect(joinGroup).toHaveBeenCalledWith({
      inviteToken: token,
      nickname: "もふ",
      profile: {
        version: 1,
        animalId: expect.any(String),
        animalGroup: expect.any(String),
        mbti: null,
        calculationMode: "date-only",
      },
    });
    expect(JSON.stringify(joinGroup.mock.calls)).not.toMatch(/2000-02-29|birth/i);
    expect(sessionStorage.getItem(joinDraftKey(token))).toBeNull();
  });

  it.each([
    ["group is full", "このグループは定員に達しています。"],
    ["invalid or deleted invite token", "招待リンクが無効か、削除されています。"],
  ])("maps RPC failures without exposing raw errors: %s", async (causeMessage, expected) => {
    const user = userEvent.setup();
    const joinGroup = vi.fn(async () => {
      throw Object.assign(new Error("safe wrapper"), {
        code: "JOIN_FAILED",
        cause: { message: causeMessage },
      });
    });
    render(<JoinGroupForm inviteToken={token} repositoryFactory={() => ({ joinGroup } as never)} onJoined={vi.fn()} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(causeMessage)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(joinDraftKey(token))).toContain("2000-02-29");
  });

  it("restores a failure draft and blocks double submit", async () => {
    sessionStorage.setItem(joinDraftKey(token), JSON.stringify({
      nickname: "保存した名前", birthDate: "1999-01-01", birthTimeKnown: false,
      birthTime: "", mbtiKnown: false, mbti: "",
    }));
    let reject!: (error: unknown) => void;
    const joinGroup = vi.fn(() => new Promise((_, fail) => { reject = fail; }));
    render(<JoinGroupForm inviteToken={token} repositoryFactory={() => ({ joinGroup } as never)} onJoined={vi.fn()} />);
    expect(screen.getByLabelText("ニックネーム")).toHaveValue("保存した名前");
    const user = userEvent.setup();
    const submit = screen.getByRole("button", { name: "グループに参加" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(joinGroup).toHaveBeenCalledOnce();
    reject(new Error("offline"));
    await screen.findByRole("alert");
  });

  it("does not persist raw data when local profile derivation fails", async () => {
    const user = userEvent.setup();
    const derive = vi.fn(async () => { throw new Error("local failure"); });
    render(
      <JoinGroupForm inviteToken={token} astrologyProvider={{ derive }}
        repositoryFactory={vi.fn()} onJoined={vi.fn()} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループに参加" }));
    await screen.findByRole("alert");
    expect(sessionStorage.getItem(joinDraftKey(token))).toBeNull();
  });

  it("enters member state and settles loading when successful draft cleanup throws", async () => {
    const user = userEvent.setup();
    const joinGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1" }));
    const loadGroup = vi.fn(async () => aggregate);
    const onJoined = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(() => { throw new Error("storage unavailable"); }),
    } as unknown as Storage;
    render(
      <JoinGroupForm inviteToken={token} repositoryFactory={() => ({ joinGroup, loadGroup } as never)}
        onJoined={onJoined} storage={storage} />,
    );
    await fillValid(user);
    const submit = screen.getByRole("button", { name: "グループに参加" });
    await user.click(submit);

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(aggregate));
    await waitFor(() => expect(submit).not.toBeDisabled());
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
