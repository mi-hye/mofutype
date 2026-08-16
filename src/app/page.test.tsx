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

  it("uses the approved Kawaii Zine headline and zodiac sticker copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "わたしたち、こんな感じ。" }),
    ).toBeInTheDocument();
    expect(screen.getByText("#MBTI")).toBeInTheDocument();
    expect(screen.getByText("性格タイプ × 十二支キャラクター")).toBeInTheDocument();
    expect(screen.getByText("#十二支")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "グループを作る" })).toHaveAttribute(
      "href",
      "#create",
    );
  });

  it("explains that birth time and MBTI refine the birth-year zodiac", () => {
    render(<Home />);

    expect(screen.getByText(
      "生年月日からわかる十二支に、出生時刻とMBTIを重ねて、あなたらしいタイプを見つけます。",
    )).toBeInTheDocument();
  });
});
