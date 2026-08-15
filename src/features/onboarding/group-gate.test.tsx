import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { GroupAggregate } from "@/lib/supabase/group-repository";
import { GroupGate } from "./group-gate";

const token = "d".repeat(64);
const aggregate = {
  group: { id: "g1", name: "なかまたち", maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
  members: [{ id: "m1" }, { id: "m2" }],
  unlocks: [],
} as unknown as GroupAggregate;

describe("GroupGate", () => {
  it.each(["ABC", "a".repeat(63), "A".repeat(64), "../secret"])(
    "rejects malformed tokens before repository/network access: %s",
    async (invalidToken) => {
      const repositoryFactory = vi.fn();
      render(<GroupGate inviteToken={invalidToken} repositoryFactory={repositoryFactory} />);
      expect(screen.getByRole("heading", { name: "招待リンクが無効です" })).toBeInTheDocument();
      expect(repositoryFactory).not.toHaveBeenCalled();
    },
  );

  it("shows loading then renders the Task 8 graph seam for an existing member", async () => {
    let resolve!: (value: GroupAggregate) => void;
    const findJoinedGroupByInviteToken = vi.fn(() => new Promise<GroupAggregate>((done) => { resolve = done; }));
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ findJoinedGroupByInviteToken } as never)} />);
    expect(screen.getByRole("status")).toHaveTextContent("参加状況を確認しています");
    resolve(aggregate);
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
    expect(screen.getByText("メンバー 2人")).toBeInTheDocument();
    expect(screen.getByTestId("relationship-graph-placeholder")).toHaveAttribute("data-task8-seam", "relationship-graph");
  });

  it("shows the join form for a nonmember", async () => {
    const findJoinedGroupByInviteToken = vi.fn(async () => null);
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ findJoinedGroupByInviteToken } as never)} />);
    expect(await screen.findByRole("heading", { name: "グループに招待されています" })).toBeInTheDocument();
  });

  it("shows a safe load error and retries", async () => {
    const user = userEvent.setup();
    const findJoinedGroupByInviteToken = vi.fn()
      .mockRejectedValueOnce(new Error("secret failure"))
      .mockResolvedValueOnce(aggregate);
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ findJoinedGroupByInviteToken } as never)} />);
    expect(await screen.findByText("グループを読み込めませんでした。通信環境を確認してください。")).toBeInTheDocument();
    expect(screen.queryByText("secret failure")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "もう一度試す" }));
    await waitFor(() => expect(findJoinedGroupByInviteToken).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
  });

  it("clears an existing member aggregate when the invite token changes", async () => {
    const secondToken = "e".repeat(64);
    const findJoinedGroupByInviteToken = vi.fn(async (value: string) =>
      value === token ? aggregate : null,
    );
    const repositoryFactory = () => ({ findJoinedGroupByInviteToken } as never);
    const view = render(<GroupGate inviteToken={token} repositoryFactory={repositoryFactory} />);
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();

    view.rerender(<GroupGate inviteToken={secondToken} repositoryFactory={repositoryFactory} />);

    expect(await screen.findByRole("heading", { name: "グループに招待されています" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "なかまたち" })).not.toBeInTheDocument();
    expect(findJoinedGroupByInviteToken).toHaveBeenLastCalledWith(secondToken);
  });
});
