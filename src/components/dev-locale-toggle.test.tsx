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

  it("translates derived zodiac results from the local development JSON", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>たつタイプ</p>
        <p>金・陰</p>
        <p>大きな理想を掲げ、その存在感で新しい景色へ飛躍できる人です。</p>
        <p>たつタイプとして、生年月日から導いた傾向です。</p>
        <p><span>金</span>・<span>陰</span></p>
        <p><span>たつ</span>タイプとして、生年月日から導いた傾向です。</p>
        <DevLocaleToggle />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: "한국어로 보기" }));

    expect(screen.getByText("용띠 타입")).toBeInTheDocument();
    expect(screen.getByText("금・음")).toBeInTheDocument();
    expect(screen.getByText(/큰 이상을 품고/)).toBeInTheDocument();
    expect(screen.getByText("용띠 유형으로 생년월일에서 도출한 성향입니다.")).toBeInTheDocument();
    expect(screen.getByText("금")).toBeInTheDocument();
    expect(screen.getByText("음")).toBeInTheDocument();
    expect(screen.getByText(/용띠 유형으로 생년월일에서 도출한 성향입니다/)).toBeInTheDocument();
  });

  it("translates the detailed MBTI and four-pillars reading in local preview", async () => {
    const user = userEvent.setup();
    render(
      <>
        <h2>十二支の気質</h2>
        <h2>INTJの思考と行動</h2>
        <strong>I · エネルギー</strong>
        <p>ひとりで考える時間で心を整え、内側で考えを深めてから言葉にします。</p>
        <h2>火・陰の行動スタイル</h2>
        <p>情熱と表現力を軸に、心が動いたことを周りへあたたかく伝える傾向があります。</p>
        <h2>へび × INTJ × 火・陰</h2>
        <DevLocaleToggle />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: "한국어로 보기" }));

    expect(screen.getByRole("heading", { name: "십이지의 기질" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "INTJ의 사고와 행동" })).toBeInTheDocument();
    expect(screen.getByText("I · 에너지")).toBeInTheDocument();
    expect(screen.getByText(/혼자 생각하는 시간으로 마음을 정돈하고/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "화・음의 행동 스타일" })).toBeInTheDocument();
    expect(screen.getByText(/열정과 표현력을 중심으로/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "뱀띠 × INTJ × 화・음" })).toBeInTheDocument();
  });

  it("translates every relationship label used by the graph", async () => {
    const user = userEvent.setup();
    render(
      <>
        <span>息ぴったり</span>
        <span>可能性ひろがる</span>
        <span>いい刺激</span>
        <span>ペース発見</span>
        <DevLocaleToggle />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: "한국어로 보기" }));

    expect(screen.getByText("찰떡 호흡")).toBeInTheDocument();
    expect(screen.getByText("가능성이 넓어져요")).toBeInTheDocument();
    expect(screen.getByText("좋은 자극")).toBeInTheDocument();
    expect(screen.getByText("서로의 속도 발견")).toBeInTheDocument();
  });
});
