import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/landing/report-sample-graph", () => ({
  ReportSampleGraph: () => (
    <section aria-label="メンバー関係性グラフ">
      <p>Aさん × Bさんの関係だけをピックアップ。</p>
    </section>
  ),
}));

vi.mock("@/features/landing/landing-relationship-preview", () => ({
  LandingRelationshipPreview: () => <div aria-hidden="true" />,
}));

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
      screen.queryByRole("heading", { name: "まずは無料で、みんなの輪郭まで。" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("0円")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "気になるふたりを、300円で深掘り。" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "十二支・五行・陰陽" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MBTIの4つの軸" })).toBeInTheDocument();
    expect(screen.getByText("違うペースが、")).toBeInTheDocument();
    expect(screen.getByText("いいリズムになる。")).toBeInTheDocument();
    expect(screen.getByText("惹かれ合う理由")).toBeInTheDocument();
    expect(screen.getByText("すれ違いのクセ")).toBeInTheDocument();
    expect(screen.getByText("もっと合うヒント")).toBeInTheDocument();
    expect(screen.getByText("追加料金なし。自動更新なし。")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "メンバー関係性グラフ" })).toBeInTheDocument();
    expect(screen.getByText("Aさん × Bさんの関係だけをピックアップ。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "無料でグループを作る" })).not.toBeInTheDocument();
  });

  it("answers purchase questions without hiding essential information in decorative UI", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "始める前に、気になること。" })).toBeInTheDocument();
    expect(screen.getByText("始める前に、")).toBeInTheDocument();
    expect(screen.getByText("気になること。")).toBeInTheDocument();
    expect(screen.getByText("何人まで使える？")).toBeInTheDocument();
    expect(screen.getByText("出生時刻やMBTIがわからなくても大丈夫？")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "特定商取引法に基づく表記" })).toHaveAttribute(
      "href",
      "/tokushoho",
    );
  });
});
