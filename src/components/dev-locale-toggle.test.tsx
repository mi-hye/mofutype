import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { DevLocaleToggle } from "./dev-locale-toggle";

describe("DevLocaleToggle", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    document.documentElement.lang = "ja";
  });

  it("switches static and dynamically added Japanese UI copy to Korean", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>グループを作る</p>
        <button aria-label="最新の情報に更新">更新</button>
        <DevLocaleToggle />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: "한국어로 보기" }));

    expect(screen.getByText("그룹 만들기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "최신 정보로 새로고침" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "ko");

    const dynamic = document.createElement("p");
    dynamic.textContent = "共有しました";
    await act(async () => {
      document.body.append(dynamic);
      await Promise.resolve();
    });
    expect(screen.getByText("공유했습니다")).toBeInTheDocument();
    dynamic.remove();
  });

  it("restores the original Japanese copy", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>プロフィールを入力</p>
        <DevLocaleToggle />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: "한국어로 보기" }));
    await user.click(screen.getByRole("button", { name: "日本語で見る" }));

    expect(screen.getByText("プロフィールを入力")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "ja");
  });
});
