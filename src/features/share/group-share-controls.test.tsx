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

  it("falls back to clipboard and exposes a safely encoded X intent", async () => {
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

    const xLink = screen.getByRole("link", { name: "Xで共有" });
    const xUrl = new URL(xLink.getAttribute("href")!);
    expect(xUrl.searchParams.get("text")).toBe("なかよしの関係マップに参加しよう。");
    expect(xUrl.searchParams.get("url")).toBe(
      `https://mofu.example/g/${token}?name=${encodeURIComponent("なかよし")}&count=3`,
    );
    expect(xLink).toHaveAttribute("rel", "noopener noreferrer");
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
