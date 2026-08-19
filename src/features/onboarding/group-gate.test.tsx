import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SupabaseConfigurationError } from "@/lib/supabase/browser";
import type { GroupAggregate, GroupInvitePreview } from "@/lib/supabase/group-repository";

const groupScreenProps = vi.hoisted(() => ({ current: null as null | { initialAggregate: GroupAggregate; repository?: unknown; currentUserId?: string } }));
vi.mock("@/features/group-graph/group-screen", () => ({
  GroupScreen: (props: { initialAggregate: GroupAggregate; repository?: unknown; currentUserId?: string }) => {
    groupScreenProps.current = props;
    return <main data-testid="group-screen"><h1>{props.initialAggregate.group.name}</h1><p>メンバー {props.initialAggregate.members.length}人</p></main>;
  },
}));

import { GroupGate } from "./group-gate";

const token = "d".repeat(64);
const aggregate = {
  group: { id: "g1", name: "なかまたち", maxMembers: 30, createdAt: "2026-08-15T00:00:00Z" },
  members: [{ id: "m1" }, { id: "m2" }],
  unlocks: [],
} as unknown as GroupAggregate;
const preview = {
  groupId: "g1", name: "なかまたち", memberCount: 2, maxMembers: 30,
} satisfies GroupInvitePreview;

