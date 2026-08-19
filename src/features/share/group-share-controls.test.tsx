import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupShareControls } from "./group-share-controls";

const token = "a".repeat(64);

describe("GroupShareControls", () => {
  it("opens an accessible action sheet and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <GroupShareControls
        groupName="なかよし"
        memberCount={3}
        inviteToken={token}
        origin="https://mofu.example"
        shareApi={vi.fn(async () => undefined)}
        writeClipboard={vi.fn(async () => undefined)}
      />,
    );

    const trigger = screen.getByRole("button", { name: "招待リンクを共有" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "共有方法" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "リンクをコピー" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "共有方法" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

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
    await user.click(screen.getByRole("button", { name: "アプリで共有" }));
    expect(shareApi).toHaveBeenCalledWith({
      title: "MofuType",
      text: "なかよしの関係マップに参加しよう。",
      url: `https://mofu.example/g/${token}?name=${encodeURIComponent("なかよし")}&count=3`,
    });
    expect(writeClipboard).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("共有しました");
  });

  it("offers link copy without rendering a separate X action", async () => {
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
    await user.click(screen.getByRole("button", { name: "リンクをコピー" }));
    expect(writeClipboard).toHaveBeenCalledWith(
      `https://mofu.example/g/${token}?name=${encodeURIComponent("なかよし")}&count=3`,
    );
    expect(screen.getByRole("status")).toHaveTextContent("招待リンクをコピーしました");
    expect(screen.getAllByRole("button", { name: "招待リンクを共有" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Xで共有" })).not.toBeInTheDocument();
    expect(screen.getByTestId("share-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows copy feedback as a temporary body-level toast", async () => {
    vi.useFakeTimers();
    try {
      render(
        <GroupShareControls
          groupName="なかよし"
          memberCount={3}
          inviteToken={token}
          origin="https://mofu.example"
          shareApi={null}
          writeClipboard={vi.fn(async () => undefined)}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "招待リンクを共有" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "リンクをコピー" }));
        await Promise.resolve();
      });
      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("group-share-toast");
      expect(toast.parentElement).toBe(document.body);

      await act(async () => vi.advanceTimersByTimeAsync(2400));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to a user-gesture copy when the secure Clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");
    const nativeWrite = vi.fn(async () => { throw new Error("insecure context"); });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: nativeWrite },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    try {
      render(
        <GroupShareControls
          groupName="なかよし"
          memberCount={3}
          inviteToken={token}
          origin="http://192.168.1.118:3100"
          shareApi={null}
        />,
      );

      await user.click(screen.getByRole("button", { name: "招待リンクを共有" }));
      await user.click(screen.getByRole("button", { name: "リンクをコピー" }));

      expect(nativeWrite).toHaveBeenCalledOnce();
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(screen.getByRole("status")).toHaveTextContent("招待リンクをコピーしました");
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
      if (execCommandDescriptor) {
        Object.defineProperty(document, "execCommand", execCommandDescriptor);
      } else {
        Reflect.deleteProperty(document, "execCommand");
      }
    }
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
    await user.click(screen.getByRole("button", { name: "アプリで共有" }));
    const feedback = await screen.findByRole("alert");
    expect(feedback).toHaveClass("group-share-toast");
    expect(feedback).toHaveTextContent(
      "共有できませんでした。もう一度お試しください。",
    );
    expect(screen.queryByText(/private platform details/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "招待リンクを共有" }));
    await user.click(screen.getByRole("button", { name: "アプリで共有" }));
    expect(screen.getByRole("status")).toHaveTextContent("共有しました");
  });
});
