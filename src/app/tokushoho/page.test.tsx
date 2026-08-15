import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TokushohoPage from "./page";

describe("TokushohoPage", () => {
  it("shows the required Japanese commerce headings and a prominent development warning", () => {
    render(<TokushohoPage />);

    expect(screen.getByRole("heading", { name: "特定商取引法に基づく表記" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "実際の決済を開始する前に、正式な事業者情報へ必ず更新してください。",
    );
    for (const label of [
      "販売事業者",
      "運営責任者",
      "所在地",
      "電話番号",
      "メールアドレス",
      "販売価格",
      "支払方法・支払時期",
      "サービスの提供時期",
      "返品・キャンセル",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("関係レポート1件 300円（税込・予定）")).toBeInTheDocument();
    expect(screen.getByText(/現在はモック決済のみ/)).toBeInTheDocument();
  });
});
