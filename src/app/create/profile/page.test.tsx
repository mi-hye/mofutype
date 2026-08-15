import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CREATE_DRAFT_KEY } from "@/features/onboarding/create-group-form";
import { emptyProfileDraft } from "@/features/onboarding/profile-form";
import CreateProfilePage from "./page";

describe("CreateProfilePage", () => {
  beforeEach(() => {
    sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({
      groupName: "放課後クラブ",
      ...emptyProfileDraft(),
    }));
  });

  it("renders the second creation step with native profile controls", () => {
    render(<CreateProfilePage />);

    expect(screen.getByRole("heading", { name: "プロフィールを入力" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "プロフィール入力フォーム" })).toBeInTheDocument();
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("出生時刻")).toHaveAttribute("type", "time");
    expect(screen.getByRole("checkbox", { name: "出生時刻はわからない" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "グループ名を変更" })).toHaveAttribute("href", "/#create");
  });
});
