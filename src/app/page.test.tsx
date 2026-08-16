import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("routes group creators to the combined group and profile form", () => {
    render(<Home />);

    const link = screen.getByRole("link", { name: "グループを作る" });
    expect(link).toHaveAttribute("href", "/create/profile");
    expect(screen.queryByRole("form", { name: "グループ名入力フォーム" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ニックネーム")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("生年月日")).not.toBeInTheDocument();
  });

  it("uses the approved Kawaii Zine headline and zodiac sticker copy", () => {
    render(<Home />);

    const homeLink = screen.getByRole("link", { name: "MofuType ホーム" });
    expect(homeLink.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("mofutype-wordmark.png"),
    );
    expect(
      screen.getByRole("heading", { name: "わたしたち、こんな感じ。" }),
    ).toBeInTheDocument();
    expect(screen.getByText("#MBTI")).toBeInTheDocument();
    expect(screen.getByText("#12干支")).toBeInTheDocument();
    expect(screen.queryByText("GROUP EDITION")).not.toBeInTheDocument();
    expect(screen.queryByText("性格タイプ × 十二支キャラクター")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "グループを作る" })).toHaveAttribute(
      "href",
      "/create/profile",
    );
  });

  it("keeps editorial decoration out of the accessibility tree", () => {
    const { container } = render(<Home />);

    for (const selector of [
      ".hero__cutout",
      ".hero__issue-note",
    ]) {
      expect(container.querySelector(selector)).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  it("places the group CTA before the editorial service explanation", () => {
    const { container } = render(<Home />);

    expect(
      screen.queryByText("誕生日と性格タイプで、友だちとの空気感を一枚の関係マップに。"),
    ).not.toBeInTheDocument();

    const cta = screen.getByRole("link", { name: "グループを作る" });
    const explainer = screen.getByRole("region", { name: "MofuTypeって？" });
    expect(cta.compareDocumentPosition(explainer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(container.querySelector(".service-flow__line")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("わたしを知る")).toBeInTheDocument();
    expect(screen.getByText("みんなをつなぐ")).toBeInTheDocument();
    expect(screen.getByText("違いを楽しむ")).toBeInTheDocument();
    expect(screen.getByText(
      "生年月日からわかる十二支に、出生時刻とMBTIを重ねて、自分らしいタイプへ。",
    )).toBeInTheDocument();
  });
});
