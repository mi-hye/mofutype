import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupShareControls } from "./group-share-controls";

const token = "a".repeat(64);

describe("GroupShareControls", () => {
  it("prefers Web Share with the minimal group payload", async () => {
    const user = userEvent.setup();
    const shareApi = vi.fn(async () => undefined);
    const writeClipboard = vi.fn(async () => undefined);
    render(
      <GroupShareControls
        groupName="なかよし"
        memberCount={3}
        inviteToken={token}
        origin="https://mofu.example"
        shareApi={shareApi}
        writeClipboard={writeClipboard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "招待リンクを共有" }));
    expect(shareApi).toHaveBeenCalledWith({
      title: "MofuType",
      text: "なかよしの関係マップに参加しよう。",
      url: `https://mofu.example/g/${token}?name=${encodeURIComponent("なかよし")}&count=3`,
    });
    expect(writeClipboard).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("共有しました");
  });

  it("falls back to clipboard and renders only one share action", async () => {
    const user = userEvent.setup();
    const writeClipboard = vi.fn(async () => undefined);
    render(
      <GroupShareControls
        groupName="なかよし"
        memberCount={3}
        inviteToken={token}
        origin="https://mofu.example"
        shareApi={null}
        writeClipboard={writeClipboard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "招待リンクを共有" }));
    expect(writeClipboard).toHaveBeenCalledWith(
      `https://mofu.example/g/${token}?name=${encodeURIComponent("なかよし")}&count=3`,
    );
    expect(screen.getByRole("status")).toHaveTextContent("招待リンクをコピーしました");
    expect(screen.getAllByRole("button", { name: "招待リンクを共有" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Xで共有" })).not.toBeInTheDocument();
    expect(screen.getByTestId("share-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows only a public failure and can retry after a rejected share", async () => {
    const user = userEvent.setup();
    const shareApi = vi.fn()
      .mockRejectedValueOnce(new Error("private platform details"))
      .mockResolvedValueOnce(undefined);
    render(
      <GroupShareControls
        groupName="なかよし"
        memberCount={3}
        inviteToken={token}
        origin="https://mofu.example"
        shareApi={shareApi}
        writeClipboard={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "招待リンクを共有" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "共有できませんでした。もう一度お試しください。",
    );
    expect(screen.queryByText(/private platform details/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "招待リンクを共有" }));
    expect(screen.getByRole("status")).toHaveTextContent("共有しました");
  });
});
