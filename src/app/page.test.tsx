import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("links its call to action to an existing section and renders real creation onboarding", () => {
    render(<Home />);

    const link = screen.getByRole("link", { name: "できることを見る" });
    const targetId = link.getAttribute("href")?.replace(/^#/, "");

    expect(targetId).toBeTruthy();
    expect(document.getElementById(targetId!)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "グループ作成フォーム" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "グループを作成" })).toBeInTheDocument();
  });
});
