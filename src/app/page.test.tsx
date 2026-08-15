import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("links its call to action to an existing section and renders real creation onboarding", () => {
    render(<Home />);

    const link = screen.getByRole("link", { name: "グループを作る" });
    const targetId = link.getAttribute("href")?.replace(/^#/, "");

    expect(targetId).toBeTruthy();
    expect(document.getElementById(targetId!)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "グループ作成フォーム" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グループを作成" })).toBeInTheDocument();
  });

  it("uses the approved Kawaii Zine headline and sticker copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "わたしたち、こんな感じ。" }),
    ).toBeInTheDocument();
    expect(screen.getByText("#MBTI")).toBeInTheDocument();
    expect(screen.getByText("#動物うらない")).toBeInTheDocument();
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
