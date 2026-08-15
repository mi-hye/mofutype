import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("starts group creation with only a group name before profile routing", () => {
    render(<Home />);

    const link = screen.getByRole("link", { name: "グループを作る" });
    const targetId = link.getAttribute("href")?.replace(/^#/, "");

    expect(targetId).toBeTruthy();
    expect(document.getElementById(targetId!)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "グループ名入力フォーム" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ：プロフィール入力" })).toBeInTheDocument();
    expect(screen.getByLabelText("グループ名")).toBeInTheDocument();
    expect(screen.queryByLabelText("ニックネーム")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("生年月日")).not.toBeInTheDocument();
  });

  it("uses the approved Kawaii Zine headline and sticker copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "わたしたち、こんな感じ。" }),
    ).toBeInTheDocument();
    expect(screen.getByText("#MBTI")).toBeInTheDocument();
    expect(screen.getByText("#12干支")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "グループを作る" })).toHaveAttribute(
      "href",
      "#create",
    );
  });

  it("keeps editorial decoration out of the accessibility tree", () => {
    const { container } = render(<Home />);

    for (const selector of [
      ".hero__cutout",
      ".hero__issue-note",
      ".create-section__tape",
    ]) {
      expect(container.querySelector(selector)).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });
});
