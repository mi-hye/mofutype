import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CreateProfilePage from "./page";

describe("CreateProfilePage", () => {
  it("renders group and profile inputs together with native profile controls", () => {
    render(<CreateProfilePage />);

    expect(screen.getByRole("heading", { name: "グループを作る" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "グループ作成フォーム" })).toBeInTheDocument();
    expect(screen.getByLabelText("グループ名")).toBeInTheDocument();
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("出生時刻")).toHaveAttribute("type", "time");
    expect(screen.getByRole("checkbox", { name: "出生時刻はわからない" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "グループ名を変更" })).not.toBeInTheDocument();
  });
});