describe("GroupGate", () => {
  it("renders the server-provided group and current member before the browser repository is ready", () => {
    render(
      <GroupGate
        inviteToken={token}
        initialAggregate={aggregate}
        currentUserId="server-user"
        repositoryFactory={() => ({
          previewGroupInvite: vi.fn(() => new Promise(() => undefined)),
          findJoinedGroupByInviteToken: vi.fn(),
        } as never)}
      />,
    );

    expect(screen.getByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
    expect(groupScreenProps.current?.currentUserId).toBe("server-user");
  });

  it.each(["ABC", "a".repeat(63), "A".repeat(64), "../secret"])(
    "rejects malformed tokens before repository/network access: %s",
    async (invalidToken) => {
      const repositoryFactory = vi.fn();
      render(<GroupGate inviteToken={invalidToken} repositoryFactory={repositoryFactory} />);
      expect(screen.getByRole("heading", { name: "招待リンクが無効です" })).toBeInTheDocument();
      expect(repositoryFactory).not.toHaveBeenCalled();
    },
  );

  it("previews first, then renders GroupScreen with the same repository for an existing member", async () => {
    let resolve!: (value: GroupAggregate) => void;
    const previewGroupInvite = vi.fn(async () => preview);
    const findJoinedGroupByInviteToken = vi.fn(() => new Promise<GroupAggregate>((done) => { resolve = done; }));
    const repository = { previewGroupInvite, findJoinedGroupByInviteToken } as never;
    render(<GroupGate inviteToken={token} repositoryFactory={() => repository} />);
    expect(screen.getByRole("status")).toHaveTextContent("参加状況を確認しています");
    await waitFor(() => expect(findJoinedGroupByInviteToken).toHaveBeenCalledOnce());
    expect(previewGroupInvite.mock.invocationCallOrder[0]).toBeLessThan(findJoinedGroupByInviteToken.mock.invocationCallOrder[0]);
    resolve(aggregate);
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
    expect(screen.getByText("メンバー 2人")).toBeInTheDocument();
    expect(screen.getByTestId("group-screen")).toBeInTheDocument();
    expect(groupScreenProps.current?.repository).toBe(repository);
  });

  it("shows safe preview metadata with the join form for a nonmember", async () => {
    const previewGroupInvite = vi.fn(async () => preview);
    const findJoinedGroupByInviteToken = vi.fn(async () => null);
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ previewGroupInvite, findJoinedGroupByInviteToken } as never)} />);
    expect(await screen.findByRole("heading", { name: "グループに招待されています" })).toBeInTheDocument();
    expect(screen.getByText("なかまたち")).toBeInTheDocument();
    expect(screen.getByText("メンバー 2 / 30人")).toBeInTheDocument();
    expect(screen.getByLabelText("生年月日")).toBeInTheDocument();
  });

  it("shows the join preview on an insecure LAN origin without Web Crypto", async () => {
    vi.stubGlobal("crypto", undefined);
    const previewGroupInvite = vi.fn(async () => preview);
    const findJoinedGroupByInviteToken = vi.fn(async () => aggregate);
    try {
      render(<GroupGate inviteToken={token} repositoryFactory={() => ({ previewGroupInvite, findJoinedGroupByInviteToken } as never)} />);

      expect(await screen.findByRole("heading", { name: "グループに招待されています" })).toBeInTheDocument();
      expect(findJoinedGroupByInviteToken).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows invalid/deleted before profile fields when a well-formed token has no preview", async () => {
    const previewGroupInvite = vi.fn(async () => null);
    const findJoinedGroupByInviteToken = vi.fn();
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ previewGroupInvite, findJoinedGroupByInviteToken } as never)} />);
    expect(await screen.findByRole("heading", { name: "招待リンクが無効か、削除されています" })).toBeInTheDocument();
    expect(screen.queryByLabelText("生年月日")).not.toBeInTheDocument();
    expect(findJoinedGroupByInviteToken).not.toHaveBeenCalled();
  });

  it("shows a full state before collecting profile data", async () => {
    const previewGroupInvite = vi.fn(async () => ({ ...preview, memberCount: 30 }));
    const findJoinedGroupByInviteToken = vi.fn(async () => null);
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ previewGroupInvite, findJoinedGroupByInviteToken } as never)} />);
    expect(await screen.findByRole("heading", { name: "このグループは定員に達しています" })).toBeInTheDocument();
    expect(screen.getByText("なかまたち")).toBeInTheDocument();
    expect(screen.queryByLabelText("生年月日")).not.toBeInTheDocument();
  });

  it("prioritizes actual configuration errors and retries safely", async () => {
    const user = userEvent.setup();
    const previewGroupInvite = vi.fn(async () => preview);
    const findJoinedGroupByInviteToken = vi.fn(async () => aggregate);
    const repositoryFactory = vi.fn()
      .mockImplementationOnce(() => { throw new SupabaseConfigurationError(); })
      .mockImplementation(() => ({ previewGroupInvite, findJoinedGroupByInviteToken }));
    render(<GroupGate inviteToken={token} repositoryFactory={repositoryFactory} />);
    expect(await screen.findByText("現在グループ参加を利用できません。設定を確認してください。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "もう一度試す" }));
    await waitFor(() => expect(repositoryFactory).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
  });

  it("hides network details and retries the preview flow", async () => {
    const user = userEvent.setup();
    const previewGroupInvite = vi.fn()
      .mockRejectedValueOnce(new Error("secret transport detail"))
      .mockResolvedValueOnce(preview);
    const findJoinedGroupByInviteToken = vi.fn(async () => aggregate);
    render(<GroupGate inviteToken={token} repositoryFactory={() => ({ previewGroupInvite, findJoinedGroupByInviteToken } as never)} />);
    expect(await screen.findByText("グループを読み込めませんでした。通信環境を確認してください。")).toBeInTheDocument();
    expect(screen.queryByText("secret transport detail")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "もう一度試す" }));
    await waitFor(() => expect(previewGroupInvite).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
  });

  it("clears an existing member aggregate when the invite token changes", async () => {
    const secondToken = "e".repeat(64);
    const previewGroupInvite = vi.fn(async () => preview);
    const findJoinedGroupByInviteToken = vi.fn(async (value: string) => value === token ? aggregate : null);
    const repositoryFactory = () => ({ previewGroupInvite, findJoinedGroupByInviteToken } as never);
    const view = render(<GroupGate inviteToken={token} repositoryFactory={repositoryFactory} />);
    expect(await screen.findByRole("heading", { name: "なかまたち" })).toBeInTheDocument();
    view.rerender(<GroupGate inviteToken={secondToken} repositoryFactory={repositoryFactory} />);
    expect(await screen.findByRole("heading", { name: "グループに招待されています" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "なかまたち" })).not.toBeInTheDocument();
    expect(findJoinedGroupByInviteToken).toHaveBeenLastCalledWith(secondToken);
  });
});
