import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EtoRelationshipResult } from "@/lib/eto/relationship";
import type { DerivedEtoProfile } from "@/lib/eto/types";
import { RelationSheet } from "./relation-sheet";

const exactProfile: DerivedEtoProfile = {
  version: 1,
  zodiacId: "dragon",
  mbti: "INFP",
  dayMaster: { element: "WOOD", polarity: "YANG" },
  fiveElements: { WOOD: 2, FIRE: 2, EARTH: 1, METAL: 1, WATER: 2 },
  yinYang: { YIN: 4, YANG: 4 },
  calculationMode: "date-time",
  boundaryState: "exact",
  engineVersion: "mofu-eto-four-pillars-v1",
};

const relationship: EtoRelationshipResult = {
  pairKey: "a:b",
  category: "NATURAL_INTERLOCK",
  categoryLabelJa: "自然にかみ合う関係",
  headlineJa: "たつとうさぎは、自然にかみ合う関係です",
  zodiacInsight: {
    relation: "LIUHE",
    category: "NATURAL_INTERLOCK",
    title: "自然に支え合う十二支",
    summary: "十二支の本文",
  },
  fiveElementInsight: {
    relation: "COMPLEMENT",
    category: "NATURAL_INTERLOCK",
    title: "五行を補い合う関係",
    summary: "五行と陰陽の本文",
  },
  mbtiInsight: {
    category: "EXPANDING_POSSIBILITIES",
    title: "考え方の重なりと違い",
    summary: "MBTIの本文",
    axes: {
      energyJa: "エネルギー軸の本文",
      informationJa: "情報軸の本文",
      decisionJa: "判断軸の本文",
      lifestyleJa: "生活軸の本文",
    },
  },
  tips: {
    togetherJa: "ふたりで試すヒント",
    forPersonAJa: "あおへのヒント",
    forPersonBJa: "ももへのヒント",
  },
};

const disclaimer =
  "この分析は自己理解とコミュニケーションを楽しむためのもので、科学的・医学的な判定ではありません。";

