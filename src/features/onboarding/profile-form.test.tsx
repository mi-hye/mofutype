import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileForm, emptyProfileDraft } from "./profile-form";

describe("ProfileForm", () => {
  it("uses associated native date/time controls and a native 16-value MBTI select", () => {
    render(<ProfileForm value={emptyProfileDraft()} onChange={vi.fn()} errors={{}} />);

    expect(screen.getByLabelText("ニックネーム")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("生年月日")).toBeRequired();
    expect(screen.getByLabelText("出生時刻")).toHaveAttribute("type", "time");
    expect(screen.getByLabelText("MBTI").tagName).toBe("SELECT");
    expect(screen.getByLabelText("MBTI").querySelectorAll("option")).toHaveLength(17);
  });

  it("clears and disables time when わからない is selected", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = React.useState({ ...emptyProfileDraft(), birthTime: "10:30" });
      return <ProfileForm value={value} onChange={setValue} errors={{}} />;
    }
    const React = await import("react");
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: "出生時刻はわからない" }));

    expect(screen.getByLabelText("出生時刻")).toBeDisabled();
    expect(screen.getByLabelText("出生時刻")).toHaveValue("");
  });

  it("clears and disables MBTI when わからない is selected", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = React.useState({ ...emptyProfileDraft(), mbti: "ENFP" });
      return <ProfileForm value={value} onChange={setValue} errors={{}} />;
    }
    const React = await import("react");
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: "MBTIはわからない" }));

    expect(screen.getByLabelText("MBTI")).toBeDisabled();
    expect(screen.getByLabelText("MBTI")).toHaveValue("");
  });

  it("associates Japanese validation messages with their fields", () => {
    render(
      <ProfileForm
        value={emptyProfileDraft()}
        onChange={vi.fn()}
        errors={{ nickname: "ニックネームを入力してください" }}
      />,
    );
    expect(screen.getByLabelText("ニックネーム")).toHaveAccessibleDescription(
      "ニックネームを入力してください",
    );
  });
});
