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

  it("shows a detailed paid report sample without repeating the group CTA", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "まずは無料で、みんなの輪郭まで。" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0円")).toBeInTheDocument();
    expect(screen.getByText("1組 300円")).toBeInTheDocument();
    expect(screen.getByText("みんなの関係マップ")).toBeInTheDocument();
    expect(screen.getByText("ふたりでいるときのヒント")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "十二支の関係" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "五行と陰陽" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MBTIの4つの軸" })).toBeInTheDocument();
    expect(screen.getByText("違いが刺激になる関係")).toBeInTheDocument();
    expect(screen.getByText(/追加料金や自動更新はありません/)).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "AさんとBさんのサンプル" })).toBeInTheDocument();
    expect(screen.getByText("A × B")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "無料でグループを作る" })).not.toBeInTheDocument();
  });

  it("answers purchase questions without hiding essential information in decorative UI", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "始める前に、気になること。" })).toBeInTheDocument();
    expect(screen.getByText("何人まで使える？")).toBeInTheDocument();
    expect(screen.getByText("出生時刻やMBTIがわからなくても大丈夫？")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "特定商取引法に基づく表記" })).toHaveAttribute(
      "href",
      "/tokushoho",
    );
  });
});