describe("RelationSheet", () => {
  it("shows the representative category and a private chapter outline while locked", () => {
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        memberProfiles={[exactProfile, exactProfile]}
        unlocked={false}
        checkoutHref="/checkout/a%3Ab?invite=token"
        detailHref="/g/token/relation/a%3Ab"
      />,
    );

    expect(screen.getByText(relationship.categoryLabelJa)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: relationship.headlineJa })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "この関係を詳しく見る 100円" })).toHaveAttribute(
      "href",
      "/checkout/a%3Ab?invite=token",
    );
    expect(screen.getByLabelText("ロック中の詳細")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "解放するとわかること" })).toBeInTheDocument();
    expect(screen.getByText("十二支・五行・陰陽・MBTIの読み解き")).toBeInTheDocument();
    expect(screen.getByText("ふたりでいるときのヒント")).toBeInTheDocument();
    expect(screen.getByText("1組 100円")).toBeInTheDocument();
    expect(screen.getByText("FREE PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("買い切り・追加料金なし・自動更新なし")).toBeInTheDocument();
    for (const chapter of [
      "十二支の関係",
      "五行と陰陽",
      "MBTIの4つの軸",
      "ふたりでいるとき",
      "それぞれへのヒント",
    ]) {
      expect(screen.getByText(chapter)).toBeInTheDocument();
    }
    expect(screen.getByText(disclaimer)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "この関係の共有ページ" })).toHaveAttribute(
      "href",
      "/g/token/relation/a%3Ab",
    );
    expect(screen.queryByText(relationship.zodiacInsight.summary)).not.toBeInTheDocument();
    expect(screen.queryByText(relationship.fiveElementInsight.summary)).not.toBeInTheDocument();
    expect(screen.queryByText(relationship.mbtiInsight?.summary ?? "")).not.toBeInTheDocument();
  });

  it("shows the typed relationship layers and directional tips after unlock", () => {
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        memberProfiles={[exactProfile, exactProfile]}
        unlocked
        checkoutHref="/checkout/a%3Ab?invite=token"
      />,
    );

    expect(screen.getByText("解放済み")).toBeInTheDocument();
    expect(screen.getByText(disclaimer)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "この関係を詳しく見る 100円" })).not.toBeInTheDocument();
    for (const heading of ["十二支の関係", "五行と陰陽", "MBTIの4つの軸", "ふたりでいるとき"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(relationship.zodiacInsight.title)).toBeInTheDocument();
    expect(screen.getByText(relationship.zodiacInsight.summary)).toBeInTheDocument();
    expect(screen.getByText(relationship.fiveElementInsight.title)).toBeInTheDocument();
    expect(screen.getByText(relationship.fiveElementInsight.summary)).toBeInTheDocument();
    expect(screen.getByText(relationship.mbtiInsight?.title ?? "")).toBeInTheDocument();
    for (const copy of Object.values(relationship.mbtiInsight?.axes ?? {})) {
      expect(screen.getByText(copy)).toBeInTheDocument();
    }
    expect(screen.getByText(relationship.tips.togetherJa)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "あおさんへのヒント" })).toBeInTheDocument();
    expect(screen.getByText(relationship.tips.forPersonAJa)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ももさんへのヒント" })).toBeInTheDocument();
    expect(screen.getByText(relationship.tips.forPersonBJa)).toBeInTheDocument();
  });

  it("treats missing MBTI as neutral unavailable information", () => {
    const withoutMbti = { ...relationship, mbtiInsight: null };
    render(
      <RelationSheet
        relationship={withoutMbti}
        memberNames={["あお", "もも"]}
        memberProfiles={[
          { ...exactProfile, mbti: null },
          exactProfile,
        ]}
        unlocked
        checkoutHref="#"
      />,
    );

    expect(screen.getByRole("heading", { name: "MBTIの4つの軸" })).toBeInTheDocument();
    expect(screen.getByText("MBTIが未入力のため、この層は表示していません。十二支と五行の分析には影響しません。")).toBeInTheDocument();
    expect(screen.queryByText(/ロック|有料|不足|不利/)).not.toBeInTheDocument();
  });

  it("uses typed boundary state for the solar-term note without inventing a balance claim", () => {
    const ambiguousProfile: DerivedEtoProfile = {
      ...exactProfile,
      mbti: null,
      fiveElements: null,
      yinYang: null,
      calculationMode: "date-only",
      boundaryState: "solar-term-ambiguous",
    };
    render(
      <RelationSheet
        relationship={{ ...relationship, mbtiInsight: null }}
        memberNames={["あお", "もも"]}
        memberProfiles={[ambiguousProfile, exactProfile]}
        unlocked
        checkoutHref="#"
      />,
    );

    expect(screen.getByText("節入りの境界に近いため、五行と陰陽の分布は表示していません。")).toBeInTheDocument();
    expect(screen.queryByText(/バランスが整|均衡して|不足がない/)).not.toBeInTheDocument();
  });

  it("neutrally explains date-only analysis independent of solar-term ambiguity", () => {
    const dateOnlyExactProfile: DerivedEtoProfile = {
      ...exactProfile,
      calculationMode: "date-only",
      boundaryState: "exact",
    };
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        memberProfiles={[exactProfile, dateOnlyExactProfile]}
        unlocked={false}
        checkoutHref="#"
      />,
    );

    expect(screen.getByText("出生時刻を使わない分析です")).toBeInTheDocument();
    expect(screen.queryByText("節入りの境界に近いため、五行と陰陽の分布は表示していません。"))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/不利|不足|精度|ペナルティ/)).not.toBeInTheDocument();
  });

  it("omits the date-only note when both profiles use birth time", () => {
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        memberProfiles={[exactProfile, exactProfile]}
        unlocked
        checkoutHref="#"
      />,
    );

    expect(screen.queryByText("出生時刻を使わない分析です")).not.toBeInTheDocument();
  });

  it("does not infer a solar-term boundary from insight prose", () => {
    render(
      <RelationSheet
        relationship={{
          ...relationship,
          fiveElementInsight: {
            ...relationship.fiveElementInsight,
            summary: "solar-term-ambiguousという文字を含む通常の説明",
          },
        }}
        memberNames={["あお", "もも"]}
        memberProfiles={[exactProfile, exactProfile]}
        unlocked
        checkoutHref="#"
      />,
    );

    expect(screen.queryByText("節入りの境界に近いため、五行と陰陽の分布は表示していません。")).not.toBeInTheDocument();
  });

  it("offers an accessible close action when embedded in the graph", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RelationSheet
        relationship={relationship}
        memberNames={["あお", "もも"]}
        memberProfiles={[exactProfile, exactProfile]}
        unlocked={false}
        checkoutHref="/checkout/a%3Ab?invite=token"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "関係詳細を閉じる" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
